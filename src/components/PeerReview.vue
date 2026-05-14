<template>
  <div>
    <div class="alert alert-info" v-if='!hideHelperURL'>
      <b>URL ({{group}}, {{cluster}}):</b> <a target=_blank :href='url'>{{ url }}</a>
    </div>
    <div v-if='!loading'>
      <div class="alert alert-primary text-right">
        <button class="btn btn-primary" @click='getReviews()'>Refresh Reviews</button>
      </div>
    </div>
    <div v-if='error'>
      <exception :exception='errorData'></exception>
    </div>
    <div v-else-if='async'>
      <async-task :asyncData='asyncData'></async-task>
    </div>
    <div v-else-if='!loaded && loading'>
      <div class="text-center p-3"><div class="spinner-border text-primary" role="status"></div> Loading ...</div>
    </div>
    <div v-else>
      <table class="table table-sm table-bordered">
        <thead class='thead-light'>
          <tr>
            <th>Id</th>
            <th>Submitted From</th>
            <th>Submission Time</th>
            <th>Status</th>
            <th>Reason</th>
            <th>Requested Action</th>
            <th>[]</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if='reviews.length == 0'>
            <td colspan=6>No reviews found.</td>
          </tr>
          <tr v-for='r in reviews' :key='r.Id' v-else>
            <td>{{ r.Id }}</td>
            <td>{{ r.SubmitterAddress }}</td>
            <td>{{ (new Date(parseInt(r.SubmissionTimeMs, 10))).toString().substr(0, 34) }}</td>
            <td><span :class='statusLabel(r.Status)'>{{ r.Status }}</span></td>
            <td>{{ r.Reason }}</td>
            <td>
              <!-- {{ reconstructURL(r.EndpointWithParams, r.Id) }} -->
              {{ r.EndpointWithParams }}</td>
            <td>
              <template v-if='r.Status && r.Status.match(/PENDING_REVIEW/)'>
                <input type='checkbox' v-model='selectedIds' :value='r.Id'>
              </template>
            </td>
            <td>
              <button v-if='r.Status == "APPROVED"' @click.prevent='submitApprovedRequest(r)' class='btn btn-sm btn-info'>Submit Action</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="alert alert-warning" v-if='selectedIds.length > 0'>
        <input type="text" placeholder="Reason" v-model='actionReason'>
        <select v-model='actionName'>
          <option disabled value=''>Please select an action:</option>
          <option value='approve'>Approve</option>
          <option value='discard'>Discard</option>
        </select>
        <button class='btn btn-sm btn-primary' @click.prevent='doAction()'>Execute {{actionName}} On {{ selectedIds }}</button>
      </div>
        <div v-if='posted'>
          <div v-if='postResponse'>
            <button class="btn btn-info" @click='clearPostResponse'>Clear Response</button>
            <exception :exception='postResponse'></exception>
          </div>
          <div class='alert alert-success' v-else>
            Waiting for Response ...
          </div>
        </div>
    </div>
  </div>
</template>

<script>
import parse from 'url-parse'
import { ASYNC_RETRY_DELAY, ARGS_RETRY_MAX, ARGS_RETRY_DELAY } from '@/constants'
import fetchCC from '@/fetchCC'

export default {
  name: 'PeerReview',
  props: {
    group: String,
    cluster: String
  },
  data () {
    return {
      loading: false,
      loaded: false,
      error: false,
      errorData: null,
      async: false,
      asyncData: null,
      argsRetryTimer: null,
      asyncRetryTimer: null,
      selectedIds: [],
      actionName: '',
      actionReason: '',
      reviews: [],
      posted: false,
      postResponse: null
    }
  },
  created () {
    this.argsChanged()
  },
  beforeDestroy () {
    if (this.argsRetryTimer) {
      clearTimeout(this.argsRetryTimer)
    }
    if (this.asyncRetryTimer) {
      clearTimeout(this.asyncRetryTimer)
    }
  },
  watch: {
    group: function (ogroup, ngroup) {
      this.argsChanged()
    },
    cluster: function (ocluster, ncluster) {
      this.argsChanged()
    }
  },
  methods: {
    argsChanged (retries) {
      retries = retries || 0
      const newurl = this.$store.getters.getnewurl(this.group, this.cluster)
      if (!newurl) {
        if (retries < ARGS_RETRY_MAX) {
          this.argsRetryTimer = setTimeout(() => this.argsChanged(retries + 1), ARGS_RETRY_DELAY)
        }
        return
      }
      this.$store.commit('seturl', newurl)
      this.loaded = false
      if (this.asyncRetryTimer) {
        clearTimeout(this.asyncRetryTimer)
        this.asyncRetryTimer = null
      }
      this.getReviews()
    },
    getReviews () {
      const vm = this
      vm.loading = true
      vm.selectedIds = []
      fetchCC(vm.url).then((result) => {
        if (result.type === 'empty') {
          vm.loading = false
          vm.error = true
          vm.errorData = 'CruiseControl sent an empty response with ' + result.status + ' status code.'
        } else if (result.type === 'async') {
          vm.loading = false
          vm.async = true
          vm.asyncData = result.data
          if (vm.asyncRetryTimer) clearTimeout(vm.asyncRetryTimer)
          vm.asyncRetryTimer = setTimeout(() => vm.getReviews(), ASYNC_RETRY_DELAY)
        } else if (result.type === 'error') {
          if (vm.asyncRetryTimer) { clearTimeout(vm.asyncRetryTimer); vm.asyncRetryTimer = null }
          vm.loading = false
          vm.error = true
          vm.errorData = result.data
        } else {
          if (vm.asyncRetryTimer) { clearTimeout(vm.asyncRetryTimer); vm.asyncRetryTimer = null }
          vm.async = false
          vm.loading = false
          vm.error = false
          vm.errorData = null
          vm.reviews = result.data.RequestInfo || []
          vm.loaded = true
        }
      }).catch((e) => {
        if (vm.asyncRetryTimer) { clearTimeout(vm.asyncRetryTimer); vm.asyncRetryTimer = null }
        vm.loading = false
        vm.error = true
        vm.errorData = e.message || e
      })
    },
    doAction () {
      if (!this.actionName) return
      const vm = this
      vm.$http.post(vm.action_url, null, { withCredentials: true }).then((r) => {
        vm.getReviews()
      }).catch((e) => {
        vm.error = true
        vm.errorData = e && e.response ? e.response.data : (e.message || e)
      })
    },
    submitApprovedRequest (r) {
      const action = r.EndpointWithParams
      const absUrl = this.reconstructURL(action, r.Id)
      const vm = this
      vm.$http.post(absUrl, null, { withCredentials: true }).then((r) => {
        vm.posted = true
        vm.postResponse = r.data || 'Cruise Control Did not send a valid response. Check the server logs.'
        vm.getReviews()
      }, (e) => {
        vm.posted = true
        vm.postResponse = e || 'Cruise Control Did not send a valid response. Check the server logs.'
        vm.getReviews()
      })
    },
    statusLabel (s) {
      if (s === 'DISCARDED') {
        return 'badge badge-warning'
      } else if (s === 'APPROVED') {
        return 'badge badge-success'
      } else if (s === 'SUBMITTED') {
        return 'badge badge-primary'
      } else {
        return 'badge badge-secondary'
      }
    },
    reconstructURL (u, id) {
      const url = this.$store.state.url
      const parsed = parse(url + u, true)
      const existing = parsed.query || {}
      existing.review_id = id
      parsed.set('query', existing)
      return parsed.toString()
    },
    clearPostResponse () {
      this.posted = false
      this.postResponse = ''
    }
  },
  computed: {
    action_url () {
      // POST /kafkacruisecontrol/review?
      //    json=[true/false]
      //    &approve=[id1,id2,...]
      //    &discard=[id1,id2,...]
      //    &reason=[reason-for-review]
      const params = {
        json: true,
        reason: this.actionReason
      }
      params[this.actionName] = this.selectedIds
      return this.$helpers.getURL('review', params)
    },
    url () {
      const params = { json: 'true' }
      // Previously this end point is /review with POST method, in later versions its changed to /review_board with GET method
      // See https://github.com/linkedin/cruise-control/blob/3a97169c7a49859cf60675ef37a23e35ed35f30e/docs/wiki/User%20Guide/2-step-verification-for-POST-requests.md
      return this.$helpers.getURL('review_board', params)
    },
    hideHelperURL () {
      return this.$store.state.hideHelperURL
    }
  }
}
</script>

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
      <p>Loading ...</p>
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
              <template v-if='r.Status.match(/PENDING_REVIEW/)'>
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
      selectedIds: [],
      actionName: null,
      actionReason: '',
      reviews: [],
      posted: false,
      postResponse: null
    }
  },
  created () {
    this.getReviews()
  },
  methods: {
    argsChanged () {
      const newurl = this.$store.getters.getnewurl(this.group, this.cluster)
      this.$store.commit('seturl', newurl)
      this.loaded = false
      this.newurl = newurl
      this.getReviews()
    },
    getReviews () {
      let vm = this
      vm.loading = true
      vm.selectedIds = []
      vm.$http.get(vm.url, {withCredentials: true}).then((r) => {
        if (r.data === null || r.data === undefined || r.data === '') {
          vm.error = true
          vm.errorData = 'CruiseControl sent an empty response with 200-OK status code. Please file a bug here https://github.com/linkedin/cruise-control/issues'
        } else if (r.headers['content-type'].match(/text\/plain/) || r.data.progress) {
          vm.async = true
          vm.asyncData = r.data
        } else {
          vm.async = false
          vm.loading = false
          vm.error = false
          vm.errorData = null
          vm.reviews = r.data.RequestInfo || []
        }
      }, (e) => {
        vm.loading = false
        vm.error = true
        vm.errorData = e && e.response && e.response.data ? e.response.data : e
      })
    },
    doAction () {
      let vm = this
      vm.$http.post(vm.action_url, {withCredentials: true}).then((r) => {
        vm.getReviews()
      }, (e) => {
        console.log('Failed to submit.')
      })
    },
    submitApprovedRequest (r) {
      let action = r.EndpointWithParams
      let absUrl = this.reconstructURL(action, r.Id)
      let vm = this
      vm.$http.post(absUrl, {withCredentials: true}).then((r) => {
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
      var url = this.$store.state.url
      let parsed = parse(url + u)
      let params = {review_id: id}
      parsed.set('query', params)
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
      let params = {
        json: true,
        reason: this.actionReason
      }
      params[this.actionName] = this.selectedIds
      return this.$helpers.getURL('review', params)
    },
    url () {
      let params = {'json': 'true'}
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

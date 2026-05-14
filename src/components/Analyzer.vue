<!-- Copyright 2017-2019 LinkedIn Corp. Licensed under the BSD 2-Clause License (the "License"). See License in the project root for license information. -->
<template>
  <div>
    <div class="alert alert-info" v-if='!hideHelperURL'>
      <b>URL ({{group}}, {{cluster}}):</b> <a target=_blank :href='url'>{{ url }}</a>
    </div>
    <div v-if='!loading'>
      <div class="alert alert-primary text-right">
        <button class="btn btn-primary" @click='getState()'>Refresh Analyzer State</button>
        <button :class="['btn', autoRefresh ? 'btn-success' : 'btn-outline-secondary']" @click='toggleAutoRefresh()'>
          Auto-Refresh {{ autoRefresh ? 'ON (30s)' : 'OFF' }}
        </button>
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
      <div class="card-deck mb-3">
        <div class='card text-center'>
          <div class='card-header'>Analyzer</div>
          <div class='card-body'>
            <p class="card-text">
              <span :class="['badge', AnalyzerState.isProposalReady ? 'badge-success' : 'badge-info']">{{ !AnalyzerState.isProposalReady ? 'PROPOSAL_NOT_READY' : 'PROPOSALS_READY' }}</span>
            </p>
          </div>
        </div>
      </div>
      <div>
        <div v-if='AnalyzerState.goalReadiness.length > 0'>
          <table class="table table-sm table-bordered">
            <thead class="thead-light">
              <tr>
                <th>Goal</th>
                <th>Status</th>
                <th>Include All Topics</th>
                <th>Min Monitored Partition %</th>
                <th>Required Snapshots</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, idx) in AnalyzerState.goalReadiness" :key="idx">
                <td>{{ r.name }}</td>
                <td><boolean-el :label='r.status' /></td>
                <td><boolean-el :label='r.modelCompleteRequirement.includeAllTopics' /></td>
                <td>{{ r.modelCompleteRequirement.minMonitoredPartitionsPercentage }}</td>
                <td>{{ r.modelCompleteRequirement.requiredNumSnapshots }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import BooleanEL from '@/components/BooleanEL'
import { AUTO_REFRESH_INTERVAL, ASYNC_RETRY_DELAY, ARGS_RETRY_MAX, ARGS_RETRY_DELAY } from '@/constants'
import fetchCC from '@/fetchCC'

export default {
  name: 'Analyzer',
  props: {
    group: String,
    cluster: String
  },
  components: {
    'boolean-el': BooleanEL
  },
  data () {
    return {
      loaded: false,
      loading: false,
      error: false,
      errorData: null,
      async: false, // when the server treats this request as async
      asyncData: null, // when the server treats the request as async and sends progress instead of actual response
      autoRefresh: true,
      autoRefreshInterval: null,
      argsRetryTimer: null,
      asyncRetryTimer: null,
      AnalyzerState: {
        isProposalReady: false,
        readyGoals: [],
        goalReadiness: []
      }
    }
  },
  created () {
    this.argsChanged()
  },
  beforeDestroy () {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval)
      this.autoRefreshInterval = null
    }
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
  computed: {
    hideHelperURL () {
      return this.$store.state.hideHelperURL
    },
    url () {
      return this.$helpers.getURL('state', { substates: 'ANALYZER', verbose: true })
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
      if (this.autoRefreshInterval) {
        clearInterval(this.autoRefreshInterval)
        this.autoRefreshInterval = null
      }
      if (this.asyncRetryTimer) {
        clearTimeout(this.asyncRetryTimer)
        this.asyncRetryTimer = null
      }
      this.getState()
      if (this.autoRefresh) {
        this.autoRefreshInterval = setInterval(() => {
          if (!this.loading) {
            this.getState()
          }
        }, AUTO_REFRESH_INTERVAL)
      }
    },
    toggleAutoRefresh () {
      if (this.autoRefresh) {
        clearInterval(this.autoRefreshInterval)
        this.autoRefreshInterval = null
        this.autoRefresh = false
      } else {
        this.autoRefresh = true
        this.autoRefreshInterval = setInterval(() => {
          if (!this.loading) {
            this.getState()
          }
        }, AUTO_REFRESH_INTERVAL)
      }
    },
    getState () {
      const vm = this
      vm.loading = true
      fetchCC(vm.url).then((result) => {
        if (result.type === 'empty') {
          vm.loading = false
          vm.error = true
          vm.errorData = 'CruiseControl sent an empty response with ' + result.status + ' status code.'
        } else if (result.type === 'async') {
          vm.loading = false
          vm.async = true
          vm.asyncData = result.data
          if (vm.autoRefreshInterval) { clearInterval(vm.autoRefreshInterval); vm.autoRefreshInterval = null }
          if (vm.asyncRetryTimer) clearTimeout(vm.asyncRetryTimer)
          vm.asyncRetryTimer = setTimeout(() => vm.getState(), ASYNC_RETRY_DELAY)
        } else if (result.type === 'error') {
          if (vm.asyncRetryTimer) { clearTimeout(vm.asyncRetryTimer); vm.asyncRetryTimer = null }
          vm.loading = false
          vm.error = true
          vm.errorData = result.data
        } else {
          if (vm.asyncRetryTimer) { clearTimeout(vm.asyncRetryTimer); vm.asyncRetryTimer = null }
          vm.async = false
          vm.error = false
          vm.errorData = null
          vm.loading = false
          const defaults = { isProposalReady: false, readyGoals: [], goalReadiness: [] }
          vm.$set(vm, 'AnalyzerState', Object.assign(defaults, result.data.AnalyzerState))
          vm.loaded = true
          if (vm.autoRefresh && !vm.autoRefreshInterval) {
            vm.autoRefreshInterval = setInterval(() => {
              if (!vm.loading) { vm.getState() }
            }, AUTO_REFRESH_INTERVAL)
          }
        }
      }).catch((e) => {
        if (vm.asyncRetryTimer) { clearTimeout(vm.asyncRetryTimer); vm.asyncRetryTimer = null }
        vm.loading = false
        vm.error = true
        vm.errorData = e.message || e
      })
    }
  }
}
</script>

<style scoped>
.card-columns {
  column-count: 6;
}
.fade-enter-active, .fade-leave-active {
  transition: opacity .5s
}
.fade-enter, .fade-leave-to  {
  opacity: 0
}
</style>

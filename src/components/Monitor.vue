<!-- Copyright 2017-2019 LinkedIn Corp. Licensed under the BSD 2-Clause License (the "License"). See License in the project root for license information. -->
<template>
  <div>
    <div class="alert alert-info" v-if='!hideHelperURL'>
      <b>URL ({{group}}, {{cluster}}):</b> <a target=_blank :href='url'>{{ url }}</a>
    </div>
    <div v-if='!loading'>
      <div class="alert alert-primary text-right">
        <button class="btn btn-primary" @click='bootstrapMetrics()'>Bootstrap Metrics</button>
        <button class="btn btn-primary" @click='getState()'>Refresh Monitor SubState</button>
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
        <div class="card text-center">
          <div class="card-header">Monitor</div>
          <div class="card-body  align-items-center d-flex justify-content-center">
            <p class="card-text" v-if='MonitorState.state == "LOADING"'><span class="badge badge-info">{{ MonitorState.state }} ({{ MonitorState.loadingProgressPct != null ? MonitorState.loadingProgressPct.toFixed(2) : '0.00' }})</span></p>
            <p class="card-text" v-else>
              <span :class="monitor_class">{{ MonitorState.state }}</span>
              <a class='pointer' @click.prevent='doAction()' :title='monitor_title'>&#x23ef;</a>
            </p>
          </div>
        </div>
        <div class="card text-center">
          <div class="card-header">Training</div>
          <div class="card-body  align-items-center d-flex justify-content-center">
            <span :class="['badge', MonitorState.trained === true ? 'badge-success': 'badge-info']">{{ MonitorState.trained === true ? 'TRAINED' : 'TRAINING' }} ({{ MonitorState.trainingPct != null ? MonitorState.trainingPct.toFixed(2) : '0.00' }} %)</span>
          </div>
        </div>
        <div class="card text-center">
          <div class="card-header">Snapshots</div>
          <div class="card-body">
            <div class="card-text"><h1 :class="[MonitorState.numMonitoredWindows < 1 ? 'text-info' : 'text-success']">{{ MonitorState.numMonitoredWindows }}</h1></div>
          </div>
        </div>
      </div>

      <div class="card-deck mb-3">
        <div class="card text-center">
          <div class="card-header">Total Kafka Partitions</div>
          <div class="card-body">
            <div class="card-text"><h1 :class="['text-center', MonitorState.numTotalPartitions < 1 ? 'text-info' : 'text-success']">{{ MonitorState.numTotalPartitions | formatNumber }}</h1></div>
          </div>
        </div>
        <div class="card text-center">
          <div class="card-header">Valid Kafka Partitions</div>
          <div class="card-body">
            <div class="card-text"><h1 :class="['text-center', MonitorState.numValidPartitions != MonitorState.numTotalPartitions ? 'text-info' : 'text-success']">{{ MonitorState.numValidPartitions | formatNumber }}</h1></div>
          </div>
        </div>
        <div class="card text-center">
          <div class="card-header">Flawed Kafka Partitions</div>
          <div class="card-body">
            <div class="card-text"><h1 :class="['text-center', MonitorState.numFlawedPartitions < 1 ? 'text-success' : 'text-info']">{{ MonitorState.numFlawedPartitions | formatNumber }}</h1></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { AUTO_REFRESH_INTERVAL, ASYNC_RETRY_DELAY, ARGS_RETRY_MAX, ARGS_RETRY_DELAY } from '@/constants'
import fetchCC from '@/fetchCC'

export default {
  name: 'Monitor',
  props: {
    group: String,
    cluster: String
  },
  components: {},
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
      MonitorState: {
        trainingPct: 0,
        trained: false,
        numFlawedPartitions: 0,
        monitoredWindows: {},
        state: null,
        numTotalPartitions: 0,
        numMonitoredWindows: 0,
        monitoringCoveragePct: 0,
        numValidPartitions: 0
      }
    }
  },
  created () {
    this.argsChanged()
  },
  beforeDestroy () {
    if (this.argsRetryTimer) {
      clearTimeout(this.argsRetryTimer)
    }
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval)
      this.autoRefreshInterval = null
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
      return this.$helpers.getURL('state', { substates: 'MONITOR', verbose: true })
    },
    bootstrapUrl () {
      return this.$helpers.getURL('bootstrap', { clearmetrics: true, start: 0 })
    },
    get_action_url () {
      if (this.MonitorState.state === 'PAUSED') {
        return this.$helpers.getURL('resume_sampling')
      } else {
        return this.$helpers.getURL('pause_sampling')
      }
    },
    monitor_title () {
      if (this.MonitorState.state === 'PAUSED') {
        return 'Resume monitor'
      } else {
        return 'Pause monitor'
      }
    },
    monitor_class () {
      if (this.MonitorState.state === 'PAUSED') {
        return 'badge badge-secondary'
      } else if (this.MonitorState.state === 'RUNNING') {
        return 'badge badge-success'
      } else if (this.MonitorState.state === 'STOPPED') {
        return 'badge badge-danger'
      } else {
        return 'badge badge-primary'
      }
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
          const defaults = { trainingPct: 0, trained: false, numFlawedPartitions: 0, monitoredWindows: {}, state: null, numTotalPartitions: 0, numMonitoredWindows: 0, monitoringCoveragePct: 0, numValidPartitions: 0 }
          vm.$set(vm, 'MonitorState', Object.assign(defaults, result.data.MonitorState))
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
    },
    bootstrapMetrics () {
      const vm = this
      fetchCC(vm.bootstrapUrl).then((result) => {
        if (result.type === 'error') {
          vm.error = true
          vm.errorData = (result.data && result.data.errorMessage) || result.data
        } else {
          vm.error = false
          vm.errorData = null
          alert('Bootstrap started, cruise control will now start to read historical metrics to get to ready state, please be patient')
        }
      }).catch((e) => {
        vm.error = true
        vm.errorData = e.message || e
        alert(e.message || e)
      })
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
    doAction () {
      const vm = this
      this.$http.post(vm.get_action_url, null, { withCredentials: true }).then((r) => {
        this.getState()
      }, (e) => {
        this.getState()
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
.pointer {cursor: pointer;}
</style>

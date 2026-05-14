<!-- Copyright 2017-2019 LinkedIn Corp. Licensed under the BSD 2-Clause License (the "License"). See License in the project root for license information. -->
<template>
  <div>
    <div class="alert alert-info" v-if='!hideHelperURL'>
      <b>URL ({{group}}, {{cluster}}):</b> <a target=_blank :href='url'>{{ url }}</a>
    </div>
    <div v-if='!loading'>
      <div class="alert alert-primary text-right">
        <button class="btn btn-primary" @click='getState()'>Refresh Anomaly Detector State</button>
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

      <div>
        <h4>Self Healing Status</h4>
        <table class="table table-sm table-bordered" >
          <tbody>
            <tr>
              <th>Healing Disabled For</th>
              <td>
                <b v-if='AnomalyDetectorState.selfHealingDisabled.length == 0'>None</b>
                <ul v-else class="list-group">
                  <li class="list-group-item" v-for='(d, idx) in AnomalyDetectorState.selfHealingDisabled' :key='idx'>{{ d }}</li>
                </ul>
              </td>
            </tr>
            <tr>
              <th>Healing Enabled For</th>
              <td>
                <b v-if='AnomalyDetectorState.selfHealingEnabled.length == 0'>None</b>
                <ul v-else class="list-group">
                  <li class="list-group-item" v-for='(d, idx) in AnomalyDetectorState.selfHealingEnabled' :key='idx'>{{ d }}</li>
                </ul>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if='AnomalyDetectorState.recentBrokerFailures && AnomalyDetectorState.recentBrokerFailures.length > 0'>
        <h4>Recent Broker Failures</h4>
        <table class="table table-sm table-bordered" >
          <thead>
            <tr>
              <th>DetectionTime</th>
              <th>Failed Brokers</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for='(r, ridx) in AnomalyDetectorState.recentBrokerFailures' :key='ridx'>
              <td>{{ r.detectionMs | formatLocalTime }} ago</td>
              <td>
                <ul class="list-group">
                  <li class="list-group-item d-flex justify-content-between align-items-center" v-for="(time, broker) in r.failedBrokersByTimeMs" :key='broker'>
                    {{ broker }}
                    <span class="badge badge-primary badge-pill">{{ time | formatLocalTime }} ago</span>
                  </li>
                </ul>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if='AnomalyDetectorState.recentGoalViolations && AnomalyDetectorState.recentGoalViolations.length > 0'>
        <h4>Recent Goal Violations</h4>
        <table class="table table-sm table-bordered">
          <thead>
            <tr>
              <th>DetectionTime</th>
              <th>Violated Goals</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, ridx) in AnomalyDetectorState.recentGoalViolations" :key='ridx'>
              <td>{{ r.detectionMs | formatLocalTime }} ago</td>
              <td>
                <!-- Depedning on the version of CC we use, two types of responses are being sent out -->
                <template v-if='r.hasOwnProperty("violatedGoals")'>
                  <ul class="list-group">
                    <li class="list-group-item list-group-item-danger" v-for="(g, gidx) in r.violatedGoals" :key='gidx'>{{ g }}</li>
                  </ul>
                </template>
                <template v-else>
                  <h5>Fixable</h5>
                  <ul class="list-group" v-if='r.fixableViolatedGoals.length > 0'>
                    <li class="list-group-item list-group-item-success" v-for="(g, gidx) in r.fixableViolatedGoals" :key='gidx'>{{ g }}</li>
                  </ul>
                  <div class="alert alert-info" v-else>None</div>
                  <h5>UnFixable</h5>
                  <ul class="list-group" v-if='r.unfixableViolatedGoals.length > 0'>
                    <li class="list-group-item list-group-item-danger" v-for="(g, gidx) in r.unfixableViolatedGoals" :key='gidx'>{{ g }}</li>
                  </ul>
                  <div class="alert alert-info" v-else>None</div>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if='AnomalyDetectorState.recentMetricAnomalies && AnomalyDetectorState.recentMetricAnomalies.length > 0'>
        <h4>Recent Metric Anomalies</h4>
        <table class="table table-sm table-bordered" >
          <thead>
            <tr>
              <th>DetectionTime</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for='(r, ridx) in AnomalyDetectorState.recentMetricAnomalies' :key='ridx'>
              <td>{{ r.detectionMs | formatLocalTime }} ago</td>
              <td>{{ r.description }}</td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>
  </div>
</template>

<script>
import { ASYNC_RETRY_DELAY, ARGS_RETRY_MAX, ARGS_RETRY_DELAY } from '@/constants'
import fetchCC from '@/fetchCC'

export default {
  name: 'AnomalyDetector',
  props: {
    group: String,
    cluster: String
  },
  data () {
    return {
      loaded: false,
      loading: false,
      error: false,
      errorData: null,
      async: false, // when the server treats this request as async
      asyncData: null, // when the server treats the request as async and sends progress instead of actual response
      argsRetryTimer: null,
      asyncRetryTimer: null,
      AnomalyDetectorState: {
        selfHealingDisabled: [],
        selfHealingEnabled: [],
        recentBrokerFailures: [],
        recentMetricAnomalies: [],
        recentGoalViolations: []
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
      return this.$helpers.getURL('state', { substates: 'ANOMALY_DETECTOR', verbose: true })
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
      this.getState()
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
          const defaults = { selfHealingDisabled: [], selfHealingEnabled: [], recentBrokerFailures: [], recentMetricAnomalies: [], recentGoalViolations: [] }
          vm.$set(vm, 'AnomalyDetectorState', Object.assign(defaults, result.data.AnomalyDetectorState))
          vm.loaded = true
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

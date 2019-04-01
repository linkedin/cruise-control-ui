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
    <div v-if='async'>
      <async-task :asyncData='asyncData'></async-task>
    </div>
    <div v-else-if='!loaded && loading'>
      <p>Loading ...</p>
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
                  <li class="list-group-item" v-for='d in AnomalyDetectorState.selfHealingDisabled'>{{ d }}</li>
                </ul>
              </td>
            </tr>
            <tr>
              <th>Healing Enabled For</th>
              <td>
                <b v-if='AnomalyDetectorState.selfHealingEnabled.length == 0'>None</b>
                <ul v-else class="list-group">
                  <li class="list-group-item" v-for='d in AnomalyDetectorState.selfHealingEnabled'>{{ d }}</li>
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
            <tr v-for='r in AnomalyDetectorState.recentBrokerFailures'>
              <td>{{ r.detectionMs | formatLocalTime }} ago</td>
              <td>
                <ul class="list-group">
                  <li class="list-group-item d-flex justify-content-between align-items-center" v-for="(time, broker) in r.failedBrokersByTimeMs">
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
            <tr v-for="r in AnomalyDetectorState.recentGoalViolations">
              <td>{{ r.detectionMs | formatLocalTime }} ago</td>
              <td>
                <!-- Depedning on the version of CC we use, two types of responses are being sent out -->
                <template v-if='r.hasOwnProperty("violatedGoals")'>
                  <ul class="list-group">
                    <li class="list-group-item list-group-item-danger" v-for="g in r.violatedGoals">{{ g }}</li>
                  </ul>
                </template>
                <template v-else>
                  <h5>Fixable</h5>
                  <ul class="list-group" v-if='r.fixableViolatedGoals.length > 0'>
                    <li class="list-group-item list-group-item-success" v-for="g in r.fixableViolatedGoals">{{ g }}</li>
                  </ul>
                  <div class="alert alert-info" v-else>None</div>
                  <h5>UnFixable</h5>
                  <ul class="list-group" v-if='r.unfixableViolatedGoals.length > 0'>
                    <li class="list-group-item list-group-item-danger" v-for="g in r.unfixableViolatedGoals">{{ g }}</li>
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
            <tr v-for='r in AnomalyDetectorState.recentMetricAnomalies'>
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
import BooleanEL from '@/components/BooleanEL'

export default {
  name: 'AnomalyDetector',
  props: {
    'group': String,
    'cluster': String
  },
  components: {
    BooleanEL
  },
  data () {
    return {
      loaded: false,
      loading: false,
      error: false,
      errorData: null,
      async: false, // when the server treats this request as async
      asyncData: null, // when the server treats the request as async and sends progress instead of actual response
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
      return this.$helpers.getURL('state', {substates: 'ANOMALY_DETECTOR', verbose: true})
    }
  },
  methods: {
    argsChanged () {
      const newurl = this.$store.getters.getnewurl(this.group, this.cluster)
      this.$store.commit('seturl', newurl)
      this.loaded = false
      this.getState()
    },
    getState () {
      const vm = this
      vm.loading = true
      vm.$http.get(vm.url, {withCredentials: true}).then((r) => {
        if (r.data === null || r.data === undefined || r.data === '') {
          vm.error = true
          vm.errorData = 'CruiseControl sent an empty response with 200-OK status code. Please file a bug here https://github.com/linkedin/cruise-control/issues'
        } else if (r.headers['content-type'].match(/text\/plain/) || r.data.progress) {
          vm.async = true
          vm.asyncData = r.data
        } else {
          vm.async = false
          vm.error = false
          vm.errorData = null
          vm.loading = false
          vm.$set(vm, 'AnomalyDetectorState', r.data.AnomalyDetectorState)
          vm.loading = false
          vm.loaded = true
        }
      }, (e) => {
        vm.loading = false
        vm.error = true
        vm.errorData = e && e.response && e.response.data ? e.response.data : e
      })
    },
    stopProposalExecution () {
      let vm = this
      // cancel the on-going proposal execution
      vm.$http.post(this.stopProposalExecutionURL, {withCredentials: true}).then((r) => {
        vm.errStopProsalExecution = false
        vm.okDataStopProposalExecution = r.data
      }, (e) => {
        vm.errStopProsalExecution = true
        vm.errDataStopProposalExecution = e && e.response && e.response.data ? e.response.data : e
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

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
      <div class="card-deck mb-3">
        <div class="card text-center">
          <div class="card-header">Monitor</div>
          <div class="card-body  align-items-center d-flex justify-content-center">
            <p class="card-text" v-if='MonitorState.state == "LOADING"'><span class="badge badge-info">{{ MonitorState.state }} ({{ MonitorState.loadingProgressPct.toFixed(2) }})</span></p>
            <p class="card-text" v-else>
              <span :class="monitor_class">{{ MonitorState.state }}</span>
              <a class='pointer' @click.prevent='doAction()' :title='monitor_title'>&#x23ef;</a>
            </p>
          </div>
        </div>
        <div class="card text-center">
          <div class="card-header">Training</div>
          <div class="card-body  align-items-center d-flex justify-content-center">
            <span :class="['badge', MonitorState.trained == 'false' ? 'badge-info': 'badge-success']">{{ MonitorState.trained == 'false' ? 'TRAINING' : 'TRAINED' }} ({{MonitorState.trainingPct.toFixed(2) }} %)</span>
          </div>
        </div>
        <div class="card text-center">
          <div class="card-header">Snapshots</div>
          <div class="card-body">
            <p class="card-text"><h1 :class="[MonitorState.numMonitoredWindows < 1 ? 'text-info' : 'text-success']">{{ MonitorState.numMonitoredWindows }}</h1></p>
          </div>
        </div>
      </div>

      <div class="card-deck mb-3">
        <div class="card text-center">
          <div class="card-header">Total Kafka Partitions</div>
          <div class="card-body">
            <p class="card-text"><h1 :class="['text-center', MonitorState.numTotalPartitions < 1 ? 'text-info' : 'text-success']">{{ MonitorState.numTotalPartitions | formatNumber }}</h1></p>
          </div>
        </div>
        <div class="card text-center">
          <div class="card-header">Valid Kafka Partitions</div>
          <div class="card-body">
            <p class="card-text"><h1 :class="['text-center', MonitorState.numValidPartitions != MonitorState.numTotalPartitions ? 'text-info' : 'text-success']">{{ MonitorState.numValidPartitions | formatNumber }}</h1></p>
          </div>
        </div>
        <div class="card text-center">
          <div class="card-header">Flawed Kafka Partitions</div>
          <div class="card-body">
            <p class="card-text"><h1 :class="['text-center', MonitorState.numFlawedPartitions < 1 ? 'text-success' : 'text-info']">{{ MonitorState.numFlawedPartitions | formatNumber }}</h1></p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import BooleanEL from '@/components/BooleanEL'

export default {
  name: 'Monitor',
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
      errStopProsalExecution: false, // true when stop propsal execution is success
      errDataStopProposalExecution: null, // err data of stop proposal execution
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
      return this.$helpers.getURL('state', {substates: 'MONITOR', verbose: true})
    },
    bootstrapUrl () {
      return this.$helpers.getURL('bootstrap', {clearmetrics: true, start: 0})
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
          vm.$set(vm, 'MonitorState', r.data.MonitorState)
          vm.loading = false
          vm.loaded = true
        }
      }, (e) => {
        vm.loading = false
        vm.error = true
        vm.errorData = e && e.response && e.response.data ? e.response.data : e
      })
    },
    bootstrapMetrics () {
      const vm = this
      vm.$http.get(vm.bootstrapUrl, {withCredentials: true}).then((r) => {
        alert('Bootstrap started, cruise control will now start to read historical metrics to get to ready state, please be patient')
      }, (e) => {
        alert(e.response.data.errorMessage)
      })
    },
    doAction () {
      let vm = this
      console.log(vm.get_action_url)
      this.$http.post(vm.get_action_url, {withCredentials: true}).then((r) => {
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

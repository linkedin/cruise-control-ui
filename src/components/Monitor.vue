<!-- Copyright 2017-2019 LinkedIn Corp. Licensed under the BSD 2-Clause License (the "License"). See License in the project root for license information. -->
<template>
  <div>
    <div class="alert alert-info" v-if='!hideHelperURL'>
      <b>URL ({{group}}, {{cluster}}):</b> <a target=_blank :href='url'>{{ url }}</a>
    </div>
    <div v-if='!loading'>
      <div class="alert alert-primary text-right">
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
            <p class="card-text" v-else><span :class="['badge', MonitorState.state == 'STOPPED' ? 'badge-danger': 'badge-success']">{{ MonitorState.state }}</span></p>
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
import Exception from '@/components/Exception'
import AsyncTask from '@/components/AsyncTask'
import AdminSampling from '@/components/AdminSampling'
import BooleanEL from '@/components/BooleanEL'

export default {
  name: 'Monitor',
  props: {
    'group': String,
    'cluster': String
  },
  components: {
    BooleanEL,
    Exception,
    AsyncTask,
    AdminSampling
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
        if (r.headers['content-type'].match(/text\/plain/) || r.data.progress) {
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
        vm.errorData = e && e.response ? e.response.data : e
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

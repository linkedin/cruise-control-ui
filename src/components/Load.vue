<!-- Copyright 2017-2019 LinkedIn Corp. Licensed under the BSD 2-Clause License (the "License"). See License in the project root for license information. -->
<template>
  <div>
    <div class="alert alert-info" v-if='!hideHelperURL'>
      <b>URL ({{group}}, {{cluster}}):</b> <a target=_blank :href='url'>{{ url }}</a>
    </div>
    <div v-if='!loading'>
      <div class="alert alert-primary">
        <b>Flags: </b>
        <label>Allow Capacity Estimation:</label> <input type=checkbox v-model=allow_capacity_estimation>
        <button class="btn btn-primary float-right" @click='getLoad()'>Refresh Kafka Cluster Load</button>
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

      <host-load :hosts='hosts' :loading='loading' :error='error' :errorData='errorData'></host-load>
      <br>
      <broker-load :brokers='brokers' :loading='loading' :error='error' :errorData='errorData'></broker-load>
    </div>
  </div>
</template>

<script>
import HostLoad from '@/components/HostLoad'
import BrokerLoad from '@/components/BrokerLoad'

export default {
  name: 'Load',
  props: {
    group: String,
    cluster: String,
    rawdata: Object
  },
  data () {
    return {
      loading: false,
      loaded: false,
      error: false,
      errorData: null,
      async: false,
      asyncData: null,
      // params
      allow_capacity_estimation: true,
      // broker load & host load
      brokers: [],
      hosts: []
    }
  },
  created () {
    if (this.rawdata) {
      this.brokers = this.rawdata.brokers
      this.hosts = this.rawdata.hosts
    } else {
      this.getLoad(true)
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
    url () {
      // KCC Supports additional parameters as well.
      // time=[TIMESTAMP]
      // allow_capacity_estimation=[true/false]
      let params = {
        allow_capacity_estimation: this.allow_capacity_estimation
      }
      return this.$helpers.getURL('load', params)
    },
    hideHelperURL () {
      return this.$store.state.hideHelperURL
    }
  },
  methods: {
    argsChanged () {
      const newurl = this.$store.getters.getnewurl(this.group, this.cluster)
      this.$store.commit('seturl', newurl)
      this.loaded = false
      this.newurl = newurl
      this.getLoad()
    },
    getLoad () {
      let vm = this
      vm.loading = true
      let params = {
        withCredentials: true
      }
      // check if there is a running user-task-id for this end point in the $store
      // let task = this.$store.getters.getTaskId('proposals')
      let task = this.$store.getters.getTaskId(vm.url)
      if (task) {
        params['headers'] = {
          'User-Task-Id': task
        }
      }
      vm.$http.get(vm.url, params).then((r) => {
        if (r.data === null || r.data === undefined || r.data === '') {
          vm.error = true
          vm.errorData = 'CruiseControl sent an empty response with 200-OK status code. Please file a bug here https://github.com/linkedin/cruise-control/issues'
        } else if (r.headers['content-type'].match(/text\/plain/) || r.data.progress) {
          // capture the user-task-id only if the response is Async one
          let task = r.headers.hasOwnProperty('user-task-id') ? r.headers['user-task-id'] : null
          vm.$store.commit('setTaskId', {url: vm.url, taskid: task}) // save this task for follow-up calls (null deletes in vuex)
          vm.async = true
          vm.asyncData = r.data
        } else {
          vm.async = false
          vm.loading = false
          vm.error = false
          vm.errorData = null
          vm.brokers = r.data.brokers || []
          vm.hosts = r.data.hosts || []
        }
      }, (e) => {
        vm.loading = false
        vm.error = true
        vm.errorData = e && e.response && e.response.data ? e.response.data : e
      })
    }
  },
  components: {
    BrokerLoad,
    HostLoad
  }
}
</script>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity .5s
}
.fade-enter, .fade-leave-to  {
  opacity: 0
}
</style>

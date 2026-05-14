<!-- Copyright 2017-2019 LinkedIn Corp. Licensed under the BSD 2-Clause License (the "License"). See License in the project root for license information. -->
<template>
  <div>
    <div class="alert alert-info" v-if='!hideHelperURL'>
      <b>URL ({{group}}, {{cluster}}):</b> <a target=_blank :href='url'>{{ url }}</a>
    </div>
    <div>
      <div class="alert alert-primary">
        <b>Note:</b> Depending on the size of the kafka cluster, this request can generate load on Cruise Control and can even crash it.<hr>
        <button class="btn btn-sm btn-primary" @click='acceptTos()'>Show Me Replica Load Anyway.</button>
      </div>
    </div>
    <div v-if="error">
      <exception :exception='errorData'></exception>
    </div>
    <div v-else-if='async'>
      <async-task :asyncData='asyncData'></async-task>
    </div>
    <div v-else-if="!loaded && loading">
      <div class="text-center p-3"><div class="spinner-border text-primary" role="status"></div> Loading ...</div>
    </div>
    <div v-else-if="loaded && loading">
      Fetching New Data ...
    </div>
    <table class="table table-sm" v-else-if='racks.length > 0'>
      <thead>
        <tr>
          <th>Rack</th>
          <th>Host</th>
          <th>Broker</th>
          <th>Topic</th>
          <th>Leader</th>
          <th>Disk</th>
          <th>CPU</th>
          <th>NetIn</th>
          <th>NetOut</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="rack in racks">
          <template v-for="host in rack.hosts">
            <template v-for="broker in host.brokers">
              <tr v-if='!broker.replicas || broker.replicas.length === 0' :key="'empty-' + rack.rackid + '-' + broker.brokerid">
                <td>{{ rack.rackid }}</td>
                <td>{{ host.name | formatHost }}</td>
                <td>{{ broker.brokerid }}</td>
                <td colspan=6 class='alert alert-warning text-center'>No replica details available.</td>
              </tr>
              <template v-else v-for="replica in broker.replicas">
                <tr :key="broker.brokerid + '-' + replica.topic + '-' + replica.partition">
                  <td>{{ rack.rackid }}</td>
                  <td>{{ host.name | formatHost }}</td>
                  <td>{{ broker.brokerid }}</td>
                  <td>{{ replica.topic + '-' + replica.partition }}</td>
                  <td>{{ replica.isLeader }}</td>
                  <template v-if='replica.load && replica.load.snapshots && replica.load.snapshots.length > 0'>
                  <td>{{ replica.load.snapshots[0].disk | formatUnits }}</td>
                  <td>{{ replica.load.snapshots[0].cpu.toFixed(0) }}</td>
                  <td>{{ replica.load.snapshots[0].networkInbound | formatNetworkUnits }}</td>
                  <td>{{ replica.load.snapshots[0].networkOutbound | formatNetworkUnits }}</td>
                  </template>
                  <template v-else>
                  <td colspan=6 class='alert alert-warning text-center'>No Load data available.</td>
                  </template>
                </tr>
              </template>
            </template>
          </template>
        </template>
      </tbody>
    </table>
  </div>
</template>

<script>
import { ASYNC_RETRY_DELAY, ARGS_RETRY_MAX, ARGS_RETRY_DELAY } from '@/constants'
import fetchCC from '@/fetchCC'

export default {
  name: 'ReplicaLoad',
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
      tos: false,
      racks: []
    }
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
    url: function () {
      return this.$helpers.getURL('replicaload', { granularity: 'replica' })
    }
  },
  methods: {
    acceptTos () {
      this.tos = true
      this.getReplicaLoad()
    },
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
      if (this.tos) {
        this.getReplicaLoad()
      }
    },
    getReplicaLoad () {
      const vm = this
      vm.loading = true
      const fetchOptions = {}
      const task = this.$store.getters.getTaskId(vm.url)
      if (task) {
        fetchOptions.headers = { 'User-Task-ID': task }
      }
      fetchCC(vm.url, fetchOptions).then((result) => {
        if (result.type === 'empty') {
          vm.loading = false
          vm.error = true
          vm.errorData = 'CruiseControl sent an empty response with ' + result.status + ' status code.'
        } else if (result.type === 'async') {
          vm.loading = false
          const taskId = result.headers.has('user-task-id') ? result.headers.get('user-task-id') : null
          vm.$store.commit('setTaskId', { url: vm.url, taskid: taskId })
          vm.async = true
          vm.asyncData = result.data
          if (vm.asyncRetryTimer) clearTimeout(vm.asyncRetryTimer)
          // Only auto-retry if we have a task ID to poll; without one, each
          // retry starts a new expensive computation on CC.
          if (taskId) {
            vm.asyncRetryTimer = setTimeout(() => vm.getReplicaLoad(), ASYNC_RETRY_DELAY)
          }
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
          vm.racks = result.data.racks || []
          vm.loaded = true
          // Clear the cached task ID so the next request fetches fresh data
          vm.$store.commit('setTaskId', { url: vm.url, taskid: null })
        }
      }).catch((e) => {
        if (vm.asyncRetryTimer) { clearTimeout(vm.asyncRetryTimer); vm.asyncRetryTimer = null }
        vm.error = true
        vm.loading = false
        vm.racks = []
        vm.errorData = e.message || e
      })
    }
  }
}
</script>

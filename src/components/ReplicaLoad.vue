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
      Loading ...
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
            <template v-for="broker in host.brokers" v-if='broker.replicas.length > 0'>
              <template v-for="replica in broker.replicas">
                <tr>
                  <td>{{ rack.rackid }}</td>
                  <td>{{ host.name | formatHost }}</td>
                  <td>{{ broker.brokerid }}</td>
                  <td>{{ replica.topic + '-' + replica.partition }}</td>
                  <td>{{ replica.isLeader }}</td>
                  <template v-if='replica.load && replica.load.snapshots'>
                  <td>{{ replica.load.snapshots[0].disk | formatUnits }}</td>
                  <td>{{ replica.load.snapshots[0].cpu.toFixed(0) }}</td>
                  <td>{{ replica.load.snapshots[0].networkOutbound | formatNetworkUnits }}</td>
                  <td>{{ replica.load.snapshots[0].networkInbound | formatNetworkUnits }}</td>
                  </template>
                  <template v-else>
                  <td colspan=6 class='alert alert-warning text-center'>No Load data available.</td>
                  </template>
                </tr>
              </template>
            </template>
            <template v-for="broker in host.brokers" v-else>
              <tr>
                <td>{{ rack.rackid }}</td>
                <td>{{ host.name | formatHost }}</td>
                <td>{{ broker.brokerid }}</td>
                <td colspan=6 class='alert alert-warning text-center'>No replica details available.</td>
              </tr>
            </template>
          </template>
        </template>
      </tbody>
    </table>
  </div>
</template>

<script>
export default {
  name: 'ReplicaLoad',
  props: {
    group: String,
    cluster: String
  },
  data () {
    return {
      stopRefresh: false,
      loading: false,
      loaded: false,
      error: false,
      errorData: null,
      async: false,
      asyncData: null,
      tos: false,
      racks: []
    }
  },
  watch: {
    group: (ngroup) => {
      this.argsChanged()
    },
    cluster: (ncluster) => {
      this.argsChanged()
    }
  },
  computed: {
    hideHelperURL () {
      return this.$store.state.hideHelperURL
    },
    url: function () {
      return this.$helpers.getURL('replicaload', {granularity: 'replica'})
    }
  },
  methods: {
    acceptTos () {
      this.tos = true
      this.getReplicaLoad()
    },
    argsChanged () {
      const newurl = this.$store.getters.getnewurl(this.group, this.cluster)
      this.$store.commit('seturl', newurl)
      this.loaded = false
      this.newurl = newurl
      this.getReplicaLoad()
    },
    getReplicaLoad () {
      let vm = this
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
          vm.loading = false
          vm.error = false
          vm.errorData = null
          vm.racks = r.data.racks || []
          vm.loaded = true
        }
      }, (e) => {
        vm.error = true
        vm.loading = false
        vm.racks = []
        vm.errorData = e && e.response && e.response.data ? e.response.data : e
      })
    }
  }
}
</script>

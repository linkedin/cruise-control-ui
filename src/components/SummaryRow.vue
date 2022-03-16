<template>
  <tr>
    <td>{{ group }}</td>
    <td>{{ cluster }}</td>
    <td colspan=5 v-if='!loaded && loading'>
      Loading ...
    </td>
    <template v-else>
      <td>{{ stats_brokers }}</td>
      <td>{{ stats_leaders }}</td>
      <td>{{ stats_replicas }}</td>
      <td>{{ Number(stats_replicas / stats_leaders).toFixed(2) }}</td>
      <td>{{ stats_outofsync }}</td>
    </template>
  </tr>
</template>

<script>
export default {
  name: 'SummaryRow',
  props: [
    'group',
    'cluster',
    'url',
    'timeout' // Make sure this is valid number
  ],
  data () {
    return {
      timer: null,
      destroyed: true,
      req: null,
      loaded: false,
      loading: false,
      error: false,
      errorData: null,
      async: false,
      asyncData: null,
      stats: {
        brokers: 0,
        replicas: 0,
        leaders: 0,
        outofsync: 0
      },
      KafkaPartitionState: {
        offline: [],
        urp: [],
        'with-offline-replicas': [],
        'under-min-isr': []
      },
      KafkaBrokerState: {
        OfflineLogDirsByBrokerId: {},
        ReplicaCountByBrokerId: {},
        OutOfSyncCountByBrokerId: {},
        OnlineLogDirsByBrokerId: {},
        LeaderCountByBrokerId: {},
        OfflineReplicaCountByBrokerId: {}
      }
    }
  },
  mounted () {
    this.loading = true
    this.loaded = false
    this.getKafkaState()
  },
  beforeDestroy () {
    this.destroyed = true
    window.clearTimeout(this.timer)
  },
  methods: {
    poll () {
      let vm = this
      if (!vm.destroyed) {
        // after vm.timeout seconds fetch the data
        vm.timer = window.setTimeout(function () {
          vm.getKafkaState()
        }, vm.timeout)
      } else {
        console.log('destroyed. not calling timer again ...')
      }
    },
    getKafkaState () {
      const vm = this
      vm.loading = true
      let url = this.url + (this.url.endsWith('/') ? 'kafka_cluster_state' : '/kafka_cluster_state')
      vm.req = vm.$http.get(url, {params: {json: true}, withCredentials: true}).then((r) => {
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
          vm.loaded = true
          vm.KafkaPartitionState.offline = r.data.KafkaPartitionState.offline
          vm.KafkaPartitionState.urp = r.data.KafkaPartitionState.urp
          vm.KafkaBrokerState.ReplicaCountByBrokerId = r.data.KafkaBrokerState.ReplicaCountByBrokerId
          vm.KafkaBrokerState.OutOfSyncCountByBrokerId = r.data.KafkaBrokerState.OutOfSyncCountByBrokerId
          vm.KafkaBrokerState.LeaderCountByBrokerId = r.data.KafkaBrokerState.LeaderCountByBrokerId
          // only >= kafka 2.0 release
          try {
            vm.KafkaPartitionState['with-offline-replicas'] = r.data.KafkaPartitionState['with-offline-replicas']
            vm.KafkaPartitionState['under-min-isr'] = r.data.KafkaPartitionState['under-min-isr']
            vm.KafkaBrokerState.OfflineReplicaCountByBrokerId = r.data.KafkaBrokerState.OfflineReplicaCountByBrokerId
            vm.KafkaBrokerState.OfflineLogDirsByBrokerId = r.data.KafkaBrokerState.OfflineLogDirsByBrokerId
            vm.KafkaBrokerState.OnlineLogDirsByBrokerId = r.data.KafkaBrokerState.OnlineLogDirsByBrokerId
            console.log('Found Kafka-2.0 Features.')
          } catch (e) {
            console.log('No kafka 2.0 features found')
          }
        }
        vm.poll() // fetch the data again
      }, (e) => {
        vm.loading = false
        vm.error = true
        vm.errorData = e && e.response && e.response.data ? e.response.data : e
        vm.poll() // fetch the data again
      })
    }
  },
  computed: {
    stats_brokers () {
      return Object.keys(this.KafkaBrokerState.ReplicaCountByBrokerId).length
    },
    stats_leaders () {
      let nleaders = 0
      Object.values(this.KafkaBrokerState.LeaderCountByBrokerId).forEach(function (leaders) {
        nleaders += leaders
      })
      return nleaders
    },
    stats_replicas () {
      let nreplicas = 0
      Object.values(this.KafkaBrokerState.ReplicaCountByBrokerId).forEach(function (replicas) {
        nreplicas += replicas
      })
      return nreplicas
    },
    stats_outofsync () {
      let oos = 0
      Object.values(this.KafkaBrokerState.OutOfSyncCountByBrokerId).forEach(function (n) {
        oos += n
      })
      return oos
    }
  }
}
</script>

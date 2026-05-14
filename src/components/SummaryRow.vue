<template>
  <tr>
    <td>{{ group }}</td>
    <td>{{ cluster }}</td>
    <td colspan=5 v-if='!loaded && loading'>
      <div class="spinner-border spinner-border-sm text-primary" role="status"></div> Loading ...
    </td>
    <td colspan=5 v-else-if='error'>
      <span class="text-danger">Error loading data</span>
    </td>
    <td colspan=5 v-else-if='!loaded'>
      <span class="text-muted">Waiting for data...</span>
    </td>
    <template v-else>
      <td>{{ stats_brokers }}</td>
      <td>{{ stats_leaders }}</td>
      <td>{{ stats_replicas }}</td>
      <td>{{ stats_leaders > 0 ? Number(stats_replicas / stats_leaders).toFixed(2) : 'N/A' }}</td>
      <td>{{ stats_outofsync }}</td>
    </template>
  </tr>
</template>

<script>
import fetchCC from '@/fetchCC'

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
      destroyed: false,
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
      const vm = this
      if (!vm.destroyed) {
        // after vm.timeout seconds fetch the data
        vm.timer = window.setTimeout(function () {
          vm.getKafkaState()
        }, vm.timeout)
      } else {
        // destroyed, not calling timer again
      }
    },
    getKafkaState () {
      const vm = this
      vm.loading = true
      let url = this.url + (this.url.endsWith('/') ? 'kafka_cluster_state' : '/kafka_cluster_state')
      url += (url.indexOf('?') === -1 ? '?' : '&') + 'json=true'
      fetchCC(url).then((result) => {
        if (result.type === 'empty') {
          vm.loading = false
          vm.error = true
          vm.errorData = 'CruiseControl sent an empty response with ' + result.status + ' status code.'
        } else if (result.type === 'async') {
          vm.loading = false
          vm.async = true
          vm.asyncData = result.data
        } else if (result.type === 'error') {
          vm.loading = false
          vm.error = true
          vm.errorData = result.data
        } else {
          vm.async = false
          vm.error = false
          vm.errorData = null
          vm.loading = false
          vm.loaded = true
          const data = result.data
          vm.KafkaPartitionState.offline = data.KafkaPartitionState.offline
          vm.KafkaPartitionState.urp = data.KafkaPartitionState.urp
          vm.KafkaBrokerState.ReplicaCountByBrokerId = data.KafkaBrokerState.ReplicaCountByBrokerId
          vm.KafkaBrokerState.OutOfSyncCountByBrokerId = data.KafkaBrokerState.OutOfSyncCountByBrokerId
          vm.KafkaBrokerState.LeaderCountByBrokerId = data.KafkaBrokerState.LeaderCountByBrokerId
          // only >= kafka 2.0 release
          try {
            vm.KafkaPartitionState['with-offline-replicas'] = data.KafkaPartitionState['with-offline-replicas']
            vm.KafkaPartitionState['under-min-isr'] = data.KafkaPartitionState['under-min-isr']
            vm.KafkaBrokerState.OfflineReplicaCountByBrokerId = data.KafkaBrokerState.OfflineReplicaCountByBrokerId
            vm.KafkaBrokerState.OfflineLogDirsByBrokerId = data.KafkaBrokerState.OfflineLogDirsByBrokerId
            vm.KafkaBrokerState.OnlineLogDirsByBrokerId = data.KafkaBrokerState.OnlineLogDirsByBrokerId
          } catch (e) {
            // Kafka 2.0 features not available
          }
        }
        vm.poll()
      }).catch((e) => {
        vm.loading = false
        vm.error = true
        vm.errorData = e.message || e
        vm.poll()
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

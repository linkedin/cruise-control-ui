<!-- Copyright 2017-2019 LinkedIn Corp. Licensed under the BSD 2-Clause License (the "License"). See License in the project root for license information. -->
<template>
  <div>
    <div class="alert alert-info" v-if='!$store.state.hideHelperURL'>
      <b>URL ({{group}}, {{cluster}}):</b> <a target=_blank :href='url'>{{ url }}</a>
    </div>
    <div v-if='!loading'>
      <div class="alert alert-primary text-right">
        <button class="btn btn-primary" @click='getKafkaState()'>Refresh Kafka Cluster State</button>
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
      <!-- statistics -->
      <div class="card-deck mb-3">
        <div class="card text-center">
          <div class="card-header">Kafka Brokers</div>
          <div class="card-body">
            <h1 :class="['card-text', stats_brokers > 0 ? 'text-success' : 'text-danger']">{{ stats_brokers }}</h1>
          </div>
        </div>
        <div class="card text-center">
          <div class="card-header">Total Leader Partitions</div>
          <div class="card-body">
            <h1 :class="['card-text', stats_leaders > 0 ? 'text-success' : 'text-danger']">{{ stats_leaders }}</h1>
          </div>
        </div>
        <div class="card text-center">
          <div class="card-header">Total Replicas</div>
          <div class="card-body">
            <h1 :class="['card-text', stats_replicas > 0 ? 'text-success' : 'text-danger']">{{ stats_replicas }}</h1>
          </div>
        </div>
        <div class="card text-center">
          <div class="card-header">Avg RF.</div>
          <div class="card-body">
            <h1 :class="['card-text', stats_leaders > 0 && stats_replicas / stats_leaders >= 3 ? 'text-success' : 'text-info']">{{ stats_leaders > 0 ? Number(stats_replicas / stats_leaders).toFixed(2) : 'N/A' }}</h1>
          </div>
        </div>
        <div class="card text-center">
          <div class="card-header">Out Of Sync Replicas</div>
          <div class="card-body">
            <h1 :class="['card-text', stats_outofsync === 0 ? 'text-success' : 'text-danger']">{{ stats_outofsync }}</h1>
          </div>
        </div>
      </div>

      <!-- detailed information -->
      <kafka-broker-state :state='KafkaBrokerState'></kafka-broker-state>
      <!-- sorted by bad ones on top -->
      <kafka-partition-state title='Offline Partitions' successTitle='No Offline Partitions' :partitions='KafkaPartitionState.offline' />
      <kafka-partition-state title='With Offline Replicas' successTitle='No With Offline Replicas' :partitions='KafkaPartitionState["with-offline-replicas"]' />
      <kafka-partition-state title='Under MinISR Replicas' successTitle='No Under MinISR Replicas' :partitions='KafkaPartitionState["under-min-isr"]' />
      <kafka-partition-state title='Under Replicated Partitions' successTitle='No Under Replicated Partitions' :partitions='KafkaPartitionState.urp' />
    </div>
  </div>
</template>

<script>
import KafkaBrokerState from '@/components/KafkaBrokerState'
import KafkaPartitionState from '@/components/KafkaPartitionState'
import { ASYNC_RETRY_DELAY, ARGS_RETRY_MAX, ARGS_RETRY_DELAY } from '@/constants'
import fetchCC from '@/fetchCC'

export default {
  name: 'KafkaClusterState',
  props: {
    group: String,
    cluster: String
  },
  components: {
    KafkaBrokerState,
    KafkaPartitionState
  },
  data () {
    return {
      loaded: false,
      loading: false,
      error: false,
      errorData: null,
      async: false,
      asyncData: null,
      argsRetryTimer: null,
      asyncRetryTimer: null,
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
  beforeMount () {
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
    url () {
      return this.$helpers.getURL('kafka_cluster_state')
    },
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
      this.getKafkaState()
    },
    getKafkaState () {
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
          vm.asyncRetryTimer = setTimeout(() => vm.getKafkaState(), ASYNC_RETRY_DELAY)
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
          vm.loaded = true
          const data = result.data
          vm.KafkaPartitionState.offline = data.KafkaPartitionState.offline
          vm.KafkaPartitionState.urp = data.KafkaPartitionState.urp
          vm.KafkaBrokerState.ReplicaCountByBrokerId = data.KafkaBrokerState.ReplicaCountByBrokerId
          vm.KafkaBrokerState.OutOfSyncCountByBrokerId = data.KafkaBrokerState.OutOfSyncCountByBrokerId
          vm.KafkaBrokerState.LeaderCountByBrokerId = data.KafkaBrokerState.LeaderCountByBrokerId
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

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
      <p>Loading ...</p>
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
            <h1 :class="['card-text', stats_replicas / stats_leaders >= 3 ? 'text-success' : 'text-info']">{{ Number(stats_replicas / stats_leaders).toFixed(2) }}</h1>
          </div>
        </div>
        <div class="card text-center">
          <div class="card-header">Out Of Sync Replicas</div>
          <div class="card-body">
            <h1 :class="['card-text', !stats_outofsync > 0 ? 'text-success' : 'text-danger']">{{ stats_outofsync }}</h1>
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
    argsChanged () {
      const newurl = this.$store.getters.getnewurl(this.group, this.cluster)
      // console.log(newurl)
      this.$store.commit('seturl', newurl)
      this.loaded = false
      this.newurl = newurl
      this.getKafkaState()
    },
    getKafkaState () {
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
      }, (e) => {
        vm.loading = false
        vm.error = true
        vm.errorData = e && e.response && e.response.data ? e.response.data : e
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

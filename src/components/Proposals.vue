<!-- Copyright 2017-2019 LinkedIn Corp. Licensed under the BSD 2-Clause License (the "License"). See License in the project root for license information. -->
<template>
  <div>
    <div class="alert alert-info" v-if='!hideHelperURL'>
      <b>URL ({{group}}, {{cluster}}):</b> <a target=_blank :href='url'>{{ url }}</a>
    </div>
    <div v-if='!loading && !detectedUserTaskId' class='alert alert-danger'>
      <strong>User-Task-ID</strong> header is not found in the response from the server. If you are using <a target=_blank href='https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS'>CORS</a>, please add necessary configuration to your Cruise Control as described <a target=_blank href='https://github.com/linkedin/cruise-control-ui/wiki/CORS-Method'>in this wiki.</a>
    </div>
    <div v-if='error'>
      <exception :exception='errorData'></exception>
    </div>
    <div v-else-if='async'>
      <div class="alert alert-info text-center" v-if='showAsyncRefreshButton'>
        <button class="btn btn-sm btn-secondary" @click='getProposals()'>⟳ Refresh View Now (Task-Id: {{ taskId }} )</button>
      </div>
      <async-task :asyncData='asyncData'></async-task>
    </div>
    <div v-else-if='!loaded && loading'>
      <div class="text-center p-3"><div class="spinner-border text-primary" role="status"></div> Loading ...</div>
    </div>
    <div v-else-if='loaded'>
      <div class="alert alert-info">
        <b>Help:</b>This page shows the state of the kafka cluster based on the optimized load calculation. Values before and after optimized load are shown respectively.
      </div>

      <h4>Proposal Changes</h4>
      <table class="table table-sm table-bordered">
        <thead class="thead-light">
          <tr>
            <th>Number of Replica Movements</th>
            <th>Number of Leader Movements</th>
            <th>Recent Windows</th>
            <th>Data to Move</th>
            <th>Monitored Partitions Coverage</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{{ numReplicaMovements }}</td>
            <td>{{ numLeaderMovements }}</td>
            <td>{{ recentWindows }}</td>
            <td>{{ dataToMoveMB | formatUnits }}</td>
            <td>{{ monitoredPartitionsPercentage ? monitoredPartitionsPercentage.toFixed(2) : null }}%</td>
          </tr>
        </tbody>
      </table>

      <h4 class="pointer" @click="showBrokerLoad = !showBrokerLoad">
        Optimized Load Difference - Per Broker
        <small class="text-muted">{{ showBrokerLoad ? '(click to hide)' : '(click to show)' }}</small>
      </h4>
      <table v-if="showBrokerLoad" class="table table-sm table-bordered">
        <thead class="thead-light">
          <tr>
            <th>Broker ID</th>
            <th v-for="h in brokerLoad.heading" :key="'bh-'+h">{{ h }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(brokerdata, brokerid) in brokerLoad.records" :key="brokerid">
            <th>{{ brokerid }}</th>
            <td v-for="h in brokerLoad.heading" :key="'bd-'+h">
              <diff-cell :head='h' :cell='brokerdata[h]' :showpct='showpct' />
            </td>
          </tr>
        </tbody>
      </table>

      <h4 class="pointer" @click="showHostLoad = !showHostLoad">
        Optimized Load Difference - Per Host
        <small class="text-muted">{{ showHostLoad ? '(click to hide)' : '(click to show)' }}</small>
      </h4>
      <table v-if="showHostLoad" class="table table-sm table-bordered">
        <thead class="thead-light">
          <tr>
            <!-- <th>Host</th> -->
            <th v-for="h in hostLoad.heading" :key="'hh-'+h">{{ h }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(hostdata, host) in hostLoad.records" :key="host">
            <!-- <th>{{ host }}</th> -->
            <td v-for="h in hostLoad.heading" :key="'hd-'+h">
              <diff-cell :head='h' :cell='hostdata[h]' :showpct='showpct' />
            </td>
          </tr>
        </tbody>
      </table>

      <h4 class="pointer" @click="showGoals = !showGoals">
        Goals
        <small class="text-muted">{{ showGoals ? '(click to hide)' : '(click to show)' }}</small>
      </h4>
      <table v-if="showGoals" class="table table-sm table-bordered">
        <thead class="thead-light">
          <tr>
            <th>Goal &amp; Goal Violation Details</th>
            <th>Metadata</th>
          </tr>
        </thead>
        <tbody>
          <tr :key='goal.goal' v-for='goal in goals'>
            <td>
              <strong>{{ goal.goal }}</strong>
              <br>
              <!-- property renamed from goalViolated -> status upstream -->
              <span v-if='goal.hasOwnProperty("goalViolated")'>{{ goal.goalViolated }}</span>
              <span v-else>{{ goal.status }}</span>
            </td>
            <td>
              <goal :goal='goal' />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
import DiffCell from '@/components/DiffCell'
import Goal from '@/components/Goal'
import { ASYNC_RETRY_DELAY, ARGS_RETRY_MAX, ARGS_RETRY_DELAY } from '@/constants'
import fetchCC from '@/fetchCC'

export default {
  name: 'Proposals',
  props: {
    group: String,
    cluster: String
  },
  components: {
    DiffCell,
    Goal
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
      // top level medatadata
      numReplicaMovements: null,
      recentWindows: null,
      dataToMoveMB: null,
      monitoredPartitionsPercentage: null,
      numLeaderMovements: null,
      // optimized data
      loadBefore: {},
      loadAfter: {},
      goals: [],
      // show percentage diff
      showpct: false,
      showBrokerLoad: true,
      showHostLoad: true,
      showGoals: true,
      showAsyncRefreshButton: false,
      detectedUserTaskId: false // true in case the response has user-task-id
    }
  },
  created () {
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
    taskId () {
      return this.$store.getters.getTaskId(this.url)
    },
    hideHelperURL () {
      return this.$store.state.hideHelperURL
    },
    url () {
      // loadBeforeOptimization is removed and is available only when
      // we pass verbose=true flag
      return this.$helpers.getURL('proposals', { verbose: true })
    },
    hostLoad () {
      const hostMap = [
        {}, // before load
        {} // after load
      ]
      const unified = {}
      if (!this.loadBefore.brokers || !this.loadAfter.brokers || !this.loadBefore.hosts || !this.loadAfter.hosts) return { heading: [], records: [] }
      // re-key them based on the broker-id
      const hostnames = []
      this.loadBefore.hosts.forEach((rec) => {
        hostnames.push(rec.Host)
        hostMap[0][rec.Host] = rec
      })
      this.loadAfter.hosts.forEach((rec) => {
        hostMap[1][rec.Host] = rec
      })
      const numKeys = [
        'FollowerNwInRate',
        'Leaders',
        'DiskMB',
        'PnwOutRate',
        'NwOutRate', // was NnwOutRate
        'CpuPct',
        'Replicas',
        'LeaderNwInRate'
      ]
      const strKeys = [
        'Host'
      ]
      const allKeys = [...strKeys, ...numKeys]
      hostnames.forEach((host) => {
        const before = hostMap[0][host] || {}
        const after = hostMap[1][host] || {}
        const diff = {}
        numKeys.forEach((key) => {
          diff[key] = {
            before: before[key],
            after: after[key],
            diff: (before[key] || 0) - (after[key] || 0)
          }
        })
        strKeys.forEach((key) => {
          diff[key] = {
            before: before[key],
            after: after[key],
            diff: null
          }
        })
        unified[host] = diff
      })
      return {
        heading: allKeys,
        records: unified
      }
    },
    brokerLoad () {
      const brokerMap = [
        {}, // before load
        {} // after load
      ]
      const unified = {}
      if (!this.loadBefore.brokers || !this.loadAfter.brokers) return { heading: [], records: [] }
      // re-key them based on the broker-id
      const brokerids = []
      this.loadBefore.brokers.forEach((rec) => {
        brokerids.push(rec.Broker)
        brokerMap[0][rec.Broker] = rec
      })
      this.loadAfter.brokers.forEach((rec) => {
        brokerMap[1][rec.Broker] = rec
      })
      const numKeys = [
        'FollowerNwInRate',
        'Leaders',
        'DiskMB',
        'PnwOutRate',
        'NwOutRate', // was NnwOutRate
        'CpuPct',
        'Replicas',
        'LeaderNwInRate'
      ]
      const strKeys = [
        'BrokerState',
        'Host'
      ]
      const allKeys = [...strKeys, ...numKeys]
      brokerids.forEach((broker) => {
        const before = brokerMap[0][broker] || {}
        const after = brokerMap[1][broker] || {}
        const diff = {}
        numKeys.forEach((key) => {
          diff[key] = {
            before: before[key],
            after: after[key],
            diff: (before[key] || 0) - (after[key] || 0)
          }
        })
        strKeys.forEach((key) => {
          diff[key] = {
            before: before[key],
            after: after[key],
            diff: null
          }
        })
        unified[broker] = diff
      })
      return {
        heading: allKeys,
        records: unified
      }
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
      this.getProposals()
    },
    getProposals () {
      const vm = this
      vm.error = false
      vm.async = false
      vm.loading = true
      const fetchOptions = {}
      const task = this.taskId
      if (task) {
        fetchOptions.headers = { 'User-Task-ID': task }
      }
      fetchCC(vm.url, fetchOptions).then((result) => {
        vm.detectedUserTaskId = result.headers.has('user-task-id')
        if (result.type === 'empty') {
          vm.loading = false
          vm.error = true
          vm.errorData = 'CruiseControl sent an empty response with 200-OK status code. Please file a bug here https://github.com/linkedin/cruise-control/issues'
        } else if (result.type === 'async') {
          vm.loading = false
          const taskId = result.headers.has('user-task-id') ? result.headers.get('user-task-id') : null
          vm.$store.commit('setTaskId', { url: vm.url, taskid: taskId })
          vm.async = true
          vm.asyncData = result.data
          vm.showAsyncRefreshButton = true
          if (vm.asyncRetryTimer) clearTimeout(vm.asyncRetryTimer)
          // Only auto-retry if we have a task ID to poll; without one, each
          // retry starts a new expensive proposal computation on CC.
          if (taskId) {
            vm.asyncRetryTimer = setTimeout(() => vm.getProposals(), ASYNC_RETRY_DELAY)
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
          const data = result.data
          // Newer CC versions nest under data.summary; older versions put fields at top level
          const summary = data.summary || data
          vm.numReplicaMovements = summary.numReplicaMovements
          vm.recentWindows = summary.recentWindows
          vm.dataToMoveMB = summary.dataToMoveMB != null ? summary.dataToMoveMB : summary.intraBrokerDataToMoveMB
          vm.monitoredPartitionsPercentage = summary.monitoredPartitionsPercentage
          vm.numLeaderMovements = summary.numLeaderMovements
          vm.$set(vm, 'loadBefore', data.loadBeforeOptimization || {})
          vm.$set(vm, 'loadAfter', data.loadAfterOptimization || {})
          if (Object.prototype.hasOwnProperty.call(data, 'goalSummary')) {
            vm.$set(vm, 'goals', data.goalSummary || [])
          } else {
            vm.$set(vm, 'goals', data.goals || [])
          }
          vm.errorData = null
          vm.loaded = true
          // Clear the cached task ID so the next refresh fetches fresh data
          vm.$store.commit('setTaskId', { url: vm.url, taskid: null })
        }
      }).catch((e) => {
        if (vm.asyncRetryTimer) { clearTimeout(vm.asyncRetryTimer); vm.asyncRetryTimer = null }
        vm.error = true
        vm.loading = false
        vm.goals = []
        vm.errorData = e.message || e
      })
    }
  }
}
</script>

<style scoped>
.pointer { cursor: pointer; }
</style>

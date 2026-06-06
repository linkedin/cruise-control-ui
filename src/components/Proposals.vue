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
      <div class="form-group">
        <div class="form-check">
          <input class="form-check-input" type="checkbox" v-model='rebalanceDisk' @change="onRebalanceDisk">
          <label class="form-check-label" title="In large clusters, this can take minutes to respond, so please be patient and don't overload the server by repeatingly switching this checkbox or moving between tabs"> Switch to "Intra Broker Rebalance Disk Proposal" ❓</label>
        </div>
      </div>
      <h4><template v-if="rebalanceDisk">Intra Broker Rebalance Disk</template> Proposal Changes Summary</h4>
      <table class="table table-sm table-bordered">
        <thead class="thead-light">
          <tr>
            <th># Replica Movements</th>
            <th># Leader Movements</th>
            <th>Recent Windows</th>
            <th>Data to Move</th>
            <th>Monitored Partitions</th>
            <th>Balancedness Score</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{{ numReplicaMovements }}</td>
            <td>{{ numLeaderMovements }}</td>
            <td>{{ recentWindows }}</td>
            <td>{{ dataToMoveMB | formatUnits }}</td>
            <td>{{ monitoredPartitionsPercentage ? monitoredPartitionsPercentage.toFixed(2) : null }}%</td>
            <td :class="onDemandBalancednessScoreAfter - onDemandBalancednessScoreBefore > 0 ? 'text-success' : null">{{ onDemandBalancednessScoreBefore }}% → {{ onDemandBalancednessScoreAfter }}%</td>
          </tr>
        </tbody>
      </table>

      <load-diff-table :per="'broker'" :loadBefore="loadBefore" :loadAfter="loadAfter"></load-diff-table>
      <load-diff-table :per="'host'" :loadBefore="loadBefore" :loadAfter="loadAfter"></load-diff-table>

      <h4 class="pointer" @click="showMovements = !showMovements">
        Proposed Partition Movements ({{ movements.length }})
        <small class="text-muted">{{ showMovements ? '(click to hide)' : '(click to show)' }}</small>
      </h4>
      <inter-broker-movement-table v-if="showMovements" title="" :movements="movements"></inter-broker-movement-table>

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
import Goal from '@/components/Goal'
import LoadDiffTable from '@/components/LoadDiffTable'
import InterBrokerMovementTable from '@/components/InterBrokerMovementTable'
import { ASYNC_RETRY_DELAY, ARGS_RETRY_MAX, ARGS_RETRY_DELAY } from '@/constants'
import fetchCC from '@/fetchCC'

export default {
  name: 'Proposals',
  props: {
    group: String,
    cluster: String
  },
  components: {
    Goal,
    LoadDiffTable,
    InterBrokerMovementTable
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
      rebalanceDisk: false,
      // top level medatadata
      numReplicaMovements: null,
      recentWindows: null,
      dataToMoveMB: null,
      monitoredPartitionsPercentage: null,
      onDemandBalancednessScoreBefore: null,
      onDemandBalancednessScoreAfter: null,
      numLeaderMovements: null,
      // optimized data
      loadBefore: {},
      loadAfter: {},
      proposals: [],
      goals: [],
      // show percentage diff
      showMovements: false,
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
      return this.$helpers.getURL('proposals', { rebalance_disk: this.rebalanceDisk, verbose: true })
    },
    movements () {
      return this.proposals.map(item => ({ proposal: item }))
    }
  },
  methods: {
    onRebalanceDisk () {
      this.loaded = false
      this.argsChanged()
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
          vm.numReplicaMovements = (summary.numReplicaMovements && summary.numReplicaMovements) || summary.numIntraBrokerReplicaMovements
          vm.recentWindows = summary.recentWindows
          vm.dataToMoveMB = (summary.dataToMoveMB && summary.dataToMoveMB) || summary.intraBrokerDataToMoveMB
          vm.monitoredPartitionsPercentage = summary.monitoredPartitionsPercentage
          vm.onDemandBalancednessScoreBefore = Number(summary.onDemandBalancednessScoreBefore).toFixed(0)
          vm.onDemandBalancednessScoreAfter = Number(summary.onDemandBalancednessScoreAfter).toFixed(0)
          vm.numLeaderMovements = summary.numLeaderMovements
          vm.$set(vm, 'loadBefore', data.loadBeforeOptimization || {})
          vm.$set(vm, 'loadAfter', data.loadAfterOptimization || {})
          vm.$set(vm, 'proposals', data.proposals || [])
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

<!-- Copyright 2017-2019 LinkedIn Corp. Licensed under the BSD 2-Clause License (the "License"). See License in the project root for license information. -->
<template>
  <div>
    <div class="alert alert-info" v-if='!hideHelperURL'>
      <b>URL ({{group}}, {{cluster}}):</b> <a target=_blank :href='url'>{{ url }}</a>
    </div>
    <div v-if='!loading'>
      <div class="alert alert-primary text-right">
        <button class="btn btn-primary" @click='getState()'>Refresh Executor State</button>
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
          <div class="card-header">Executor</div>
          <div class="card-body">
            <p class="card-text">
            <span :class="['badge', ExecutorState.state && ExecutorState.state.match(/STOPPED|ERROR/) ? 'badge-danger': 'badge-success']">{{ ExecutorState.state }}</span>
            </p>
          </div>
        </div>
      </div>
      <div v-if='(/\\*._MOVEMENT_TASK_IN_PROGRESS/.test(ExecutorState.state) || ExecutorState.state === "STOPPING_EXECUTION")' class="card">
        <div>
          <div class='card-header'>
            {{ ExecutorState.state | camelCase }}
          </div>
        </div>
        <div class='card-body'>
          <div>
            <button class="btn btn-primary" @click='stopProposalExecution'>Stop Proposal Execution</button>
            <button class="btn btn-secondary" @click='okDataStopProposalExecution = null'>Clear Response</button>
            <div v-if='errStopProsalExecution'>
              <exception :exception='errDataStopProposalExecution'></exception>
            </div>
            <div v-else>
              <pre>{{ okDataStopProposalExecution }}</pre>
            </div>
            <hr>
          </div>
          <div class="card-deck mb-3">
            <div class="card">
              <div class="card-header">
                Total Data To Move
              </div>
              <div class="card-body">
                <div v-if='ExecutorState.totalDataToMove'>
                  <div class="progress" style="height:20px">
                    <div class="progress-bar progress-bar-striped progress-bar-animated" :style="'width:' + ExecutorState.finishedDataMovement / ExecutorState.totalDataToMove * 100 + '%'">Done</div>
                  </div>
                </div>
                <h1 class="text-primary">{{ ExecutorState.totalDataToMove | formatUnits }}</h1>
              </div>
            </div>
            <div class="card">
              <div class="card-header">Finished Data Movement</div>
              <div class="card-body">
                <p class="card-text"><h1 class="text-success">{{ ExecutorState.finishedDataMovement | formatUnits }}</h1></p>
              </div>
            </div>
            <div class="card">
              <div class="card-header">Remaining Data</div>
              <div class="card-body">
                <p class="card-text"><h1 class="text-info">{{ ExecutorState.totalDataToMove - ExecutorState.finishedDataMovement | formatUnits }}</h1></p>
              </div>
            </div>
          </div>
          <div class="card-deck mb-3">
            <div class="card">
              <div class="card-header">
                Total Leadership Movements
              </div>
              <div class="card-body">
                <div v-if='ExecutorState.numTotalLeadershipMovements'>
                  <div class="progress" style="height:20px">
                    <div class="progress-bar progress-bar-striped progress-bar-animated" :style="'width:' + ExecutorState.numFinishedLeadershipMovements / ExecutorState.numTotalLeadershipMovements * 100 + '%'">Done</div>
                  </div>
                </div>
                <h1 class="text-primary">{{ ExecutorState.numTotalLeadershipMovements | formatNumber }}</h1>
              </div>
            </div>
            <div class="card">
              <div class="card-header">Finished Leadership Movements</div>
              <div class="card-body">
                <p class="card-text"><h1 class="text-success">{{ ExecutorState.numFinishedLeadershipMovements | formatNumber }}</h1></p>
              </div>
            </div>
            <div class="card">
              <div class="card-header">Remaining Leadership Movements</div>
              <div class="card-body">
                <p class="card-text"><h1 class="text-info">{{ ExecutorState.numTotalLeadershipMovements - ExecutorState.numFinishedLeadershipMovements | formatNumber }}</h1></p>
              </div>
            </div>
          </div>
          <div class="card-deck mb-3">
            <div class="card">
              <div class="card-header">
                Total Partition Movements
              </div>
              <div class="card-body">
                <div v-if='ExecutorState.numTotalPartitionMovements'>
                  <div class="progress" style="height:20px">
                    <div class="progress-bar progress-bar-striped bg-success" :style="'width:' + ExecutorState.numFinishedPartitionMovements / ExecutorState.numTotalPartitionMovements * 100 + '%'">Done</div>
                    <div class="progress-bar progress-bar-striped progress-bar-animated" :style="'width:' + getInProgressPartitionMovements.length / ExecutorState.numTotalPartitionMovements * 100 + '%'">In Progress</div>
                  </div>
                </div>
                <h1 class="text-primary">{{ ExecutorState.numTotalPartitionMovements | formatNumber }}</h1>
              </div>
            </div>
            <div class="card">
              <div class="card-header">Finished Partition Movements</div>
              <div class="card-body">
                <p class="card-text"><h1 class="text-success">{{ ExecutorState.numFinishedPartitionMovements | formatNumber }}</h1></p>
              </div>
            </div>
            <div class="card">
              <div class="card-header">Remaining Partition Movements</div>
              <div class="card-body">
                <p class="card-text"><h1 class="text-info">{{ ExecutorState.numTotalPartitionMovements - ExecutorState.numFinishedPartitionMovements | formatNumber }}</h1></p>
              </div>
            </div>
          </div>
          <div class="card-deck mb-3">
            <div class="card">
              <div class="card-header">Aborting Partitions</div>
              <div class="card-body">
                <p class="card-text"><h1 class="text-primary">{{ ExecutorState.abortingPartitions }}</h1></p>
              </div>
            </div>
            <div class="card">
              <div class="card-header">Aborted Partitions</div>
              <div class="card-body">
                <p class="card-text"><h1 class="text-success">{{ ExecutorState.abortedPartitions }}</h1></p>
              </div>
            </div>
            <div class="card">
              <div class="card-header">Dead Partitions</div>
              <div class="card-body">
                <p class="card-text"><h1 class="text-info">{{ ExecutorState.deadPartitions }}</h1></p>
              </div>
            </div>
          </div>
          <div class="card-deck mb-3">
            <h4>Completed Movements</h4>
            <table class="table table-sm table-bordered">
              <thead class="thead-light">
                <tr>
                  <th>Topic</th>
                  <th>Partition</th>
                  <th>Old Replica</th>
                  <th>New Replica</th>
                  <th>Movement Type</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="h in ExecutorState.completedPartitionMovement">
                  <td>{{ h.proposal.topicPartition.topic }}</td>
                  <td>{{ h.proposal.topicPartition.partition }}</td>
                  <td>{{ h.proposal.oldReplicas.join(',') }}</td>
                  <td>{{ h.proposal.newReplicas.join(',') }}</td>
                  <td>{{ h.type }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="card-deck mb-3">
            <h4>Pending Movements</h4>
            <table class="table table-sm table-bordered">
              <thead class="thead-light">
                <tr>
                  <th>Topic</th>
                  <th>Partition</th>
                  <th>Old Replica</th>
                  <th>New Replica</th>
                  <th>Movement Type</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="h in getPendingPartitionMovements">
                  <td>{{ h.proposal.topicPartition.topic }}</td>
                  <td>{{ h.proposal.topicPartition.partition }}</td>
                  <td>{{ h.proposal.oldReplicas.join(',') }}</td>
                  <td>{{ h.proposal.newReplicas.join(',') }}</td>
                  <td>{{ h.type }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="card-deck mb-3">
            <h4>In Progress Movements</h4>
            <table class="table table-sm table-bordered">
              <thead class="thead-light">
                <tr>
                  <th>Topic</th>
                  <th>Partition</th>
                  <th>Old Replica</th>
                  <th>New Replica</th>
                  <th>Movement Type</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="h in getInProgressPartitionMovements">
                  <td>{{ h.proposal.topicPartition.topic }}</td>
                  <td>{{ h.proposal.topicPartition.partition }}</td>
                  <td>{{ h.proposal.oldReplicas.join(',') }}</td>
                  <td>{{ h.proposal.newReplicas.join(',') }}</td>
                  <td>{{ h.type }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="card-deck mb-3">
            <h4>Aborting Movements</h4>
            <table class="table table-sm table-bordered">
              <thead class="thead-light">
                <tr>
                  <th>Topic</th>
                  <th>Partition</th>
                  <th>Old Replica</th>
                  <th>New Replica</th>
                  <th>Movement Type</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="h in ExecutorState.abortingPartitionMovement">
                  <td>{{ h.proposal.topicPartition.topic }}</td>
                  <td>{{ h.proposal.topicPartition.partition }}</td>
                  <td>{{ h.proposal.oldReplicas.join(',') }}</td>
                  <td>{{ h.proposal.newReplicas.join(',') }}</td>
                  <td>{{ h.type }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="card-deck mb-3">
            <h4>Aborted Movements</h4>
            <table class="table table-sm table-bordered">
              <thead class="thead-light">
                <tr>
                  <th>Topic</th>
                  <th>Partition</th>
                  <th>Old Replica</th>
                  <th>New Replica</th>
                  <th>Movement Type</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="h in ExecutorState.abortedPartitionMovement">
                  <td>{{ h.proposal.topicPartition.topic }}</td>
                  <td>{{ h.proposal.topicPartition.partition }}</td>
                  <td>{{ h.proposal.oldReplicas.join(',') }}</td>
                  <td>{{ h.proposal.newReplicas.join(',') }}</td>
                  <td>{{ h.type }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="card-deck mb-3">
            <h4>Dead partition Movements</h4>
            <table class="table table-sm table-bordered">
              <thead class="thead-light">
                <tr>
                  <th>Topic</th>
                  <th>Partition</th>
                  <th>Old Replica</th>
                  <th>New Replica</th>
                  <th>Movement Type</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="h in ExecutorState.deadPartitionMovement">
                  <td>{{ h.proposal.topicPartition.topic }}</td>
                  <td>{{ h.proposal.topicPartition.partition }}</td>
                  <td>{{ h.proposal.oldReplicas.join(',') }}</td>
                  <td>{{ h.proposal.newReplicas.join(',') }}</td>
                  <td>{{ h.type }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import BooleanEL from '@/components/BooleanEL'

export default {
  name: 'Executor',
  props: {
    'group': String,
    'cluster': String
  },
  components: {
    BooleanEL
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
      ExecutorState: {
        totalDataToMove: 0,
        finishedDataMovement: 0,
        numTotalLeadershipMovements: 0,
        numFinishedLeadershipMovements: 0,
        numTotalPartitionMovements: 0,
        numFinishedPartitionMovements: 0,
        abortingPartitions: 0,
        abortedPartitions: 0,
        deadPartitions: 0,
        numFinishedPartitions: 0,
        state: null,
        numTotalPartitions: 0,
        completedPartitionMovement: [],
        pendingPartitionMovement: [],
        inProgressPartitionMovement: [],
        abortingPartitionMovement: [],
        abortedPartitionMovement: [],
        deadPartitionMovement: []
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
      return this.$helpers.getURL('state', {substates: 'EXECUTOR', verbose: true})
    },
    stopProposalExecutionURL () {
      return this.$helpers.getURL('stop_proposal_execution')
    },
    getPendingPartitionMovements () {
      if (typeof this.ExecutorState.pendingPartitionMovement === 'undefined') {
        return []
      } else {
        return this.ExecutorState.pendingPartitionMovement.filter(f => f.state === 'PENDING')
      }
    },
    getInProgressPartitionMovements () {
      var inprogress = []
      var pending = []
      if (typeof this.ExecutorState.inProgressPartitionMovement !== 'undefined') {
        inprogress = this.ExecutorState.inProgressPartitionMovement
      }
      if (typeof this.ExecutorState.pendingPartitionMovement !== 'undefined') {
        pending = this.ExecutorState.pendingPartitionMovement
      }
      return inprogress.concat(pending.filter(f => f.state === 'IN_PROGRESS'))
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
      vm.$http.get(vm.url, {withCredentials: true, headers: {'Cache-Control': 'no-cache', 'Cache-buster': Date.now()}}).then((r) => {
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
          vm.$set(vm, 'ExecutorState', r.data.ExecutorState)
          vm.loading = false
          vm.loaded = true
        }
      }, (e) => {
        vm.loading = false
        vm.error = true
        vm.errorData = e && e.response && e.response.data ? e.response.data : e
      })
    },
    stopProposalExecution () {
      let vm = this
      // cancel the on-going proposal execution
      vm.$http.post(this.stopProposalExecutionURL, {withCredentials: true}).then((r) => {
        vm.errStopProsalExecution = false
        vm.okDataStopProposalExecution = r.data
      }, (e) => {
        vm.errStopProsalExecution = true
        vm.errDataStopProposalExecution = e && e.response ? e.response.data : e
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

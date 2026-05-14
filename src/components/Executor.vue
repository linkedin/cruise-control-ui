<!-- Copyright 2017-2019 LinkedIn Corp. Licensed under the BSD 2-Clause License (the "License"). See License in the project root for license information. -->
<template>
  <div>
    <div class="alert alert-info" v-if='!hideHelperURL'>
      <b>URL ({{group}}, {{cluster}}):</b> <a target=_blank :href='url'>{{ url }}</a>
    </div>
    <div v-if='!loading'>
      <div class="alert alert-primary text-right">
        <button class="btn btn-primary" @click='getState()'>Refresh Executor State</button>
        <button :class="['btn', autoRefresh ? 'btn-success' : 'btn-outline-secondary']" @click='toggleAutoRefresh()'>
          Auto-Refresh {{ autoRefresh ? 'ON (30s)' : 'OFF' }}
        </button>
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

      <!-- Triggered Task Info (shown for all in-progress/stopping states) -->
      <div v-if='isInProgressState' class="card mb-3">
        <div class="card-header" style="cursor:pointer" @click="showTriggeredTaskInfo = !showTriggeredTaskInfo">
          {{ showTriggeredTaskInfo ? '▼' : '▶' }} Triggered Task Info
        </div>
        <div class="card-body" v-show="showTriggeredTaskInfo">
          <table class="table table-sm table-bordered mb-0">
            <tbody>
              <tr v-if="ExecutorState.triggeredUserTaskId">
                <td><strong>User Task ID</strong></td>
                <td>{{ ExecutorState.triggeredUserTaskId }}</td>
              </tr>
              <tr v-if="ExecutorState.triggeredSelfHealingTaskId">
                <td><strong>Self-Healing Task ID</strong></td>
                <td>{{ ExecutorState.triggeredSelfHealingTaskId }}</td>
              </tr>
              <tr v-if="ExecutorState.triggeredTaskReason">
                <td><strong>Reason</strong></td>
                <td>
                  <div v-if="parsedTaskReason.prefix">{{ parsedTaskReason.prefix }}</div>
                  <table v-if="parsedTaskReason.entries.length" class="table table-sm table-bordered mb-0 mt-1">
                    <tbody>
                      <tr v-for="(entry, idx) in parsedTaskReason.entries" :key="idx">
                        <td><strong>{{ entry.key }}</strong></td>
                        <td>{{ entry.value }}</td>
                      </tr>
                    </tbody>
                  </table>
                  <span v-if="!parsedTaskReason.entries.length && !parsedTaskReason.prefix">{{ ExecutorState.triggeredTaskReason }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Main execution card (shown for all in-progress/stopping states) -->
      <div v-if='isInProgressState' class="card">
        <div>
          <div class='card-header'>
            {{ ExecutorState.state | camelCase }}
          </div>
        </div>
        <div class='card-body'>
          <div>
            <button class="btn btn-primary" @click='stopProposalExecution'>Stop Proposal Execution</button>
            <button class="btn btn-secondary" @click='okDataStopProposalExecution = null'>Clear Response</button>
            <div v-if='errStopProposalExecution'>
              <exception :exception='errDataStopProposalExecution'></exception>
            </div>
            <div v-else>
              <pre>{{ okDataStopProposalExecution }}</pre>
            </div>
            <hr>
          </div>

          <!-- ===================== INITIALIZING SECTION ===================== -->
          <div v-if="isInitializingState" class="alert alert-info text-center">
            <div class="spinner-border spinner-border-sm text-primary mr-2" role="status"></div>
            {{ ExecutorState.state | camelCase }} &mdash; preparing execution plan...
          </div>

          <!-- ===================== INTER-BROKER SECTION ===================== -->
          <div v-if="isInterBrokerState || isLeaderMovementState || isStoppingState">
            <h4 class="mt-2 mb-3">Inter-Broker Replica Movement Progress</h4>
            <!-- Data progress bar -->
            <div v-if='ExecutorState.totalDataToMove' class="mb-2">
              <small class="text-muted font-weight-bold">Data Movement ({{ ExecutorState.finishedDataMovement | formatUnits }} / {{ ExecutorState.totalDataToMove | formatUnits }})</small>
              <div class="progress" style="height:28px;font-size:14px">
                <div class="progress-bar progress-bar-striped progress-bar-animated bg-success" :style="'width:' + ExecutorState.finishedDataMovement / ExecutorState.totalDataToMove * 100 + '%'">
                  {{ ExecutorState.totalDataToMove ? (ExecutorState.finishedDataMovement / ExecutorState.totalDataToMove * 100).toFixed(1) + '%' : '0%' }}
                </div>
              </div>
            </div>
            <!-- Partition progress bar -->
            <div v-if='ExecutorState.numTotalPartitionMovements' class="mb-3">
              <small class="text-muted font-weight-bold">Partition Movements ({{ ExecutorState.numFinishedPartitionMovements }} / {{ ExecutorState.numTotalPartitionMovements }})</small>
              <div class="progress" style="height:28px;font-size:14px">
                <div class="progress-bar progress-bar-striped bg-success" :style="'width:' + ExecutorState.numFinishedPartitionMovements / ExecutorState.numTotalPartitionMovements * 100 + '%'">Done</div>
                <div class="progress-bar progress-bar-striped progress-bar-animated" :style="'width:' + getInProgressPartitionMovements.length / ExecutorState.numTotalPartitionMovements * 100 + '%'">In Progress</div>
              </div>
            </div>
            <table class="table table-bordered mb-3">
              <thead class="thead-light">
                <tr>
                  <th></th>
                  <th>Total</th>
                  <th class="text-success">Finished</th>
                  <th class="text-warning">In Progress</th>
                  <th class="text-info">Remaining</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Data</strong></td>
                  <td>{{ ExecutorState.totalDataToMove | formatUnits }}</td>
                  <td>{{ ExecutorState.finishedDataMovement | formatUnits }}</td>
                  <td>-</td>
                  <td>{{ ExecutorState.totalDataToMove - ExecutorState.finishedDataMovement | formatUnits }}</td>
                </tr>
                <tr>
                  <td><strong>Partitions</strong></td>
                  <td>{{ ExecutorState.numTotalPartitionMovements | formatNumber }}</td>
                  <td>{{ ExecutorState.numFinishedPartitionMovements | formatNumber }}</td>
                  <td>{{ getInProgressPartitionMovements.length | formatNumber }}</td>
                  <td>{{ ExecutorState.numTotalPartitionMovements - ExecutorState.numFinishedPartitionMovements | formatNumber }}</td>
                </tr>
                <tr>
                  <td><strong>Leadership</strong></td>
                  <td>{{ ExecutorState.numTotalLeadershipMovements | formatNumber }}</td>
                  <td>{{ ExecutorState.numFinishedLeadershipMovements | formatNumber }}</td>
                  <td>-</td>
                  <td>{{ ExecutorState.numTotalLeadershipMovements - ExecutorState.numFinishedLeadershipMovements | formatNumber }}</td>
                </tr>
              </tbody>
            </table>
            <!-- Concurrency & abort stats -->
            <table class="table table-bordered mb-3">
              <thead class="thead-light">
                <tr>
                  <th v-if="ExecutorState.maximumConcurrentInterBrokerPartitionMovementsPerBroker != null">Max Concurrency/Broker</th>
                  <th v-if="ExecutorState.minimumConcurrentInterBrokerPartitionMovementsPerBroker != null">Min Concurrency/Broker</th>
                  <th v-if="ExecutorState.averageConcurrentInterBrokerPartitionMovementsPerBroker != null">Avg Concurrency/Broker</th>
                  <th>Aborting</th>
                  <th>Aborted</th>
                  <th>Dead</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td v-if="ExecutorState.maximumConcurrentInterBrokerPartitionMovementsPerBroker != null">{{ ExecutorState.maximumConcurrentInterBrokerPartitionMovementsPerBroker }}</td>
                  <td v-if="ExecutorState.minimumConcurrentInterBrokerPartitionMovementsPerBroker != null">{{ ExecutorState.minimumConcurrentInterBrokerPartitionMovementsPerBroker }}</td>
                  <td v-if="ExecutorState.averageConcurrentInterBrokerPartitionMovementsPerBroker != null">{{ ExecutorState.averageConcurrentInterBrokerPartitionMovementsPerBroker | formatDecimal }}</td>
                  <td>{{ ExecutorState.abortingPartitions }}</td>
                  <td>{{ ExecutorState.abortedPartitions }}</td>
                  <td>{{ ExecutorState.deadPartitions }}</td>
                </tr>
              </tbody>
            </table>
            <!-- Inter-broker stopping stats -->
            <div v-if="isStoppingState">
              <table class="table table-bordered mb-3">
                <thead class="thead-light">
                  <tr>
                    <th class="text-warning">Cancelled</th>
                    <th class="text-info">In Progress</th>
                    <th class="text-danger">Aborting</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{{ ExecutorState.numCancelledInterBrokerPartitionMovements }}</td>
                    <td>{{ ExecutorState.numInProgressInterBrokerPartitionMovements }}</td>
                    <td>{{ ExecutorState.numAbortingInterBrokerPartitionMovements }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- ===================== INTRA-BROKER SECTION ===================== -->
          <div v-if="isIntraBrokerState || isStoppingState">
            <hr>
            <h4 class="mt-2 mb-3">Intra-Broker Replica Movement Progress</h4>
            <div v-if="isIntraBrokerState">
              <!-- Data progress bar -->
              <div v-if='ExecutorState.totalIntraBrokerDataToMove' class="mb-2">
                <small class="text-muted font-weight-bold">Data Movement ({{ ExecutorState.finishedIntraBrokerDataMovement | formatUnits }} / {{ ExecutorState.totalIntraBrokerDataToMove | formatUnits }})</small>
                <div class="progress" style="height:28px;font-size:14px">
                  <div class="progress-bar progress-bar-striped progress-bar-animated bg-success" :style="'width:' + ExecutorState.finishedIntraBrokerDataMovement / ExecutorState.totalIntraBrokerDataToMove * 100 + '%'">
                    {{ ExecutorState.totalIntraBrokerDataToMove ? (ExecutorState.finishedIntraBrokerDataMovement / ExecutorState.totalIntraBrokerDataToMove * 100).toFixed(1) + '%' : '0%' }}
                  </div>
                </div>
              </div>
              <!-- Partition progress bar -->
              <div v-if='ExecutorState.numTotalIntraBrokerPartitionMovements' class="mb-3">
                <small class="text-muted font-weight-bold">Partition Movements ({{ ExecutorState.numFinishedIntraBrokerPartitionMovements }} / {{ ExecutorState.numTotalIntraBrokerPartitionMovements }})</small>
                <div class="progress" style="height:28px;font-size:14px">
                  <div class="progress-bar progress-bar-striped bg-success" :style="'width:' + ExecutorState.numFinishedIntraBrokerPartitionMovements / ExecutorState.numTotalIntraBrokerPartitionMovements * 100 + '%'">Done</div>
                  <div class="progress-bar progress-bar-striped progress-bar-animated" :style="'width:' + getInProgressIntraBrokerPartitionMovements.length / ExecutorState.numTotalIntraBrokerPartitionMovements * 100 + '%'">In Progress</div>
                </div>
              </div>
              <table class="table table-bordered mb-3">
                <thead class="thead-light">
                  <tr>
                    <th></th>
                    <th>Total</th>
                    <th class="text-success">Finished</th>
                    <th class="text-warning">Pending</th>
                    <th class="text-info">In Progress</th>
                    <th class="text-danger">Aborting</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Data</strong></td>
                    <td>{{ ExecutorState.totalIntraBrokerDataToMove | formatUnits }}</td>
                    <td>{{ ExecutorState.finishedIntraBrokerDataMovement | formatUnits }}</td>
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                  </tr>
                  <tr>
                    <td><strong>Partitions</strong></td>
                    <td>{{ ExecutorState.numTotalIntraBrokerPartitionMovements | formatNumber }}</td>
                    <td>{{ ExecutorState.numFinishedIntraBrokerPartitionMovements | formatNumber }}</td>
                    <td>{{ ExecutorState.numPendingIntraBrokerPartitionMovements | formatNumber }}</td>
                    <td>{{ ExecutorState.numInProgressIntraBrokerPartitionMovements | formatNumber }}</td>
                    <td>{{ ExecutorState.numAbortingIntraBrokerPartitionMovements | formatNumber }}</td>
                  </tr>
                </tbody>
              </table>
              <!-- Concurrency stats -->
              <table v-if="ExecutorState.maximumConcurrentIntraBrokerPartitionMovementsPerBroker != null" class="table table-bordered mb-3">
                <thead class="thead-light">
                  <tr>
                    <th>Max Concurrency/Broker</th>
                    <th>Min Concurrency/Broker</th>
                    <th>Avg Concurrency/Broker</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{{ ExecutorState.maximumConcurrentIntraBrokerPartitionMovementsPerBroker }}</td>
                    <td>{{ ExecutorState.minimumConcurrentIntraBrokerPartitionMovementsPerBroker }}</td>
                    <td>{{ ExecutorState.averageConcurrentIntraBrokerPartitionMovementsPerBroker | formatDecimal }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <!-- Stopping state: intra-broker cancelled/in-progress/aborting counts -->
            <div v-if="isStoppingState">
              <div v-if="ExecutorState.numInProgressIntraBrokerPartitionMovements" class="alert alert-warning">
                Waiting for {{ ExecutorState.numInProgressIntraBrokerPartitionMovements }} in-progress intra-broker disk move(s) to complete
              </div>
              <table class="table table-bordered mb-3">
                <thead class="thead-light">
                  <tr>
                    <th class="text-warning">Cancelled</th>
                    <th class="text-info">In Progress</th>
                    <th class="text-danger">Aborting</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{{ ExecutorState.numCancelledIntraBrokerPartitionMovements }}</td>
                    <td>{{ ExecutorState.numInProgressIntraBrokerPartitionMovements }}</td>
                    <td>{{ ExecutorState.numAbortingIntraBrokerPartitionMovements }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- ===================== RUNNING REASSIGNMENTS ===================== -->
          <div class="mb-3">
            <h4 class="mt-2 mb-3">Running Reassignments</h4>
            <!-- In-progress inter-broker movements table -->
            <inter-broker-movement-table
              v-if="isInterBrokerState || isStoppingState"
              title="In Progress Inter-Broker Movements"
              :movements="getInProgressPartitionMovements"
              :hide-empty="true"
              table-class="table table-sm table-bordered table-striped"
              thead-class="thead-dark"
            />
            <!-- In-progress intra-broker movements table -->
            <intra-broker-movement-table
              v-if="isIntraBrokerState || isStoppingState"
              title="In Progress Intra-Broker Movements"
              :movements="getInProgressIntraBrokerPartitionMovements"
              :hide-empty="true"
              table-class="table table-sm table-bordered table-striped"
              thead-class="thead-dark"
            />
          </div>

          <!-- ===================== MOVEMENT DETAILS (below Running Reassignments) ===================== -->
          <!-- Inter-broker verbose tables (only when not stopping, stopping has its own) -->
          <div v-if="isInterBrokerState">
            <button class="btn btn-sm btn-outline-secondary mb-3" @click="showInterBrokerDetails = !showInterBrokerDetails">
              {{ showInterBrokerDetails ? 'Hide' : 'Show' }} Movement Details
            </button>
            <div v-if="showInterBrokerDetails">
              <inter-broker-movement-table title="Completed Movements" :movements="ExecutorState.completedPartitionMovement" />
              <inter-broker-movement-table title="Pending Movements" :movements="getPendingPartitionMovements" />
              <inter-broker-movement-table title="In Progress Movements" :movements="getInProgressPartitionMovements" />
              <inter-broker-movement-table title="Aborting Movements" :movements="ExecutorState.abortingPartitionMovement" />
              <inter-broker-movement-table title="Aborted Movements" :movements="ExecutorState.abortedPartitionMovement" />
              <inter-broker-movement-table title="Dead partition Movements" :movements="ExecutorState.deadPartitionMovement" />
            </div>
          </div>
          <!-- Stopping state: inter-broker verbose tables -->
          <div v-if="isStoppingState">
            <inter-broker-movement-table title="Cancelled Inter-Broker Movements" :movements="ExecutorState.cancelledInterBrokerPartitionMovement" :hide-empty="true" />
            <inter-broker-movement-table title="In Progress Inter-Broker Movements" :movements="ExecutorState.inProgressInterBrokerPartitionMovement" :hide-empty="true" />
            <inter-broker-movement-table title="Aborting Inter-Broker Movements" :movements="ExecutorState.abortingInterBrokerPartitionMovement" :hide-empty="true" />
          </div>
          <!-- Intra-broker verbose tables (active intra-broker state) -->
          <div v-if="isIntraBrokerState">
            <button class="btn btn-sm btn-outline-secondary mb-3" @click="showIntraBrokerDetails = !showIntraBrokerDetails">
              {{ showIntraBrokerDetails ? 'Hide' : 'Show' }} Intra-Broker Movement Details
            </button>
            <div v-if="showIntraBrokerDetails">
              <intra-broker-movement-table title="Completed Intra-Broker Movements" :movements="ExecutorState.completedIntraBrokerPartitionMovement" />
              <intra-broker-movement-table title="Pending Intra-Broker Movements" :movements="getPendingIntraBrokerPartitionMovements" />
              <intra-broker-movement-table title="In Progress Intra-Broker Movements" :movements="getInProgressIntraBrokerPartitionMovements" />
              <intra-broker-movement-table title="Aborting Intra-Broker Movements" :movements="ExecutorState.abortingIntraBrokerPartitionMovement" />
              <intra-broker-movement-table title="Aborted Intra-Broker Movements" :movements="ExecutorState.abortedIntraBrokerPartitionMovement" />
              <intra-broker-movement-table title="Dead Intra-Broker Movements" :movements="ExecutorState.deadIntraBrokerPartitionMovement" />
            </div>
          </div>
          <!-- Stopping state: intra-broker verbose tables -->
          <div v-if="isStoppingState">
            <intra-broker-movement-table title="Cancelled Intra-Broker Movements" :movements="ExecutorState.cancelledIntraBrokerPartitionMovement" :hide-empty="true" />
            <intra-broker-movement-table title="In Progress Intra-Broker Movements" :movements="ExecutorState.inProgressIntraBrokerPartitionMovement" :hide-empty="true" />
            <intra-broker-movement-table title="Aborting Intra-Broker Movements" :movements="ExecutorState.abortingIntraBrokerPartitionMovement" :hide-empty="true" />
          </div>

        </div>
      </div>
    </div>
  </div>
</template>

<script>
import InterBrokerMovementTable from '@/components/InterBrokerMovementTable'
import IntraBrokerMovementTable from '@/components/IntraBrokerMovementTable'
import { AUTO_REFRESH_INTERVAL, ASYNC_RETRY_DELAY, ARGS_RETRY_MAX, ARGS_RETRY_DELAY } from '@/constants'
import fetchCC from '@/fetchCC'

const DEFAULT_EXECUTOR_STATE = {
  state: null,
  // Inter-broker fields
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
  numTotalPartitions: 0,
  completedPartitionMovement: [],
  pendingPartitionMovement: [],
  inProgressPartitionMovement: [],
  abortingPartitionMovement: [],
  abortedPartitionMovement: [],
  deadPartitionMovement: [],
  // Inter-broker concurrency
  maximumConcurrentInterBrokerPartitionMovementsPerBroker: null,
  minimumConcurrentInterBrokerPartitionMovementsPerBroker: null,
  averageConcurrentInterBrokerPartitionMovementsPerBroker: null,
  // Inter-broker stopping fields
  numCancelledInterBrokerPartitionMovements: 0,
  numInProgressInterBrokerPartitionMovements: 0,
  numAbortingInterBrokerPartitionMovements: 0,
  cancelledInterBrokerPartitionMovement: [],
  inProgressInterBrokerPartitionMovement: [],
  abortingInterBrokerPartitionMovement: [],
  // Intra-broker fields
  numTotalIntraBrokerPartitionMovements: 0,
  numFinishedIntraBrokerPartitionMovements: 0,
  numPendingIntraBrokerPartitionMovements: 0,
  numInProgressIntraBrokerPartitionMovements: 0,
  numAbortingIntraBrokerPartitionMovements: 0,
  totalIntraBrokerDataToMove: 0,
  finishedIntraBrokerDataMovement: 0,
  // Intra-broker concurrency
  maximumConcurrentIntraBrokerPartitionMovementsPerBroker: null,
  minimumConcurrentIntraBrokerPartitionMovementsPerBroker: null,
  averageConcurrentIntraBrokerPartitionMovementsPerBroker: null,
  // Intra-broker verbose
  completedIntraBrokerPartitionMovement: [],
  pendingIntraBrokerPartitionMovement: [],
  inProgressIntraBrokerPartitionMovement: [],
  abortingIntraBrokerPartitionMovement: [],
  abortedIntraBrokerPartitionMovement: [],
  deadIntraBrokerPartitionMovement: [],
  // Intra-broker stopping fields
  numCancelledIntraBrokerPartitionMovements: 0,
  cancelledIntraBrokerPartitionMovement: [],
  // Triggered task info
  triggeredUserTaskId: null,
  triggeredSelfHealingTaskId: null,
  triggeredTaskReason: null
}

export default {
  name: 'Executor',
  props: {
    group: String,
    cluster: String
  },
  components: {
    InterBrokerMovementTable,
    IntraBrokerMovementTable
  },
  data () {
    return {
      loaded: false,
      loading: false,
      error: false,
      errorData: null,
      async: false, // when the server treats this request as async
      asyncData: null, // when the server treats the request as async and sends progress instead of actual response
      showTriggeredTaskInfo: false,
      showInterBrokerDetails: false,
      showIntraBrokerDetails: false,
      autoRefresh: true,
      autoRefreshInterval: null,
      argsRetryTimer: null,
      asyncRetryTimer: null,
      errStopProposalExecution: false, // true when stop proposal execution is success
      errDataStopProposalExecution: null, // err data of stop proposal execution
      okDataStopProposalExecution: null, // success data from stop proposal execution
      ExecutorState: JSON.parse(JSON.stringify(DEFAULT_EXECUTOR_STATE))
    }
  },
  created () {
    this.argsChanged()
  },
  beforeDestroy () {
    if (this.argsRetryTimer) {
      clearTimeout(this.argsRetryTimer)
    }
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval)
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
    url () {
      return this.$helpers.getURL('state', { substates: 'EXECUTOR', verbose: true })
    },
    stopProposalExecutionURL () {
      return this.$helpers.getURL('stop_proposal_execution')
    },
    isInterBrokerState () {
      return this.ExecutorState.state === 'INTER_BROKER_REPLICA_MOVEMENT_TASK_IN_PROGRESS'
    },
    isIntraBrokerState () {
      return this.ExecutorState.state === 'INTRA_BROKER_REPLICA_MOVEMENT_TASK_IN_PROGRESS'
    },
    isStoppingState () {
      return this.ExecutorState.state === 'STOPPING_EXECUTION'
    },
    isLeaderMovementState () {
      return this.ExecutorState.state === 'LEADER_MOVEMENT_TASK_IN_PROGRESS'
    },
    isInitializingState () {
      const s = this.ExecutorState.state
      return s === 'INITIALIZING_PROPOSAL_EXECUTION' || s === 'GENERATING_PROPOSALS_FOR_EXECUTION'
    },
    isInProgressState () {
      return this.isInterBrokerState || this.isIntraBrokerState || this.isStoppingState || this.isLeaderMovementState || this.isInitializingState
    },
    parsedTaskReason () {
      const reason = this.ExecutorState.triggeredTaskReason || ''
      const result = { prefix: '', entries: [] }
      // Format: "Self healing for GOAL_VIOLATION: {key1: val1, key2: val2}"
      const match = reason.match(/^(.*?):\s*\{(.*)\}\s*$/)
      if (!match) return result
      result.prefix = match[1]
      const inner = match[2]
      // Split on top-level commas (not inside braces or parentheses)
      const pairs = []
      let depth = 0
      let current = ''
      for (let i = 0; i < inner.length; i++) {
        const ch = inner[i]
        if (ch === '{' || ch === '(') depth++
        else if (ch === '}' || ch === ')') depth--
        else if (ch === ',' && depth === 0) {
          pairs.push(current.trim())
          current = ''
          continue
        }
        current += ch
      }
      if (current.trim()) pairs.push(current.trim())
      for (const pair of pairs) {
        // Find the first top-level colon (not inside parens/braces)
        let d = 0
        let colonIdx = -1
        for (let i = 0; i < pair.length; i++) {
          if (pair[i] === '{' || pair[i] === '(') d++
          else if (pair[i] === '}' || pair[i] === ')') d--
          else if (pair[i] === ':' && d === 0) { colonIdx = i; break }
        }
        if (colonIdx > 0) {
          result.entries.push({
            key: pair.substring(0, colonIdx).trim(),
            value: pair.substring(colonIdx + 1).trim()
          })
        } else if (pair) {
          result.entries.push({ key: pair, value: '' })
        }
      }
      return result
    },
    getPendingPartitionMovements () {
      if (typeof this.ExecutorState.pendingPartitionMovement === 'undefined') {
        return []
      } else {
        return this.ExecutorState.pendingPartitionMovement.filter(f => f.state === 'PENDING')
      }
    },
    getInProgressPartitionMovements () {
      let inprogress = []
      let pending = []
      if (typeof this.ExecutorState.inProgressPartitionMovement !== 'undefined') {
        inprogress = this.ExecutorState.inProgressPartitionMovement
      }
      if (typeof this.ExecutorState.pendingPartitionMovement !== 'undefined') {
        pending = this.ExecutorState.pendingPartitionMovement
      }
      return inprogress.concat(pending.filter(f => f.state === 'IN_PROGRESS'))
    },
    getPendingIntraBrokerPartitionMovements () {
      if (typeof this.ExecutorState.pendingIntraBrokerPartitionMovement === 'undefined') {
        return []
      } else {
        return this.ExecutorState.pendingIntraBrokerPartitionMovement.filter(f => f.state === 'PENDING')
      }
    },
    getInProgressIntraBrokerPartitionMovements () {
      let inprogress = []
      let pending = []
      if (typeof this.ExecutorState.inProgressIntraBrokerPartitionMovement !== 'undefined') {
        inprogress = this.ExecutorState.inProgressIntraBrokerPartitionMovement
      }
      if (typeof this.ExecutorState.pendingIntraBrokerPartitionMovement !== 'undefined') {
        pending = this.ExecutorState.pendingIntraBrokerPartitionMovement
      }
      return inprogress.concat(pending.filter(f => f.state === 'IN_PROGRESS'))
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
      if (this.autoRefreshInterval) {
        clearInterval(this.autoRefreshInterval)
        this.autoRefreshInterval = null
      }
      if (this.asyncRetryTimer) {
        clearTimeout(this.asyncRetryTimer)
        this.asyncRetryTimer = null
      }
      this.getState()
      if (this.autoRefresh) {
        this.autoRefreshInterval = setInterval(() => {
          if (!this.loading) {
            this.getState()
          }
        }, AUTO_REFRESH_INTERVAL)
      }
    },
    getState () {
      const vm = this
      vm.loading = true
      // Uses fetchCC which sends credentials:'include' for authentication.
      fetchCC(vm.url).then((result) => {
        if (result.type === 'empty') {
          vm.loading = false
          vm.error = true
          vm.errorData = 'CruiseControl sent an empty response with ' + result.status + ' status code.'
        } else if (result.type === 'async') {
          vm.loading = false
          vm.async = true
          vm.asyncData = result.data
          if (vm.autoRefreshInterval) { clearInterval(vm.autoRefreshInterval); vm.autoRefreshInterval = null }
          if (vm.asyncRetryTimer) clearTimeout(vm.asyncRetryTimer)
          vm.asyncRetryTimer = setTimeout(() => vm.getState(), ASYNC_RETRY_DELAY)
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
          vm.$set(vm, 'ExecutorState', Object.assign(JSON.parse(JSON.stringify(DEFAULT_EXECUTOR_STATE)), result.data.ExecutorState))
          vm.loaded = true
          if (vm.autoRefresh && !vm.autoRefreshInterval) {
            vm.autoRefreshInterval = setInterval(() => {
              if (!vm.loading) { vm.getState() }
            }, AUTO_REFRESH_INTERVAL)
          }
        }
      }).catch((e) => {
        if (vm.asyncRetryTimer) { clearTimeout(vm.asyncRetryTimer); vm.asyncRetryTimer = null }
        vm.loading = false
        vm.error = true
        vm.errorData = e.message || e
      })
    },
    toggleAutoRefresh () {
      if (this.autoRefresh) {
        clearInterval(this.autoRefreshInterval)
        this.autoRefreshInterval = null
        this.autoRefresh = false
      } else {
        this.autoRefresh = true
        this.autoRefreshInterval = setInterval(() => {
          if (!this.loading) {
            this.getState()
          }
        }, AUTO_REFRESH_INTERVAL)
      }
    },
    stopProposalExecution () {
      const vm = this
      // cancel the on-going proposal execution
      vm.$http.post(this.stopProposalExecutionURL, null, { withCredentials: true }).then((r) => {
        vm.errStopProposalExecution = false
        vm.okDataStopProposalExecution = r.data
      }, (e) => {
        vm.errStopProposalExecution = true
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

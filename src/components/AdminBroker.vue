<!-- Copyright 2017-2019 LinkedIn Corp. Licensed under the BSD 2-Clause License (the "License"). See License in the project root for license information. -->
<template>
  <div>
    <div v-if='!loading'>
      <div class="alert alert-primary text-right">
        <button class="btn btn-primary" @click='getKafkaState()'>Refresh Broker Details</button>
      </div>
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
    <div v-else-if="!loaded && loading">
      Loading Brokers ...
    </div>
    <div v-else-if='loaded'>
      <table class="table table-sm table-bordered">
        <thead class="thead-light">
          <tr>
            <th>Broker</th>
            <th>#Replicas </th>
            <th>#Leaders</th>
            <th>#Out of Sync Replicas</th>
            <template v-if='KafkaBrokerState.OfflineReplicaCountByBrokerId'>
              <!-- kafka 2.0 bits -->
              <th>#Offline Replicas</th>
              <th>#Online LogDirs</th>
              <th>#Offline LogDirs</th>
            </template>
            <th>Broker(s)</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for='(v, bid) in KafkaBrokerState.ReplicaCountByBrokerId' :class='brokerRowColor'>
            <td>{{ bid }}</td>
            <td>{{ v }}</td>
            <td :class='!KafkaBrokerState.LeaderCountByBrokerId[bid] ? "table-danger" : null'>{{ KafkaBrokerState.LeaderCountByBrokerId[bid] || 0 }}</td>
            <td :class='KafkaBrokerState.OutOfSyncCountByBrokerId[bid] > 0 ? "table-danger" : null'>{{ KafkaBrokerState.OutOfSyncCountByBrokerId[bid] || 0 }}</td>
            <template v-if='KafkaBrokerState.OfflineReplicaCountByBrokerId'>
              <td :class='KafkaBrokerState.OfflineReplicaCountByBrokerId[bid] ? "table-danger" : null'>
                {{ KafkaBrokerState.OfflineReplicaCountByBrokerId[bid] ? KafkaBrokerState.OfflineReplicaCountByBrokerId[bid] : 0 }}
              </td>
              <td>
                {{ KafkaBrokerState.OnlineLogDirsByBrokerId[bid] ? KafkaBrokerState.OnlineLogDirsByBrokerId[bid].length : 0 }}
              </td>
              <td :class='KafkaBrokerState.OfflineLogDirsByBrokerId[bid].length > 0 ? "table-danger" : null'>
                {{ KafkaBrokerState.OfflineLogDirsByBrokerId[bid] ? KafkaBrokerState.OfflineLogDirsByBrokerId[bid].length : 0 }}
              </td>
            </template>
            <td>
              <input type="checkbox" v-model="selectedBrokers" :value='bid'/>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="alert alert-secondary">
        <div class="form-check form-check-inline">
          <input class="form-check-input" type="radio" value="ple" v-model='actionName' :disabled='selectedBrokers.length != 0'>
          <label class="form-check-label">Preferred Leader Election</label>
        </div>
        <div class="form-check form-check-inline">
          <input class="form-check-input" type="radio" value="rebalance" v-model='actionName' :disabled='selectedBrokers.length != 0'>
          <label class="form-check-label">Rebalance Cluster</label>
        </div>
        <div class="form-check form-check-inline">
          <input class="form-check-input" type="radio" value="rebalance_disk" v-model='actionName' :disabled='selectedBrokers.length != 0'>
          <label class="form-check-label">Rebalance Broker Disks</label>
        </div>
        <div class="form-check form-check-inline">
          <input class="form-check-input" type="radio" value="add" v-model='actionName' :disabled='selectedBrokers.length == 0'>
          <label class="form-check-label">Add Brokers</label>
        </div>
        <div class="form-check form-check-inline">
          <input class="form-check-input" type="radio" value="remove" v-model='actionName' :disabled='selectedBrokers.length == 0'>
          <label class="form-check-label">Remove Brokers</label>
        </div>
        <div class="form-check form-check-inline">
          <input class="form-check-input" type="radio" value="demote" v-model='actionName' :disabled='selectedBrokers.length == 0'>
          <label class="form-check-label">Demote Brokers</label>
        </div>
        <div class="form-check form-check-inline float-right" v-if='actionName'>
          <input class="form-check-input" type="checkbox" v-model='showURL'>
          <label class="form-check-label">Show URL</label>
        </div>
      </div>

      <div class="alert alert-primary" v-if='showURL && actionURL'>
        <h6>POST URL</h6>
        <hr>
        <pre>
          <code> {{ actionURL.replace(/\&/g, "\n\t\t&") }} </code>
        </pre>
      </div>

      <!-- PLE options -->
      <div class="alert alert-primary" v-if='actionName === "ple"'>
        <h5>PLE Flags</h5>
        <hr>
        <div class="row">
          <div class="col-md-4">
            <div class="form-inline">
              <label class="form-label"> Concurrent Leader Movements </label>
              <input type="number" class="form-input" v-model='concurrent_leader_movements' placeholder='(CC Default)'>
            </div>
          </div>
          <div class="col-md-4">
            <div class="form-check form-check-inline">
              <input class="form-check-input" type="checkbox" v-model='dryrun'>
              <label class="form-check-label">DryRun</label>
            </div>
          </div>
        </div>
        <div class="text-right">
          <button @click='actionBroker' class="btn btn-primary">Run PLE</button>
        </div>
      </div>

      <!-- Rebalance Broker Disk -->
      <div class="alert alert-primary" v-if='actionName === "rebalance_disk"'>
        <h5>Rebalance Broker Disks</h5>
        <hr>
        <div class="row">
          <div class="col-md-4">
            <div class="form-check form-check-inline">
              <input class="form-check-input" type="checkbox" v-model='dryrun'>
              <label class="form-check-label">DryRun</label>
            </div>
          </div>
        </div>
        <div class="text-right">
          <button @click='actionBroker' class="btn btn-primary">Run Broker Disk Rebalance</button>
        </div>
      </div>


      <!-- Rebalance Cluster Flags -->
      <div class="alert alert-info" v-if='actionName === "rebalance"'>
        <h5>Rebalance Cluster Flags</h5>
        <hr>
        <form>
          <div class="form-check">
            <input class="form-check-input" type="checkbox" v-model='showAdvanced'>
            <label class="form-check-label">
              Show All Options
            </label>
          </div>
          <div class="form-check" v-if='!showAdvanced'>
            <input class="form-check-input" type="checkbox" v-model='dryrun'>
            <label class="form-check-label">
              Dry Run
            </label>
          </div>

          <template v-if='showAdvanced'>
          <hr>
          <div class="row">
            <div class="col-md-4">
              <h6>Choose Goals</h6>
              <div class="form-check" v-for='g in allGoals.goals' v-if='!g.skip'>
                <template v-if='g.group == 1'>
                  <input class="form-check-input" type="checkbox" :value="g.goal" v-model='goals1' :disabled='disable_goals1'>
                  <label class="form-check-label" :title='g.description'>
                    <b v-if='g.hardGoal'>{{ g.goal.replace(/Goal/, '') | splitCamelCase }}</b>
                    <template v-else>{{ g.goal.replace(/Goal/, '') | splitCamelCase }}</template>
                  </label>
                </template>
              </div>
            </div>
            <div class="col-md-4">
              <div class="form-group">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" v-model='disallow_capacity_estimation'>
                  <label class="form-check-label">
                    Disallow Capacity Estimation
                  </label>
                </div>
              </div>
              <div class="form-group">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" v-model='skip_hard_goal_check' :disabled='disable_skip_hard_goal_check'>
                  <label class="form-check-label">
                    Skip Hard Goal Check
                  </label>
                </div>
              </div>
              <div class="form-group">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" v-model='use_ready_default_goals' :disabled='disable_use_ready_default_goals'>
                  <label class="form-check-label">
                    Use Ready Default Goals
                  </label>
                </div>
              </div>
              <div class="form-group">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" v-model='kafka_assigner' :disabled='disable_kafka_assigner'>
                  <label class="form-check-label">
                    Kafka Assigner Mode
                  </label>
                </div>
              </div>
              <div class="form-group">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" v-model='dryrun'>
                  <label class="form-check-label">
                    Dryrun
                  </label>
                </div>
              </div>
            </div>

            <div class="col-md-4">
              <div class="form-row">
                <label class="col-sm-6">Use Data From:</label>
                <div class="col-sm-6">
                  <select v-model=data_from class="form-control">
                    <option value=''>(CC Default)</option>
                    <option value='valid_windows'>Valid Windows</option>
                    <option value='valid_partitions'>Valid Partitions</option>
                  </select>
                </div>
              </div>
              <div class="form-row">
                <label class="col-sm-6">Excluded Topics <b title="Excluded Topics takes  Regular Expression">❓</b></label>
                <div class="col-sm-6">
                  <input type='text' v-model='excluded_topics' class="form-control" placeholder='(CC Default)'>
                </div>
              </div>
              <div class="form-row">
                <label class="col-sm-6">Concurrent Partition Movements Per Broker:</label>
                <div class="col-sm-6">
                  <input class="form-control" type='number' min=0 v-model='concurrent_partition_movements_per_broker' placeholder='(CC Default)'>
                </div>
              </div>
              <div class="form-row">
                <label class="col-sm-6">Concurrent Leader Movements:</label>
                <div class="col-sm-6">
                  <input class="form-control" type='number' min=0 v-model='concurrent_leader_movements' placeholder='(CC Default)'>
                </div>
              </div>
            </div>
          </div>
          </template>
          <div class="text-right">
            <button @click.prevent='actionBroker' class="btn btn-primary" v-if='!showAdvanced'>Execute Rebalance With Default Options</button>
            <button @click.prevent='actionBroker' class="btn btn-primary" v-else>Execute Rebalance</button>
          </div>
        </form>
      </div>

      <!-- Demote Broker additional options -->
      <div class="alert alert-warning" v-if='selectedBrokers.length > 0 && actionName === "demote"'>
        <h5>Demote Broker Flags</h5>
        <hr>
        <div class="row">
          <div class="col-md-4">
            <div class="form-inline">
              <label class="form-label"> Concurrent Leader Movements </label>
              <input type="number" class="form-input" v-model='concurrent_leader_movements' placeholder='(CC Default)'>
            </div>
          </div>
          <div class="col-md-3">
            <div class="form-check form-check-inline">
              <input class="form-check-input" type="checkbox" v-model='disallow_capacity_estimation'>
              <label class="form-check-label">
                Disallow Capacity Estimation
              </label>
            </div>
          </div>
          <div class="col-md-3">
            <div class="form-check form-check-inline">
              <input class="form-check-input" type="checkbox" v-model='dryrun'>
              <label class="form-check-label">DryRun</label>
            </div>
          </div>
          <div class="col-md-2">
            <button @click='actionBroker' class="btn btn-primary">Demote Brokers {{ selectedBrokers }}</button>
          </div>
        </div>
      </div>

      <!-- Remove Broker Flags -->
      <div class="alert alert-danger" v-if='selectedBrokers.length > 0 && actionName === "remove"'>
        <h5>Remove Broker Flags</h5>
        <hr>
        <form>
          <div class="form-check">
            <input class="form-check-input" type="checkbox" v-model='showAdvanced'>
            <label class="form-check-label">
              Show All Options
            </label>
          </div>
          <div class="form-check" v-if='!showAdvanced'>
            <input class="form-check-input" type="checkbox" v-model='dryrun'>
            <label class="form-check-label">
              Dry Run
            </label>
          </div>
          <template v-if='showAdvanced'>
          <hr>
          <div class="row">
            <div class="col-md-4">
              <h6>Choose Goals</h6>
              <div class="form-check" v-for='g in allGoals.goals' v-if='!g.skip'>
                <template v-if='g.group == 1'>
                  <input class="form-check-input" type="checkbox" :value="g.goal" v-model='goals1' :disabled='disable_goals1'>
                  <label class="form-check-label" :title='g.description'>
                    <b v-if='g.hardGoal'>{{ g.goal.replace(/Goal/, '') | splitCamelCase }}</b>
                    <template v-else>{{ g.goal.replace(/Goal/, '') | splitCamelCase }}</template>
                  </label>
                </template>
              </div>
            </div>
            <div class="col-md-4">
              <div class="form-group">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" v-model='disallow_capacity_estimation'>
                  <label class="form-check-label">
                    Disallow Capacity Estimation
                  </label>
                </div>
              </div>
              <div class="form-group">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" v-model='skip_hard_goal_check' :disabled='disable_skip_hard_goal_check'>
                  <label class="form-check-label">
                    Skip Hard Goal Check
                  </label>
                </div>
              </div>
              <div class="form-group">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" v-model='use_ready_default_goals' :disabled='disable_use_ready_default_goals'>
                  <label class="form-check-label">
                    Use Ready Default Goals
                  </label>
                </div>
              </div>
              <div class="form-group">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" v-model='kafka_assigner' :disabled='disable_kafka_assigner'>
                  <label class="form-check-label">
                    Kafka Assigner Mode
                  </label>
                </div>
              </div>
              <div class="form-group">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" v-model='throttle_removed_broker'>
                  <label class="form-check-label">
                    Throttle Removed Broker
                  </label>
                </div>
              </div>
              <div class="form-group">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" v-model='dryrun'>
                  <label class="form-check-label">
                    Dryrun
                  </label>
                </div>
              </div>
            </div>

            <div class="col-md-4">
              <div class="form-row">
                <label class="col-sm-6">Use Data From:</label>
                <div class="col-sm-6">
                  <select v-model=data_from class="form-control">
                    <option value=''>(CC Default)</option>
                    <option value='valid_windows'>Valid Windows</option>
                    <option value='valid_partitions'>Valid Partitions</option>
                  </select>
                </div>
              </div>
              <div class="form-row">
                <label class="col-sm-6">Excluded Topics <b title="Excluded Topics takes  Regular Expression">❓</b></label>
                <div class="col-sm-6">
                  <input type='text' v-model='excluded_topics' class="form-control" placeholder='(CC Default)'>
                </div>
              </div>
              <div class="form-row">
                <label class="col-sm-6">Concurrent Partition Movements Per Broker:</label>
                <div class="col-sm-6">
                  <input class="form-control" type='number' min=0 v-model='concurrent_partition_movements_per_broker' placeholder='(CC Default)'>
                </div>
              </div>
              <div class="form-row">
                <label class="col-sm-6">Concurrent Leader Movements:</label>
                <div class="col-sm-6">
                  <input class="form-control" type='number' min=0 v-model='concurrent_leader_movements' placeholder='(CC Default)'>
                </div>
              </div>
            </div>
          </div>
          </template>
          <div class="text-right">
            <button @click.prevent='actionBroker' class="btn btn-primary" v-if='!showAdvanced'>Remove Brokers {{ selectedBrokers }} With Default Options</button>
            <button @click.prevent='actionBroker' class="btn btn-primary" v-else>Remove Brokers {{ selectedBrokers }}</button>
          </div>
        </form>
      </div>

      <!-- Add Broker Flags -->
      <div class="alert alert-success" v-if='selectedBrokers.length > 0 && actionName === "add"'>
        <h5>Add Broker Flags</h5>
        <hr>
        <form>
          <div class="form-check">
            <input class="form-check-input" type="checkbox" v-model='showAdvanced'>
            <label class="form-check-label">
              Show All Options
            </label>
          </div>
          <div class="form-check" v-if='!showAdvanced'>
            <input class="form-check-input" type="checkbox" v-model='dryrun'>
            <label class="form-check-label">
              Dry Run
            </label>
          </div>
          <template v-if='showAdvanced'>
          <hr>
          <div class="row">
            <div class="col-md-4">
              <h6>Choose Goals</h6>
              <div class="form-check" v-for='g in allGoals.goals' v-if='!g.skip'>
                <template v-if='g.group == 1'>
                  <input class="form-check-input" type="checkbox" :value="g.goal" v-model='goals1' :disabled='disable_goals1'>
                  <label class="form-check-label" :title='g.description'>
                    <b v-if='g.hardGoal'>{{ g.goal.replace(/Goal/, '') | splitCamelCase }}</b>
                    <template v-else>{{ g.goal.replace(/Goal/, '') | splitCamelCase }}</template>
                  </label>
                </template>
              </div>
            </div>
            <div class="col-md-4">
              <div class="form-group">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" v-model='disallow_capacity_estimation'>
                  <label class="form-check-label">
                    Disallow Capacity Estimation
                  </label>
                </div>
              </div>
              <div class="form-group">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" v-model='skip_hard_goal_check' :disabled='disable_skip_hard_goal_check'>
                  <label class="form-check-label">
                    Skip Hard Goal Check
                  </label>
                </div>
              </div>
              <div class="form-group">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" v-model='use_ready_default_goals' :disabled='disable_use_ready_default_goals'>
                  <label class="form-check-label">
                    Use Ready Default Goals
                  </label>
                </div>
              </div>
              <div class="form-group">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" v-model='kafka_assigner' :disabled='disable_kafka_assigner'>
                  <label class="form-check-label">
                    Kafka Assigner Mode
                  </label>
                </div>
              </div>
              <div class="form-group">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" v-model='throttle_added_broker'>
                  <label class="form-check-label">
                    Throttle Added Broker
                  </label>
                </div>
              </div>
              <div class="form-group">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" v-model='dryrun'>
                  <label class="form-check-label">
                    Dryrun
                  </label>
                </div>
              </div>
            </div>
            <div class="col-md-4">
              <div class="form-row">
                <label class="col-sm-6">Use Data From:</label>
                <div class="col-sm-6">
                  <select v-model=data_from class="form-control">
                    <option value=''>(CC Default)</option>
                    <option value='valid_windows'>Valid Windows</option>
                    <option value='valid_partitions'>Valid Partitions</option>
                  </select>
                </div>
              </div>
              <div class="form-row">
                <label class="col-sm-6">Excluded Topics <b title="Excluded Topics takes  Regular Expression">❓</b></label>
                <div class="col-sm-6">
                  <input type='text' v-model='excluded_topics' class="form-control" placeholder='(CC Default)'>
                </div>
              </div>
              <div class="form-row">
                <label class="col-sm-6">Concurrent Partition Movements Per Broker:</label>
                <div class="col-sm-6">
                  <input class="form-control" type='number' min=0 v-model='concurrent_partition_movements_per_broker' placeholder='(CC Default)'>
                </div>
              </div>
              <div class="form-row">
                <label class="col-sm-6">Concurrent Leader Movements:</label>
                <div class="col-sm-6">
                  <input class="form-control" type='number' min=0 v-model='concurrent_leader_movements' placeholder='(CC Default)'>
                </div>
              </div>
            </div>
          </div>
          </template>
          <div class="text-right">
            <button @click.prevent='actionBroker' class="btn btn-primary" v-if='!showAdvanced'>Add Brokers {{ selectedBrokers }} With Default Options</button>
            <button @click.prevent='actionBroker' class="btn btn-primary" v-else>Add Brokers {{ selectedBrokers }}</button>
          </div>
        </form>
      </div>

      <!--
        <pre><code v-if='actionURL'>{{ actionURL.replace(/\&/g, "\n\t") }}</code></pre>
        -->

        <div v-if='posted'>
          <div v-if='postResponse'>
            <button class="btn btn-info" @click='clearPostResponse'>Clear Response</button>
            <exception :exception='postResponse'></exception>
          </div>
          <div class='alert alert-success' v-else>
            Waiting for Response ...
          </div>
        </div>
    </div>
  </div>
</template>

<script>
// Disable this due to https://github.com/linkedin/cruise-control-ui/issues/40
// import xssFilters from 'xss-filters'
import goals from '@/goals'
import BrokerState from '@/components/BrokerState'

export default {
  name: 'AdminBroker',
  props: {
    group: String,
    cluster: String
  },
  components: {
    BrokerState
  },
  data () {
    return {
      sortColumn: 'Replicas', // column on which data needs to be sorted
      loading: false, // true if the data is being fetched now
      loaded: false, // true if data is fetched at-least once
      error: false, // in case server sent non 200 OK Response
      errorData: null, // complete error data
      selectedBrokers: [],
      // This is the response from the CC
      KafkaBrokerState: {
        OfflineLogDirsByBrokerId: {},
        ReplicaCountByBrokerId: {},
        OutOfSyncCountByBrokerId: {},
        OnlineLogDirsByBrokerId: {},
        LeaderCountByBrokerId: {},
        OfflineReplicaCountByBrokerId: {}
      },
      allGoals: goals, // goals from configuration
      /*
       * x                              Goals   Disallow-Capacity-Estimation   Skip-Hard-Goal-Check   Use-Ready-Default-Goals   Kafka-Assigner-Mode   Module
       * Goals                          1       1                              1                      0                         0                     Analyzer
       * Disallow-Capacity-Estimation   1       1                              1                      1                         1                     Capacity-Resolver
       * Skip-Hard-Goal-Check           1       1                              1                      1                         0                     Analyzer
       * Use-Ready-Default-Goals        0       1                              1                      1                         0                     Analyzer
       * Kafka-Assigner-Mode            0       1                              0                      0                         1                     Analyzer
       */
      // disable user flags
      disable_goals1: false,
      disable_skip_hard_goal_check: false,
      disable_use_ready_default_goals: false,
      disable_kafka_assigner: false,
      // user flags
      showAdvanced: false, // show all options on UI ?
      showURL: false, // show the URL on UI if true
      goals1: [], // non kafka assigner goals
      goals2: [], // kafka assigner goals
      skip_hard_goal_check: false, // Check CC Documentation
      use_ready_default_goals: false, // Check CC Documentation
      disallow_capacity_estimation: false, // Check CC Documentation
      kafka_assigner: false, // Check CC Documentation
      data_from: '', // Check CC Documentation
      excluded_topics: '', // Check CC Documentation
      concurrent_partition_movements_per_broker: null, // Check CC Documentation
      concurrent_leader_movements: null, // Check CC Documentation
      throttle_removed_broker: false, // Check CC Documentation
      throttle_added_broker: false, // Check CC Documentation
      // workflow
      actionName: 'ple', // radio to chose an action on ui
      dryrun: true, // part of URL
      posted: false, // true if a POST method is made
      posturl: null, // POST url
      postResponse: '', // POST response from server
      detectedUserTaskId: false // true in case the response has user-task-id
    }
  },
  created () {
    this.argsChanged()
  },
  computed: {
    taskId () {
      return this.$store.getters.getTaskId(this.url)
    },
    disableGoals () {
      return this.kafka_assigner || this.use_ready_default_goals
    },
    brokerRowColor () {
      return null
    },
    actionURL () {
      let vm = this
      // dryrun should always be there in URL
      let params = {
        dryrun: vm.dryrun
      }
      if (vm.actionName === 'remove' || vm.actionName === 'add' || vm.actionName === 'demote') {
        if (vm.selectedBrokers) {
          params.brokerid = vm.selectedBrokers
        }
        if (vm.disallow_capacity_estimation) {
          params.allow_capacity_estimation = !vm.disallow_capacity_estimation
        }
      }
      if (vm.actionName === 'remove' || vm.actionName === 'add' || vm.actionName === 'rebalance') {
        if (vm.goals1.length > 0) {
          params.goals = vm.goals1
        }
        if (vm.goals2.length > 0) {
          params.kafka_assigner = true
        }
        if (vm.skip_hard_goal_check) {
          params.skip_hard_goal_check = vm.skip_hard_goal_check
        }
        if (vm.use_ready_default_goals) {
          params.use_ready_default_goals = vm.use_ready_default_goals
        }
        if (vm.disallow_capacity_estimation) {
          params.allow_capacity_estimation = !vm.disallow_capacity_estimation
        }
        if (vm.kafka_assigner) {
          params.kafka_assigner = vm.kafka_assigner
        }
        if (vm.data_from && vm.data_from.length > 0) {
          params.data_from = vm.data_from
        }
        if (vm.concurrent_partition_movements_per_broker) {
          params.concurrent_partition_movements_per_broker = vm.concurrent_partition_movements_per_broker
        }
        if (vm.concurrent_leader_movements) {
          params.concurrent_leader_movements = vm.concurrent_leader_movements
        }
        if (vm.excluded_topics && vm.excluded_topics.length > 0) {
          // Disable this due to https://github.com/linkedin/cruise-control-ui/issues/40
          // params.excluded_topics = xssFilters.uriQueryInDoubleQuotedAttr(vm.excluded_topics)
          params.excluded_topics = vm.excluded_topics
        }
      }
      if (vm.actionName === 'remove') {
        // POST /kafkacruisecontrol/remove_broker
        //  ?brokerid=[id1,id2...]
        //  &goals=[goal1,goal2...]
        //  &skip_hard_goal_check=[true/false]
        //  &use_ready_default_goals=[true/false]
        //  &allow_capacity_estimation=[true/false]
        //  &kafka_assigner=[true/false]
        //  &dryrun=[true/false]
        //  &data_from=[valid_windows/valid_partitions]
        //  &excluded_topics=[TOPICS]
        //  &concurrent_partition_movements_per_broker=[concurrency]
        //  &concurrent_leader_movements=[concurrency]
        //  &throttle_removed_broker=[true/false]
        //  &json=[true/false]
        if (vm.throttle_removed_broker) {
          params.throttle_removed_broker = params.throttle_removed_broker
        }
        return vm.$helpers.getURL('remove_broker', params)
      }
      if (vm.actionName === 'demote') {
        // POST /kafkacruisecontrol/demote_broker
        //  ?brokerid=[id1, id2...]
        //  &dryrun=[true/false]
        //  &json=[true/false]
        //  &allow_capacity_estimation=[true/false]
        //  &concurrent_leader_movements=[concurrency]
        return vm.$helpers.getURL('demote_broker', params)
      }
      if (vm.actionName === 'add') {
        // POST /kafkacruisecontrol/add_broker
        //  ?brokerid=[id1,id2...]
        //  &goals=[goal1,goal2...]
        //  &dryrun=[true/false]
        //  &throttle_added_broker=[true/false]
        //  &kafka_assigner=[true/false]
        //  &json=[true/false]
        //  &&allow_capacity_estimation=[true/false]
        //  &concurrent_partition_movements_per_broker=[concurrency]
        //  &concurrent_leader_movements=[concurrency]
        //  &data_from=[valid_windows/valid_partitions]
        //  &skip_hard_goal_check=[true/false]
        //  &excluded_topics=[TOPICS]
        //  &use_ready_default_goals=[true/false]
        if (vm.throttle_added_broker) {
          params.throttle_added_broker = vm.throttle_added_broker
        }
        return vm.$helpers.getURL('add_broker', params)
      }
      if (vm.actionName === 'ple') {
        if (vm.concurrent_leader_movements > 0) {
          params.concurrent_leader_movements = vm.concurrent_leader_movements
        }
        params.goals = 'PreferredLeaderElectionGoal'
        return vm.$helpers.getURL('rebalance', params)
      }
      if (vm.actionName === 'rebalance') {
        // POST /kafkacruisecontrol/rebalance
        //  ?goals=[goal1,goal2...]
        //  &skip_hard_goal_check=[true/false]
        //  &use_ready_default_goals=[true/false]
        //  &allow_capacity_estimation=[true/false]
        //  &kafka_assigner=[true/false]
        //  &dryrun=[true/false]
        //  &data_from=[valid_windows/valid_partitions]
        //  &json=[true/false]
        //  &concurrent_partition_movements_per_broker=[concurrency]
        //  &concurrent_leader_movements=[concurrency]
        //  &excluded_topics=[TOPICS]
        return vm.$helpers.getURL('rebalance', params)
      }
      if (vm.actionName === 'rebalance_disk') {
        // POST /kafkacruisecontrol/rebalance
        // ?dryrun=[true/false]
        // ?rebalance_disk=true
        params.rebalance_disk = 'true'

        return vm.$helpers.getURL('rebalance', params)
      }
      // console.log(' no url !')
    }
  },
  watch: {
    goals1: function (n, o) {
      this.disable_use_ready_default_goals = n.length > 0
      this.disable_kafka_assigner = n.length > 0
    },
    skip_hard_goal_check: function (n, o) {
      // console.log(n, o)
      if (n) {
        this.disable_kafka_assigner = true
      } else {
        this.disable_kafka_assigner = false
      }
    },
    use_ready_default_goals: function (n, o) {
      if (n) {
        this.goals1 = []
      }
      this.disable_goals1 = n
    },
    kafka_assigner: function (n, o) {
      if (n) {
        this.goals1 = []
        this.disable_goals1 = true
        this.disable_skip_hard_goal_check = true
        this.disable_use_ready_default_goals = true
      } else {
        this.disable_goals1 = false
        this.disable_skip_hard_goal_check = false
        this.disable_use_ready_default_goals = false
      }
    },
    showAdvanced: function (n, o) {
      if (!n) {
        this.goals1 = []
        this.disallow_capacity_estimation = false
        this.skip_hard_goal_check = false
        this.use_ready_default_goals = false
        this.kafka_assigner = false
        this.data_from = ''
        this.excluded_topics = null
        this.concurrent_partition_movements_per_broker = 0
        this.concurrent_leader_movements = 0
      }
    },
    group: function (ogroup, ngroup) {
      this.argsChanged()
    },
    cluster: function (ocluster, ncluster) {
      this.argsChanged()
    },
    selectedBrokers (n, o) {
      if (n.length > 0) {
        this.actionName = 'add'
      } else {
        this.actionName = 'ple'
      }
    }
  },
  methods: {
    clearPostResponse () {
      this.posted = false
      this.postResponse = ''
    },
    argsChanged () {
      const newurl = this.$store.getters.getnewurl(this.group, this.cluster)
      this.$store.commit('seturl', newurl)
      this.loaded = false
      this.newurl = newurl
      this.clearPostResponse()
      this.getKafkaState()
    },
    actionBroker () {
      let vm = this
      vm.posted = true
      this.clearPostResponse()
      let params = {
        withCredentials: true
      }
      // check if there is a running user-task-id for this end point in the $store
      // let task = this.$store.getters.getTaskId('proposals')
      let task = this.$store.getters.getTaskId(vm.actionURL)
      if (task) {
        params['headers'] = {
          'User-Task-ID': task
        }
      }
      this.$http.post(vm.actionURL, params).then((r) => {
        // set this so that we know if the server sends user-task-id in the response
        vm.detectedUserTaskId = r.headers.hasOwnProperty('user-task-id')
        // store this task in local cache for future follow-up
        let task = r.headers.hasOwnProperty('user-task-id') ? r.headers['user-task-id'] : null
        vm.$store.commit('setTaskId', {url: vm.actionURL, taskid: task}) // save this task for follow-up calls (null deletes in vuex)
        vm.posted = true
        vm.postResponse = r.data
      }, (e) => {
        vm.posted = true
        vm.postResponse = e && e.response ? e.response.data : e
      })
    },
    getKafkaState () {
      const vm = this
      vm.error = false
      vm.async = false
      vm.loading = true
      let url = vm.$helpers.getURL('kafka_cluster_state')
      // console.log(url)
      this.$http.get(url, {withCredentials: true}).then((r) => {
        // set this so that we know if the server sends user-task-id in the response
        vm.detectedUserTaskId = r.headers.hasOwnProperty('user-task-id')
        // do verify the state
        if (r.data === null || r.data === undefined || r.data === '') {
          vm.error = true
          vm.errorData = 'CruiseControl sent an empty response with 200-OK status code. Please file a bug here https://github.com/linkedin/cruise-control/issues'
        } else if (r.headers['content-type'].match(/text\/plain/) || r.data.progress) {
          vm.async = true
          vm.asyncData = r.data
          vm.showAsyncRefreshButton = true
        } else {
          vm.async = false
          vm.error = false
          vm.errorData = null
          vm.loading = false
          vm.loaded = true
          vm.KafkaBrokerState.ReplicaCountByBrokerId = r.data.KafkaBrokerState.ReplicaCountByBrokerId
          vm.KafkaBrokerState.OutOfSyncCountByBrokerId = r.data.KafkaBrokerState.OutOfSyncCountByBrokerId
          vm.KafkaBrokerState.LeaderCountByBrokerId = r.data.KafkaBrokerState.LeaderCountByBrokerId
          // only >= kafka 2.0 release
          try {
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

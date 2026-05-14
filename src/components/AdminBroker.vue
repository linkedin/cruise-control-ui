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
        <button class="btn btn-sm btn-secondary" @click='getKafkaState()'>⟳ Refresh View Now</button>
      </div>
      <async-task :asyncData='asyncData'></async-task>
    </div>
    <div v-else-if="!loaded && loading">
      <div class="text-center p-3"><div class="spinner-border text-primary" role="status"></div> Loading ...</div>
    </div>
    <div v-else-if='loaded'>
      <div class="form-inline mb-2">
        <input type="text" class="form-control form-control-sm" v-model="adminFilterText" placeholder="Filter by Broker ID, Host, or Rack...">
      </div>
      <table class="table table-sm table-bordered">
        <thead class="thead-light">
          <tr>
            <th @click='sortAdmin("bid")' style="cursor:pointer">Broker</th>
            <th @click='sortAdmin("host")' style="cursor:pointer">Host</th>
            <th @click='sortAdmin("rack")' style="cursor:pointer">Rack</th>
            <th @click='sortAdmin("state")' style="cursor:pointer">State</th>
            <th @click='sortAdmin("replicas")' style="cursor:pointer">#Replicas</th>
            <th @click='sortAdmin("leaders")' style="cursor:pointer">#Leaders</th>
            <th @click='sortAdmin("outofsync")' style="cursor:pointer">#Out of Sync Replicas</th>
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
          <tr v-for='row in filteredAdminBrokers' :key='row.bid'>
            <td>{{ row.bid }}</td>
            <td>{{ row.host }}</td>
            <td>{{ row.rack || 'N/A' }}</td>
            <td><broker-state :state='row.state'></broker-state></td>
            <td>{{ row.replicas }}</td>
            <td :class='!row.leaders ? "table-danger" : null'>{{ row.leaders }}</td>
            <td :class='row.outofsync > 0 ? "table-danger" : null'>{{ row.outofsync }}</td>
            <template v-if='KafkaBrokerState.OfflineReplicaCountByBrokerId'>
              <td :class='row.offlineReplicas ? "table-danger" : null'>
                {{ row.offlineReplicas }}
              </td>
              <td>
                {{ row.onlineLogDirs }}
              </td>
              <td :class='row.offlineLogDirs > 0 ? "table-danger" : null'>
                {{ row.offlineLogDirs }}
              </td>
            </template>
            <td>
              <input type="checkbox" v-model="selectedBrokers" :value='row.bid'/>
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
        <div class="form-group mt-2">
          <label>Reason:</label>
          <input class="form-control" type='text' v-model='reason' placeholder='Reason for this action (optional)'>
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
          <div class="col-md-4">
            <div class="form-inline">
              <label class="form-label">Intra-Broker Replication Throttle (bytes/sec):</label>
              <input class="form-control" type='number' min=1 v-model='intra_broker_replication_throttle' placeholder='(CC Default)'>
            </div>
          </div>
        </div>
        <div class="form-group mt-2">
          <label>Reason:</label>
          <input class="form-control" type='text' v-model='reason' placeholder='Reason for this rebalance (optional)'>
        </div>
        <div class="text-right">
          <button @click='actionBroker' class="btn btn-primary">Run Broker Disk Rebalance</button>
        </div>
      </div>

      <!-- Rebalance Cluster Flags -->
      <div class="alert alert-info" v-if='actionName === "rebalance"'>
        <h5>Rebalance Cluster Flags</h5>
        <hr>
        <form @submit.prevent>
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
              <template v-for='g in allGoals.goals'>
              <div class="form-check" v-if='!g.skip && g.group == 1' :key='g.goal'>
                  <input class="form-check-input" type="checkbox" :value="g.goal" v-model='goals1' :disabled='disable_goals1'>
                  <label class="form-check-label" :title='g.description'>
                    <b v-if='g.hardGoal'>{{ g.goal.replace(/Goal/, '') | splitCamelCase }}</b>
                    <template v-else>{{ g.goal.replace(/Goal/, '') | splitCamelCase }}</template>
                  </label>
              </div>
              </template>
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
              <div class="form-row">
                <label class="col-sm-6">Replication Throttle (bytes per second):</label>
                <div class="col-sm-6">
                  <input class="form-control" type='number' min=0 v-model='replication_throttle' placeholder='(CC Default)'>
                </div>
              </div>
            </div>
          </div>
          </template>
          <div class="form-group mt-2">
            <label>Reason:</label>
            <input class="form-control" type='text' v-model='reason' placeholder='Reason for this rebalance (optional)'>
          </div>
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
        <form @submit.prevent>
          <div class="form-check">
            <input class="form-check-input" type="checkbox" v-model='dryrun'>
            <label class="form-check-label">DryRun</label>
          </div>
          <hr>
          <div class="row">
            <div class="col-md-4">
              <div class="form-inline">
                <label class="form-label"> Concurrent Leader Movements </label>
                <input type="number" class="form-input" v-model='concurrent_leader_movements' placeholder='(CC Default)'>
              </div>
            </div>
            <div class="col-md-4">
              <div class="form-inline">
                <label class="form-label">Replication Throttle (bytes per second):</label>
                <input class="form-input" type='number' min=0 v-model='replication_throttle' placeholder='(CC Default)'>
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
          </div>
          <div class="form-group mt-2">
            <label>Reason:</label>
            <input class="form-control" type='text' v-model='reason' placeholder='Reason for this action (optional)'>
          </div>
          <div class="text-right">
            <button @click='actionBroker' class="btn btn-primary">Demote Brokers {{ selectedBrokers }}</button>
          </div>
        </form>
      </div>

      <!-- Remove Broker Flags -->
      <div class="alert alert-danger" v-if='selectedBrokers.length > 0 && actionName === "remove"'>
        <h5>Remove Broker Flags</h5>
        <hr>
        <form @submit.prevent>
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
              <template v-for='g in allGoals.goals'>
              <div class="form-check" v-if='!g.skip && g.group == 1' :key='g.goal'>
                  <input class="form-check-input" type="checkbox" :value="g.goal" v-model='goals1' :disabled='disable_goals1'>
                  <label class="form-check-label" :title='g.description'>
                    <b v-if='g.hardGoal'>{{ g.goal.replace(/Goal/, '') | splitCamelCase }}</b>
                    <template v-else>{{ g.goal.replace(/Goal/, '') | splitCamelCase }}</template>
                  </label>
              </div>
              </template>
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
              <div class="form-row">
                <label class="col-sm-6">Replication Throttle (bytes per second):</label>
                <div class="col-sm-6">
                  <input class="form-control" type='number' min=0 v-model='replication_throttle' placeholder='(CC Default)'>
                </div>
              </div>
            </div>
          </div>
          </template>
          <div class="form-group mt-2">
            <label>Reason:</label>
            <input class="form-control" type='text' v-model='reason' placeholder='Reason for this action (optional)'>
          </div>
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
        <form @submit.prevent>
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
              <template v-for='g in allGoals.goals'>
              <div class="form-check" v-if='!g.skip && g.group == 1' :key='g.goal'>
                  <input class="form-check-input" type="checkbox" :value="g.goal" v-model='goals1' :disabled='disable_goals1'>
                  <label class="form-check-label" :title='g.description'>
                    <b v-if='g.hardGoal'>{{ g.goal.replace(/Goal/, '') | splitCamelCase }}</b>
                    <template v-else>{{ g.goal.replace(/Goal/, '') | splitCamelCase }}</template>
                  </label>
              </div>
              </template>
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
              <div class="form-row">
                <label class="col-sm-6">Replication Throttle (bytes per second):</label>
                <div class="col-sm-6">
                  <input class="form-control" type='number' min=0 v-model='replication_throttle' placeholder='(CC Default)'>
                </div>
              </div>
            </div>
          </div>
          </template>
          <div class="form-group mt-2">
            <label>Reason:</label>
            <input class="form-control" type='text' v-model='reason' placeholder='Reason for this action (optional)'>
          </div>
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
            <div v-if='dataParsed'>
              <table class="table table-sm table-bordered">
                <thead class="thead-light">
                  <tr>
                    <th>Replica Movements</th>
                    <th>Leader Movements</th>
                    <th>Recent Windows</th>
                    <th>Data To Move</th>
                    <th>Monitored Partitions %</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{{ numReplicaMovements | formatNumber }}</td>
                    <td>{{ numLeaderMovements | formatNumber }}</td>
                    <td>{{ recentWindows | formatNumber }}</td>
                    <td>{{ dataToMoveMB | formatUnits }}</td>
                    <td>{{ monitoredPartitionsPercentage | formatDecimal }} %</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-if='postError'>
              <exception :exception='postResponse'></exception>
            </div>
            <div v-else>
              <div class="alert alert-success">Action submitted successfully.</div>
              <button class="btn btn-sm btn-outline-secondary mb-2" @click="showRawResponse = !showRawResponse">
                {{ showRawResponse ? 'Hide' : 'Show' }} Raw Response
              </button>
              <pre v-if="showRawResponse" class="bg-light p-2 border" style="max-height:400px;overflow:auto;white-space:pre-wrap"><code>{{ typeof postResponse === 'string' ? postResponse : JSON.stringify(postResponse, null, 2) }}</code></pre>
            </div>
            <div v-if='!dataParsed && !postError && typeof postResponse === "object"'>
              <h6>Response Summary</h6>
              <table class="table table-sm table-bordered">
                <thead class="thead-light">
                  <tr>
                    <th>Key</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(val, key) in flatSummary" :key="key">
                    <td>{{ key }}</td>
                    <td>{{ val }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
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
import { ASYNC_RETRY_DELAY, ARGS_RETRY_MAX, ARGS_RETRY_DELAY } from '@/constants'
import fetchCC from '@/fetchCC'
const sortBy = require('lodash.sortby')

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
      async: false,
      asyncData: null,
      argsRetryTimer: null,
      asyncRetryTimer: null,
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
      brokerDetails: {}, // host, rack, state per broker from /load endpoint
      adminFilterText: '',
      adminSortColumn: 'bid', // column to sort admin broker table
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
      replication_throttle: null, // Check CC Documentation
      intra_broker_replication_throttle: null, // Check CC Documentation
      reason: '', // Check CC Documentation
      throttle_removed_broker: false, // Check CC Documentation
      throttle_added_broker: false, // Check CC Documentation
      // workflow
      actionName: 'ple', // radio to chose an action on ui
      dryrun: true, // part of URL
      posted: false, // true if a POST method is made
      posturl: null, // POST url
      postResponse: '', // POST response from server
      detectedUserTaskId: false, // true in case the response has user-task-id
      postError: false, // true if the POST response is an error
      showRawResponse: false, // toggle raw JSON response view
      showAsyncRefreshButton: false, // show refresh button during async state
      dataParsed: false,
      numReplicaMovements: null,
      recentWindows: null,
      dataToMoveMB: null,
      monitoredPartitionsPercentage: null,
      numLeaderMovements: null
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
  computed: {
    disableGoals () {
      return this.kafka_assigner || this.use_ready_default_goals
    },
    sortedAdminBrokers () {
      const vm = this
      const rows = Object.keys(vm.KafkaBrokerState.ReplicaCountByBrokerId).map(function (bid) {
        const d = vm.brokerDetails[bid]
        return {
          bid: parseInt(bid, 10),
          host: d ? d.Host : '',
          rack: d && d.Rack && d.Rack !== d.Host ? d.Rack : '',
          state: d ? d.BrokerState : '',
          replicas: vm.KafkaBrokerState.ReplicaCountByBrokerId[bid] || 0,
          leaders: vm.KafkaBrokerState.LeaderCountByBrokerId[bid] || 0,
          outofsync: vm.KafkaBrokerState.OutOfSyncCountByBrokerId[bid] || 0,
          offlineReplicas: vm.KafkaBrokerState.OfflineReplicaCountByBrokerId ? (vm.KafkaBrokerState.OfflineReplicaCountByBrokerId[bid] || 0) : 0,
          onlineLogDirs: vm.KafkaBrokerState.OnlineLogDirsByBrokerId && vm.KafkaBrokerState.OnlineLogDirsByBrokerId[bid] ? vm.KafkaBrokerState.OnlineLogDirsByBrokerId[bid].length : 0,
          offlineLogDirs: vm.KafkaBrokerState.OfflineLogDirsByBrokerId && vm.KafkaBrokerState.OfflineLogDirsByBrokerId[bid] ? vm.KafkaBrokerState.OfflineLogDirsByBrokerId[bid].length : 0
        }
      })
      return sortBy(rows, vm.adminSortColumn)
    },
    filteredAdminBrokers () {
      if (!this.adminFilterText) return this.sortedAdminBrokers
      const q = this.adminFilterText.toLowerCase()
      return this.sortedAdminBrokers.filter(b => {
        return String(b.bid).includes(q) ||
          (b.host && b.host.toLowerCase().includes(q)) ||
          (b.rack && b.rack.toLowerCase().includes(q))
      })
    },
    flatSummary () {
      if (!this.postResponse || typeof this.postResponse !== 'object') return {}
      const result = {}
      const skip = ['loadBeforeOptimization', 'loadAfterOptimization', 'goalSummary', 'goals', 'summary']
      Object.keys(this.postResponse).forEach(key => {
        if (skip.indexOf(key) !== -1) return
        const val = this.postResponse[key]
        if (val === null || val === undefined) return
        if (typeof val === 'object') return
        result[key] = val
      })
      return result
    },
    actionURL () {
      const vm = this
      // dryrun should always be there in URL
      const params = {
        dryrun: vm.dryrun
      }
      if (vm.reason && vm.reason.length > 0) {
        params.reason = vm.reason
      }
      if (vm.actionName === 'remove' || vm.actionName === 'add' || vm.actionName === 'demote') {
        if (vm.selectedBrokers) {
          params.brokerid = vm.selectedBrokers
        }
        if (vm.disallow_capacity_estimation) {
          params.allow_capacity_estimation = !vm.disallow_capacity_estimation
        }
        if (vm.concurrent_leader_movements) {
          params.concurrent_leader_movements = vm.concurrent_leader_movements
        }
        if (vm.replication_throttle) {
          params.replication_throttle = vm.replication_throttle
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
        if (vm.replication_throttle) {
          params.replication_throttle = vm.replication_throttle
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
        //  &replication_throttle=[throttle]
        //  &json=[true/false]
        if (vm.throttle_removed_broker) {
          params.throttle_removed_broker = vm.throttle_removed_broker
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
        //  &replication_throttle=[throttle]
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
        //  &replication_throttle=[throttle]
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
        //  &replication_throttle=[throttle]
        return vm.$helpers.getURL('rebalance', params)
      }
      if (vm.actionName === 'rebalance_disk') {
        // POST /kafkacruisecontrol/rebalance
        // ?dryrun=[true/false]
        // ?rebalance_disk=true
        // ?intra_broker_replication_throttle=[throttle]
        // ?reason=[reason]
        params.rebalance_disk = 'true'
        if (vm.intra_broker_replication_throttle) {
          params.intra_broker_replication_throttle = vm.intra_broker_replication_throttle
        }

        return vm.$helpers.getURL('rebalance', params)
      }
      return ''
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
        this.excluded_topics = ''
        this.concurrent_partition_movements_per_broker = null
        this.concurrent_leader_movements = null
        this.replication_throttle = null
        this.intra_broker_replication_throttle = null
        this.reason = ''
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
    },
    adminFilterText () {
      this.selectedBrokers = []
    }
  },
  methods: {
    sortAdmin (col) {
      this.adminSortColumn = col
    },
    clearPostResponse () {
      this.posted = false
      this.postResponse = ''
      this.postError = false
      this.showRawResponse = false
      this.dataParsed = false
      this.numReplicaMovements = null
      this.recentWindows = null
      this.dataToMoveMB = null
      this.monitoredPartitionsPercentage = null
      this.numLeaderMovements = null
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
      this.clearPostResponse()
      if (this.asyncRetryTimer) {
        clearTimeout(this.asyncRetryTimer)
        this.asyncRetryTimer = null
      }
      this.getKafkaState()
      this.getBrokerDetails()
    },
    actionBroker () {
      const vm = this
      this.clearPostResponse()
      vm.posted = true
      vm.doPost(vm.actionURL)
    },
    doPost (url, retried) {
      const vm = this
      const params = {
        withCredentials: true
      }
      // User-Task-ID header is only for polling async GET requests, not for initiating new POST actions.
      // Sending a stale task ID on a new POST causes CC to reject with "Unexpected header" error.
      this.$http.post(url, null, params).then((r) => {
        vm.detectedUserTaskId = Object.prototype.hasOwnProperty.call(r.headers, 'user-task-id')
        vm.posted = true
        vm.postError = false
        vm.postResponse = r.data
        const summary = (r.data && r.data.summary) || r.data
        if (summary && typeof summary === 'object' && (summary.numReplicaMovements != null || summary.numLeaderMovements != null || summary.numIntraBrokerReplicaMovements != null)) {
          vm.dataParsed = true
          vm.numReplicaMovements = (summary.numReplicaMovements || summary.numIntraBrokerReplicaMovements) || 0
          vm.numLeaderMovements = summary.numLeaderMovements
          vm.recentWindows = summary.recentWindows
          vm.dataToMoveMB = (summary.dataToMoveMB || summary.intraBrokerDataToMoveMB) || 0
          vm.monitoredPartitionsPercentage = summary.monitoredPartitionsPercentage
        }
      }, (e) => {
        const errData = e && e.response ? e.response.data : null
        const errMsg = typeof errData === 'string' ? errData : (errData && errData.errorMessage) || ''
        // If CC doesn't support intra_broker_replication_throttle, retry without it (once)
        if (!retried && e && e.response && e.response.status === 400 && errMsg.indexOf('intra_broker_replication_throttle') !== -1) {
          const retryUrl = url.replace(/([?&])intra_broker_replication_throttle=[^&]*&?/, '$1').replace(/[?&]$/, '')
          vm.intra_broker_replication_throttle = null
          vm.doPost(retryUrl, true)
          return
        }
        vm.posted = true
        vm.postError = true
        vm.postResponse = errData || e
      })
    },
    getBrokerDetails () {
      const vm = this
      const url = vm.$helpers.getURL('load', { allow_capacity_estimation: true })
      fetchCC(url).then((result) => {
        if (result.type === 'success' && result.data && result.data.brokers) {
          const details = {}
          result.data.brokers.forEach(function (b) {
            details[String(b.Broker)] = b
          })
          vm.brokerDetails = details
        }
      }).catch(() => {
        // silently ignore - broker details are supplementary
      })
    },
    getKafkaState () {
      const vm = this
      vm.error = false
      vm.async = false
      vm.loading = true
      const url = vm.$helpers.getURL('kafka_cluster_state')
      fetchCC(url).then((result) => {
        vm.detectedUserTaskId = result.headers.has('user-task-id')
        if (result.type === 'error') {
          if (vm.asyncRetryTimer) { clearTimeout(vm.asyncRetryTimer); vm.asyncRetryTimer = null }
          vm.loading = false
          vm.loaded = false
          vm.error = true
          vm.errorData = result.data || result.status
        } else if (result.type === 'empty') {
          vm.loading = false
          vm.error = true
          vm.errorData = 'CruiseControl sent an empty response with 200-OK status code. Please file a bug here https://github.com/linkedin/cruise-control/issues'
        } else if (result.type === 'async') {
          vm.loading = false
          vm.async = true
          vm.asyncData = result.data
          vm.showAsyncRefreshButton = true
          if (vm.asyncRetryTimer) clearTimeout(vm.asyncRetryTimer)
          vm.asyncRetryTimer = setTimeout(() => vm.getKafkaState(), ASYNC_RETRY_DELAY)
        } else {
          if (vm.asyncRetryTimer) { clearTimeout(vm.asyncRetryTimer); vm.asyncRetryTimer = null }
          vm.async = false
          vm.error = false
          vm.errorData = null
          vm.loading = false
          vm.loaded = true
          vm.showAsyncRefreshButton = false
          const data = result.data
          vm.KafkaBrokerState.ReplicaCountByBrokerId = data.KafkaBrokerState.ReplicaCountByBrokerId
          vm.KafkaBrokerState.OutOfSyncCountByBrokerId = data.KafkaBrokerState.OutOfSyncCountByBrokerId
          vm.KafkaBrokerState.LeaderCountByBrokerId = data.KafkaBrokerState.LeaderCountByBrokerId
          try {
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
        vm.errorData = e
      })
    }
  }
}
</script>

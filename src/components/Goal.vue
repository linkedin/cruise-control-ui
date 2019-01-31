<!-- Copyright 2017-2019 LinkedIn Corp. Licensed under the BSD 2-Clause License (the "License"). See License in the project root for license information. -->
<template>
  <div>
  <table class="table table-sm table-bordered table-fixed">
    <thead class='thead-light'>
      <tr>
        <th>Brokers</th>
        <th>Replicas</th>
        <th>Topics</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th>{{ goal.clusterModelStats.metadata.brokers }}</th>
        <th>{{ goal.clusterModelStats.metadata.replicas }}</th>
        <th>{{ goal.clusterModelStats.metadata.topics }}</th>
      </tr>
    </tbody>
  </table>
  <table class="table table-sm table-fixed">
    <thead class='thead-light'>
      <tr>
        <th></th>
        <th>Disk</th>
        <th>Replicas</th>
        <th>Cpu</th>
        <th>Network Outbound</th>
        <th>Network Inbound</th>
        <th>Topic Replicas</th>
        <th>Potential Network Out</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for='(v, k) in goal.clusterModelStats.statistics'>
        <th>{{ k }}</th>
        <td>{{ v.disk | formatUnits }}</td>
        <td>{{ v.replicas.toFixed(0) }}</td>
        <td>{{ v.cpu.toFixed(0) }}</td>
        <td>{{ v.networkOutbound | formatNetworkUnits }}</td>
        <td>{{ v.networkInbound | formatNetworkUnits }}</td>
        <td>{{ v.topicReplicas.toFixed(0) }}</td>
        <td>{{ v.potentialNwOut | formatNetworkUnits }}</td>
      </tr>
    </tbody>
  </table>
  </div>
</template>

<script>
export default {
  name: 'Goal',
  props: {
    goal: Object
  }
}
</script>

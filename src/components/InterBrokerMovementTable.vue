<template>
  <div class="card-deck mb-3" v-if="!hideEmpty || movements.length">
    <h4>{{ title }} ({{ movements.length }})</h4>
    <table :class="tableClass">
      <thead :class="theadClass">
        <tr>
          <th>Topic</th>
          <th>Partition</th>
          <th>Old Replica</th>
          <th>New Replica</th>
          <th>Movement Type</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(h, idx) in movements" :key="idx">
          <td>{{ h.proposal.topicPartition.topic }}</td>
          <td>{{ h.proposal.topicPartition.partition }}</td>
          <td>{{ h.proposal.oldReplicas.join(',') }}</td>
          <td>{{ h.proposal.newReplicas.join(',') }}</td>
          <td>{{ h.type }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
export default {
  name: 'InterBrokerMovementTable',
  props: {
    title: { type: String, required: true },
    movements: { type: Array, default: () => [] },
    hideEmpty: { type: Boolean, default: false },
    tableClass: { type: String, default: 'table table-sm table-bordered' },
    theadClass: { type: String, default: 'thead-light' }
  }
}
</script>

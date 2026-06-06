<template>
  <div class="card-deck mb-3" v-if="!hideEmpty || movements.length">
    <h4 v-if="title">{{ title }} ({{ movements.length }})</h4>
    <div class="form-inline mb-2">
      <input type="text" class="form-control form-control-sm" v-model="filterTopic" placeholder="Filter by Topic...">
      <button class="btn btn-sm btn-secondary ml-1" style="padding: 1px 2px;" @click='toReassignmentJson' title="Open Console Debug Panel and copy json object. Use this if you want a generic good proposal but you need additional modifications.">Create reassignment.json ❓</button>
    </div>
    <table :class="tableClass">
      <thead :class="theadClass">
        <tr>
          <th>Topic</th>
          <th>Partition</th>
          <th>Old Replica</th>
          <th>New Replica</th>
          <th v-if="filteredMovements[0]?.type">Movement Type</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(h, idx) in filteredMovements" :key="idx">
          <td>{{ h.proposal.topicPartition.topic }}</td>
          <td>{{ h.proposal.topicPartition.partition }}</td>
          <td>
              <span v-for="(oldReplica, idx) in h.proposal.oldReplicas" :key="idx">
              <span v-if="idx !== 0">,</span>
              <span v-if="h.proposal.newReplicas.includes(oldReplica)">{{ oldReplica }}</span>
              <span v-else class="text-danger">{{ oldReplica }}</span>
            </span>
          </td>
          <td>
            <span v-for="(newReplica, idx) in h.proposal.newReplicas" :key="idx">
              <span v-if="idx !== 0">,</span>
              <span v-if="h.proposal.oldReplicas.includes(newReplica)">{{ newReplica }}</span>
              <span v-else class="text-success">{{ newReplica }}</span>
            </span>
          </td>
          <td v-if="filteredMovements[0]?.type">{{ h.type }}</td>
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
  },
  data () {
    return {
      filterTopic: ''
    }
  },
  methods: {
    toReassignmentJson () {
      const partitions = this.filteredMovements.map(m => ({
        topic: m.proposal.topicPartition.topic,
        partition: m.proposal.topicPartition.partition,
        replicas: m.proposal.newReplicas
      }))
      const obj = { version: 1, partitions }
      console.log('reassignment.json: ', obj)
    }
  },
  computed: {
    filteredMovements () {
      if (!this.filterTopic) return this.movements
      return this.movements.filter(b => b.proposal.topicPartition.topic.toLowerCase().includes(this.filterTopic.toLowerCase()))
    }
  }
}
</script>

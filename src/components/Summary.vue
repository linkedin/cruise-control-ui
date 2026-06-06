<template>
  <div>
    <div class='alert alert-danger'>
      <b>WARNING:</b> This page makes periodic calls (Every <i>{{ periodicity }}ms</i>) to your cruise-control instances to fetch the latest cluster state. Ideally you need a monitoring/metric collection system to capture these and view in dashboard.
      <b>Use this feature with caution.</b>
    </div>
    <table class="table table-sm table-bordered">
      <thead>
        <tr>
          <th colspan=7 class="text-right">
            <span>Group Filter:</span>
            <select v-model='selectedGroup'>
              <option v-for='g in groups' :key='g'> {{ g }} </option>
            </select>
          </th>
        </tr>
        <tr>
          <th>Group</th>
          <th>Cluster</th>
          <th>Brokers</th>
          <th>Leaders</th>
          <th>Replicas</th>
          <th>Avg RF</th>
          <th>Out of sync Replicas</th>
        </tr>
      </thead>
      <tbody>
        <template v-for='(m, k) in filteredConfig'>
          <summary-row v-for='(u, c) in m' :key='k + "-" + c' :url='u' :cluster='c' :group='k' :timeout='periodicity'></summary-row>
        </template>
      </tbody>
    </table>
  </div>
</template>

<script>
import SummaryRow from '@/components/SummaryRow'

export default {
  name: 'ClusterSummary',
  components: {
    SummaryRow
  },
  computed: {
    config () {
      return this.$store.state.config
    },
    groups () {
      return this.config ? ['all'].concat(Object.keys(this.config)) : ['all']
    },
    filteredConfig () {
      if (!this.config) return {}
      if (this.selectedGroup === 'all') return this.config
      const result = {}
      if (this.config[this.selectedGroup]) {
        result[this.selectedGroup] = this.config[this.selectedGroup]
      }
      return result
    }
  },
  methods: {
    stats_url (endpoint) {
      return endpoint + '/kafka_cluster_state?json=true'
    }
  },
  data () {
    return {
      periodicity: 60000,
      selectedGroup: 'all'
    }
  }
}
</script>

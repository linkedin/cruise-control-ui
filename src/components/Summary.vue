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
        <template v-for='(m, k) in config' v-if='selectedGroup === "all" || k === selectedGroup'>
          <summary-row v-for='(u, c) in m' :key='k + c + m' :url='u' :cluster='c' :group='k' :timeout='periodicity'></summary-row>
        </template>
      </tbody>
    </table>
  </div>
</template>

<script>
import SummaryRow from '@/components/SummaryRow'

export default {
  name: 'Summary',
  components: {
    SummaryRow
  },
  computed: {
    config () {
      return this.$store.state.config
    },
    groups () {
      return this.config ? ['all'].concat(Object.keys(this.config)) : ['all']
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
      selectedGroup: this.groups ? this.groups[-1] : 'all'
    }
  }
}
</script>

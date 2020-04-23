<!-- Copyright 2017-2019 LinkedIn Corp. Licensed under the BSD 2-Clause License (the "License"). See License in the project root for license information. -->
<template>
  <div>
    <h4>Kafka Server Load</h4>
    <div v-if='error'>
      <exception :exception='errorData'></exception>
    </div>
    <div v-else-if='async'>
      <async-task :asyncData='asyncData'></async-task>
    </div>
    <div v-else-if="loading && !sortedHosts">
      Loading ...
    </div>
    <table class="table table-sm table-bordered" v-else-if='sortedHosts && sortedHosts.length > 0'>
      <thead class="thead-light">
        <tr>
          <th colspan=1 class='text-center'>Broker</th>
          <th colspan=2 class='text-center'>Topic/Partition</th>
          <th colspan=2 class='text-center'>Disk/Cpu</th>
          <th colspan=6 class='text-center'>Network Rate</th>
        </tr>
        <tr>
          <th @click='sort("Host")'>Host</th>
          <th @click='sort("Replicas")'>#Replicas</th>
          <th @click='sort("Leaders")'>#Leaders</th>
          <th @click='sort("DiskMB")'>Disk</th>
          <th @click='sort("CpuPct")'>CPU</th>
          <th @click='sort("LeaderNwInRate")'>Leader In</th>
          <th @click='sort("FollowerNwInRate")'>Follower In</th>
          <th v-if='apiMinorVersion === 2' @click='sort("NwOutRate")'>Network Out</th> <!-- was NnwOutRate in previous commits -->
          <th v-if='apiMinorVersion === 1' @click='sort("NnwOutRate")'>Net Network Out</th>
          <th @click='sort("PnwOutRate")'>Potential Out</th>
          <th title='Leader to Follower Incoming Traffic Ratio'>LF Ratio</th>
          <th title='Leader Incoming vs Outgoing Traffic Ratio'>IO Ratio</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="e in sortedHosts">
          <td>{{ e.Host | formatHost }}</td>
          <td :class='e.Replicas < 1 ? "table-info" : null'>{{ e.Replicas }}</td>
          <td :class='e.Leaders < 1 ? "table-warning" : null'>{{ e.Leaders }}</td>
          <td>{{ e.DiskMB | formatUnits }}</td>
          <td>{{ e.CpuPct.toFixed(2) }} %</td>
          <td>{{ e.LeaderNwInRate | formatNetworkUnits }}</td>
          <td>{{ e.FollowerNwInRate | formatNetworkUnits }}</td>
          <td v-if='apiMinorVersion === 2'>{{ e.NwOutRate | formatNetworkUnits }}</td>
          <td v-if='apiMinorVersion === 1'>{{ e.NnwOutRate | formatNetworkUnits }}</td>
          <td>{{ e.PnwOutRate | formatNetworkUnits }}</td>
          <td>{{ e.LeaderNwInRate > 0 ? Number(e.FollowerNwInRate / e.LeaderNwInRate).toFixed(4) : null }}</td>
          <td v-if='apiMinorVersion === 2'>{{ e.NwOutRate > 0 ? Number(e.LeaderNwInRate / e.NwOutRate).toFixed(4) : null }}</td>
          <td v-if='apiMinorVersion === 1'>{{ e.NnwOutRate > 0 ? Number(e.LeaderNwInRate / e.NnwOutRate).toFixed(4) : null }}</td>
        </tr>
      </tbody>
    </table>
    <div v-else>No Servers Found.</div>
  </div>
</template>

<script>
const sortBy = require('lodash.sortby')

export default {
  name: 'HostLoad',
  props: {
    hosts: Array,
    loading: Boolean,
    async: false, // when the server treats this request as async
    asyncData: null, // when the server treats the request as async and sends progress instead of actual response
    error: Boolean,
    errorData: Object
  },
  data () {
    return {
      sortColumn: 'Replicas'
    }
  },
  methods: {
    sort (col) {
      this.sortColumn = col
    }
  },
  computed: {
    sortedHosts () {
      return sortBy(this.hosts, this.sortColumn)
    },
    apiMinorVersion () {
      // NnwOutRate has been changed to NwOutRate and Upstream
      // API does not expose this correctly.
      if (this.hosts.length > 0 && this.hosts[0].hasOwnProperty('NwOutRate')) {
        return 2
      } else {
        return 1
      }
    }
  }
}
</script>

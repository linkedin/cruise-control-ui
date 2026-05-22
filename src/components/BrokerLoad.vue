<!-- Copyright 2017-2019 LinkedIn Corp. Licensed under the BSD 2-Clause License (the "License"). See License in the project root for license information. -->
<template>
  <div>
    <div v-if='error'>
      <exception :exception='errorData'></exception>
    </div>
    <div v-else-if="loading && sortedBrokers.length === 0">
      <div class="text-center p-3"><div class="spinner-border text-primary" role="status"></div> Loading ...</div>
    </div>
    <div v-else-if='sortedBrokers.length > 0'>
    <div class="form-inline mb-2">
      <input type="text" class="form-control form-control-sm" v-model="filterText" placeholder="Filter by Broker ID, Host, or Rack...">
      <label class="ml-3 mr-1">Show State & Host: </label>
      <input type=checkbox v-model=showStateHost>
      <label class="ml-3 mr-1" title="Calculated based on user-provided capacity"> ❓ Show Usage Percentages:</label>
      <input type=checkbox v-model=showPct>
      <label v-if="diskDetailsExist" class="ml-3 mr-1"> Show Per Disk Usage:</label>
      <input v-if="diskDetailsExist" type=checkbox v-model=showPerDiskUsage>
    </div>
    <table class="table table-sm table-bordered">
      <thead class="thead-light">
        <tr>
          <th :colspan="showStateHost ? 4 : 2" class="text-center">Broker</th>
          <th colspan="2" class="text-center">Topic/Partition</th>
          <th :colspan="showDiskDetails ? 2 : 1" class="text-center">Disk</th>
          <th v-if="showPct" colspan="1" class="text-center">CPU</th>
          <th colspan="6" class="text-center">Network Rate</th>
        </tr>
        <tr>
          <th @click='sort("Broker")' style="cursor:pointer">ID</th>
          <th v-if="showStateHost" @click='sort("BrokerState")' style="cursor:pointer">State</th>
          <th v-if="showStateHost" @click='sort("Host")' style="cursor:pointer">Host</th>
          <th @click='sort("Rack")' style="cursor:pointer">Rack</th>

          <th @click='sort("Replicas")' style="cursor:pointer">#Replicas</th>
          <th @click='sort("Leaders")' style="cursor:pointer">#Leaders</th>

          <th v-if="showDiskDetails">Log Dir</th>
          <th @click='showPct ? sort("DiskPct") : sort("DiskMB")' style="cursor:pointer">Used</th>

          <th v-if="showPct" @click='sort("CpuPct")' style="cursor:pointer">Used</th>

          <th v-if="!showPct" @click='sort("LeaderNwInRate")' style="cursor:pointer">Leader In</th><th v-else>Leader In</th>
          <th v-if="!showPct" @click='sort("FollowerNwInRate")' style="cursor:pointer">Follower In</th><th v-else>Follower In</th>
          <th v-if='apiMinorVersion === 2 && !showPct' @click='sort("NwOutRate")' style="cursor:pointer">Network Out</th><th v-if='apiMinorVersion === 2 && showPct'>Network Out</th>
          <th v-if='apiMinorVersion === 1 && !showPct' @click='sort("NnwOutRate")' style="cursor:pointer">Net Network Out</th><th v-if='apiMinorVersion === 1 && showPct'>Net Network Out</th>
          <th v-if="!showPct" @click='sort("PnwOutRate")' style="cursor:pointer">Potential Out</th><th v-else>Potential Out</th>
          <th title="Leader to Follower Incoming Traffic Ratio">LF Ratio ❓</th>
          <th title="Leader Incoming to Outgoing Traffic Ratio">IO Ratio ❓</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="e in filteredBrokers">
          <tr v-for="([path, disk], i) in brokerDisks(e)" :key="e.Broker + '-' + i">
            <td v-if="i === 0" :rowspan="brokerDisks(e).length" class="align-middle">{{ e.Broker }}</td>

            <td v-if="showStateHost && i === 0" :rowspan="brokerDisks(e).length" class="align-middle border-bottom-0">
              <BrokerState :state="e.BrokerState" />
            </td>

            <td v-if="showStateHost && i === 0" :rowspan="brokerDisks(e).length" class="align-middle border-bottom-0">
              {{ e.Host | formatHost }}
            </td>

            <td v-if="i === 0" :rowspan="brokerDisks(e).length" class="align-middle border-bottom-0">
              {{ e.Rack && e.Rack !== e.Host ? e.Rack : 'N/A' }}
            </td>

            <td :class="['align-middle', (disk ? disk.NumReplicas : e.Replicas) < 1 ? 'table-info' : null]">
              {{ disk ? disk.NumReplicas : e.Replicas }}
            </td>

            <td :class="['align-middle', (disk ? disk.NumLeaderReplicas : e.Leaders) < 1 ? 'table-warning' : null]">
              {{ disk ? disk.NumLeaderReplicas : e.Leaders }}
            </td>

            <td v-if="disk" class="align-middle">
              <code>{{ path }}</code>
            </td>

            <td class="align-middle">
              <div v-if="showPct" :class="[(disk ? disk.DiskPct : e.DiskPct) > 70 ? 'table-warning' : null]">
                {{ (disk ? (disk.DiskPct === 'DEAD' ? 0 : disk.DiskPct) : e.DiskPct).toFixed(2) }} %
              </div>
              <div v-else>{{ (disk ? disk.DiskMB : e.DiskMB) | formatUnits }}</div>
            </td>

            <td v-if="showPct && i === 0" :rowspan="brokerDisks(e).length" class="align-middle border-bottom-0">
              {{ e.CpuPct != null ? e.CpuPct.toFixed(2) : 'N/A' }} %
            </td>

            <td v-if="i === 0" :rowspan="brokerDisks(e).length" class="align-middle border-bottom-0">
              <div v-if="showPct">{{ Number(e.LeaderNwInRate / e.NetworkInCapacity * 100).toFixed(2) }} %</div>
              <div v-else>{{ e.LeaderNwInRate | formatNetworkUnits }}</div>
            </td>

            <td v-if="i === 0" :rowspan="brokerDisks(e).length" class="align-middle border-bottom-0">
              <div v-if="showPct">{{ Number(e.FollowerNwInRate / e.NetworkInCapacity * 100).toFixed(2) }} %</div>
              <div v-else>{{ e.FollowerNwInRate | formatNetworkUnits }}</div>
            </td>

            <td v-if="apiMinorVersion === 2 && i === 0" :rowspan="brokerDisks(e).length" class="align-middle border-bottom-0">
              <div v-if="showPct">{{ Number(e.NwOutRate / e.NetworkOutCapacity * 100).toFixed(2) }} %</div>
              <div v-else>{{ e.NwOutRate | formatNetworkUnits }}</div>
            </td>

            <td v-if="apiMinorVersion === 1 && i === 0" :rowspan="brokerDisks(e).length" class="align-middle border-bottom-0">
              <div v-if="showPct">{{ Number(e.NnwOutRate / e.NetworkOutCapacity * 100).toFixed(2) }} %</div>
              <div v-else>{{ e.NnwOutRate | formatNetworkUnits }}</div>
            </td>

            <td v-if="i === 0" :rowspan="brokerDisks(e).length" class="align-middle border-bottom-0">
              <div v-if="showPct" :class="[Number(e.PnwOutRate / e.NetworkOutCapacity * 100) > 70 ? 'table-warning' : null]">{{ Number(e.PnwOutRate / e.NetworkOutCapacity * 100).toFixed(2) }} %</div>
              <div v-else>{{ e.PnwOutRate | formatNetworkUnits }}</div>
            </td>

            <td v-if="i === 0" :rowspan="brokerDisks(e).length" class="align-middle border-bottom-0">
              {{ e.FollowerNwInRate > 0 ? Number(e.LeaderNwInRate / e.FollowerNwInRate).toFixed(3) : null }}
            </td>

            <td v-if="apiMinorVersion === 2 && i === 0" :rowspan="brokerDisks(e).length" class="align-middle border-bottom-0">
              {{ e.NwOutRate > 0 ? Number(e.LeaderNwInRate / e.NwOutRate).toFixed(3) : null }}
            </td>

            <td v-if="apiMinorVersion === 1 && i === 0" :rowspan="brokerDisks(e).length" class="align-middle border-bottom-0">
              {{ e.NnwOutRate > 0 ? Number(e.LeaderNwInRate / e.NnwOutRate).toFixed(3) : null }}
            </td>
          </tr>
        </template>
      </tbody>
    </table>
    </div>
    <div v-else>No Brokers Found.</div>
  </div>
</template>

<script>
import BrokerState from '@/components/BrokerState'
const sortBy = require('lodash.sortby')

export default {
  name: 'BrokerLoad',
  props: {
    brokers: Array,
    loading: Boolean,
    error: Boolean,
    errorData: Object
  },
  components: {
    BrokerState
  },
  data () {
    return {
      showStateHost: false,
      showPct: false,
      showPerDiskUsage: false,
      sortColumn: 'Replicas',
      ascending: true,
      filterText: ''
    }
  },
  methods: {
    sort (col) {
      if (this.sortColumn === col) {
        this.ascending = !this.ascending
      } else {
        this.sortColumn = col
        this.ascending = true
      }
    },
    brokerDisks (e) {
      if (!this.showPerDiskUsage) {
        return [[null, null]]
      }

      const disks = Object.entries(e.DiskState || {})
        .sort(([a], [b]) => a.localeCompare(b))
      return disks.length ? disks : [[null, null]]
    }
  },
  computed: {
    sortedBrokers () {
      if (this.ascending) {
        return sortBy(this.brokers, this.sortColumn)
      }
      return sortBy(this.brokers, this.sortColumn).reverse()
    },
    filteredBrokers () {
      if (!this.filterText) return this.sortedBrokers
      const q = this.filterText.toLowerCase()
      return this.sortedBrokers.filter(b => {
        return String(b.Broker).toLowerCase().includes(q) ||
          (b.Host && b.Host.toLowerCase().includes(q)) ||
          (b.Rack && b.Rack.toLowerCase().includes(q))
      })
    },
    apiMinorVersion () {
      // NnwOutRate has been changed to NwOutRate and Upstream
      // API does not expose this correctly.
      if (this.brokers && this.brokers.length > 0 && Object.prototype.hasOwnProperty.call(this.brokers[0], 'NwOutRate')) {
        return 2
      } else {
        return 1
      }
    },
    diskDetailsExist () {
      return this.brokers && this.brokers.length > 0 && this.brokers[0].DiskState
    },
    showDiskDetails () {
      return this.showPerDiskUsage && this.brokers && this.brokers.length > 0 && this.brokers[0].DiskState
    }
  }
}
</script>

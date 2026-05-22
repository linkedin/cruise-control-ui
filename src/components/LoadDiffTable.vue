<!-- Copyright 2017-2019 LinkedIn Corp. Licensed under the BSD 2-Clause License (the "License"). See License in the project root for license information. -->

<template>
  <div v-if="per === 'broker'">
    <h4 class="pointer" @click="showBrokerLoad = !showBrokerLoad">
      Optimized Load Difference - Per Broker
      <small class="text-muted">{{ showBrokerLoad ? '(click to hide)' : '(click to show)' }}</small>
    </h4>
    <table v-if="showBrokerLoad" class="table table-sm table-bordered">
    <thead class="thead-light">
      <tr>
        <th>Broker ID</th>
        <th v-for="h in brokerLoad.heading" :key="'bh-'+h">{{ h === 'DiskMB' ? 'Disk' : h }}</th>
      </tr>
    </thead>
    <tbody>
      <template v-for="(brokerdata, brokerid) in brokerLoad.records">
        <template v-if="hasDiskState">
          <tr v-for="([, disk], diskidx) in getSortedBrokerDisks(brokerdata)" :key="brokerid + diskidx + 'row'" :class="[diskidx == getSortedBrokerDisks(brokerdata).length - 1 ? 'thick-border' : null]">
            <th v-if="diskidx === 0" :rowspan="getSortedBrokerDisks(brokerdata).length" class="align-middle" :key="brokerid + diskidx + 'h-bid'">{{ brokerid }}</th>
            <template v-for="h in brokerLoad.heading">
              <td v-if="diskKeys.includes(h)" :key="brokerid + diskidx + h" class="align-middle">
                <diff-cell :head='h' :cell='disk[h]' />
              </td>
              <td v-else-if="diskidx === 0" :rowspan="getSortedBrokerDisks(brokerdata).length" class="align-middle" :key="brokerid + diskidx + h + 'else'">
                <diff-cell :head='h' :cell='brokerdata[h]' />
              </td>
            </template>
          </tr>
        </template>
        <template v-else>
          <tr :key="brokerid">
            <th >{{ brokerid }}</th>
            <td v-for="h in brokerLoad.heading" :key="'bd-'+h">
              <diff-cell :head='h' :cell='brokerdata[h]' />
            </td>
          </tr>
        </template>
      </template>
    </tbody>
    </table>
  </div>
  <div v-else-if="per === 'host'">
    <h4 class="pointer" @click="showHostLoad = !showHostLoad">
      Optimized Load Difference - Per Host
      <small class="text-muted">{{ showHostLoad ? '(click to hide)' : '(click to show)' }}</small>
    </h4>
    <table v-if="showHostLoad" class="table table-sm table-bordered">
      <thead class="thead-light">
        <tr>
          <th v-for="h in hostLoad.heading" :key="'hh-'+h">{{ h }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(hostdata, host) in hostLoad.records" :key="host">
          <td v-for="h in hostLoad.heading" :key="'hd-'+h">
            <diff-cell :head='h' :cell='hostdata[h]' />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
import DiffCell from '@/components/DiffCell'

export default {
  name: 'LoadDiffTable',
  props: {
    loadBefore: Object,
    loadAfter: Object,
    per: String
  },
  components: {
    DiffCell
  },
  data () {
    return {
      showBrokerLoad: true,
      showHostLoad: false,
      diskKeys: ['Replicas', 'Leaders', 'LogDir', 'DiskMB', 'DiskPct']
    }
  },
  methods: {
    withoutDiskState (brokerids, brokerMap) {
      const unified = {}
      const keysToUnit = {
        BrokerState: 'brokerstate',
        Host: 'string',
        Replicas: 'number',
        Leaders: 'number',
        DiskMB: 'disk',
        CpuPct: 'pct',
        LeaderNwInRate: 'network',
        FollowerNwInRate: 'network',
        NwOutRate: 'network', // was NnwOutRate
        PnwOutRate: 'network'
      }
      brokerids.forEach((broker) => {
        const before = brokerMap[0][broker] || {}
        const after = brokerMap[1][broker] || {}
        const diff = {}
        Object.keys(keysToUnit).forEach((key) => {
          diff[key] = {
            before: before[key],
            after: after[key],
            unit: keysToUnit[key]
          }
        })
        unified[broker] = diff
      })
      return {
        heading: Object.keys(keysToUnit),
        records: unified
      }
    },
    withDiskState (brokerids, brokerMap) {
      const unified = {}
      const preKeysToUnit = {
        BrokerState: 'brokerstate',
        Host: 'string'
      }
      const keysToUnit = {
        // Network doesn't change in a rebalance_disk (except for /demote_broker), so we skip most of it for more space in table
        LeaderNwInRate: 'network',
        NwOutRate: 'network'
      }
      brokerids.forEach((broker) => {
        const before = (brokerMap[0] && brokerMap[0][broker]) || {}
        const after = brokerMap[1][broker] || {}
        const diff = {}
        Object.keys(preKeysToUnit).forEach((key) => {
          diff[key] = {
            before: before[key],
            after: after[key],
            unit: preKeysToUnit[key]
          }
        })
        Object.keys(keysToUnit).forEach((key) => {
          diff[key] = {
            before: before[key],
            after: after[key],
            unit: keysToUnit[key]
          }
        })
        diff.LogDir = {}
        Object.keys(after.DiskState).forEach((disk) => {
          diff.LogDir[disk] = {
            LogDir: {
              before: disk,
              after: disk,
              unit: 'logdir'
            },
            Replicas: {
              before: before.DiskState && before.DiskState[disk].NumReplicas,
              after: after.DiskState[disk].NumReplicas,
              unit: 'number'
            },
            Leaders: {
              before: before.DiskState && before.DiskState[disk].NumLeaderReplicas,
              after: after.DiskState[disk].NumLeaderReplicas,
              unit: 'number'
            },
            DiskMB: {
              before: before.DiskState && before.DiskState[disk].DiskMB,
              after: after.DiskState[disk].DiskMB,
              unit: 'disk'
            },
            DiskPct: {
              before: before.DiskState && before.DiskState[disk].DiskPct,
              after: after.DiskState[disk].DiskPct,
              unit: 'pct'
            }
          }
        })
        unified[broker] = diff
      })
      return {
        heading: [...Object.keys(preKeysToUnit), ...this.diskKeys, ...Object.keys(keysToUnit)],
        records: unified
      }
    },
    getSortedBrokerDisks (e) {
      const disks = Object.entries(e.LogDir || {})
        .sort(([a], [b]) => a.localeCompare(b))
      return disks.length ? disks : [[null, null]]
    }
  },
  computed: {
    hasDiskState () {
      if (!this.loadAfter || !this.loadAfter.brokers || !this.loadAfter.brokers.length) return false
      return !!this.loadAfter.brokers[0].DiskState
    },
    brokerLoad () {
      const brokerMap = [
        {}, // before load
        {} // after load
      ]
      if (!this.loadAfter || typeof this.loadAfter !== 'object' || !this.loadAfter.brokers) return { heading: [], records: [] }
      // re-key them based on the broker-id
      const brokerids = []
      if (this.loadBefore && typeof this.loadBefore === 'object' && this.loadBefore.brokers) {
        // some APIs like /remove_disk don't have loadBefore object in their response (yet)
        this.loadBefore.brokers.forEach((rec) => {
          brokerMap[0][rec.Broker] = rec
        })
      }
      this.loadAfter.brokers.forEach((rec) => {
        brokerids.push(rec.Broker)
        brokerMap[1][rec.Broker] = rec
      })
      return this.hasDiskState ? this.withDiskState(brokerids, brokerMap) : this.withoutDiskState(brokerids, brokerMap)
    },
    hostLoad () {
      const hostMap = [
        {}, // before load
        {} // after load
      ]
      const unified = {}
      if (!this.loadBefore.brokers || !this.loadAfter.brokers || !this.loadBefore.hosts || !this.loadAfter.hosts) return { heading: [], records: [] }
      // re-key them based on the broker-id
      const hostnames = []
      this.loadBefore.hosts.forEach((rec) => {
        hostnames.push(rec.Host)
        hostMap[0][rec.Host] = rec
      })
      this.loadAfter.hosts.forEach((rec) => {
        hostMap[1][rec.Host] = rec
      })
      const keysToUnit = {
        Host: 'string',
        Replicas: 'number',
        Leaders: 'number',
        DiskMB: 'disk',
        CpuPct: 'pct',
        LeaderNwInRate: 'network',
        FollowerNwInRate: 'network',
        NwOutRate: 'network', // was NnwOutRate
        PnwOutRate: 'network'
      }
      hostnames.forEach((host) => {
        const before = hostMap[0][host] || {}
        const after = hostMap[1][host] || {}
        const diff = {}
        Object.keys(keysToUnit).forEach((key) => {
          diff[key] = {
            before: before[key],
            after: after[key],
            unit: keysToUnit[key]
          }
        })
        unified[host] = diff
      })
      return {
        heading: Object.keys(keysToUnit),
        records: unified
      }
    }
  }
}
</script>

<style scoped>
.pointer { cursor: pointer; }
.thick-border { border-bottom-style: outset; }
</style>

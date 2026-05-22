<!-- Copyright 2017-2019 LinkedIn Corp. Licensed under the BSD 2-Clause License (the "License"). See License in the project root for license information. -->
<template>
  <span v-if='cell.unit === "brokerstate"'>
    <broker-state :state="cell.after" />
  </span>
  <span v-else-if="cell.unit === 'logdir'">
    <code>{{ before }}</code>
  </span>
  <span v-else-if="!beforeExists" :class="[ after === 'DEAD' ? 'badge badge-danger' : '']">
    <template v-if="cell.unit === 'network'"> {{ after | formatNetworkUnits }} </template>
    <template v-else-if="cell.unit === 'disk'"> {{ after | formatUnits }} </template>
    <template v-else> {{ after }} </template>
  </span>
  <span v-else>
    <template v-if="cell.unit === 'network'"> {{ before | formatNetworkUnits }} </template>
    <template v-else-if="cell.unit === 'disk'"> {{ before | formatUnits }} </template>
    <template v-else> {{ before }} </template>
    <br>
    <span v-if='cell.before > cell.after' class='text-success'>
      <template v-if="cell.unit === 'network'"> {{ after | formatNetworkUnits }} </template>
      <template v-else-if="cell.unit === 'disk'"> {{ after | formatUnits }} </template>
      <template v-else> {{ after }} </template>
      <br>
      ({{ pctchange }}%)
    </span>
    <span v-else-if='cell.before < cell.after' class='text-danger'>
      <template v-if="cell.unit === 'network'"> {{ after | formatNetworkUnits }} </template>
      <template v-else-if="cell.unit === 'disk'"> {{ after | formatUnits }} </template>
      <template v-else> {{ after }} </template>
      <br>
      ({{ pctchange }}%)
    </span>
  </span>
</template>

<script>
import BrokerState from '@/components/BrokerState'

export default {
  name: 'DiffCell',
  components: {
    BrokerState
  },
  props: {
    cell: Object
  },
  data () {
    return {
      precision: 1
    }
  },
  methods: {
  },
  computed: {
    pctchange () {
      if (this.numeric) {
        if (this.cell.before > 0) {
          const v = Number(((this.before - this.after) / (this.before)) * 100)
          if (isNaN(v)) {
            return '0'
          } else {
            return v.toFixed(this.precision)
          }
        } else {
          return 0
        }
      } else {
        return null
      }
    },
    beforeExists () {
      return !!this.cell.before
    },
    before () {
      return (!this.numeric || this.cell.unit === 'number') ? this.cell.before : this.cell.before.toFixed(this.precision)
    },
    after () {
      if (!this.numeric || this.cell.unit === 'number') return this.cell.after
      if (this.cell.after === 'DEAD') return 'DEAD'
      return this.cell.after.toFixed(this.precision)
    },
    numeric () {
      return ['number', 'disk', 'pct', 'network'].includes(this.cell.unit)
    }
  }
}
</script>

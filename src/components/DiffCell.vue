<!-- Copyright 2017-2019 LinkedIn Corp. Licensed under the BSD 2-Clause License (the "License"). See License in the project root for license information. -->
<template>
  <span v-if='head.toLowerCase() == "brokerstate"'>
    <broker-state :state="cell.before" />
  </span>
  <span v-else>
    {{ before }}
    <br>
    <span v-if='cell.before > cell.after' class='text-success'>
      {{ after }} ({{ pctchange }}%)
    </span>
    <span v-else-if='cell.before < cell.after' class='text-danger'>
      {{ after }} ({{ pctchange }}%)
    </span>
    <span v-else>
      {{ after }}
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
    cell: Object,
    head: String,
    showpct: Boolean
  },
  data () {
    return {
      precision: 2
    }
  },
  computed: {
    changesign () {
      if (this.numeric) {
        if (this.cell.before > this.cell.after) {
          return '+'
        } else {
          return ''
        }
      } else {
        return null
      }
    },
    pctclass () {
      if (this.numeric) {
        if (this.cell.before > this.cell.after) {
          return 'text-success'
        } else if (this.cell.before === this.cell.after) {
          return 'text-primary'
        } else {
          return 'text-danger'
        }
      } else {
        return null
      }
    },
    pctchange () {
      if (this.numeric) {
        if (this.cell.before > 0) {
          let v = Number(((this.before - this.after) / (this.before)) * 100)
          if (isNaN(v)) {
            return '0'
          } else {
            return v.toFixed(2)
          }
        } else {
          return 0
        }
      } else {
        return null
      }
    },
    difference () {
      return this.numeric ? this.cell.diff.toFixed(this.precision) : this.cell.diff
    },
    before () {
      return this.numeric ? this.cell.before.toFixed(this.precision) : this.cell.before
    },
    after () {
      return this.numeric ? this.cell.after.toFixed(this.precision) : this.cell.after
    },
    numeric () {
      return this.cell.diff !== null
    }
  }
}
</script>

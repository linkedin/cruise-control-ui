<!-- Copyright 2017-2019 LinkedIn Corp. Licensed under the BSD 2-Clause License (the "License"). See License in the project root for license information. -->
<template>
  <span :class='className' v-if='isTrue'>{{ label }}</span>
</template>

<script>
export default {
  name: 'BooleanEL',
  props: {
    label: [Boolean, String]
  },
  computed: {
    isTrue () {
      return this.label === true || (this.label !== false && this.label.match(/^ready/i))
    },
    className () {
      return this.isTrue ? 'badge badge-success' : 'badge badge-secondary'
    }
  }
}
</script>

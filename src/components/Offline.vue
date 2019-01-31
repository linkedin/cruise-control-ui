<!-- Copyright 2017-2019 LinkedIn Corp. Licensed under the BSD 2-Clause License (the "License"). See License in the project root for license information. -->
<template>
  <div class="alert alert-warning" v-if='!isOnline()'>
    <b>NOTICE:</b> Hi there ! You are disconnected from Network. Application still shows the most recent data that was loaded from the server.
  </div>
</template>

<script>
export default {
  name: 'Offline',
  methods: {
    setOnline () {
      this.$store.commit('setonline', true)
    },
    setOffline () {
      this.$store.commit('setonline', false)
    },
    isOnline () {
      return this.$store.state.online
    }
  },
  created () {
    let vm = this
    window.addEventListener('online', vm.setOnline)
    window.addEventListener('offline', vm.setOffline)
  },
  beforeDestroy () {
    let vm = this
    window.removeEventListener('online', vm.setOnline)
    window.removeEventListener('offline', vm.setOffline)
  }
}
</script>

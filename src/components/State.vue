<!-- Copyright 2017-2019 LinkedIn Corp. Licensed under the BSD 2-Clause License (the "License"). See License in the project root for license information. -->
<template>
  <div>
    <ul class="nav nav-tabs mb-3">
      <li class="nav-item">
        <router-link exact class="nav-link" :to='{"name": "page.state.executor", params: { group: group, cluster: cluster } }'>Executor State</router-link>
      </li>
      <li class="nav-item">
        <router-link exact class="nav-link" :to='{"name": "page.state.monitor", params: { group: group, cluster: cluster } }'>Monitor State</router-link>
      </li>
      <li class="nav-item">
        <router-link exact class="nav-link" :to='{"name": "page.state.analyzer", params: { group: group, cluster: cluster } }'>Analyzer State</router-link>
      </li>
      <li class="nav-item">
        <router-link exact class="nav-link" :to='{"name": "page.state.anomaly_detector", params: { group: group, cluster: cluster } }'>Anomaly Detector State</router-link>
      </li>
    </ul>
    <router-view></router-view>
  </div>
</template>

<script>
export default {
  name: 'State',
  props: {
    group: String,
    cluster: String
  }
}
</script>

<style scoped>
.nav-link.active {
  font-weight: bold;
  background-color: #2780e3;
  color: #fff;
  border-color: #2780e3;
}
</style>

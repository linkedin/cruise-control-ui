<!-- Copyright 2017-2019 LinkedIn Corp. Licensed under the BSD 2-Clause License (the "License"). See License in the project root for license information. -->
<template>
  <div class="card">
    <div class="card-header">Cruise Control UI - Preferences</div>
    <div class="card-body">
      <table class="table table-bordered">
        <tbody>
          <!--
          <tr><th colspan=2 class='text-center'>Auto Refresh UI Data</th></tr>
          <tr>
            <td>Enable Auto Reload of All REST end points on the UI</td>
            <th><input type="checkbox" v-model="$store.state.autoReloadEnabled"></th>
          </tr>
          <tr>
            <td>Auto Reload Interval in Milli Seconds</td>
            <th><input type="number" min='3000' v-model="$store.state.autoReloadInterval"></th>
          </tr>
          -->
          <tr><th colspan=2 class='text-center'>Help URLs</th></tr>
          <tr>
            <td>Hide REST URL details in the applications</td>
            <th><input type="checkbox" v-model="$store.state.hideHelperURL"></th>
          </tr>
          <tr><th colspan=2 class='text-center'>Modules to Enable</th></tr>
          <tr v-for="(v, k) in $store.state.modules" :key='k'>
            <td>Enable <b>{{ k | camelCase }}</b>  UI Module</td>
            <th><input type="checkbox" v-model="$store.state.modules[k]"></th>
          </tr>
          <tr><th colspan=2 class='text-center'>Server Exception Messages:</th></tr>
          <tr>
            <td>Show Full Stack Traces from Exception Responses</td>
            <th><input type="checkbox" v-model="$store.state.showFullStackTrace"></th>
          </tr>
          <!--
          <tr><th colspan=2 class='text-center'>Configuration Reload:</th></tr>
          <tr>
            <td>Enable Automatic refreshing of <code>config.csv</code> file</td>
            <th><input type="checkbox" v-model="$store.state.enableConfigFileReload"></th>
          </tr>
          <tr>
            <td>Automatic refreshing <code>config.csv</code> interval <i>(in Milli Seconds)</i></td>
            <th><input type="number" min='3000' placeholder='3000' :disabled='!$store.state.enableConfigFileReload' v-model="$store.state.configFileReloadInterval"></th>
          </tr>
          -->
        </tbody>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Preferences',
  data () {
    return {
      store: this.$store
    }
  }
}
</script>

<style scoped>
.text-center {
  text-align: center
}
</style>

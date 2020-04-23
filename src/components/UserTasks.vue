<!-- Copyright 2017-2019 LinkedIn Corp. Licensed under the BSD 2-Clause License (the "License"). See License in the project root for license information. -->
<template>
  <div>
    <div class="alert alert-info" v-if='!hideHelperURL'>
      <b>URL ({{group}}, {{cluster}}):</b> <a target=_blank :href='url'>{{ url }}</a>
    </div>
    <div v-if='!loading'>
      <div class="alert alert-primary text-right">
        <button class="btn btn-primary" @click='getUserTasks()'>Refresh User Tasks</button>
      </div>
    </div>
    <div v-if='error'>
      <exception :exception='errorData'></exception>
    </div>
    <div v-else-if='async'>
      <async-task :asyncData='asyncData'></async-task>
    </div>
    <div v-else-if="loading">
      Loading ...
    </div>
    <div v-else-if='sortedTasks.length > 0'>
      <table class="table table-sm table-bordered">
        <thead class="thead-light">
          <tr>
            <th @click='sort("UserTaskId")'>Task Id</th>
            <th @click='sort("ClientIdentity")'>Client</th>
            <th @click='sort("StartMs")'>Request Time</th>
            <th>Elapsed Time</th>
            <th @click='sort("Status")'>Status</th>
            <th @click='sort("RequestURL")'>Request URL</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in sortedTasks">
            <td>{{ t.UserTaskId }}</td>
            <td>{{ t.ClientIdentity }}</td>
            <td>{{ (new Date(parseInt(t.StartMs, 10))).toString().substr(0, 34) }}</td>
            <td>{{ t.StartMs | formatLocalTime }}</td>
            <td>
              <span v-if='t.Status === "Completed"' class="badge badge-success">{{ t.Status }}</span>
              <span v-else class="badge badge-info">{{ t.Status }}</span>
            </td>
            <td>{{ t.RequestURL }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else>No Tasks Found.</div>
  </div>
</template>

<script>
import BooleanEL from '@/components/BooleanEL'
const sortBy = require('lodash.sortby')

export default {
  name: 'UserTasks',
  props: {
    group: String,
    cluster: String
  },
  components: {
    BooleanEL
  },
  data () {
    return {
      loaded: false,
      loading: false,
      error: false,
      errorData: null,
      async: false,
      asyncData: null,
      tasks: Array,
      sortColumn: 'StartMs'
    }
  },
  created () {
    this.argsChanged()
  },
  watch: {
    group: function (ogroup, ngroup) {
      this.argsChanged()
    },
    cluster: function (ocluster, ncluster) {
      this.argsChanged()
    }
  },
  methods: {
    argsChanged () {
      const newurl = this.$store.getters.getnewurl(this.group, this.cluster)
      this.$store.commit('seturl', newurl)
      this.loaded = false
      this.getUserTasks()
    },
    sort (col) {
      this.sortColumn = col
    },
    getUserTasks () {
      const vm = this
      vm.loading = true
      vm.$http.get(vm.url, {withCredentials: true}).then((r) => {
        if (r.data === null || r.data === undefined || r.data === '') {
          vm.error = true
          vm.errorData = 'CruiseControl sent an empty response with 200-OK status code. Please file a bug here https://github.com/linkedin/cruise-control/issues'
        } else if (r.headers['content-type'].match(/text\/plain/) || r.data.progress) {
          vm.async = true
          vm.asyncData = r.data
        } else {
          vm.async = false
          vm.error = false
          vm.errorData = null
          vm.tasks = r.data.userTasks
        }
        vm.loading = false
        vm.loaded = true
      }, (e) => {
        vm.loading = false
        vm.error = true
        vm.errorData = e && e.response && e.response.data ? e.response.data : e
      })
    }
  },
  computed: {
    hideHelperURL () {
      return this.$store.state.hideHelperURL
    },
    url () {
      return this.$helpers.getURL('user_tasks')
    },
    sortedTasks () {
      return sortBy(this.tasks, this.sortColumn)
    }
  }
}
</script>

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
      <div class="text-center p-3"><div class="spinner-border text-primary" role="status"></div> Loading ...</div>
    </div>
    <div v-else-if='sortedTasks.length > 0'>
      <div class="form-inline mb-2">
        <input type="text" class="form-control form-control-sm mr-2" v-model="searchText" placeholder="Search by Task ID or Client...">
        <select class="form-control form-control-sm" v-model="statusFilter">
          <option value="">All Statuses</option>
          <option value="Active">Active</option>
          <option value="InExecution">InExecution</option>
          <option value="Completed">Completed</option>
          <option value="CompletedWithError">CompletedWithError</option>
        </select>
      </div>
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
          <tr v-for="t in filteredTasks" :key="t.UserTaskId">
            <td>{{ t.UserTaskId }}</td>
            <td>{{ t.ClientIdentity }}</td>
            <td>{{ (new Date(parseInt(t.StartMs, 10))).toLocaleString() }}</td>
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
import { ASYNC_RETRY_DELAY, ARGS_RETRY_MAX, ARGS_RETRY_DELAY } from '@/constants'
import fetchCC from '@/fetchCC'
const sortBy = require('lodash.sortby')

export default {
  name: 'UserTasks',
  props: {
    group: String,
    cluster: String
  },
  data () {
    return {
      loaded: false,
      loading: false,
      error: false,
      errorData: null,
      async: false,
      asyncData: null,
      argsRetryTimer: null,
      asyncRetryTimer: null,
      tasks: [],
      sortColumn: 'StartMs',
      searchText: '',
      statusFilter: ''
    }
  },
  created () {
    this.argsChanged()
  },
  beforeDestroy () {
    if (this.argsRetryTimer) {
      clearTimeout(this.argsRetryTimer)
    }
    if (this.asyncRetryTimer) {
      clearTimeout(this.asyncRetryTimer)
    }
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
    argsChanged (retries) {
      retries = retries || 0
      const newurl = this.$store.getters.getnewurl(this.group, this.cluster)
      if (!newurl) {
        if (retries < ARGS_RETRY_MAX) {
          this.argsRetryTimer = setTimeout(() => this.argsChanged(retries + 1), ARGS_RETRY_DELAY)
        }
        return
      }
      this.$store.commit('seturl', newurl)
      this.loaded = false
      if (this.asyncRetryTimer) {
        clearTimeout(this.asyncRetryTimer)
        this.asyncRetryTimer = null
      }
      this.getUserTasks()
    },
    sort (col) {
      this.sortColumn = col
    },
    getUserTasks () {
      const vm = this
      vm.loading = true
      fetchCC(vm.url).then((result) => {
        if (result.type === 'empty') {
          vm.loading = false
          vm.error = true
          vm.errorData = 'CruiseControl sent an empty response with ' + result.status + ' status code.'
        } else if (result.type === 'async') {
          vm.loading = false
          vm.async = true
          vm.asyncData = result.data
          if (vm.asyncRetryTimer) clearTimeout(vm.asyncRetryTimer)
          vm.asyncRetryTimer = setTimeout(() => vm.getUserTasks(), ASYNC_RETRY_DELAY)
        } else if (result.type === 'error') {
          if (vm.asyncRetryTimer) { clearTimeout(vm.asyncRetryTimer); vm.asyncRetryTimer = null }
          vm.loading = false
          vm.error = true
          vm.errorData = result.data
        } else {
          if (vm.asyncRetryTimer) { clearTimeout(vm.asyncRetryTimer); vm.asyncRetryTimer = null }
          vm.async = false
          vm.loading = false
          vm.error = false
          vm.errorData = null
          vm.tasks = result.data.userTasks || []
          vm.loaded = true
        }
      }).catch((e) => {
        if (vm.asyncRetryTimer) { clearTimeout(vm.asyncRetryTimer); vm.asyncRetryTimer = null }
        vm.loading = false
        vm.error = true
        vm.errorData = e.message || e
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
    },
    filteredTasks () {
      let result = this.sortedTasks
      if (this.statusFilter) {
        result = result.filter(t => t.Status === this.statusFilter)
      }
      if (this.searchText) {
        const q = this.searchText.toLowerCase()
        result = result.filter(t => {
          return (t.UserTaskId && t.UserTaskId.toLowerCase().includes(q)) ||
            (t.ClientIdentity && t.ClientIdentity.toLowerCase().includes(q)) ||
            (t.RequestURL && t.RequestURL.toLowerCase().includes(q))
        })
      }
      return result
    }
  }
}
</script>

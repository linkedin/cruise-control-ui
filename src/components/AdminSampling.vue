<!-- Copyright 2017-2019 LinkedIn Corp. Licensed under the BSD 2-Clause License (the "License"). See License in the project root for license information. -->
<template>
  <div v-if='state'>
    <button class="btn btn-primary" @click='changeState()'>{{ newState }}</button>
    <exception v-if='error' :exception='errorData'></exception>
    <div v-if='success === true' class="alert alert-success">
      Successfully Submitted Request.
    </div>
  </div>
  <div v-else class="alert alert-info">
    Please wait while the current state is being updated.
  </div>
</template>

<script>

export default {
  name: 'AdminSampling',
  props: {
    'group': String,
    'cluster': String
  },
  data () {
    return {
      error: false,
      errorData: null,
      success: null,
      state: ''
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
  computed: {
    monitor_url () {
      return this.$helpers.getURL('state', {substates: 'monitor'})
    },
    url () {
      if (this.state === 'PAUSED') {
        return this.$helpers.getURL('resume_sampling')
      } else {
        return this.$helpers.getURL('pause_sampling')
      }
    },
    newState () {
      if (this.state === 'PAUSED') {
        return 'Resume Sampling'
      } else {
        return 'Pause Sampling'
      }
    }
  },
  methods: {
    argsChanged () {
      const newurl = this.$store.getters.getnewurl(this.group, this.cluster)
      this.$store.commit('seturl', newurl)
      this.loaded = false
      this.fetchMonitorState()
    },
    fetchMonitorState () {
      const vm = this
      vm.loading = true
      this.$http.get(vm.monitor_url, {withCredentials: true}).then((r) => {
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
          vm.loading = false
          vm.state = r.data.MonitorState
          vm.loading = false
          vm.loaded = true
        }
      }, (e) => {
        vm.loading = false
        vm.error = true
        vm.errorData = e && e.response && e.response.data ? e.response.data : e
      })
    },
    changeState () {
      let vm = this
      this.$http.post(vm.url, {withCredentials: true}).then((r) => {
        vm.success = true
        window.setTimeout(function () {
          vm.success = null
          vm.state = null
        }, 3000)
      }, (e) => {
        vm.error = true
        vm.errorData = e && e.response && e.response.data ? e.response.data : e
      })
    }
  }
}
</script>

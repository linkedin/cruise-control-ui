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
import { ASYNC_RETRY_DELAY, ARGS_RETRY_MAX, ARGS_RETRY_DELAY } from '@/constants'
import fetchCC from '@/fetchCC'

export default {
  name: 'AdminSampling',
  props: {
    group: String,
    cluster: String
  },
  data () {
    return {
      loading: false,
      loaded: false,
      error: false,
      errorData: null,
      async: false,
      asyncData: null,
      argsRetryTimer: null,
      asyncRetryTimer: null,
      successTimer: null,
      success: null,
      state: ''
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
    if (this.successTimer) {
      clearTimeout(this.successTimer)
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
  computed: {
    monitor_url () {
      return this.$helpers.getURL('state', { substates: 'monitor' })
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
      this.fetchMonitorState()
    },
    fetchMonitorState () {
      const vm = this
      vm.loading = true
      fetchCC(vm.monitor_url).then((result) => {
        if (result.type === 'empty') {
          vm.loading = false
          vm.error = true
          vm.errorData = 'CruiseControl sent an empty response with ' + result.status + ' status code.'
        } else if (result.type === 'async') {
          vm.loading = false
          vm.async = true
          vm.asyncData = result.data
          if (vm.asyncRetryTimer) clearTimeout(vm.asyncRetryTimer)
          vm.asyncRetryTimer = setTimeout(() => vm.fetchMonitorState(), ASYNC_RETRY_DELAY)
        } else if (result.type === 'error') {
          if (vm.asyncRetryTimer) { clearTimeout(vm.asyncRetryTimer); vm.asyncRetryTimer = null }
          vm.loading = false
          vm.error = true
          vm.errorData = result.data
        } else {
          if (vm.asyncRetryTimer) { clearTimeout(vm.asyncRetryTimer); vm.asyncRetryTimer = null }
          vm.async = false
          vm.error = false
          vm.errorData = null
          vm.loading = false
          vm.state = result.data.MonitorState.state
          vm.loaded = true
        }
      }).catch((e) => {
        if (vm.asyncRetryTimer) { clearTimeout(vm.asyncRetryTimer); vm.asyncRetryTimer = null }
        vm.loading = false
        vm.error = true
        vm.errorData = e.message || e
      })
    },
    changeState () {
      const vm = this
      this.$http.post(vm.url, null, { withCredentials: true }).then((r) => {
        vm.success = true
        vm.successTimer = window.setTimeout(function () {
          vm.successTimer = null
          vm.success = null
          vm.fetchMonitorState()
        }, 3000)
      }, (e) => {
        vm.error = true
        vm.errorData = e && e.response && e.response.data ? e.response.data : e
      })
    }
  }
}
</script>

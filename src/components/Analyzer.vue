<!-- Copyright 2017-2019 LinkedIn Corp. Licensed under the BSD 2-Clause License (the "License"). See License in the project root for license information. -->
<template>
  <div>
    <div class="alert alert-info" v-if='!hideHelperURL'>
      <b>URL ({{group}}, {{cluster}}):</b> <a target=_blank :href='url'>{{ url }}</a>
    </div>
    <div v-if='!loading'>
      <div class="alert alert-primary text-right">
        <button class="btn btn-primary" @click='getState()'>Refresh Analyzer State</button>
      </div>
    </div>
    <div v-if='error'>
      <exception :exception='errorData'></exception>
    </div>
    <div v-else-if='async'>
      <async-task :asyncData='asyncData'></async-task>
    </div>
    <div v-else-if='!loaded && loading'>
      <p>Loading ...</p>
    </div>
    <div v-else>
      <div class class="card-deck mb-3">
        <div class='card text-center'>
          <div class='card-header'>Analyzer</div>
          <div class='card-body'>
            <p class="card-text">
              <span :class="['badge', AnalyzerState.isProposalReady ? 'badge-success' : 'badge-info']">{{ !AnalyzerState.isProposalReady ? 'PROPOSAL_NOT_READY' : 'PROPOSALS_READY' }}</span>
            </p>
          </div>
        </div>
      </div>
      <div>
        <div v-if='AnalyzerState.goalReadiness.length > 0'>
          <table class="table table-sm table-bordered">
            <thead class="thead-light">
              <tr>
                <th>Goal</th>
                <th>Status</th>
                <th>Include All Topics</th>
                <th>Min Monitored Partition %</th>
                <th>Required Snapshots</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in AnalyzerState.goalReadiness">
                <td>{{ r.name }}</td>
                <td><boolean-el :label='r.status' /></td>
                <td><boolean-el :label='r.modelCompleteRequirement.includeAllTopics' /></td>
                <td>{{ r.modelCompleteRequirement.minMonitoredPartitionsPercentage }}</td>
                <td>{{ r.modelCompleteRequirement.requiredNumSnapshots }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import BooleanEL from '@/components/BooleanEL'

export default {
  name: 'Analyzer',
  props: {
    'group': String,
    'cluster': String
  },
  components: {
    'boolean-el': BooleanEL
  },
  data () {
    return {
      loaded: false,
      loading: false,
      error: false,
      errorData: null,
      async: false, // when the server treats this request as async
      asyncData: null, // when the server treats the request as async and sends progress instead of actual response
      AnalyzerState: {
        isProposalReady: false,
        readyGoals: [],
        goalReadiness: []
      }
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
    hideHelperURL () {
      return this.$store.state.hideHelperURL
    },
    url () {
      return this.$helpers.getURL('state', {substates: 'ANALYZER', verbose: true})
    }
  },
  methods: {
    argsChanged () {
      const newurl = this.$store.getters.getnewurl(this.group, this.cluster)
      this.$store.commit('seturl', newurl)
      this.loaded = false
      this.getState()
    },
    getState () {
      const vm = this
      vm.loading = true
      vm.loaded = false
      this.$http.get(vm.url, {withCredentials: true}).then((r) => {
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
          vm.$set(vm, 'AnalyzerState', r.data.AnalyzerState)
          vm.loading = false
          vm.loaded = true
        }
      }, (e) => {
        vm.loading = false
        vm.error = true
        vm.errorData = e && e.response && e.response.data ? e.response.data : e
      })
    }
  }
}
</script>

<style scoped>
.card-columns {
  column-count: 6;
}
.fade-enter-active, .fade-leave-active {
  transition: opacity .5s
}
.fade-enter, .fade-leave-to  {
  opacity: 0
}
</style>

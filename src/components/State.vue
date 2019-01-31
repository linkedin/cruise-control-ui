<!-- Copyright 2017-2019 LinkedIn Corp. Licensed under the BSD 2-Clause License (the "License"). See License in the project root for license information. -->
<template>
  <div class="row">
    <div class="col-3">
      <div class="card">
        <div class="card-body">
          <div class="nav flex-column nav-pills" aria-orientation="vertical">
            <router-link class="nav-link" :to='{"name": "page.state.executor", params: { group: group, cluster: cluster } }'>Executor State</router-link>
            <router-link class="nav-link" :to='{"name": "page.state.monitor", params: { group: group, cluster: cluster } }'><b>Monitor State</b></router-link>
            <router-link class="nav-link" :to='{"name": "page.state.analyzer", params: { group: group, cluster: cluster } }'><b>Analyzer State</b></router-link>
            <router-link class="nav-link" :to='{"name": "page.state.anomaly_detector", params: { group: group, cluster: cluster } }'><b>Anomaly Detector State</b></router-link>
          </div>
        </div>
      </div>
    </div>
    <div class="col-9">
      <div class="tab-content">
        <div class="card">
          <div class="card-body">
            <router-view></router-view>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>


<script>
import Monitor from '@/components/Monitor'
import Analyzer from '@/components/Analyzer'
import Executor from '@/components/Executor'
import AnomalyDetector from '@/components/AnomalyDetector'

export default {
  name: 'State',
  props: {
    'group': String,
    'cluster': String
  },
  components: {
    'monitor': Monitor,
    'analyzer': Analyzer,
    'executor': Executor,
    'anomaly-detector': AnomalyDetector
  }
}
</script>

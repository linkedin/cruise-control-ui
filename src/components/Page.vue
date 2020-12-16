<!-- Copyright 2017-2019 LinkedIn Corp. Licensed under the BSD 2-Clause License (the "License"). See License in the project root for license information. -->
<template>
  <div v-if="group == 'a' || cluster == 'b'">
    <div class="alert alert-info">
      <h3>Hi There !</h3>
      <p>To get started, please select one cluster from the top navigation.</p>
    </div>
  </div>
  <div v-else-if='!configloaded'>
    <div class="alert alert-warning">
      <h3>Please wait</h3>
      <p>Please wait while the configuration is loaded from remote server.</p>
    </div>
  </div>
  <div v-else>
    <offline></offline>
    <div class="alert alert-primary">{{ group }} &raquo; {{ cluster }}</div>
    <div class="card">
      <div class="card-header">
        <!-- common navigation -->
        <ul class="nav nav-tabs card-header-tabs">
          <!-- Bold Items are heavier on CC -->
          <li class="nav-item" v-if='modules.kafkaclusterstate' >
            <router-link class="nav-link" :to='{"name": "page.kafkaclusterstate", params: { group: group, cluster: cluster } }'>Kafka Cluster State</router-link>
          </li>
          <li class="nav-item" v-if='modules.load'>
            <router-link class="nav-link" :to='{"name": "page.load", params: { group: group, cluster: cluster } }'><b>Kafka Cluster Load</b></router-link>
          </li>
          <li class="nav-item" v-if='modules.replicaload'>
          <router-link class="nav-link" :to='{"name": "page.replicaload", params: { group: group, cluster: cluster } }'><b>Kafka Replica Load</b></router-link>
          </li>
          <li class="nav-item" v-if='modules.partitionload'>
          <router-link class="nav-link" :to='{"name": "page.partitionload", params: { group: group, cluster: cluster } }'><b>Kafka Partition Load</b></router-link>
          </li>
          <li class="nav-item" v-if='modules.state'>
          <router-link class="nav-link" :to='{"name": "page.state", params: { group: group, cluster: cluster } }'>Cruise Control State</router-link>
          </li>
          <li class="nav-item" v-if='modules.proposals'>
          <router-link class="nav-link" :to='{"name": "page.proposals", params: { group: group, cluster: cluster } }'><b>Cruise Control Proposals</b></router-link>
          </li>
          <li class="nav-item" v-if='modules.user_tasks'>
          <router-link class="nav-link" :to='{"name": "page.user_tasks", params: { group: group, cluster: cluster } }'>Cruise Control Tasks</router-link>
          </li>
          <li class="nav-item" v-if='modules.chart_page'>
          <router-link class="nav-link" :to='{"name": "page.resource_distributions", params: { group: group, cluster: cluster } }'>Resource distributions</router-link>
          </li>
          <!--
          <li class="nav-item" v-if='modules.admin_state'>
            <router-link :to='{"name": "page.admin_state", params: { group: group, cluster: cluster, embed: true } }'>&#9881; Sampling Admin</router-link>
          </li>
          -->
          <li class="nav-item" v-if='modules.review'>
            <router-link class="nav-link" :to='{"name": "page.review", params: { group: group, cluster: cluster } }'>Peer Reviews</router-link>
          </li>
          <li class="nav-item" v-if='modules.admin_broker'>
            <router-link class="nav-link" :to='{"name": "page.admin_broker", params: { group: group, cluster: cluster } }'>&#9881; Kafka Cluster Administration</router-link>
          </li>
        </ul>
      </div>
      <div class="card-body">
        <transition name="fade" mode="out-in">
        <router-view></router-view><!-- this will render child components -->
        </transition>
      </div>
    </div>
  </div>
</template>

<script>
import Offline from '@/components/Offline'
export default {
  name: 'Page',
  props: {
    group: String,
    cluster: String
  },
  data () {
    return {
      modules: this.$store.state.modules
    }
  },
  computed: {
    configloaded () {
      return Object.keys(this.$store.state.config).length > 0
    }
  },
  components: {
    'offline': Offline
  }
}
</script>

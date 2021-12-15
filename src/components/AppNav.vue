<!-- Copyright 2017-2019 LinkedIn Corp. Licensed under the BSD 2-Clause License (the "License"). See License in the project root for license information. -->
<template>
  <nav class="navbar navbar-expand-md navbar-dark fixed-top bg-dark">
    <a href="#" target="_self" class="navbar-brand">
        <img height=48 :src="cclogo" alt="LinkedIn Kafka Cruise Control Frontend" />
    </a>
    <router-link class="navbar-item" :to='{name: "summary"}'>Summary</router-link>
    <ul class="navbar-nav">
      <li class="nav-item dropdown" v-for="(groupm, forgroup) in groups" :key="forgroup">
        <a class="nav-link dropdown-toggle" data-toggle='dropdown'>{{ forgroup }}</a>
        <div class="dropdown-menu">
          <router-link class='dropdown-item' :key="c.label" v-for="c in groupm" :to='{"name": "page.kafkaclusterstate", "params": { "group": forgroup, "cluster": c.label } }'>{{ c.label }}</router-link>
        </div>
      </li>
    </ul>
    <ul class="navbar-nav ml-auto">
      <li class="nav-item dropdown">
        <a class="nav-link dropdown-toggle" data-toggle='dropdown'>UI Administration</a>
        <div class="dropdown-menu">
          <router-link :to='{"name": "preferences"}' class="dropdown-item" target="_self">&#9881;  Preferences</router-link>
          <a class='dropdown-item' href='#' @click.prevent='refresh()'>⟳ Refresh Config</a>
          <router-link :to='{"name": "configInsights"}' class="dropdown-item" target="_self">config.csv Insights</router-link>
        </div>
      </li>
    </ul>
  </nav>
</template>

<script>
import xssFilters from 'xss-filters'
import cclogo from '../assets/images/cc-logo.png'

export default {
  name: 'AppNav',
  props: {
    group: String,
    cluster: String
  },
  data () {
    return {
      groups: {},
      active: {
        group: null,
        cluster: null,
        url: null
      },
      csvTimer: null,
      cclogo: cclogo
    }
  },
  methods: {
    configFetch () {
      let vm = this
      let notselected = true
      let url = vm.$store.state.configurl + '?_t=' + (new Date() / 1)
      // download the cluster information csv file
      vm.$http.get(url, {withCredentials: true}).then((r) => {
        let lines = r.data.split(/\n/)
        let groups = {}
        let config = {}
        for (let i = 0; i < lines.length; i++) {
          let csv = lines[i].split(/,/)
          if (csv.length === 3) {
            let group = xssFilters.inHTMLData(csv[0])
            let label = xssFilters.inHTMLData(csv[1])
            let url = xssFilters.uriInHTMLData(csv[2])
            if (!groups[group]) {
              groups[group] = []
            }
            if (!config[group]) {
              config[group] = {}
            }
            if (!config[group][label]) {
              config[group][label] = csv[2]
            }
            groups[group].push({label: label, url: url})
            // set the initial selected things
            if (notselected) {
              vm.$set(vm.active, 'group', group)
              vm.$set(vm.active, 'cluster', label)
              vm.$set(vm.active, 'url', url)
            }
          }
        }
        vm.groups = groups
        vm.$store.commit('config', config)
        if (Object.keys(groups).length === 0) {
          vm.$store.commit('configError', true)
          vm.$store.commit('configErrorMessage', 'No Cruise-Control REST End point information found found in the : ' + vm.$store.state.configurl)
        } else {
          vm.$store.commit('configError', false)
          vm.$store.commit('configErrorMessage', null)
        }
      }, (e) => {
        vm.$store.commit('configError', true)
        vm.$store.commit('configErrorMessage', 'Error encountered while fetching :' + vm.$store.state.configurl)
      }).then(() => {
        console.log('completed')
      })
    },
    refresh () {
      this.configFetch()
    },
    reloadForever () {
      let vm = this
      vm.csvTimer = window.setInterval(function () {
        // console.log('calling ...', vm.$store.state.configFileReloadInterval)
        if (vm.$store.state.enableConfigFileReload) {
          vm.configFetch()
        }
      }, vm.$store.state.configFileReloadInterval)
    }
  },
  created () {
    this.configFetch()
  },
  beforeDestroy () {
    try {
      window.clearInterval(this.csvTimer)
    } catch (e) {}
  }
}
</script>

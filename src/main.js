// Copyright 2017-2019 LinkedIn Corp. Licensed under the BSD 2-Clause License (the "License"). See License in the project root for license information.

// The Vue build version to load with the `import` command
// (runtime-only or standalone) has been set in webpack.base.conf with an alias.
import Vue from 'vue'
import Vuex from 'vuex'
import Axios from 'axios'
import App from './App'
import Api from './api'
import router from './router'
import store from './store'
import Exception from '@/components/Exception'
import AsyncTask from '@/components/AsyncTask'
import 'bootstrap/js/dist/dropdown'
import 'bootswatch/dist/cosmo/bootstrap.css'

Vue.use(Vuex)

Vue.component('exception', Exception)
Vue.component('async-task', AsyncTask)

Vue.prototype.$http = Axios
Vue.prototype.$helpers = Api
Vue.config.productionTip = false

// disk is already in MB
Vue.filter('formatUnits', function (v) {
  v = v * 1024 * 1024
  var units = [ 'B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB' ]
  for (var i = 0; i < units.length; i++) {
    if (v <= Math.pow(1024, i + 1)) {
      var value = v / Math.pow(1024, i)
      value = value.toFixed(2)
      return value + ' ' + units[i]
    }
  }
})

// network is in KB
Vue.filter('formatNetworkUnits', function (v) {
  v = v * 1000
  var units = [ 'Bps', 'KBps', 'MBps', 'GBps', 'TBps', 'PBps', 'EBps', 'ZBps', 'YBps' ]
  for (var i = 0; i < units.length; i++) {
    if (v <= Math.pow(1024, i + 1)) {
      var value = v / Math.pow(1024, i)
      value = value.toFixed(0)
      return value + ' ' + units[i]
    }
  }
})

Vue.filter('formatHost', function (v) {
  if (v) {
    return v.replace(/\.(\w+)\.(com|org|biz|net)$/, '')
  } else {
    return v
  }
})

Vue.filter('formatNumber', function (v) {
  return Number(v).toLocaleString()
})

Vue.filter('camelCase', function (v) {
  return v.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')
})

Vue.filter('splitCamelCase', function (v) {
  return v.replace(/([A-Z])/g, ' $1').replace(/^./, function (str) { return str.toUpperCase() })
})

Vue.filter('formatLocalTime', function (v) {
  let d = new Date() / 1000
  return Number((d - v / 1000)).toFixed(0) + ' secs'
})

/* eslint-disable no-new */
new Vue({
  el: '#app',
  store,
  router,
  template: '<App/>',
  components: { App }
})

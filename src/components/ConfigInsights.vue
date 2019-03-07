<!-- Copyright 2017-2019 LinkedIn Corp. Licensed under the BSD 2-Clause License (the "License"). See License in the project root for license information. -->
<template>
    <div>
        <h3>config.csv Insights</h3>
        <table class='table table-bordered'>
            <thead>
                <tr class='text-center'>
                    <th colspan=3><code>config.csv</code> Data</th>
                    <th colspan=3>Derived Values</th>
                </tr>
                <tr>
                    <th>Logical Group</th>
                    <th>CC Instance Name</th>
                    <th>CC API URL</th>
                    <th>CC API Absolute URL <i title="Cruise Control REST API Url">?</i></th>
                    <th>Are CC &amp; CCFE Same Origin ?</th>
                    <th>CORS Required ?</th>
                </tr>
            </thead>
            <tbody>
                <tr v-if='records.length === 0'>
                    <td colspan=5>No records in <code>config.csv</code></td>
                </tr>
                <tr v-for='(r, k) in records' :key='r[3]' v-else>
                    <td>{{ r[0] }} </td>
                    <td>{{ r[1] }} </td>
                    <td>{{ r[2] }} </td>
                    <td>{{ r[3] }} </td>
                    <td><boolean-el :label='r[5]'></boolean-el></td>
                    <td><boolean-el :label='!r[5]'></boolean-el></td>
                </tr>
            </tbody>
        </table>
        <div class="alert alert-warning" v-if='corsRequired'>
            <b>CORS Alert!</b> One or more URLs in your <code>config.csv</code> requires you to enable CORS support on your Cruise Control Server.
        </div>
        <div class="alert alert-primary" v-else>
            <b>NOTE:</b> All the CC REST API URLs in the <code>config.csv</code> are configured to be Served from the Origin server (<code>{{ origin }}</code>) on which CCFE is deployed.
        </div>
    </div>
</template>

<script>
import BooleanEL from '@/components/BooleanEL'
var Url = require('url-parse')
export default {
  name: 'ConfigInsights',
  components: {
    'boolean-el': BooleanEL
  },
  computed: {
    origin () {
      return Url('/').href
    },
    records () {
      let r = []
      Object.keys(this.$store.state.config).forEach((name) => {
        Object.keys(this.$store.state.config[name]).forEach((place) => {
          let url = this.$store.state.config[name][place]
          let origin = Url('/')
          let ccUrl = Url(url)
          let match = 0
          let props = ['protocol', 'hostname', 'port']
          props.forEach((k) => {
            if (origin[k] === ccUrl[k]) {
              match++
            }
          })
          r.push([name, place, url, ccUrl.href, origin, match === 3])
        })
      })
      return r
    },
    corsRequired () {
      let c = 0
      this.records.forEach((r) => {
        if (r[5]) {
          c++
        }
      })
      return !(this.records.length === c)
    }
  }
}
</script>

<!-- Copyright 2017-2019 LinkedIn Corp. Licensed under the BSD 2-Clause License (the "License"). See License in the project root for license information. -->
<template>
  <div v-if='partitions'>
    <h4>{{ title }}</h4>
    <div class="alert alert-success" v-if='partitions.length <= 0'>{{ successTitle }}</div>
    <table class="table table-sm table-bordered" v-else>
      <thead class="thead-light">
        <tr>
          <th>Kafka Topic</th>
          <th>Partition</th>
          <th>Replicas</th>
          <th>Leader</th>
          <th>In-Sync</th>
          <th>Out-Of-Sync</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for='part in pagepartitions'>
          <td>{{ part.topic }}</td>
          <td>{{ part.partition }}</td>
          <td>{{ part.replicas }}</td>
          <td>{{ part.leader }}</td>
          <td>{{ part['in-sync'] }}</td>
          <td :class='part["out-of-sync"] ? "table-danger" : null'>{{ part['out-of-sync'] }}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <td colspan=3>
            Found {{ partitions.length }} Records
          </td>
          <td colspan=3 class='text-right'>
            <label> #Records Per Page:</label>
            <input v-model='perpage' type='number'>
            <label> Page #</label>
            <select v-model='pageNumber'>
              <option v-for='p in pages'>{{ p }}</option>
            </select>
          </td>
        </tr>
      </tfoot>
    </table>
  </div>
</template>

<script>
export default {
  name: 'KafkaPartitionState',
  props: {
    title: String,
    successTitle: String,
    partitions: Array
  },
  data () {
    return {
      search: '', // inline filter on the topic
      pageNumber: 1, // default page number data to be shown when initialized for first time
      perpage: 10, // total number of partitions to show in one page
      start: 0, // start offset in partitions array
      end: 10 // end offset in partitions array
    }
  },
  // these variables are computed whenever there is any dependency change in the members
  computed: {
    // Array of page numbers to show based on active services (including filtered) data
    pages () {
      let list = []
      for (let i = 0; i < this.partitions.length / this.perpage; i++) {
        list.push(i + 1)
      }
      return list
    },
    // Returns the list of partitions that can be rendered in the current page thats selected by user.
    pagepartitions () {
      this.start = (this.pageNumber - 1) * this.perpage
      this.end = Math.min(
        this.pageNumber * this.perpage,
        this.partitions.length,
      )
      return this.partitions.slice(this.start, this.end)
    }
  }
}
</script>

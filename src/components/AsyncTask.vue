<!-- Copyright 2017-2019 LinkedIn Corp. Licensed under the BSD 2-Clause License (the "License"). See License in the project root for license information. -->
<template>
  <div :class="[!isParsed ? 'alert alert-primary' : null]">
    <div class="card bg-light mb-3">
      <div class="card-header">Async Request: Request Being Processed</div>
      <div class="card-body">
        <div class="alert alert-info"><b>INFO:</b> Cruise control requires more time to compute the response for this request. Progress of each step is shown below.</div>
        <pre v-if='!isParsed'>{{ asyncData }}</pre>
        <table v-else class="table table-sm table-bordered">
          <thead class="thead-light">
            <tr>
              <th class="text-center">Name</th>
              <th class="text-center">Operation</th>
              <th class="text-center">Description</th>
              <th class="text-center">Completion</th>
              <th class="text-center">Computation Time (ms)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(step, idx) in steps" :key="idx">
              <td>{{ step.label }}</td>
              <td>{{ step.step }}</td>
              <td>{{ step.description }}</td>
              <td>{{ step.completionPercentage }} <i>%</i></td>
              <td>{{ step['time-in-ms'] | formatNumber }} <i>ms</i></td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th colspan=3>Total Completion</th>
              <th>{{ totalCompletion }} <i>%</i></th>
              <th>&nbsp;</th>
            </tr>
            <tr>
              <th colspan=4>Total Time (ms)</th>
              <th>{{ totalTime | formatNumber }} <i>ms</i></th>
            </tr>
          </tfoot>
        </table>
        <!--
          TBD: For some reason, this event is captured only once by parent component
          <div class="text-right">
          <button @click="checkNow()" class="btn btn-primary">Check Status Now</button>
          </div>
        -->
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AsyncTask',
  props: {
    asyncData: [String, Object]
  },
  methods: {
    checkNow () {
      this.$emit('CheckAsyncResponse')
    }
  },
  computed: {
    isParsed () {
      return Object.prototype.hasOwnProperty.call(this.asyncData, 'progress')
    },
    steps () {
      if (!this.isParsed) {
        return []
      }
      const steps = []
      this.asyncData.progress.forEach((op) => {
        if (Object.prototype.hasOwnProperty.call(op, 'operationProgress')) {
          op.operationProgress.forEach((step) => {
            steps.push({
              label: op.operation,
              step: step.step,
              completionPercentage: step.completionPercentage,
              description: step.description,
              'time-in-ms': step['time-in-ms']
            })
          })
        } else {
          steps.push({
            label: 'Async Task',
            step: op.step,
            completionPercentage: op.completionPercentage,
            description: op.description,
            'time-in-ms': op['time-in-ms']
          })
        }
      })
      return steps
    },
    totalCompletion () {
      if (this.steps.length === 0) return 0
      let total = 0
      this.steps.forEach((s) => { total += s.completionPercentage })
      return total / this.steps.length
    },
    totalTime () {
      let total = 0
      this.steps.forEach((s) => { total += s['time-in-ms'] })
      return total
    }
  }
}
</script>

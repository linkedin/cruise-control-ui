<template>
  <div>
    <h1 class="text-center">
      Cluster {{ cluster }} ({{ group }})
    </h1>
    <h2 class="text-center">
      {{ resource }} distribution across brokers per topic
    </h2>

    <div class="col-5 mx-auto">
      <div class="row">
        <div class="col-8 mx-auto my-auto">
          <input
            type="text"
            class="form-control"
            v-model="filter"
            placeholder="filter topics.."
            :disabled="stacked"
          />
        </div>
        <div class="col-4">
          <div class="form-check">
            <input
              v-model="stacked"
              type="checkbox"
              class="form-check-input"
              id="stackedCheckBox"
            />
            <label class="form-check-label" for="stackedCheckBox">
              Stacked view
            </label>
          </div>
          <div class="dropdown">
            <button
              class="btn btn-outline-primary btn-sm dropdown-toggle"
              type="button"
              data-toggle="dropdown"
              aria-haspopup="true"
              aria-expanded="false"
            >
              display: {{ resource }}
            </button>
            <div class="dropdown-menu" aria-labelledby="dropdownMenuButton">
              <a class="dropdown-item" @click.prevent="setResource('leaders')"
                >Leaders</a
              >
              <a class="dropdown-item" @click.prevent="setResource('replicas')"
                >Replicas</a
              >
              <a class="dropdown-item" @click.prevent="setResource('cpu')"
                >CPU</a
              >
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="alert alert-danger" role="alert" v-if="error">
      {{ error }}
    </div>

    <div class="row" v-show="stacked">
      <div class="col-8 mx-auto">
        <div class="card mx-4 mt-4">
          <div class="card-inner" style="height:500px;">
            <LineChart
              v-bind:style="{
                height: '100%',
                width: '100%',
                position: 'relative'
              }"
              :chart-data="formatStackedData"
              :options="getStackedOptions"
            ></LineChart>
          </div>
        </div>
      </div>
    </div>

    <div
      class="row mx-auto"
      v-show="!stacked"
    >
      <div
        class="col-4"
        v-for="item in cachedKccData"
        v-bind:key="item[0]"
        v-show="item[0].toLowerCase().includes(filter.toLowerCase())"
      >
        <div class="card mt-4">
          <div class="card-inner">
            <LineChart
              :chart-data="formatItemData(item)"
              :options="formatItemOptions(item)"
            ></LineChart>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import LineChart from '@/components/LineChart.vue'

class Topic {
  constructor () {
    this.leaders = {}
    this.replicas = {}
    this.cpu = {}
    this.replicationFactor = 0
    this.disk = 0
  }

  addLeader (item) {
    let broker = item.leader
    if (this.leaders[broker] === undefined) {
      this.leaders[broker] = 1
      return
    }
    this.leaders[broker]++
  }

  addReplicas (item) {
    let replicas = Object.values(item.followers)
    replicas.push(item.leader)

    replicas.map(follower => {
      if (this.replicas[follower] === undefined) {
        this.replicas[follower] = 1
        return
      }
      this.replicas[follower]++
    })
  }

  countCpu (item) {
    if (this.cpu[item.leader] === undefined) {
      this.cpu[item.leader] = item.cpu
      return
    }
    this.cpu[item.leader] += item.cpu
  }

  countDisk (item) {
    let replicationFactor = item.followers.length + 1
    this.disk += item.disk * replicationFactor
  }

  getSize () {
    let decimals = 2
    if (this.disk === 0) return '0 MiB'
    const k = 1024
    const sizes = ['MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']
    let i
    if (this.disk <= 1) {
      i = 0
    } else {
      i = Math.floor(Math.log(this.disk) / Math.log(k))
    }
    return parseFloat((this.disk / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i]
  }
}

export default {
  name: 'ResourceDistributionChart',
  components: {
    LineChart
  },

  props: {
    group: String,
    cluster: String
  },

  data () {
    return {
      resource: 'leaders',
      stacked: false,
      filter: '',
      cachedKccData: null,
      error: null,
      brokerList: []
    }
  },

  beforeMount () {
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

  mounted () {
    this.fetchKccData()
    this.moptions = this.getOptions('test')
  },

  methods: {
    argsChanged () {
      const newurl = this.$store.getters.getnewurl(this.group, this.cluster)
      this.$store.commit('seturl', newurl)
    },
    cacheKccDataItem (item) {
      if (!this.cachedKccData.has(item.topic)) {
        this.cachedKccData.set(item.topic, new Topic())
      }
      this.cachedKccData.get(item.topic).addLeader(item)
      this.cachedKccData.get(item.topic).addReplicas(item)
      this.cachedKccData.get(item.topic).countCpu(item)
      this.cachedKccData.get(item.topic).countDisk(item)
      this.cachedKccData.get(item.topic).replicationFactor = Math.max(this.cachedKccData.get(item.topic).replicationFactor, item.followers.length + 1)
    },
    fetchKccData () {
      this.cachedKccData = new Map()
      this.$http
        .get(this.$helpers.getURL('partitionload', {}))
        .then(response => {
          let brokerList = new Set()
          for (let record of response.data.records) {
            this.cacheKccDataItem(record)
            brokerList.add(record.leader, ...record.followers)
          }
          this.brokerList = [...brokerList].sort()
        })
        .then(e => {
          this.cachedKccData = new Map([...this.cachedKccData.entries()].sort((a, b) => {
            if (a[1].disk > b[1].disk) {
              return -1
            }
            return 1
          }))
        })
        .catch(error => {
          this.error = error.response.data
        })
    },
    formatItemData (item) {
      let resources = item[1][this.resource]
      return {
        datasets: [{
          data: [...Object.values(resources)],
          backgroundColor: 'rgba(7, 66, 160, 0.5)'
        }],
        labels: [...Object.keys(resources)].map(e => 'broker ' + e)
      }
    },
    formatItemOptions (item) {
      let title = `${item[0]} (RF ${item[1].replicationFactor}, size ${item[1].getSize()})`
      return this.getOptions(title)
    },
    getOptions (title) {
      let options = {
        legend: {
          display: false
        },
        scales: {
          yAxes: [{
            ticks: {
              beginAtZero: true
            },
            scaleLabel: {
              labelString: this.resource === 'cpu' ? '% cpu' : `nb ${this.resource}`,
              display: true
            }
          }]
        },
        title: {
          display: true,
          text: title
        }
      }
      return options
    },
    setResource (resource) {
      this.resource = resource
    }
  },

  computed: {
    formatStackedData () {
      let stackedKccData = {
        labels: this.brokerList,
        datasets: []
      }

      if (this.cachedKccData === null) {
        return stackedKccData
      }

      let counter = 0
      for (let topic of this.cachedKccData) {
        let dataset = {
          label: topic[0],
          data: [],
          backgroundColor: this.$store.state.chartColors[counter]
        }
        counter++
        counter = counter % this.$store.state.chartColors.length
        for (let broker of this.brokerList) {
          let value = (topic[1][this.resource][broker] !== undefined) ? topic[1][this.resource][broker] : 0
          dataset.data.push(value)
        }
        stackedKccData.datasets.push(dataset)
      }

      return stackedKccData
    },

    getStackedOptions () {
      let options = this.getOptions(`stacked ${this.resource} view`)
      options.scales.xAxes = [{ stacked: true }]
      options.scales.yAxes[0].stacked = true
      options.scales.yAxes[0].scaleLabel.labelString = this.resource === 'cpu' ? '% cpu' : `nb ${this.resource}`
      options.maintainAspectRatio = false
      options.responsive = true
      options.legend = {
        display: true,
        position: 'bottom'
      }
      return options
    }
  }
}
</script>
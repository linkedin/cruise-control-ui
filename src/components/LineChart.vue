<script>
import { Bar, mixins } from 'vue-chartjs'
const { reactiveProp } = mixins

export default {
  extends: Bar,
  mixins: [reactiveProp],
  props: ['chartData', 'options'],
  mounted () {
    // Overwriting base render method with actual data.
    this.renderChart(this.chartData, this.options)
  },
  watch: {
    options: function () {
      this.$data._chart.options = this.options
      this.$data._chart.update()
    }
  }
}
</script>

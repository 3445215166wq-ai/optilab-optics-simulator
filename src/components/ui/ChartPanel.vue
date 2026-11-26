<script setup lang="ts">
/**
 * ECharts 容器：负责实例生命周期、尺寸自适应与配置更新。
 * 图表配置由各模块以纯函数方式生成（core → option），本组件只做渲染。
 *
 * 注意：图表通常位于底部可切换标签页中，切到其他标签时容器 display:none、
 * 宽高为 0，此时不能初始化 ECharts（会得到 0×0 画布并输出告警），
 * 因此采用「可见时才初始化」的惰性策略，由 ResizeObserver 驱动。
 */
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { EChartsOption } from 'echarts'
import { echarts } from '@/lib/echarts'

const props = defineProps<{
  option: EChartsOption
  height?: number
}>()

const host = ref<HTMLDivElement | null>(null)
const chart = shallowRef<echarts.ECharts | null>(null)
let observer: ResizeObserver | null = null

function ensureChart(): void {
  if (chart.value) return
  const el = host.value
  if (!el) return
  if (el.clientWidth < 8 || el.clientHeight < 8) return
  chart.value = echarts.init(el, undefined, { renderer: 'canvas' })
  chart.value.setOption(props.option, true)
}

function sync(): void {
  ensureChart()
  if (!chart.value) return
  if (chart.value.getWidth() < 8) {
    // 容器从隐藏变为可见时补一次尺寸计算
    chart.value.resize()
  }
}

onMounted(() => {
  ensureChart()
  if (host.value) {
    observer = new ResizeObserver(() => sync())
    observer.observe(host.value)
  }
})

watch(
  () => props.option,
  (next) => {
    if (!chart.value) {
      ensureChart()
      return
    }
    // notMerge = true：参数变化后曲线数量可能改变，必须整体替换
    chart.value.setOption(next, true)
  },
)

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
  chart.value?.dispose()
  chart.value = null
})
</script>

<template>
  <div ref="host" class="chart-host" :style="{ height: `${height ?? 190}px` }" />
</template>

<style scoped>
.chart-host {
  width: 100%;
  min-width: 0;
}
</style>

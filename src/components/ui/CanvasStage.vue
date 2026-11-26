<script setup lang="ts">
/**
 * 通用 Canvas 舞台。
 * - 处理 DPR（高分屏清晰度）与容器尺寸变化；
 * - 通过 watchEffect 自动追踪 draw 函数内部读取的响应式参数，参数变化即重绘；
 * - 单次绘制异常只记录一次日志，不打断整个界面。
 */
import { onBeforeUnmount, onMounted, reactive, ref, watchEffect } from 'vue'
import { pushLog } from '@/stores/log'

const props = defineProps<{
  draw: (ctx: CanvasRenderingContext2D, size: { w: number; h: number }) => void
}>()

const emit = defineEmits<{ (e: 'resize', size: { w: number; h: number }): void }>()

const host = ref<HTMLDivElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const size = reactive({ w: 0, h: 0, dpr: 1 })

let observer: ResizeObserver | null = null
let drawErrorLogged = false

function applySize(): void {
  const el = host.value
  const cv = canvas.value
  if (!el || !cv) return
  const rect = el.getBoundingClientRect()
  const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1))
  const w = Math.max(1, Math.round(rect.width))
  const h = Math.max(1, Math.round(rect.height))
  size.w = w
  size.h = h
  size.dpr = dpr
  const pxW = Math.round(w * dpr)
  const pxH = Math.round(h * dpr)
  if (cv.width !== pxW || cv.height !== pxH) {
    cv.width = pxW
    cv.height = pxH
    cv.style.width = `${w}px`
    cv.style.height = `${h}px`
  }
  emit('resize', { w, h })
}

function render(): void {
  const cv = canvas.value
  if (!cv || size.w <= 0 || size.h <= 0) return
  const ctx = cv.getContext('2d')
  if (!ctx) return
  ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0)
  ctx.clearRect(0, 0, size.w, size.h)
  try {
    props.draw(ctx, { w: size.w, h: size.h })
  } catch (error) {
    if (!drawErrorLogged) {
      drawErrorLogged = true
      pushLog('error', '渲染', `画布绘制异常：${String(error)}`)
      console.error('[OptiLab] 画布绘制异常', error)
    }
  }
}

onMounted(() => {
  applySize()
  if (host.value && typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => {
      applySize()
      render()
    })
    observer.observe(host.value)
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})

watchEffect(() => {
  // 显式依赖：容器尺寸、DPR、canvas 引用
  void size.w
  void size.h
  void size.dpr
  void canvas.value
  // draw 内部读取的响应式参数（如模块 params / computed 结果）也会被自动追踪
  render()
})
</script>

<template>
  <div ref="host" class="canvas-stage">
    <canvas ref="canvas" class="stage__canvas" />
    <slot />
  </div>
</template>

<style scoped>
.canvas-stage {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
</style>

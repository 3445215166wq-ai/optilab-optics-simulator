<script setup lang="ts">
/**
 * 实验工作区骨架：中央可视化 + 右侧参数 + 底部数据坞（结果 / 曲线 / 日志）。
 * 每个实验模块只提供内容（slot），布局、标签页、可拖拽高度由本组件统一负责。
 */
import { computed, ref } from 'vue'
import LogConsole from '../ui/LogConsole.vue'

const props = defineProps<{
  initialTab?: DockTab
  initialDockHeight?: number
}>()

type DockTab = 'results' | 'charts' | 'log'

const tabs: Array<{ id: DockTab; label: string; labelEn: string }> = [
  { id: 'results', label: '计算结果', labelEn: 'results' },
  { id: 'charts', label: '特性曲线', labelEn: 'charts' },
  { id: 'log', label: '实验日志', labelEn: 'log' },
]

const tab = ref<DockTab>(props.initialTab ?? 'results')
const dockHeight = ref(props.initialDockHeight ?? 236)
const collapsed = ref(false)

const dockBodyStyle = computed(() => ({
  height: collapsed.value ? '0px' : `${dockHeight.value}px`,
}))

let startY = 0
let startHeight = 0

function onResizeDown(event: PointerEvent): void {
  if (collapsed.value) return
  startY = event.clientY
  startHeight = dockHeight.value
  window.addEventListener('pointermove', onResizeMove)
  window.addEventListener('pointerup', onResizeUp, { once: true })
  event.preventDefault()
}

function onResizeMove(event: PointerEvent): void {
  const next = startHeight + (startY - event.clientY)
  const max = Math.max(200, window.innerHeight * 0.62)
  dockHeight.value = Math.max(110, Math.min(max, next))
}

function onResizeUp(): void {
  window.removeEventListener('pointermove', onResizeMove)
}
</script>

<template>
  <div class="ws">
    <div class="ws__main">
      <div class="ws__stage">
        <slot name="stage" />
      </div>
      <div class="ws__side">
        <slot name="params" />
      </div>
    </div>

    <div class="dock">
      <div class="dock__resizer" title="拖动调整数据面板高度" @pointerdown="onResizeDown" />
      <div class="dock__tabs">
        <button
          v-for="item in tabs"
          :key="item.id"
          class="dock__tab"
          :class="{ 'dock__tab--on': tab === item.id }"
          @click="tab = item.id"
        >
          {{ item.label }}
          <span class="dock__tab-en">{{ item.labelEn }}</span>
        </button>
        <span class="panel__spacer" />
        <button class="btn btn--sm btn--ghost" @click="collapsed = !collapsed">
          {{ collapsed ? '展开' : '收起' }}
        </button>
      </div>
      <div v-show="!collapsed" class="dock__body" :style="dockBodyStyle">
        <div v-show="tab === 'results'" class="dock__pane">
          <slot name="results" />
        </div>
        <div v-show="tab === 'charts'" class="dock__pane">
          <slot name="charts" />
        </div>
        <div v-show="tab === 'log'" class="dock__pane dock__pane--flush">
          <LogConsole />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ws {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  height: 100%;
  min-height: 0;
  min-width: 0;
}

.ws__main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--panel-w);
  min-height: 0;
  min-width: 0;
}

.ws__stage {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: var(--bg-deep);
}

.ws__side {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-left: 1px solid var(--border);
  background: var(--bg-panel);
}

@media (max-width: 1080px) {
  .ws__main {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(260px, 42vh) minmax(0, 1fr);
    overflow: auto;
  }

  .ws__stage {
    min-height: 260px;
  }

  .ws__side {
    border-left: none;
    border-top: 1px solid var(--border);
  }
}
</style>

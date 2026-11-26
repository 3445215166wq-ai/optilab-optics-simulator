<script setup lang="ts">
/** 实验日志控制台：展示真实运行日志，可复制与清空 */
import { nextTick, ref, watch } from 'vue'
import { useLog } from '@/stores/log'

const { entries, clear, exportText } = useLog()
const list = ref<HTMLDivElement | null>(null)
const copied = ref(false)

watch(
  () => entries.value.length,
  async () => {
    await nextTick()
    const el = list.value
    if (el) el.scrollTop = el.scrollHeight
  },
)

async function copyAll(): Promise<void> {
  try {
    await navigator.clipboard.writeText(exportText())
    copied.value = true
    window.setTimeout(() => {
      copied.value = false
    }, 1400)
  } catch {
    copied.value = false
  }
}
</script>

<template>
  <div class="log-console">
    <div class="log-console__bar">
      <span class="xs muted">共 {{ entries.length }} 条 · 记录参数与计算结果，可导出</span>
      <span class="panel__spacer" />
      <button class="btn btn--sm btn--ghost" @click="copyAll">
        {{ copied ? '已复制' : '复制全部' }}
      </button>
      <button class="btn btn--sm btn--ghost" @click="clear()">清空</button>
    </div>
    <div ref="list" class="log">
      <div v-for="entry in entries" :key="entry.id" class="log__row">
        <span class="log__time">{{ entry.time }}</span>
        <span class="log__lvl" :class="`log__lvl--${entry.level}`">
          {{ entry.level.toUpperCase() }}
        </span>
        <span class="log__text">
          <span class="log__mod">[{{ entry.module }}]</span> {{ entry.text }}
        </span>
      </div>
      <div v-if="!entries.length" class="empty">暂无日志记录</div>
    </div>
  </div>
</template>

<style scoped>
.log-console {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  width: 100%;
}

.log-console__bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-bottom: 1px dashed var(--border);
  flex: none;
}
</style>

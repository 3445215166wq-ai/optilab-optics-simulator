<script setup lang="ts">
/**
 * 实验日志控制台。
 * 支持：按级别筛选、复制全部、清空；日志只保存在本机（localStorage）。
 */
import { computed, nextTick, ref, watch } from 'vue'
import { useLog, type LogLevel } from '@/stores/log'

const { entries, clear, exportText } = useLog()
const list = ref<HTMLDivElement | null>(null)
const copied = ref(false)
const levelFilter = ref<LogLevel | 'all'>('all')

const LEVELS: Array<{ value: LogLevel | 'all'; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'info', label: 'INFO' },
  { value: 'ok', label: 'OK' },
  { value: 'warn', label: 'WARN' },
  { value: 'error', label: 'ERROR' },
]

const visible = computed(() =>
  levelFilter.value === 'all' ? entries.value : entries.value.filter((e) => e.level === levelFilter.value),
)

function countOf(level: LogLevel | 'all'): number {
  return level === 'all' ? entries.value.length : entries.value.filter((e) => e.level === level).length
}

watch(
  () => visible.value.length,
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
      <div class="log-console__filters">
        <button
          v-for="l in LEVELS"
          :key="l.value"
          class="chip"
          :class="{ 'chip--on': levelFilter === l.value }"
          :disabled="l.value !== 'all' && countOf(l.value) === 0"
          @click="levelFilter = l.value"
        >
          {{ l.label }} {{ countOf(l.value) }}
        </button>
      </div>
      <span class="panel__spacer" />
      <button class="btn btn--sm btn--ghost" @click="copyAll">
        {{ copied ? '已复制' : '复制全部' }}
      </button>
      <button class="btn btn--sm btn--ghost" :disabled="!entries.length" @click="clear()">清空</button>
    </div>
    <div ref="list" class="log">
      <div v-for="entry in visible" :key="entry.id" class="log__row">
        <span class="log__time">{{ entry.time }}</span>
        <span class="log__lvl" :class="`log__lvl--${entry.level}`">
          {{ entry.level.toUpperCase() }}
        </span>
        <span class="log__text">
          <span class="log__mod">[{{ entry.module }}]</span> {{ entry.text }}
        </span>
      </div>
      <div v-if="!visible.length" class="empty">
        {{ entries.length ? '当前级别筛选下没有日志' : '暂无日志记录' }}
      </div>
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
  padding: 4px 10px;
  border-bottom: 1px dashed var(--border);
  flex: none;
  flex-wrap: wrap;
}

.log-console__filters {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.log-console__filters .chip {
  height: 20px;
  padding: 0 7px;
  font-family: var(--font-mono);
  font-size: 10px;
}

.log-console__filters .chip::before {
  display: none;
}
</style>

<script setup lang="ts">
/**
 * 实验日志控制台。
 * 支持：自动/手动记录切换、按级别筛选、手写一条日志、复制全部、清空。
 * 日志只保存在本机（localStorage）。
 */
import { computed, nextTick, ref, watch } from 'vue'
import { useLog, type LogLevel } from '@/stores/log'

const { entries, mode, suppressed, setMode, pushManual, clear, exportText } = useLog()
const list = ref<HTMLDivElement | null>(null)
const copied = ref(false)
const levelFilter = ref<LogLevel | 'all'>('all')
const draft = ref('')

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

function submitDraft(): void {
  if (pushManual('手动备注', draft.value)) draft.value = ''
}

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
      <div class="seg log-console__mode" role="group" aria-label="日志记录模式">
        <button
          class="seg__item"
          :class="{ 'seg__item--on': mode === 'auto' }"
          title="参数变化、模块加载、各动作都会自动写入日志"
          @click="setMode('auto')"
        >
          自动记录
        </button>
        <button
          class="seg__item"
          :class="{ 'seg__item--on': mode === 'manual' }"
          title="只记录你主动触发的条目：记录实验、手写日志；参数拖动不再写入（错误仍会记录）"
          @click="setMode('manual')"
        >
          手动记录
        </button>
      </div>

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
      <span v-if="mode === 'manual' && suppressed > 0" class="xs muted" :title="'手动模式下被静音的自动日志条数'">
        已抑制 {{ suppressed }} 条
      </span>
      <button class="btn btn--sm btn--ghost" @click="copyAll">
        {{ copied ? '已复制' : '复制全部' }}
      </button>
      <button class="btn btn--sm btn--ghost" :disabled="!entries.length" @click="clear()">清空</button>
    </div>

    <div v-if="mode === 'manual'" class="log-console__hint">
      手动模式：只有「记录实验」、下面这条手写日志、以及错误信息会写入；参数拖动的自动日志已静音。
    </div>

    <div class="log-console__compose">
      <input
        v-model="draft"
        class="input log-console__input"
        type="text"
        maxlength="200"
        placeholder="手写一条日志（例如：把 u 调到 250mm 观察像距变化），回车记录"
        @keydown.enter.prevent="submitDraft"
      />
      <button class="btn btn--sm" :disabled="!draft.trim()" @click="submitDraft">记录</button>
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
        {{ entries.length ? '当前级别筛选下没有日志' : mode === 'manual' ? '手动模式下暂无日志：可用上面输入框记一条，或到模块里点「记录实验」' : '暂无日志记录' }}
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

.log-console__mode {
  width: auto;
  flex: none;
}

.log-console__mode .seg__item {
  height: 22px;
  padding: 0 9px;
  font-size: var(--fs-xs);
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

.log-console__hint {
  padding: 3px 10px;
  font-size: 10.5px;
  line-height: 1.4;
  color: var(--text-3);
  background: var(--bg-panel-2);
  border-bottom: 1px dashed var(--border);
  flex: none;
}

.log-console__compose {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-bottom: 1px solid var(--border);
  flex: none;
}

.log-console__input {
  flex: 1 1 auto;
  min-width: 0;
  height: 24px;
  font-family: var(--font-sans);
  font-size: var(--fs-sm);
}
</style>

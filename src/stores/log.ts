/**
 * 实验日志：所有模块共享一条时间线，用于「实验日志 / Experiment Log」面板。
 * 日志内容全部来自真实的参数与计算结果，不含预置假数据。
 */
import { computed, onScopeDispose, reactive, watch } from 'vue'

export type LogLevel = 'info' | 'ok' | 'warn' | 'error'

export interface LogEntry {
  id: number
  /** HH:MM:SS.mmm */
  time: string
  level: LogLevel
  module: string
  text: string
}

const MAX_ENTRIES = 400

const state = reactive<{ entries: LogEntry[] }>({ entries: [] })
let seq = 0

function timestamp(): string {
  const d = new Date()
  const pad = (v: number, n = 2) => v.toString().padStart(n, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
}

export function pushLog(level: LogLevel, module: string, text: string): void {
  seq += 1
  state.entries.push({ id: seq, time: timestamp(), level, module, text })
  if (state.entries.length > MAX_ENTRIES) {
    state.entries.splice(0, state.entries.length - MAX_ENTRIES)
  }
}

export function clearLog(): void {
  state.entries.length = 0
  pushLog('info', '系统', '日志已清空')
}

export function exportLogText(): string {
  return state.entries.map((e) => `[${e.time}] [${e.level.toUpperCase()}] [${e.module}] ${e.text}`).join('\n')
}

export function useLog() {
  return {
    entries: computed(() => state.entries),
    push: pushLog,
    clear: clearLog,
    exportText: exportLogText,
  }
}

/**
 * 参数变化的节流日志：避免拖动滑杆时刷屏。
 * signature 返回 null 表示当前状态无有效结果，不记录。
 */
export function useExperimentLog(
  moduleName: string,
  signature: () => string | null,
  delay = 500,
): void {
  let timer: ReturnType<typeof setTimeout> | undefined
  let last: string | null = null

  const stop = watch(
    signature,
    (sig) => {
      if (sig === null || sig === last) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        last = sig
        pushLog('info', moduleName, sig)
      }, delay)
    },
    { immediate: false },
  )

  onScopeDispose(() => {
    if (timer) clearTimeout(timer)
    stop()
  })
}

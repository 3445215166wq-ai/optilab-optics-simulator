/**
 * 实验日志：所有模块共享一条时间线，用于「实验日志 / Experiment Log」面板。
 *
 * 两种记录模式（设置会保存在本机）：
 *   - auto（默认）：参数变化（节流）+ 模块加载 + 各动作都会自动记一条；
 *   - manual：**只记录你主动触发的内容** —— 「记录实验」、手写日志、模式切换、清空动作。
 *     参数拖动产生的节流日志会被静默丢弃（可在面板上看到"已抑制 N 条"）。
 *     `error` 级别不受模式影响，永远记录（错误不能被静音）。
 *
 * 日志内容全部来自真实的参数与计算结果，不含预置假数据。
 */
import { computed, onScopeDispose, reactive, watch } from 'vue'
import { loadJson, removeKey, saveJson } from './persistence'

export type LogLevel = 'info' | 'ok' | 'warn' | 'error'
export type LogMode = 'auto' | 'manual'

export interface LogEntry {
  id: number
  /** HH:MM:SS.mmm */
  time: string
  level: LogLevel
  module: string
  text: string
}

const MAX_ENTRIES = 400
const STORAGE_KEY = 'log'
const MODE_KEY = 'logMode'

const state = reactive<{ entries: LogEntry[]; mode: LogMode; suppressed: number }>({
  entries: [],
  mode: 'auto',
  suppressed: 0,
})
let seq = 0
let saveTimer: ReturnType<typeof setTimeout> | undefined

/** 节流写入 localStorage：拖动滑杆时日志可能密集产生，避免每行都同步写盘 */
function persistSoon(): void {
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = undefined
    saveJson(STORAGE_KEY, state.entries)
  }, 600)
}

/** 从本地恢复历史日志与记录模式（页面刷新后仍能追溯上一次实验） */
export function hydrateLog(): number {
  const saved = loadJson<LogEntry[]>(STORAGE_KEY, [], Array.isArray)
  state.entries.splice(0, state.entries.length, ...saved.slice(-MAX_ENTRIES))
  for (const e of state.entries) if (typeof e.id === 'number' && e.id > seq) seq = e.id
  state.mode = loadJson<LogMode>(MODE_KEY, 'auto', (v) => v === 'auto' || v === 'manual')
  return state.entries.length
}

function timestamp(): string {
  const d = new Date()
  const pad = (v: number, n = 2) => v.toString().padStart(n, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
}

export interface PushLogOptions {
  /** true = 用户主动记录，手动模式下也会写入 */
  manual?: boolean
}

/**
 * 追加一条日志。
 * 手动模式下自动类日志会被抑制（并累加 suppressed 计数）；error 级别永远写入。
 */
export function pushLog(
  level: LogLevel,
  module: string,
  text: string,
  options: PushLogOptions = {},
): boolean {
  const shouldKeep = state.mode === 'auto' || options.manual === true || level === 'error'
  if (!shouldKeep) {
    state.suppressed += 1
    return false
  }
  seq += 1
  state.entries.push({ id: seq, time: timestamp(), level, module, text })
  if (state.entries.length > MAX_ENTRIES) {
    state.entries.splice(0, state.entries.length - MAX_ENTRIES)
  }
  persistSoon()
  return true
}

/** 用户手写一条日志（手动模式下也一定记录） */
export function pushManualLog(module: string, text: string, level: LogLevel = 'info'): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  return pushLog(level, module, trimmed, { manual: true })
}

/** 切换记录模式；切换本身会记一条（手动级，两种模式下都能看到） */
export function setLogMode(mode: LogMode): void {
  if (mode === state.mode) return
  state.mode = mode
  state.suppressed = 0
  saveJson(MODE_KEY, mode)
  pushLog(
    'info',
    '系统',
    mode === 'manual'
      ? '日志切换为「手动记录」：只有你主动记录的内容会写入（参数拖动的自动日志已静音，错误仍会记录）'
      : '日志切换为「自动记录」：参数变化与各动作会自动写入',
    { manual: true },
  )
}

/** 清空日志时把抑制计数也归零 */
export function clearLog(): void {
  state.entries.length = 0
  state.suppressed = 0
  removeKey(STORAGE_KEY)
  pushLog('info', '系统', '日志已清空', { manual: true })
}

export function exportLogText(): string {
  return state.entries.map((e) => `[${e.time}] [${e.level.toUpperCase()}] [${e.module}] ${e.text}`).join('\n')
}

export function useLog() {
  return {
    entries: computed(() => state.entries),
    mode: computed(() => state.mode),
    suppressed: computed(() => state.suppressed),
    push: pushLog,
    pushManual: pushManualLog,
    setMode: setLogMode,
    clear: clearLog,
    exportText: exportLogText,
  }
}

/**
 * 参数变化的节流日志：避免拖动滑杆时刷屏。
 * signature 返回 null 表示当前状态无有效结果，不记录。
 * 手动模式下直接不注册，连节流计时器都不跑。
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
      if (state.mode !== 'auto') return
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

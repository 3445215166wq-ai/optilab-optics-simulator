/**
 * 日志 store 的行为测试：自动/手动模式的抑制规则。
 * 环境是 Node（没有 localStorage），persistence 会静默降级，正好覆盖「存储不可用」的情况。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearLog,
  exportLogText,
  hydrateLog,
  pushLog,
  pushManualLog,
  setLogMode,
  useLog,
} from './log'

describe('日志模式', () => {
  beforeEach(() => {
    setLogMode('auto')
    clearLog()
  })

  it('默认是自动模式，自动日志会写入', () => {
    expect(useLog().mode.value).toBe('auto')
    expect(pushLog('info', '几何光学', '自动日志')).toBe(true)
    expect(useLog().entries.value.some((e) => e.text === '自动日志')).toBe(true)
  })

  it('手动模式下自动日志被抑制并累计计数', () => {
    setLogMode('manual')
    const before = useLog().suppressed.value
    expect(pushLog('info', '几何光学', '被抑制的日志')).toBe(false)
    expect(pushLog('ok', '折射', '也被抑制')).toBe(false)
    expect(useLog().suppressed.value).toBe(before + 2)
    expect(useLog().entries.value.some((e) => e.text === '被抑制的日志')).toBe(false)
  })

  it('手动模式下 error 永远写入（错误不可静音）', () => {
    setLogMode('manual')
    expect(pushLog('error', '渲染', '画布绘制异常')).toBe(true)
    expect(useLog().entries.value.some((e) => e.level === 'error')).toBe(true)
  })

  it('手动模式下「记录实验」类手动级日志仍会写入', () => {
    setLogMode('manual')
    expect(pushLog('ok', '几何光学', '已记录实验 EXP-0001', { manual: true })).toBe(true)
    expect(useLog().entries.value.some((e) => e.text.includes('EXP-0001'))).toBe(true)
  })

  it('手写日志：空内容不记录，有内容记录并去空白', () => {
    setLogMode('manual')
    expect(pushManualLog('手动备注', '   ')).toBe(false)
    expect(pushManualLog('手动备注', '  把 u 调到 250mm  ')).toBe(true)
    const entry = useLog().entries.value.at(-1)
    expect(entry?.text).toBe('把 u 调到 250mm')
    expect(entry?.module).toBe('手动备注')
  })

  it('切换模式本身会留下一条可见记录，并把抑制计数清零', () => {
    setLogMode('manual')
    pushLog('info', 'x', 'auto-suppressed')
    expect(useLog().suppressed.value).toBeGreaterThan(0)
    setLogMode('auto')
    expect(useLog().suppressed.value).toBe(0)
    expect(useLog().entries.value.at(-1)?.text).toContain('自动记录')
  })

  it('清空日志后仍留一条「日志已清空」', () => {
    pushLog('info', 'a', '1')
    pushLog('info', 'a', '2')
    clearLog()
    const entries = useLog().entries.value
    expect(entries.length).toBe(1)
    expect(entries[0].text).toContain('日志已清空')
  })

  it('导出文本包含时间/级别/模块/内容四要素', () => {
    pushLog('warn', '折射与全反射', '角度越过临界角')
    const text = exportLogText()
    expect(text).toContain('[WARN]')
    expect(text).toContain('[折射与全反射]')
    expect(text).toContain('角度越过临界角')
  })

  it('条目上限 400 条，超出后丢弃最早的', () => {
    for (let i = 0; i < 450; i += 1) pushLog('info', 'a', `第 ${i} 条`)
    const entries = useLog().entries.value
    expect(entries.length).toBe(400)
    expect(entries.at(-1)?.text).toBe('第 449 条')
  })

  it('hydrate 在无本地存储时安全返回 0（不抛异常）', () => {
    expect(() => hydrateLog()).not.toThrow()
    expect(typeof hydrateLog()).toBe('number')
  })
})

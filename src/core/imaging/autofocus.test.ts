import { describe, expect, it } from 'vitest'
import { buildTarget } from './targets'
import {
  MAX_CAPTURES,
  capture,
  runAutofocus,
  runRepeatability,
  scoreAt,
  type PlatformConfig,
  type SearchOptions,
} from './autofocus'
import type { FocusMetricKind } from './focusMetrics'

function makeConfig(over: Partial<PlatformConfig> = {}): PlatformConfig {
  return {
    baseImage: buildTarget('siemens', 96),
    bestFocusZ: 10,
    blurPerMm: 0.8,
    noiseSigma: 0,
    exposureGain: 1,
    exposureOffset: 0,
    positionErrorMm: 0,
    metric: 'tenengrad',
    seed: 1234,
    ...over,
  }
}

function makeOptions(over: Partial<SearchOptions> = {}): SearchOptions {
  return { startZ: 10, rangeMm: 6, stepMm: 0.2, strategy: 'full', coarseFactor: 4, ...over }
}

describe('capture — 虚拟 Z 轴平台成像', () => {
  it('在最佳焦点处最清晰，离焦越远评分越低', () => {
    const cfg = makeConfig()
    const atFocus = scoreAt(cfg, 10)
    const near = scoreAt(cfg, 10.5)
    const far = scoreAt(cfg, 12)
    expect(atFocus).toBeGreaterThan(near)
    expect(near).toBeGreaterThan(far)
    expect(far).toBeLessThan(atFocus * 0.8)
  })

  it('评分关于最佳焦点对称（无定位误差时）', () => {
    const cfg = makeConfig()
    expect(scoreAt(cfg, 9)).toBeCloseTo(scoreAt(cfg, 11), 10)
    expect(scoreAt(cfg, 9.4)).toBeCloseTo(scoreAt(cfg, 10.6), 10)
  })

  it('相同位置重复拍摄结果完全一致（噪声种子绑定位置）', () => {
    const cfg = makeConfig({ noiseSigma: 0.02 })
    const a = capture(cfg, 10.3, 0)
    const b = capture(cfg, 10.3, 0)
    expect(a.sample.score).toBe(b.sample.score)
    expect(Array.from(a.image.data)).toEqual(Array.from(b.image.data))
  })

  it('定位误差会使实际位置偏离命令位置，但幅度不超过设定值', () => {
    const cfg = makeConfig({ positionErrorMm: 0.05 })
    for (let i = 0; i < 20; i += 1) {
      const { sample } = capture(cfg, 10, i)
      expect(Math.abs(sample.zActual - 10)).toBeLessThanOrEqual(0.05 + 1e-9)
    }
  })

  it('曝光增益改变图像亮度，进而影响评分', () => {
    const dark = makeConfig({ exposureGain: 0.4 })
    const normal = makeConfig()
    expect(scoreAt(dark, 10)).toBeLessThan(scoreAt(normal, 10))
  })
})

describe('runAutofocus — 全范围遍历', () => {
  it('无噪声无定位误差时，最佳位置与真值之差不超过一个步长的一半', () => {
    const cfg = makeConfig()
    const r = runAutofocus(cfg, makeOptions({ strategy: 'full', stepMm: 0.2 }))
    expect(r.ok).toBe(true)
    expect(r.errorMm).toBeLessThanOrEqual(0.1 + 1e-9)
    expect(r.captureCount).toBe(Math.ceil(6 / 0.2) + 1)
    expect(r.samples.length).toBe(r.captureCount)
    expect(r.elapsedMs).toBeGreaterThanOrEqual(0)
  })

  it('步长越小，捕获次数增加；误差都不超过各自步长', () => {
    const cfg = makeConfig()
    const coarse = runAutofocus(cfg, makeOptions({ stepMm: 0.5 }))
    const fine = runAutofocus(cfg, makeOptions({ stepMm: 0.1 }))
    // 注：焦平面附近评分曲线是平的（真实物理特性），因此误差只能保证 ≤ 一个步长，
    // 不能假设「步长越小误差越小」——那取决于采样点是否恰好落在峰上。
    expect(fine.errorMm).toBeLessThanOrEqual(0.1 + 1e-9)
    expect(coarse.errorMm).toBeLessThanOrEqual(0.5 + 1e-9)
    expect(fine.captureCount).toBeGreaterThan(coarse.captureCount)
  })

  it('归一化评分曲线的最大值为 1，且对应最佳样本', () => {
    const cfg = makeConfig()
    const r = runAutofocus(cfg, makeOptions())
    const max = Math.max(...r.normalizedScores)
    expect(max).toBeCloseTo(1, 10)
    const idx = r.normalizedScores.indexOf(max)
    expect(r.samples[idx].score).toBeCloseTo(r.bestScore, 10)
  })

  it('存在噪声时仍能找到峰的附近（误差 ≤ 2 个步长）', () => {
    const cfg = makeConfig({ noiseSigma: 0.02 })
    const r = runAutofocus(cfg, makeOptions({ stepMm: 0.2 }))
    expect(r.errorMm).toBeLessThanOrEqual(0.4 + 1e-9)
  })

  it('非法参数返回结构化错误', () => {
    const cfg = makeConfig()
    const bad: Array<Partial<SearchOptions>> = [
      { rangeMm: 0 },
      { stepMm: 0 },
      { stepMm: -1 },
      { startZ: Number.NaN },
      { rangeMm: 10, stepMm: 0.001 }, // 超过捕获上限
    ]
    for (const over of bad) {
      const r = runAutofocus(cfg, makeOptions(over))
      expect(r.ok).toBe(false)
      expect(r.errors.length).toBeGreaterThan(0)
      expect(r.samples.length).toBe(0)
    }
  })

  it('捕获上限常量为 400', () => {
    expect(MAX_CAPTURES).toBe(400)
  })
})

describe('runAutofocus — 粗调 + 精调', () => {
  it('比全范围遍历捕获次数少，且仍能定位到峰附近', () => {
    const cfg = makeConfig()
    const opts = makeOptions({ stepMm: 0.1 })
    const full = runAutofocus(cfg, { ...opts, strategy: 'full' })
    const coarseFine = runAutofocus(cfg, { ...opts, strategy: 'coarseFine', coarseFactor: 4 })
    expect(coarseFine.captureCount).toBeLessThan(full.captureCount)
    expect(coarseFine.errorMm).toBeLessThanOrEqual(opts.stepMm + 1e-9)
    expect(coarseFine.strategy).toBe('coarseFine')
  })

  it('粗调倍数越大捕获越少', () => {
    const cfg = makeConfig()
    const opts = makeOptions({ stepMm: 0.1 })
    const f2 = runAutofocus(cfg, { ...opts, strategy: 'coarseFine', coarseFactor: 2 })
    const f8 = runAutofocus(cfg, { ...opts, strategy: 'coarseFine', coarseFactor: 8 })
    expect(f8.captureCount).toBeLessThan(f2.captureCount)
  })

  it('精调阶段不会重复拍摄同一位置', () => {
    const cfg = makeConfig()
    const r = runAutofocus(cfg, makeOptions({ strategy: 'coarseFine', stepMm: 0.1, coarseFactor: 4 }))
    const zs = r.samples.map((s) => s.zCommand.toFixed(4))
    expect(new Set(zs).size).toBe(zs.length)
  })
})

describe('runRepeatability — 重复性统计', () => {
  it('统计量与逐次记录自洽，且结果可复现', () => {
    const cfg = makeConfig({ noiseSigma: 0.01, positionErrorMm: 0.01 })
    const opts = makeOptions({ stepMm: 0.2 })
    const a = runRepeatability(cfg, opts, 5, 0.2)
    const b = runRepeatability(cfg, opts, 5, 0.2)
    expect(a.ok).toBe(true)
    expect(a.perRun.length).toBe(5)
    expect(a.meanErrorMm).toBeCloseTo(b.meanErrorMm, 10)
    expect(a.successCount).toBe(b.successCount)

    const errs = a.perRun.map((r) => r.errorMm)
    expect(a.maxErrorMm).toBeCloseTo(Math.max(...errs), 10)
    expect(a.meanErrorMm).toBeCloseTo(errs.reduce((x, y) => x + y, 0) / errs.length, 10)
    expect(a.successRate).toBeCloseTo(a.successCount / 5, 10)
    expect(a.meanCaptureCount).toBeGreaterThan(0)
  })

  it('阈值越宽松成功率越高', () => {
    const cfg = makeConfig({ noiseSigma: 0.02, positionErrorMm: 0.02 })
    const opts = makeOptions({ stepMm: 0.2 })
    const tight = runRepeatability(cfg, opts, 6, 0.05)
    const loose = runRepeatability(cfg, opts, 6, 1.0)
    expect(loose.successCount).toBeGreaterThanOrEqual(tight.successCount)
    expect(loose.successRate).toBe(1)
  })

  it('每次实验的起始位置在 ±range/4 内变化（模拟操作差异）', () => {
    const cfg = makeConfig()
    const opts = makeOptions({ stepMm: 0.2, rangeMm: 4 })
    const r = runRepeatability(cfg, opts, 5, 1)
    const starts = r.perRun.map((x) => x.startZ)
    expect(new Set(starts.map((s) => s.toFixed(6))).size).toBeGreaterThan(1)
    for (const s of starts) {
      expect(Math.abs(s - opts.startZ)).toBeLessThanOrEqual(opts.rangeMm / 4 + 1e-9)
    }
  })

  it('非法参数返回结构化错误', () => {
    const r = runRepeatability(makeConfig(), makeOptions({ stepMm: 0 }), 3, 0.1)
    expect(r.ok).toBe(false)
    expect(r.errors.length).toBeGreaterThan(0)
    expect(r.perRun.length).toBe(0)
  })
})

describe('评价函数选择', () => {
  it('三种评价函数都能用于自动对焦并给出有限误差', () => {
    for (const metric of ['laplacian', 'tenengrad', 'brenner'] as FocusMetricKind[]) {
      const r = runAutofocus(makeConfig({ metric }), makeOptions({ stepMm: 0.2 }))
      expect(r.ok).toBe(true)
      expect(Number.isFinite(r.errorMm)).toBe(true)
      expect(r.errorMm).toBeLessThanOrEqual(0.1 + 1e-9)
    }
  })
})

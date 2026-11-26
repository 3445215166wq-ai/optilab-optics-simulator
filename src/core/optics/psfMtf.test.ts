import { describe, expect, it } from 'vitest'
import { computePsfMtf, diffractionLimitedMtf, findMtf50, type PsfInput } from './psfMtf'
import { airyIntensityAtRadius } from './diffraction'

function make(over: Partial<PsfInput> = {}): PsfInput {
  return { wavelengthNm: 550, fNumber: 8, defocusWaves: 0, gridSize: 256, pupilRadiusSamples: 25, ...over }
}

describe('diffractionLimitedMtf — 解析衍射极限 OTF', () => {
  it('端点与中点符合解析式', () => {
    expect(diffractionLimitedMtf(0)).toBeCloseTo(1, 12)
    expect(diffractionLimitedMtf(1)).toBe(0)
    expect(diffractionLimitedMtf(1.5)).toBe(0)
    // t = 0.5: (2/π)(acos0.5 − 0.5·√0.75) = (2/π)(1.0471976 − 0.4330127) = 0.39100
    expect(diffractionLimitedMtf(0.5)).toBeCloseTo(0.391002, 5)
  })

  it('单调递减', () => {
    let prev = 1
    for (let t = 0.02; t <= 1; t += 0.02) {
      const v = diffractionLimitedMtf(t)
      expect(v).toBeLessThanOrEqual(prev + 1e-12)
      prev = v
    }
  })

  it('解析 MTF50 ≈ 0.4035 ν_c', () => {
    const f50 = findMtf50({
      x: Array.from({ length: 1001 }, (_, i) => i / 1000),
      y: Array.from({ length: 1001 }, (_, i) => diffractionLimitedMtf(i / 1000)),
    })
    expect(f50 as number).toBeCloseTo(0.4035, 3)
  })
})

describe('computePsfMtf — 与解析艾里斑对照（W₂₀ = 0）', () => {
  it('数值 PSF 径向截面与解析艾里斑一致（实测最大绝对偏差 < 0.01）', () => {
    // 依据：光瞳圆边界面积的子采样 + 径向「实际平均半径」分箱后，
    // 主瓣内每个采样点与解析艾里斑的绝对偏差约 0.004（相对偏差在解析值很小的
    // 副极小附近会放大，但绝对量可忽略）。全局标定由后面的 MTF 对照（< 1.5%）严格把关。
    const r = computePsfMtf(make({ defocusWaves: 0 }))
    expect(r.ok).toBe(true)
    const airyRUm = 1.21967 * (r.wavelengthNm * 1e-6) * r.fNumber * 1e3
    let checked = 0
    for (let i = 0; i < r.crossSection.rUm.length; i += 1) {
      const radius = r.crossSection.rUm[i]
      if (radius > airyRUm * 2.2) break
      const analytic = airyIntensityAtRadius(radius * 1e-3, r.wavelengthNm * 1e-6, r.fNumber)
      if (analytic < 0.02) continue // 副极小附近相对误差无意义，跳过
      const numeric = r.crossSection.intensity[i]
      expect(Math.abs(numeric - analytic)).toBeLessThan(0.01)
      checked += 1
    }
    expect(checked).toBeGreaterThanOrEqual(6)
  })

  it('数值 MTF 与解析衍射极限 MTF 一致（实测最大偏差 < 1.5%）', () => {
    const r = computePsfMtf(make({ defocusWaves: 0 }))
    let checked = 0
    let maxDev = 0
    for (let i = 0; i < r.mtf.x.length; i += 1) {
      const t = r.mtf.x[i] / r.cutoffCyclesPerMm
      if (t > 0.95) break
      const dev = Math.abs(r.mtf.y[i] - r.mtfLimited.y[i])
      maxDev = Math.max(maxDev, dev)
      checked += 1
    }
    expect(checked).toBeGreaterThan(20)
    expect(maxDev).toBeLessThan(0.015)
  })

  it('数值与解析 MTF50 一致（相对偏差 < 4%）', () => {
    const r = computePsfMtf(make({ defocusWaves: 0 }))
    const a = r.mtf50CyclesPerMm as number
    const b = r.mtf50LimitedCyclesPerMm as number
    expect(a).not.toBeNull()
    expect(Math.abs(a - b) / b).toBeLessThan(0.04)
  })

  it('W₂₀ = 0 时斯特列尔比 = 1', () => {
    const r = computePsfMtf(make({ defocusWaves: 0 }))
    expect(r.strehlRatio).toBeCloseTo(1, 9)
    expect(r.peakDropDb).toBeCloseTo(0, 9)
  })

  it('PSF 峰值归一化为 1，且总能量有限', () => {
    const r = computePsfMtf(make())
    const peak = Math.max(...Array.from(r.psf))
    expect(peak).toBeCloseTo(1, 6)
    expect(r.psf.length).toBe(256 * 256)
    expect(Array.from(r.psf).every((v) => v >= 0 && Number.isFinite(v))).toBe(true)
  })
})

describe('computePsfMtf — 坐标标定与截止频率', () => {
  it('采样间距 dx = 2RλN/n，艾里半径对应约 6.25 个采样点', () => {
    const r = computePsfMtf(make())
    const n = 256
    const R = 25
    const dxUm = ((2 * R * (550e-6) * 8) / n) * 1e3
    expect(r.pixelSizeUm).toBeCloseTo(dxUm, 6)
    const airyRUm = 1.21967 * 550e-6 * 8 * 1e3
    expect(airyRUm / r.pixelSizeUm).toBeCloseTo(6.25, 1)
  })

  it('截止频率 = 1/(λN)，且 MTF 在截止频率处趋于 0', () => {
    const r = computePsfMtf(make({ wavelengthNm: 550, fNumber: 8 }))
    expect(r.cutoffCyclesPerMm).toBeCloseTo(1 / (0.00055 * 8), 6)
    const last = r.mtfLimited.y[r.mtfLimited.y.length - 1]
    expect(last).toBeLessThan(0.15)
    expect(r.mtf.x[r.mtf.x.length - 1]).toBeLessThanOrEqual(r.cutoffCyclesPerMm * 1.001)
  })

  it('频率轴严格递增且 dν = 1/(2RλN)', () => {
    const r = computePsfMtf(make())
    for (let i = 1; i < r.mtf.x.length; i += 1) {
      expect(r.mtf.x[i]).toBeGreaterThan(r.mtf.x[i - 1])
    }
    const expectedDf = 1 / (2 * 25 * 0.00055 * 8)
    expect(r.mtf.x[1] - r.mtf.x[0]).toBeCloseTo(expectedDf, 6)
  })
})

describe('computePsfMtf — 离焦的物理含义', () => {
  it('Δz = 8λN²W₂₀，且 W₂₀ = 0.25 对应焦深 2λN²', () => {
    const r = computePsfMtf(make({ fNumber: 8, defocusWaves: 0.25 }))
    const lambdaMm = 0.00055
    expect(r.defocusMm).toBeCloseTo(8 * lambdaMm * 64 * 0.25, 12)
    expect(r.depthOfFocusMm).toBeCloseTo(2 * lambdaMm * 64, 12)
    expect(r.defocusMm).toBeCloseTo(r.depthOfFocusMm, 12)
  })

  it('离焦使峰值（斯特列尔比）与 MTF50 同时下降', () => {
    const inFocus = computePsfMtf(make({ defocusWaves: 0 }))
    const mild = computePsfMtf(make({ defocusWaves: 0.25 }))
    const strong = computePsfMtf(make({ defocusWaves: 1 }))

    expect(inFocus.strehlRatio).toBeGreaterThan(mild.strehlRatio)
    expect(mild.strehlRatio).toBeGreaterThan(strong.strehlRatio)
    expect(strong.strehlRatio).toBeLessThan(0.5)
    expect(strong.peakDropDb).toBeGreaterThan(mild.peakDropDb)

    const f50In = inFocus.mtf50CyclesPerMm as number
    const f50Mild = mild.mtf50CyclesPerMm as number
    expect(f50Mild).toBeLessThan(f50In)
  })

  it('离焦对称：W₂₀ 与 −W₂₀ 的 MTF 完全相同', () => {
    const a = computePsfMtf(make({ defocusWaves: 0.6 }))
    const b = computePsfMtf(make({ defocusWaves: -0.6 }))
    expect(a.strehlRatio).toBeCloseTo(b.strehlRatio, 10)
    for (let i = 0; i < a.mtf.y.length; i += 1) {
      expect(a.mtf.y[i]).toBeCloseTo(b.mtf.y[i], 10)
    }
  })

  it('超过四分之一波长判据时给出警告', () => {
    expect(computePsfMtf(make({ defocusWaves: 0.1 })).warnings.length).toBe(0)
    expect(computePsfMtf(make({ defocusWaves: 0.5 })).warnings.join()).toContain('四分之一波长')
  })
})

describe('computePsfMtf — 输入校验与可复现性', () => {
  it('非法参数返回结构化错误而不是抛异常', () => {
    const bad: Array<Partial<PsfInput>> = [
      { wavelengthNm: 100 },
      { fNumber: 0.1 },
      { defocusWaves: 20 },
      { gridSize: 200 },
      { pupilRadiusSamples: 2 },
      { pupilRadiusSamples: 100 },
      { fNumber: Number.NaN },
    ]
    for (const over of bad) {
      const r = computePsfMtf(make(over))
      expect(r.ok).toBe(false)
      expect(r.errors.length).toBeGreaterThan(0)
      expect(r.psf.length).toBe(0)
    }
  })

  it('相同输入完全可复现', () => {
    const a = computePsfMtf(make({ defocusWaves: 0.4 }))
    const b = computePsfMtf(make({ defocusWaves: 0.4 }))
    expect(a.strehlRatio).toBe(b.strehlRatio)
    expect(Array.from(a.mtf.y).join(',')).toBe(Array.from(b.mtf.y).join(','))
  })
})

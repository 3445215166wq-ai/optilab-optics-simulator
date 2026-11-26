import { describe, expect, it } from 'vitest'
import {
  AIRY_FACTOR,
  airyIntensityAtRadius,
  computeDiffraction,
  sampleAiryImage,
  type DiffractionInput,
} from './diffraction'

function make(over: Partial<DiffractionInput> = {}): DiffractionInput {
  return { wavelengthNm: 550, fNumber: 8, apertureDiameterMm: 25, magnification: 1, ...over }
}

describe('computeDiffraction — 解析判据', () => {
  it('艾里半径 r₁ = 1.22·λ·N（系数由 J₁ 第一零点精确给出）', () => {
    const r = computeDiffraction(make({ wavelengthNm: 550, fNumber: 8 }))
    // 1.21967 × 550e-6 mm × 8 = 5.3665e-3 mm = 5.3665 μm
    expect(r.airyRadiusImgUm).toBeCloseTo(1.21967 * 0.55 * 8, 3)
    expect(r.airyRadiusImgUm).toBeCloseTo(5.3665, 2)
    // 教科书常用近似值 1.22λN 的相对偏差 < 0.03%
    expect(Math.abs(r.airyRadiusImgUm - 1.22 * 0.55 * 8) / r.airyRadiusImgUm).toBeLessThan(3e-4)
    expect(AIRY_FACTOR).toBeCloseTo(1.21967, 5)
  })

  it('第二暗环半径 = 7.0156/π · λN ≈ 2.233 λN', () => {
    const r = computeDiffraction(make())
    const second = r.rings.filter((x) => x.kind === 'dark')[1]
    expect(second.radiusImgUm).toBeCloseTo((7.015586 / Math.PI) * 0.55 * 8, 3)
  })

  it('瑞利判据等于第一暗环半径（像方）', () => {
    const r = computeDiffraction(make())
    expect(r.rayleighImgUm).toBeCloseTo(r.airyRadiusImgUm, 12)
    expect(r.firstDarkRingImgUm).toBeCloseTo(r.airyRadiusImgUm, 12)
  })

  it('截止空间频率 f_c = 1/(λN)', () => {
    const r = computeDiffraction(make({ wavelengthNm: 500, fNumber: 4 }))
    // 1/(0.5e-3 mm × 4) = 500 lp/mm
    expect(r.cutoffImgCyclesPerMm).toBeCloseTo(500, 6)
    expect(r.cutoffImgCyclesPerMm).toBeCloseTo(1 / (0.0005 * 4), 9)
  })

  it('截止频率与 NA 的关系：f_c ≈ 2NA/λ（近轴适用，NA 小时误差更小）', () => {
    // f_c = 2NA/λ 只在近轴（小 NA）下成立；N 很小时 sinθ 与 θ 差异变大
    for (const f of [4, 8, 16, 32]) {
      const r = computeDiffraction(make({ fNumber: f, wavelengthNm: 550 }))
      const approx = (2 * r.naImage) / r.wavelengthMm
      expect(Math.abs(approx - r.cutoffImgCyclesPerMm) / r.cutoffImgCyclesPerMm).toBeLessThan(0.01)
    }
    // N = 2 时已达 3% 偏差，验证「近轴近似会退化」这一事实
    const tiny = computeDiffraction(make({ fNumber: 2, wavelengthNm: 550 }))
    const dev = Math.abs((2 * tiny.naImage) / tiny.wavelengthMm - tiny.cutoffImgCyclesPerMm) / tiny.cutoffImgCyclesPerMm
    expect(dev).toBeGreaterThan(0.02)
  })

  it('派生量与 NA：f = N·D，NA′ = sin(atan(1/(2N)))，NA = |m|·NA′', () => {
    const r = computeDiffraction(make({ fNumber: 4, apertureDiameterMm: 25, magnification: 2 }))
    expect(r.focalLengthMm).toBeCloseTo(100, 9)
    const naImg = Math.sin(Math.atan(1 / 8))
    expect(r.naImage).toBeCloseTo(naImg, 12)
    expect(r.naObject).toBeCloseTo(naImg * 2, 12)
  })

  it('物方/像方换算：物方尺寸 = 像方 ÷ |m|，物方截止频率 = 像方 × |m|', () => {
    for (const mag of [0.5, 1, 2, 10]) {
      const r = computeDiffraction(make({ magnification: mag }))
      expect(r.airyRadiusObjUm).toBeCloseTo(r.airyRadiusImgUm / mag, 9)
      expect(r.rayleighObjUm).toBeCloseTo(r.rayleighImgUm / mag, 9)
      expect(r.cutoffObjCyclesPerMm).toBeCloseTo(r.cutoffImgCyclesPerMm * mag, 9)
    }
    // 1:1 时两者相等
    const one = computeDiffraction(make({ magnification: 1 }))
    expect(one.airyRadiusObjUm).toBeCloseTo(one.airyRadiusImgUm, 12)
  })

  it('波长越长 / F 数越大 → 艾里斑越大、截止频率越低', () => {
    const a = computeDiffraction(make({ wavelengthNm: 400, fNumber: 4 }))
    const b = computeDiffraction(make({ wavelengthNm: 700, fNumber: 4 }))
    expect(b.airyRadiusImgUm).toBeGreaterThan(a.airyRadiusImgUm)
    expect(b.cutoffImgCyclesPerMm).toBeLessThan(a.cutoffImgCyclesPerMm)

    const c = computeDiffraction(make({ wavelengthNm: 550, fNumber: 16 }))
    expect(c.airyRadiusImgUm).toBeGreaterThan(a.airyRadiusImgUm)
    expect(c.cutoffImgCyclesPerMm).toBeLessThan(a.cutoffImgCyclesPerMm)
  })
})

describe('computeDiffraction — 径向强度剖面', () => {
  it('中心强度为 1，第一暗环处约为 0', () => {
    const r = computeDiffraction(make())
    expect(r.profile.intensity[0]).toBe(1)
    const at = airyIntensityAtRadius(r.firstDarkRingImgUm * 1e-3, r.wavelengthMm, r.fNumber)
    expect(at).toBeLessThan(1e-10)
  })

  it('副极大幅度与位置符合教科书值（1.75% @ 1.635λN，0.42% @ 2.679λN）', () => {
    const r = computeDiffraction(make())
    expect(r.secondaryMaxima.length).toBe(3)
    const first = r.secondaryMaxima[0]
    expect(first.intensity).toBeCloseTo(0.0175, 3)
    expect(first.radiusImgUm).toBeCloseTo(1.6347 * 0.55 * 8, 1)
    const second = r.secondaryMaxima[1]
    expect(second.intensity).toBeCloseTo(0.00416, 3)
  })

  it('剖面单调下降到第一暗环（主瓣内无额外极值）', () => {
    const r = computeDiffraction(make())
    const end = r.profile.rUm.findIndex((v) => v > r.airyRadiusImgUm)
    expect(end).toBeGreaterThan(10)
    for (let i = 1; i < end; i += 1) {
      expect(r.profile.intensity[i]).toBeLessThanOrEqual(r.profile.intensity[i - 1] + 1e-12)
    }
  })
})

describe('sampleAiryImage — 二维图样', () => {
  it('中心为 1，且绕中心对称', () => {
    const size = 33
    const img = sampleAiryImage(size, 12, 550, 8)
    const c = (size - 1) / 2
    expect(img[c * size + c]).toBeCloseTo(1, 6)
    // 对称性抽查
    for (const [dx, dy] of [
      [4, 0],
      [0, 5],
      [3, 3],
      [-6, 2],
    ]) {
      const a = img[(c + dy) * size + (c + dx)]
      const b = img[(c - dy) * size + (c - dx)]
      expect(a).toBeCloseTo(b, 6)
    }
  })

  it('归一化强度落在 [0,1]，且第一暗环附近出现强度极小值', () => {
    const size = 65
    const half = 12
    const img = sampleAiryImage(size, half, 550, 8)
    const c = (size - 1) / 2
    const pixelUm = (2 * half) / size
    const airyRUm = 1.21967 * 0.55 * 8
    let minNearRing = 1
    for (let x = c; x < size; x += 1) {
      const v = img[c * size + x]
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1.0000001)
      const r = (x - c) * pixelUm
      // 第一暗环 ±1.5 个像素范围内应出现接近 0 的强度
      if (Math.abs(r - airyRUm) < pixelUm * 1.5) minNearRing = Math.min(minNearRing, v)
    }
    expect(minNearRing).toBeLessThan(0.01)
  })

  it('非法参数返回全零数组而不抛错', () => {
    expect(sampleAiryImage(0, 10, 550, 8).length).toBe(0)
    const zeros = sampleAiryImage(16, 0, 550, 8)
    expect(Array.from(zeros).every((v) => v === 0)).toBe(true)
  })
})

describe('computeDiffraction — 输入校验', () => {
  it('非法参数返回结构化错误', () => {
    const bad: Array<Partial<DiffractionInput>> = [
      { wavelengthNm: 100 },
      { wavelengthNm: 2000 },
      { fNumber: 0.1 },
      { fNumber: 100 },
      { apertureDiameterMm: 0 },
      { apertureDiameterMm: -5 },
      { magnification: 0 },
      { magnification: 500 },
      { wavelengthNm: Number.NaN },
    ]
    for (const over of bad) {
      const r = computeDiffraction(make(over))
      expect(r.ok).toBe(false)
      expect(r.errors.length).toBeGreaterThan(0)
      expect(r.profile.rUm.length).toBe(0)
    }
  })

  it('相同输入完全可复现', () => {
    const a = computeDiffraction(make())
    const b = computeDiffraction(make())
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})

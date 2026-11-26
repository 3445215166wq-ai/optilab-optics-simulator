/**
 * 折射 / 全反射 / Fresnel 单元测试
 * 验证点：Snell 定律自洽、光路可逆性、临界角与布儒斯特角解析值、
 *        正入射反射率经典公式、能量守恒。
 */
import { describe, expect, it } from 'vitest'
import type { RefractionInput } from './refraction'
import {
  MEDIA_PRESETS,
  computeRefraction,
  fresnelReflectance,
  refractionAngleDeg,
} from './refraction'

function make(over: Partial<RefractionInput> = {}): RefractionInput {
  return { incidenceAngleDeg: 45, n1: 1.000293, n2: 1.333, wavelengthNm: 550, ...over }
}

describe('computeRefraction — Snell 定律', () => {
  it('n₁sinθ₁ = n₂sinθ₂ 严格成立（多组角度与折射率）', () => {
    for (const n1 of [1, 1.333, 1.5168, 1.77]) {
      for (const n2 of [1.000293, 1.333, 1.6204, 2.417]) {
        for (const angle of [0, 10, 25, 40, 60, 80]) {
          const r = computeRefraction({ incidenceAngleDeg: angle, n1, n2, wavelengthNm: 550 })
          if (r.isTIR) continue
          const lhs = n1 * Math.sin((r.theta1Deg * Math.PI) / 180)
          const rhs = n2 * Math.sin((r.theta2Rad as number))
          expect(Math.abs(lhs - rhs)).toBeLessThan(1e-12)
        }
      }
    }
  })

  it('空气 → 水 45° 入射，折射角约 32.03°', () => {
    const r = computeRefraction({ incidenceAngleDeg: 45, n1: 1.000293, n2: 1.333, wavelengthNm: 550 })
    expect(r.isTIR).toBe(false)
    // 手算：sinθ₂ = 1.000293×sin45° / 1.333 = 0.530620 → θ₂ = 32.0472°
    expect(r.theta2Deg as number).toBeCloseTo(32.0472, 3)
    expect(r.thetaReflectDeg).toBeCloseTo(45, 12)
  })

  it('光路可逆：反向传播时折射角与正向入射角一致', () => {
    const fwd = computeRefraction({ incidenceAngleDeg: 40, n1: 1.0, n2: 1.5, wavelengthNm: 550 })
    const back = computeRefraction({
      incidenceAngleDeg: fwd.theta2Deg as number,
      n1: 1.5,
      n2: 1.0,
      wavelengthNm: 550,
    })
    expect(back.theta2Deg as number).toBeCloseTo(40, 9)
  })

  it('正入射时不偏折', () => {
    const r = computeRefraction({ incidenceAngleDeg: 0, n1: 1, n2: 1.5168, wavelengthNm: 550 })
    expect(r.theta2Deg as number).toBeCloseTo(0, 12)
    // 方向向量：incident 与 refracted 都沿 −y
    expect(r.directions.incident.x).toBeCloseTo(0, 12)
    expect((r.directions.refracted as { x: number; y: number }).x).toBeCloseTo(0, 12)
    expect((r.directions.refracted as { x: number; y: number }).y).toBeCloseTo(-1, 12)
  })

  it('n₁ = n₂ 时无折射无反射', () => {
    const r = computeRefraction({ incidenceAngleDeg: 37, n1: 1.5, n2: 1.5, wavelengthNm: 550 })
    expect(r.theta2Deg as number).toBeCloseTo(37, 9)
    expect(r.fresnel.R).toBeCloseTo(0, 12)
    expect(r.fresnel.T).toBeCloseTo(1, 12)
  })
})

describe('computeRefraction — 全反射与临界角', () => {
  it('水 → 空气临界角约 48.61°', () => {
    const r = computeRefraction({ incidenceAngleDeg: 30, n1: 1.333, n2: 1.000293, wavelengthNm: 550 })
    expect(r.criticalAngleDeg as number).toBeCloseTo(
      (Math.asin(1.000293 / 1.333) * 180) / Math.PI,
      9,
    )
    expect(r.criticalAngleDeg as number).toBeCloseTo(48.6, 1)
  })

  it('玻璃 → 空气临界角约 41.2°（BK7）', () => {
    const r = computeRefraction({ incidenceAngleDeg: 20, n1: 1.5168, n2: 1.000293, wavelengthNm: 550 })
    // 手算：arcsin(1.000293 / 1.5168) = 41.2599°
    expect(r.criticalAngleDeg as number).toBeCloseTo(41.26, 2)
  })

  it('入射角超过临界角触发全反射：无折射光、R = 1、T = 0', () => {
    const r = computeRefraction({ incidenceAngleDeg: 60, n1: 1.333, n2: 1.000293, wavelengthNm: 550 })
    expect(r.isTIR).toBe(true)
    expect(r.theta2Deg).toBeNull()
    expect(r.directions.refracted).toBeNull()
    expect(r.fresnel.R).toBe(1)
    expect(r.fresnel.T).toBe(0)
    expect(r.sinTheta2).toBeGreaterThan(1)
    expect(r.warnings.join()).toContain('全反射')
  })

  it('恰好等于临界角时仍存在折射光（擦界面出射）', () => {
    const r0 = computeRefraction({ incidenceAngleDeg: 30, n1: 1.5, n2: 1, wavelengthNm: 550 })
    const critical = r0.criticalAngleDeg as number
    const r = computeRefraction({ incidenceAngleDeg: critical - 1e-9, n1: 1.5, n2: 1, wavelengthNm: 550 })
    expect(r.isTIR).toBe(false)
    // 擦界面出射：折射角非常接近 90°（受双精度限制，不会精确等于 90°）
    expect(r.theta2Deg as number).toBeGreaterThan(89.9)
    expect(r.theta2Deg as number).toBeLessThanOrEqual(90)
  })

  it('光疏 → 光密不存在临界角（不会全反射）', () => {
    for (const angle of [10, 45, 80, 89]) {
      const r = computeRefraction({ incidenceAngleDeg: angle, n1: 1, n2: 1.5, wavelengthNm: 550 })
      expect(r.criticalAngleDeg).toBeNull()
      expect(r.isTIR).toBe(false)
    }
  })
})

describe('computeRefraction — Fresnel 反射率', () => {
  it('正入射反射率符合 ((n₁−n₂)/(n₁+n₂))²', () => {
    for (const [n1, n2] of [
      [1, 1.5],
      [1, 1.333],
      [1.5168, 1],
      [1, 2.417],
    ]) {
      const r = computeRefraction({ incidenceAngleDeg: 0, n1, n2, wavelengthNm: 550 })
      const expected = Math.pow((n1 - n2) / (n1 + n2), 2)
      expect(r.fresnel.R).toBeCloseTo(expected, 12)
      expect(r.fresnel.Rs).toBeCloseTo(expected, 12)
      expect(r.fresnel.Rp).toBeCloseTo(expected, 12)
    }
  })

  it('布儒斯特角处 p 偏振反射率为 0 且 θ₁ + θ₂ = 90°', () => {
    const n1 = 1
    const n2 = 1.5
    const brewster = (Math.atan(n2 / n1) * 180) / Math.PI
    const r = computeRefraction({ incidenceAngleDeg: brewster, n1, n2, wavelengthNm: 550 })
    expect(r.brewsterAngleDeg).toBeCloseTo(brewster, 9)
    expect(r.fresnel.Rp).toBeLessThan(1e-12)
    expect(r.fresnel.Rs).toBeGreaterThan(0.1)
    expect(r.theta1Deg + (r.theta2Deg as number)).toBeCloseTo(90, 6)
  })

  it('无吸收介质满足能量守恒 R + T = 1', () => {
    for (const angle of [0, 15, 30, 45, 60, 75, 85]) {
      for (const [n1, n2] of [
        [1, 1.5],
        [1.5, 1],
        [1.333, 1.77],
      ]) {
        const r = computeRefraction({ incidenceAngleDeg: angle, n1, n2, wavelengthNm: 550 })
        expect(r.fresnel.R + r.fresnel.T).toBeCloseTo(1, 12)
      }
    }
  })

  it('掠入射时反射率趋近 1 且始终小于 1', () => {
    // 手算 89.9°、n=1.5：Rs≈0.9938、Rp≈0.9860 → R≈0.9899
    const r = computeRefraction({ incidenceAngleDeg: 89.9, n1: 1, n2: 1.5, wavelengthNm: 550 })
    expect(r.fresnel.R).toBeCloseTo(0.98991, 4)
    expect(r.fresnel.R).toBeLessThan(1)
    const ultra = computeRefraction({ incidenceAngleDeg: 89.999, n1: 1, n2: 1.5, wavelengthNm: 550 })
    expect(ultra.fresnel.R).toBeGreaterThan(r.fresnel.R)
    expect(ultra.fresnel.R).toBeLessThan(1)
  })

  it('fresnelReflectance 与 computeRefraction 结果一致', () => {
    for (const angle of [5, 33, 57, 78]) {
      const full = computeRefraction({ incidenceAngleDeg: angle, n1: 1, n2: 1.77, wavelengthNm: 550 })
      const quick = fresnelReflectance(angle, 1, 1.77)
      expect(quick.R).toBeCloseTo(full.fresnel.R, 12)
      expect(quick.Rs).toBeCloseTo(full.fresnel.Rs, 12)
      expect(quick.tir).toBe(full.isTIR)
    }
  })
})

describe('computeRefraction — 介质参数与校验', () => {
  it('介质中光速 v = c/n，波长 λ = λ₀/n', () => {
    const r = computeRefraction({ incidenceAngleDeg: 20, n1: 1.5, n2: 1.333, wavelengthNm: 600 })
    expect(r.speed1).toBeCloseTo(299792458 / 1.5, 3)
    expect(r.speed2).toBeCloseTo(299792458 / 1.333, 3)
    expect(r.wavelength1Nm).toBeCloseTo(400, 9)
    expect(r.wavelength2Nm).toBeCloseTo(600 / 1.333, 9)
  })

  it('预设介质表数据合法（折射率均 ≥ 1 且唯一 id）', () => {
    const ids = new Set<string>()
    for (const m of MEDIA_PRESETS) {
      expect(m.n).toBeGreaterThanOrEqual(1)
      expect(m.n).toBeLessThanOrEqual(4)
      expect(ids.has(m.id)).toBe(false)
      ids.add(m.id)
    }
    expect(MEDIA_PRESETS.length).toBeGreaterThanOrEqual(6)
  })

  it('非法输入返回结构化错误', () => {
    for (const over of [
      { incidenceAngleDeg: 90 },
      { incidenceAngleDeg: -5 },
      { n1: 0.5 },
      { n2: 4.5 },
      { wavelengthNm: 0 },
      { n1: Number.NaN },
    ]) {
      const r = computeRefraction(make(over))
      expect(r.ok).toBe(false)
      expect(r.errors.length).toBeGreaterThan(0)
      expect(r.directions.refracted).toBeNull()
    }
  })

  it('refractionAngleDeg 在全反射区间返回 null', () => {
    expect(refractionAngleDeg(30, 1.5, 1)).toBeCloseTo(
      (Math.asin((1.5 / 1) * Math.sin((30 * Math.PI) / 180)) * 180) / Math.PI,
      9,
    )
    expect(refractionAngleDeg(50, 1.5, 1)).toBeNull()
    expect(refractionAngleDeg(50, 1, 1.5)).not.toBeNull()
  })
})

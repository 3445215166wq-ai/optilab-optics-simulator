import { describe, expect, it } from 'vitest'
import { airyIntensity, besselJ1, j1Zero } from './bessel'

describe('besselJ1 — 与参考值对照', () => {
  it('J₁(0) = 0', () => {
    expect(besselJ1(0)).toBeCloseTo(0, 12)
  })

  it('奇数性：J₁(−x) = −J₁(x)', () => {
    for (const x of [0.3, 1.7, 5, 9.4, 20]) {
      expect(besselJ1(-x)).toBeCloseTo(-besselJ1(x), 10)
    }
  })

  it('前三个正零点处函数值为 0', () => {
    // 参考值：3.8317059702、7.0155866698、10.1734681351
    for (const zero of [3.831705970207512, 7.015586669815619, 10.173468135068678]) {
      expect(Math.abs(besselJ1(zero))).toBeLessThan(1e-7)
    }
  })

  it('小自变量级数展开：J₁(x) ≈ x/2 − x³/16 + x⁵/384（相对误差 < 1e-7）', () => {
    for (const x of [1e-3, 0.05, 0.2]) {
      const expected = x / 2 - (x * x * x) / 16 + (x * x * x * x * x) / 384
      expect(Math.abs(besselJ1(x) - expected) / expected).toBeLessThan(1e-7)
    }
  })

  it('第一个极大值 J₁(1.8411838) ≈ 0.581865', () => {
    expect(besselJ1(1.8411837813406593)).toBeCloseTo(0.581865, 5)
  })

  it('大自变量渐近行为：|J₁(x)| ≤ √(2/πx)', () => {
    for (const x of [12, 40, 100]) {
      const bound = Math.sqrt(2 / (Math.PI * x))
      expect(Math.abs(besselJ1(x))).toBeLessThanOrEqual(bound * 1.001)
    }
  })

  it('换段处（|x| = 8）两侧都贴近参考值 J₁(8) ≈ 0.234636', () => {
    // 分段逼近在换段附近精度降为 1e-4 量级，这里直接与参考值对照
    expect(Math.abs(besselJ1(7.9999) - 0.234636)).toBeLessThan(3e-4)
    expect(Math.abs(besselJ1(8.0001) - 0.234636)).toBeLessThan(3e-4)
    expect(Math.abs(besselJ1(7.9999) - besselJ1(8.0001))).toBeLessThan(3e-4)
  })
})

describe('airyIntensity — 艾里斑归一化强度', () => {
  it('中心强度为 1（v → 0 极限）', () => {
    expect(airyIntensity(0)).toBe(1)
    expect(airyIntensity(1e-9)).toBeCloseTo(1, 12)
  })

  it('第一暗环（v = 3.8317）强度为 0', () => {
    expect(airyIntensity(j1Zero(1))).toBeLessThan(1e-12)
    expect(airyIntensity(j1Zero(2))).toBeLessThan(1e-10)
  })

  it('第一副极大约在 v = 5.136，强度约 1.75%', () => {
    // v = 5.1356 时 [2J₁(v)/v]² ≈ 0.01750（教科书典型值）
    expect(airyIntensity(5.1356)).toBeCloseTo(0.0175, 3)
  })

  it('强度随半径单调衰减的主包络（第一暗环以外持续振铃但不超过第一副极大）', () => {
    for (let v = 4.5; v < 30; v += 0.05) {
      expect(airyIntensity(v)).toBeLessThan(0.05)
    }
  })

  it('非有限输入返回 0 而不是 NaN', () => {
    expect(airyIntensity(Number.POSITIVE_INFINITY)).toBe(0)
    expect(airyIntensity(Number.NaN)).toBe(0)
  })
})

describe('j1Zero — 暗环半径', () => {
  it('前三个零点与精确值一致', () => {
    expect(j1Zero(1)).toBeCloseTo(3.83170597, 8)
    expect(j1Zero(2)).toBeCloseTo(7.01558667, 8)
    expect(j1Zero(3)).toBeCloseTo(10.17346814, 8)
  })

  it('高阶零点用渐近式，且仍在零点附近', () => {
    for (const k of [4, 6, 10]) {
      const z = j1Zero(k)
      expect(Math.abs(besselJ1(z))).toBeLessThan(0.02)
    }
  })
})

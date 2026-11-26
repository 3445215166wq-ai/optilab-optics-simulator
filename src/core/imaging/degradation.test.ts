import { describe, expect, it } from 'vitest'
import { createGray, imageMean, imageStdDev, type GrayImage } from './image'
import {
  DEGRADE_DEFAULTS,
  addGaussianNoise,
  applyContrast,
  applyExposure,
  applyIllumination,
  degradeImage,
  gaussianBlur,
  gaussianKernel,
  motionBlur,
} from './degradation'
import { buildTarget } from './targets'
import { tenengrad } from './focusMetrics'

/** 用靶标缩小到 64×64 作为测试图（快且含高频） */
function testImage(): GrayImage {
  const big = buildTarget('bars', 128)
  const out = createGray(64, 64)
  for (let y = 0; y < 64; y += 1) {
    for (let x = 0; x < 64; x += 1) {
      out.data[y * 64 + x] = big.data[y * 2 * 128 + x * 2]
    }
  }
  return out
}

describe('gaussianKernel / gaussianBlur', () => {
  it('核归一化且对称，半径 = ceil(3σ)', () => {
    const k = gaussianKernel(1.5)
    expect(k.length).toBe(2 * Math.ceil(4.5) + 1)
    let sum = 0
    for (const v of k) sum += v
    expect(sum).toBeCloseTo(1, 6)
    for (let i = 0; i < k.length; i += 1) {
      expect(k[i]).toBeCloseTo(k[k.length - 1 - i], 10)
    }
  })

  it('模糊降低高频能量（Tenengrad 下降）并基本保持平均亮度', () => {
    const img = testImage()
    const sharp = tenengrad(img)
    const blurred = gaussianBlur(img, 2)
    expect(tenengrad(blurred)).toBeLessThan(sharp * 0.5)
    // 边界钳制会带来少量均值变化，容差 2%
    expect(Math.abs(imageMean(blurred) - imageMean(img))).toBeLessThan(0.02)
  })

  it('σ ≤ 0.05 时视为不模糊（返回副本）', () => {
    const img = testImage()
    const same = gaussianBlur(img, 0)
    expect(Array.from(same.data)).toEqual(Array.from(img.data))
    expect(same.data).not.toBe(img.data)
  })

  it('模糊单调：σ 越大高频越少', () => {
    const img = testImage()
    let prev = Number.POSITIVE_INFINITY
    for (const sigma of [0.5, 1, 2, 4]) {
      const t = tenengrad(gaussianBlur(img, sigma))
      expect(t).toBeLessThan(prev)
      prev = t
    }
  })
})

describe('motionBlur', () => {
  it('降低高频能量，且长度增加效果更强', () => {
    const img = testImage()
    const base = tenengrad(img)
    const m10 = tenengrad(motionBlur(img, 10, 0))
    const m20 = tenengrad(motionBlur(img, 20, 0))
    expect(m10).toBeLessThan(base * 0.6)
    expect(m20).toBeLessThan(m10)
  })

  it('长度 ≤ 0.5 时不处理', () => {
    const img = testImage()
    expect(Array.from(motionBlur(img, 0, 30).data)).toEqual(Array.from(img.data))
  })

  it('45° 方向模糊对两种方向的条纹都有影响', () => {
    const img = testImage()
    const out = motionBlur(img, 12, 45)
    expect(tenengrad(out)).toBeLessThan(tenengrad(img))
    // 边界按钳制处理（非零填充），均值会有约 1%~2% 的变化，属显示模型的合理近似
    expect(Math.abs(imageMean(out) - imageMean(img))).toBeLessThan(0.03)
  })
})

describe('照度 / 对比度 / 曝光', () => {
  it('光照不均：中心保持，角落变暗', () => {
    const img = createGray(41, 41, 0.8)
    const out = applyIllumination(img, 1)
    const c = 20 * 41 + 20
    expect(out.data[c]).toBeCloseTo(0.8, 6)
    expect(out.data[0]).toBeLessThan(0.2)
    // 亮度整体下降
    expect(imageMean(out)).toBeLessThan(imageMean(img))
  })

  it('对比度缩放围绕 0.5，并且 RMS 对比度按比例变化', () => {
    const img = testImage()
    const out = applyContrast(img, 0.5)
    expect(imageStdDev(out)).toBeCloseTo(imageStdDev(img) * 0.5, 4)
  })

  it('曝光增益与偏置按 out = in·gain + offset 计算并截断到 [0,1]', () => {
    const img = createGray(4, 4, 0.5)
    const bright = applyExposure(img, 1.5, 0.1)
    expect(bright.data[0]).toBeCloseTo(0.85, 6)
    const over = applyExposure(img, 3, 0.5)
    expect(over.data[0]).toBe(1)
    const under = applyExposure(img, 0.1, -0.5)
    expect(under.data[0]).toBe(0)
  })
})

describe('addGaussianNoise', () => {
  it('相同种子完全复现，不同种子不同', () => {
    const img = createGray(16, 16, 0.5)
    const a = addGaussianNoise(img, 0.05, 123)
    const b = addGaussianNoise(img, 0.05, 123)
    const c = addGaussianNoise(img, 0.05, 124)
    expect(Array.from(a.data)).toEqual(Array.from(b.data))
    expect(Array.from(a.data)).not.toEqual(Array.from(c.data))
  })

  it('噪声幅度统计接近设定 σ，且被截断在 [0,1]', () => {
    const img = createGray(128, 128, 0.5)
    const noisy = addGaussianNoise(img, 0.05, 7)
    const diffs = Array.from(noisy.data).map((v) => v - 0.5)
    const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length
    const std = Math.sqrt(diffs.reduce((a, b) => a + (b - mean) ** 2, 0) / diffs.length)
    expect(Math.abs(mean)).toBeLessThan(0.01)
    expect(std).toBeGreaterThan(0.04)
    expect(std).toBeLessThan(0.06)
    expect(Math.min(...Array.from(noisy.data))).toBeGreaterThanOrEqual(0)
    expect(Math.max(...Array.from(noisy.data))).toBeLessThanOrEqual(1)
  })
})

describe('degradeImage — 完整退化链路', () => {
  it('默认参数下不改变图像，且 applied 为空', () => {
    const img = testImage()
    const { image, applied } = degradeImage(img, { ...DEGRADE_DEFAULTS })
    expect(Array.from(image.data)).toEqual(Array.from(img.data))
    expect(applied.length).toBe(0)
  })

  it('逐项开启时记录实际生效的退化项', () => {
    const img = testImage()
    const { applied } = degradeImage(img, {
      ...DEGRADE_DEFAULTS,
      defocusSigma: 2,
      motionLength: 10,
      noiseSigma: 0.03,
      exposureGain: 1.2,
      illuminationFalloff: 0.5,
      contrast: 0.8,
    })
    expect(applied.length).toBe(6)
    expect(applied.join('|')).toContain('高斯近似')
    expect(applied.join('|')).toContain('运动模糊')
    expect(applied.join('|')).toContain('噪声')
  })

  it('可行复现：相同参数与种子得到同一结果', () => {
    const img = testImage()
    const p = { ...DEGRADE_DEFAULTS, defocusSigma: 1.5, noiseSigma: 0.04, seed: 99 }
    const a = degradeImage(img, p).image
    const b = degradeImage(img, p).image
    expect(Array.from(a.data)).toEqual(Array.from(b.data))
  })
})

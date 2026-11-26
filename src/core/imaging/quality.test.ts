import { describe, expect, it } from 'vitest'
import { createGray, imageMean, imageStdDev, type GrayImage } from './image'
import { computeQuality, meanBrightness, mse, psnrDb, rmsContrast, ssim } from './quality'
import { buildTarget } from './targets'
import { addGaussianNoise, applyExposure, gaussianBlur } from './degradation'

function target(size = 96): GrayImage {
  return buildTarget('pcb', size)
}

describe('基础统计量', () => {
  it('平均亮度与 RMS 对比度', () => {
    const flat = createGray(20, 20, 0.25)
    expect(meanBrightness(flat)).toBeCloseTo(0.25, 10)
    expect(rmsContrast(flat)).toBeCloseTo(0, 10)

    const img = createGray(2, 1)
    img.data[0] = 0
    img.data[1] = 1
    expect(meanBrightness(img)).toBeCloseTo(0.5, 10)
    expect(rmsContrast(img)).toBeCloseTo(0.5, 10)
  })

  it('空图像返回 NaN 而不是崩溃', () => {
    expect(Number.isNaN(imageMean(createGray(0, 0)))).toBe(true)
    expect(Number.isNaN(imageStdDev(createGray(0, 0)))).toBe(true)
  })
})

describe('MSE / PSNR', () => {
  it('完全相同的图像：MSE = 0、PSNR = +∞', () => {
    const img = target()
    expect(mse(img, img)).toBe(0)
    expect(psnrDb(img, img)).toBe(Number.POSITIVE_INFINITY)
  })

  it('已知 MSE 下的 PSNR 与解析值一致（数据范围 1）', () => {
    const a = createGray(10, 10, 0.5)
    const b = createGray(10, 10, 0.4)
    // MSE = 0.01 → PSNR = 10·log10(1/0.01) = 20 dB
    // 注：数据存为 Float32，0.4/0.5 无法精确表示，因此按 6 位小数比较
    expect(mse(a, b)).toBeCloseTo(0.01, 6)
    expect(psnrDb(a, b)).toBeCloseTo(20, 5)
  })

  it('噪声越强 PSNR 越低', () => {
    const img = target()
    const p1 = psnrDb(img, addGaussianNoise(img, 0.01, 1))
    const p2 = psnrDb(img, addGaussianNoise(img, 0.03, 1))
    const p3 = psnrDb(img, addGaussianNoise(img, 0.08, 1))
    expect(p1).toBeGreaterThan(p2)
    expect(p2).toBeGreaterThan(p3)
    expect(p3).toBeGreaterThan(0)
  })

  it('模糊越小 PSNR 越高', () => {
    const img = target()
    const small = psnrDb(img, gaussianBlur(img, 0.5))
    const large = psnrDb(img, gaussianBlur(img, 2))
    expect(small).toBeGreaterThan(large)
  })
})

describe('SSIM', () => {
  it('完全相同图像 SSIM = 1', () => {
    const img = target()
    expect(ssim(img, img)).toBeCloseTo(1, 10)
  })

  it('SSIM ∈ (−1,1]，且模糊/噪声使其下降', () => {
    const img = target()
    const blurred = ssim(img, gaussianBlur(img, 2))
    const noisy = ssim(img, addGaussianNoise(img, 0.05, 3))
    expect(blurred).toBeLessThan(1)
    expect(blurred).toBeGreaterThan(-1)
    expect(noisy).toBeLessThan(1)
    expect(noisy).toBeGreaterThan(-1)
  })

  it('模糊越强 SSIM 越低', () => {
    const img = target()
    const a = ssim(img, gaussianBlur(img, 0.5))
    const b = ssim(img, gaussianBlur(img, 1.5))
    const c = ssim(img, gaussianBlur(img, 3))
    expect(a).toBeGreaterThan(b)
    expect(b).toBeGreaterThan(c)
  })

  it('纯亮度偏移（结构不变）时 SSIM 明显高于随机噪声情形', () => {
    const img = target()
    const shifted = applyExposure(img, 1, 0.1)
    const noisy = addGaussianNoise(img, 0.1, 5)
    expect(ssim(img, shifted)).toBeGreaterThan(ssim(img, noisy))
  })

  it('图像过小时返回 NaN', () => {
    expect(Number.isNaN(ssim(createGray(8, 8, 0.5), createGray(8, 8, 0.5)))).toBe(true)
  })
})

describe('computeQuality 汇总', () => {
  it('返回全部指标，未退化的图像 PSNR 为 +∞ / SSIM 为 1', () => {
    const img = target()
    const q = computeQuality(img, img)
    expect(q.brightness).toBeCloseTo(meanBrightness(img), 10)
    expect(q.contrast).toBeCloseTo(rmsContrast(img), 10)
    expect(q.psnrDb).toBe(Number.POSITIVE_INFINITY)
    expect(q.ssim).toBeCloseTo(1, 10)
  })

  it('亮度指标反映的是被测图像（test）而非参考图', () => {
    const img = target()
    const dark = applyExposure(img, 0.5, 0)
    const q = computeQuality(img, dark)
    expect(q.brightness).toBeCloseTo(meanBrightness(dark), 10)
    expect(q.brightness).toBeLessThan(meanBrightness(img))
  })
})

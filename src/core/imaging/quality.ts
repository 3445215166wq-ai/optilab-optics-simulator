/**
 * ============================================================================
 * 图像质量度量（模块六）
 * ============================================================================
 *
 * 与「清晰度」的区别：清晰度是自动对焦用的**相对评价**（只要单调即可），
 * 这里的指标要能给出**有物理意义、可比较**的数值：
 *
 *   平均亮度  mean(I)                        0..1（8bit 时 ×255）
 *   RMS 对比度 stdDev(I)                     0..0.5
 *   清晰度    与对焦模块共用（Laplacian / Tenengrad / Brenner）
 *   MSE       (1/N)Σ(I_ref − I_test)²
 *   PSNR      10·log₁₀(1² / MSE)  dB         完全相同时为 +∞
 *   SSIM      11×11 高斯窗（σ=1.5）、C₁=(0.01L)²、C₂=(0.03L)²，L=1
 *             SSIM = [(2μxμy+C₁)(2σxy+C₂)] / [(μx²+μy²+C₁)(σx²+σy²+C₂)]
 *
 * 注意：PSNR 只反映**逐像素误差**，与「看起来是否清晰」并不总一致；
 * SSIM 引入了亮度/对比度/结构三项，与人眼感受更接近。两者应结合看。
 * ============================================================================
 */

import { imageMean, imageStdDev, type GrayImage } from './image'

/** 均方误差 */
export function mse(ref: GrayImage, test: GrayImage): number {
  const n = Math.min(ref.data.length, test.data.length)
  if (n === 0) return Number.NaN
  let acc = 0
  for (let i = 0; i < n; i += 1) {
    const d = ref.data[i] - test.data[i]
    acc += d * d
  }
  return acc / n
}

/** 峰值信噪比（数据范围 1）：完全相同返回 +∞ */
export function psnrDb(ref: GrayImage, test: GrayImage): number {
  const err = mse(ref, test)
  if (!Number.isFinite(err)) return Number.NaN
  if (err === 0) return Number.POSITIVE_INFINITY
  return 10 * Math.log10(1 / err)
}

/** 平均亮度 */
export function meanBrightness(img: GrayImage): number {
  return imageMean(img)
}

/** RMS 对比度（像素标准差） */
export function rmsContrast(img: GrayImage): number {
  return imageStdDev(img)
}

/** 11×11 高斯窗（σ = 1.5），SSIM 标准参数 */
function gaussianWindow11(sigma = 1.5): Float32Array {
  const size = 11
  const half = 5
  const win = new Float32Array(size * size)
  const twoSigma2 = 2 * sigma * sigma
  let sum = 0
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dy = y - half
      const dx = x - half
      const v = Math.exp(-(dx * dx + dy * dy) / twoSigma2)
      win[y * size + x] = v
      sum += v
    }
  }
  for (let i = 0; i < win.length; i += 1) win[i] /= sum
  return win
}

const SSIM_WINDOW = gaussianWindow11()

/**
 * 结构相似度 SSIM（均值法汇总各窗口）。
 * 数据范围 L = 1（若按 8bit 计算，把所有输入除以 255 即可等价）。
 */
export function ssim(ref: GrayImage, test: GrayImage): number {
  const w = Math.min(ref.width, test.width)
  const h = Math.min(ref.height, test.height)
  if (w < 11 || h < 11) return Number.NaN
  const K1 = 0.01
  const K2 = 0.03
  const L = 1
  const C1 = (K1 * L) ** 2
  const C2 = (K2 * L) ** 2

  let total = 0
  let count = 0
  for (let y = 0; y + 10 < h; y += 1) {
    for (let x = 0; x + 10 < w; x += 1) {
      let muX = 0
      let muY = 0
      for (let ky = 0; ky < 11; ky += 1) {
        for (let kx = 0; kx < 11; kx += 1) {
          const g = SSIM_WINDOW[ky * 11 + kx]
          const xi = (y + ky) * ref.width + (x + kx)
          const yi = (y + ky) * test.width + (x + kx)
          muX += g * ref.data[xi]
          muY += g * test.data[yi]
        }
      }
      let varX = 0
      let varY = 0
      let cov = 0
      for (let ky = 0; ky < 11; ky += 1) {
        for (let kx = 0; kx < 11; kx += 1) {
          const g = SSIM_WINDOW[ky * 11 + kx]
          const xi = (y + ky) * ref.width + (x + kx)
          const yi = (y + ky) * test.width + (x + kx)
          const dx = ref.data[xi] - muX
          const dy = test.data[yi] - muY
          varX += g * dx * dx
          varY += g * dy * dy
          cov += g * dx * dy
        }
      }
      const num = (2 * muX * muY + C1) * (2 * cov + C2)
      const den = (muX * muX + muY * muY + C1) * (varX + varY + C2)
      total += den === 0 ? 0 : num / den
      count += 1
    }
  }
  return count === 0 ? Number.NaN : total / count
}

/** 一次算出全部质量指标 */
export interface QualityMetrics {
  brightness: number
  contrast: number
  mse: number
  psnrDb: number
  ssim: number
}

export function computeQuality(ref: GrayImage, test: GrayImage): QualityMetrics {
  return {
    brightness: meanBrightness(test),
    contrast: rmsContrast(test),
    mse: mse(ref, test),
    psnrDb: psnrDb(ref, test),
    ssim: ssim(ref, test),
  }
}

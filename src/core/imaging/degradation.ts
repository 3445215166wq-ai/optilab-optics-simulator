/**
 * ============================================================================
 * 图像退化模型（模块五离焦成像 / 模块六成像质量测试共用）
 * ============================================================================
 *
 * 【重要声明】
 * 本文件里的「离焦」用**高斯模糊**近似：σ 与离焦量成正比。
 * 这是**图像退化近似模型**，不是严格的物理光学计算 ——
 * 真实的离焦 PSF 是艾里斑在离焦下的形态（见模块四的复光瞳 FFT 模型），
 * 会随离焦出现环状结构、旁瓣与轴上零点，而高斯核是各向同性的单调低通。
 * 之所以在这里用高斯近似：本模块关注的是「清晰度评价函数 / 搜索策略 / 重复性统计」
 * 这套**工程测试流程**，高斯退化在计算量上可接受且单调可控。
 * 需要严格 PSF 时请使用模块四。
 *
 * 【退化链路（按物理顺序）】
 *   场景照度（光照不均）→ 对比度（反照率）→ 光学模糊（离焦/运动）
 *   → 曝光与增益（相机响应）→ 传感器噪声
 * ============================================================================
 */

import { createRng } from '../rng'
import { clamp01, createGray, sampleBilinear, type GrayImage } from './image'

export interface DegradeParams {
  /** 离焦模糊 σ（像素）；**高斯近似**，非严格 PSF */
  defocusSigma: number
  /** 运动模糊长度（像素，0 = 关闭） */
  motionLength: number
  /** 运动方向（度，0 = 水平） */
  motionAngleDeg: number
  /** 照度不均强度 0..1（0 = 均匀照明） */
  illuminationFalloff: number
  /** 对比度系数（1 = 原图） */
  contrast: number
  /** 曝光增益（1 = 正常） */
  exposureGain: number
  /** 曝光偏置（-1..1，模拟提亮/压暗） */
  exposureOffset: number
  /** 高斯噪声 σ（0..0.25） */
  noiseSigma: number
  /** 随机种子（可复现） */
  seed: number
}

export const DEGRADE_DEFAULTS: DegradeParams = {
  defocusSigma: 0,
  motionLength: 0,
  motionAngleDeg: 0,
  illuminationFalloff: 0,
  contrast: 1,
  exposureGain: 1,
  exposureOffset: 0,
  noiseSigma: 0,
  seed: 20240501,
}

export const MAX_DEFOCUS_SIGMA = 6
export const MAX_MOTION_LENGTH = 40
export const MAX_NOISE_SIGMA = 0.25

/** 高斯核（一维），半径 = ceil(3σ) */
export function gaussianKernel(sigma: number): Float32Array {
  const r = Math.max(1, Math.ceil(3 * sigma))
  const size = r * 2 + 1
  const kernel = new Float32Array(size)
  const twoSigma2 = 2 * sigma * sigma
  let sum = 0
  for (let i = 0; i < size; i += 1) {
    const d = i - r
    const v = Math.exp(-(d * d) / twoSigma2)
    kernel[i] = v
    sum += v
  }
  for (let i = 0; i < size; i += 1) kernel[i] /= sum
  return kernel
}

/** 可分离高斯模糊（边界钳制） */
export function gaussianBlur(img: GrayImage, sigma: number): GrayImage {
  if (!(sigma > 0.05)) return { width: img.width, height: img.height, data: Float32Array.from(img.data) }
  const { width: w, height: h, data } = img
  const kernel = gaussianKernel(sigma)
  const r = (kernel.length - 1) / 2
  const tmp = new Float32Array(w * h)
  const out = createGray(w, h)

  // 水平
  for (let y = 0; y < h; y += 1) {
    const row = y * w
    for (let x = 0; x < w; x += 1) {
      let acc = 0
      for (let k = -r; k <= r; k += 1) {
        const sx = Math.min(w - 1, Math.max(0, x + k))
        acc += data[row + sx] * kernel[k + r]
      }
      tmp[row + x] = acc
    }
  }
  // 垂直
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let acc = 0
      for (let k = -r; k <= r; k += 1) {
        const sy = Math.min(h - 1, Math.max(0, y + k))
        acc += tmp[sy * w + x] * kernel[k + r]
      }
      out.data[y * w + x] = acc
    }
  }
  return out
}

/**
 * 运动模糊：沿给定方向的线段 PSF。
 * 用「亚像素双线性平移叠加」实现，等价于与线段核做卷积，但复杂度是 O(n²·L) 而非 O(n²·L²)。
 */
export function motionBlur(img: GrayImage, lengthPx: number, angleDeg: number): GrayImage {
  if (!(lengthPx > 0.5)) return { width: img.width, height: img.height, data: Float32Array.from(img.data) }
  const { width: w, height: h } = img
  const out = createGray(w, h)
  const rad = (angleDeg * Math.PI) / 180
  const dx = Math.cos(rad)
  const dy = Math.sin(rad)
  const steps = Math.max(2, Math.round(lengthPx) + 1)
  const half = (lengthPx / 2) * 1
  for (let s = 0; s < steps; s += 1) {
    const t = (steps === 1 ? 0 : (s / (steps - 1)) * 2 - 1) * half
    const ox = dx * t
    const oy = dy * t
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        out.data[y * w + x] += sampleBilinear(img, x + ox, y + oy) / steps
      }
    }
  }
  return out
}

/** 照度不均：中心亮、边缘暗的余弦分布（模拟镜头暗角 / 环形光源照明） */
export function applyIllumination(img: GrayImage, strength: number): GrayImage {
  if (!(strength > 0.001)) return { width: img.width, height: img.height, data: Float32Array.from(img.data) }
  const { width: w, height: h } = img
  const out = createGray(w, h)
  const cx = (w - 1) / 2
  const cy = (h - 1) / 2
  const rMax = Math.hypot(cx, cy) || 1
  const s = Math.min(1, strength)
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const r = Math.hypot(x - cx, y - cy) / rMax
      // 1 → 均匀；0 → 边缘衰减到约 0.15
      const gain = 1 - s * (1 - Math.cos(r * Math.PI * 0.5) ** 2)
      out.data[y * w + x] = img.data[y * w + x] * gain
    }
  }
  return out
}

/** 对比度（围绕中灰 0.5 缩放） */
export function applyContrast(img: GrayImage, factor: number): GrayImage {
  const out = createGray(img.width, img.height)
  const f = Math.max(0, factor)
  for (let i = 0; i < img.data.length; i += 1) {
    out.data[i] = clamp01(0.5 + (img.data[i] - 0.5) * f)
  }
  return out
}

/** 曝光：out = in·gain + offset（模拟欠曝 / 过曝与偏置） */
export function applyExposure(img: GrayImage, gain: number, offset: number): GrayImage {
  const out = createGray(img.width, img.height)
  for (let i = 0; i < img.data.length; i += 1) {
    out.data[i] = clamp01(img.data[i] * gain + offset)
  }
  return out
}

/** 高斯噪声（使用带种子 PRNG，结果可复现） */
export function addGaussianNoise(img: GrayImage, sigma: number, seed: number): GrayImage {
  const out = createGray(img.width, img.height)
  if (!(sigma > 0)) {
    out.data.set(img.data)
    return out
  }
  const rng = createRng(seed)
  for (let i = 0; i < img.data.length; i += 1) {
    out.data[i] = clamp01(img.data[i] + rng.gaussian() * sigma)
  }
  return out
}

/**
 * 按物理顺序执行完整退化链路。
 * 返回新图像，并给出「已生效的退化项」清单，便于界面标注实际生效的模型。
 */
export function degradeImage(
  img: GrayImage,
  params: DegradeParams,
): { image: GrayImage; applied: string[] } {
  const applied: string[] = []
  let out = img

  if (params.illuminationFalloff > 0.001) {
    out = applyIllumination(out, params.illuminationFalloff)
    applied.push('光照不均（余弦暗角）')
  }
  if (Math.abs(params.contrast - 1) > 0.001) {
    out = applyContrast(out, params.contrast)
    applied.push(`对比度 ×${params.contrast.toFixed(2)}`)
  }
  if (params.defocusSigma > 0.05) {
    out = gaussianBlur(out, Math.min(params.defocusSigma, MAX_DEFOCUS_SIGMA))
    applied.push(`离焦模糊 σ=${params.defocusSigma.toFixed(2)}px（高斯近似）`)
  }
  if (params.motionLength > 0.5) {
    out = motionBlur(out, Math.min(params.motionLength, MAX_MOTION_LENGTH), params.motionAngleDeg)
    applied.push(`运动模糊 L=${params.motionLength.toFixed(1)}px @${params.motionAngleDeg.toFixed(0)}°`)
  }
  if (Math.abs(params.exposureGain - 1) > 0.001 || Math.abs(params.exposureOffset) > 0.001) {
    out = applyExposure(out, params.exposureGain, params.exposureOffset)
    applied.push(`曝光 ×${params.exposureGain.toFixed(2)} ${params.exposureOffset >= 0 ? '+' : ''}${params.exposureOffset.toFixed(2)}`)
  }
  if (params.noiseSigma > 0) {
    out = addGaussianNoise(out, Math.min(params.noiseSigma, MAX_NOISE_SIGMA), params.seed)
    applied.push(`高斯噪声 σ=${params.noiseSigma.toFixed(3)}（种子 ${params.seed}）`)
  }
  return { image: out, applied }
}

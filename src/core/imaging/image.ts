/**
 * 灰度图像基础结构与工具（纯计算层，不依赖 DOM / Canvas）。
 *
 * 约定：
 *   - 数据统一存为 Float32Array，取值 [0,1]（0 = 黑，1 = 白），便于做线性运算；
 *   - 只在「显示」与「PSNR/SSIM 的 8bit 惯例」这两处与 0..255 互转；
 *   - 所有函数都是纯函数，不修改入参。
 *
 * 为什么不用 ImageData：core 层要保持可在 Node 中单元测试，不能依赖浏览器类型。
 */

export interface GrayImage {
  width: number
  height: number
  /** 行优先，长度 = width × height，取值 [0,1] */
  data: Float32Array
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

export function createGray(width: number, height: number, fill = 0): GrayImage {
  const data = new Float32Array(Math.max(0, width * height))
  if (fill !== 0) data.fill(fill)
  return { width, height, data }
}

export function cloneGray(img: GrayImage): GrayImage {
  return { width: img.width, height: img.height, data: Float32Array.from(img.data) }
}

/** RGBA（Uint8ClampedArray，来自 canvas ImageData）→ 灰度，使用 BT.601 亮度权重 */
export function rgbaToGray(rgba: ArrayLike<number>, width: number, height: number): GrayImage {
  const out = createGray(width, height)
  const n = Math.min(width * height, Math.floor(rgba.length / 4))
  for (let i = 0; i < n; i += 1) {
    const o = i * 4
    const alpha = rgba[o + 3] / 255
    // 透明像素按白底合成，避免上传 PNG 时出现黑边
    const luma = (0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2]) / 255
    out.data[i] = clamp01(luma * alpha + (1 - alpha))
  }
  return out
}

/** 灰度 → RGBA（Uint8ClampedArray），供 putImageData 使用 */
export function grayToRgba(img: GrayImage): Uint8ClampedArray {
  const out = new Uint8ClampedArray(img.width * img.height * 4)
  for (let i = 0; i < img.data.length; i += 1) {
    const v = Math.round(clamp01(img.data[i]) * 255)
    const o = i * 4
    out[o] = v
    out[o + 1] = v
    out[o + 2] = v
    out[o + 3] = 255
  }
  return out
}

/** 最近邻缩放（用于把不同来源的图片统一到内部工作分辨率） */
export function resizeNearest(img: GrayImage, width: number, height: number): GrayImage {
  const out = createGray(width, height)
  if (img.width === 0 || img.height === 0) return out
  for (let y = 0; y < height; y += 1) {
    const sy = Math.min(img.height - 1, Math.floor(((y + 0.5) * img.height) / height))
    for (let x = 0; x < width; x += 1) {
      const sx = Math.min(img.width - 1, Math.floor(((x + 0.5) * img.width) / width))
      out.data[y * width + x] = img.data[sy * img.width + sx]
    }
  }
  return out
}

/** 双线性采样（越界按边缘钳制），供亚像素平移 / 插值使用 */
export function sampleBilinear(img: GrayImage, x: number, y: number): number {
  const { width, height, data } = img
  if (width === 0 || height === 0) return 0
  const xc = Math.min(width - 1, Math.max(0, x))
  const yc = Math.min(height - 1, Math.max(0, y))
  const x0 = Math.floor(xc)
  const y0 = Math.floor(yc)
  const x1 = Math.min(width - 1, x0 + 1)
  const y1 = Math.min(height - 1, y0 + 1)
  const fx = xc - x0
  const fy = yc - y0
  const v00 = data[y0 * width + x0]
  const v10 = data[y0 * width + x1]
  const v01 = data[y1 * width + x0]
  const v11 = data[y1 * width + x1]
  return (
    v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy
  )
}

/** 均值 */
export function imageMean(img: GrayImage): number {
  if (img.data.length === 0) return Number.NaN
  let sum = 0
  for (let i = 0; i < img.data.length; i += 1) sum += img.data[i]
  return sum / img.data.length
}

/** 总体标准差（即 RMS 对比度指标的基础量） */
export function imageStdDev(img: GrayImage): number {
  if (img.data.length === 0) return Number.NaN
  const mean = imageMean(img)
  let acc = 0
  for (let i = 0; i < img.data.length; i += 1) {
    const d = img.data[i] - mean
    acc += d * d
  }
  return Math.sqrt(acc / img.data.length)
}

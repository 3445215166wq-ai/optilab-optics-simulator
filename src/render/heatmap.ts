/**
 * 标量场热力图渲染（PSF / 艾里斑共用）。
 *
 * 设计要点：
 *   1. 颜色映射用「科学计算常用」的黑→紫→红→黄→白有序色阶（inferno 风格），
 *      比彩虹色阶更能表达强度大小关系，且对色盲友好；
 *   2. 支持线性/对数两种映射：PSF 动态范围可达 10⁴ 以上，对数显示才能看清旁瓣；
 *   3. 场数据（Float32Array）→ 离屏 canvas 的转换结果做一层缓存，
 *      参数不变时不重复生成，避免滑杆拖动时反复分配 256×256 的 ImageData。
 */

import type { ScenePalette } from './palette'

export interface HeatmapOptions {
  /** 是否对数映射 */
  logScale: boolean
  /** 对数映射的动态范围（dB），默认 40 dB（4 个数量级） */
  dynamicRangeDb?: number
}

/** 色阶停靠点（inferno 风格有序色阶的近似实现） */
const STOPS: Array<[number, number, number, number]> = [
  [0.0, 8, 6, 18],
  [0.22, 58, 15, 82],
  [0.42, 124, 26, 108],
  [0.62, 186, 54, 74],
  [0.8, 238, 122, 45],
  [0.92, 250, 186, 60],
  [1.0, 252, 246, 214],
]

/** 归一化值 t ∈ [0,1] → RGB */
export function colormap(t: number): [number, number, number] {
  const v = Math.min(1, Math.max(0, t))
  for (let i = 1; i < STOPS.length; i += 1) {
    const [pos, r1, g1, b1] = STOPS[i]
    if (v <= pos) {
      const [prevPos, r0, g0, b0] = STOPS[i - 1]
      const k = (v - prevPos) / (pos - prevPos)
      return [r0 + (r1 - r0) * k, g0 + (g1 - g0) * k, b0 + (b1 - b0) * k]
    }
  }
  const last = STOPS[STOPS.length - 1]
  return [last[1], last[2], last[3]]
}

/** 把物理强度值映射到 [0,1] 显示值 */
export function scaleValue(value: number, opts: HeatmapOptions): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  if (!opts.logScale) return Math.min(1, value)
  const floorDb = -(opts.dynamicRangeDb ?? 40)
  const db = 10 * Math.log10(value)
  if (db <= floorDb) return 0
  return Math.min(1, 1 + db / -floorDb)
}

interface FieldCacheEntry {
  field: Float32Array
  size: number
  logScale: boolean
  dynamicRangeDb: number
  canvas: HTMLCanvasElement
}

let cache: FieldCacheEntry | null = null

/**
 * 把标量场转成离屏 canvas（带缓存）。
 * 注意：直接复用上一次的 canvas，调用方不要修改返回值。
 */
export function fieldToCanvas(
  field: Float32Array,
  size: number,
  opts: HeatmapOptions,
): HTMLCanvasElement {
  const dr = opts.dynamicRangeDb ?? 40
  if (
    cache &&
    cache.field === field &&
    cache.size === size &&
    cache.logScale === opts.logScale &&
    cache.dynamicRangeDb === dr
  ) {
    return cache.canvas
  }

  const canvas = cache?.size === size ? cache.canvas : document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const image = ctx.createImageData(size, size)
  const data = image.data
  for (let i = 0; i < size * size; i += 1) {
    const t = scaleValue(field[i] ?? 0, opts)
    const [r, g, b] = colormap(t)
    const o = i * 4
    data[o] = r
    data[o + 1] = g
    data[o + 2] = b
    data[o + 3] = 255
  }
  ctx.putImageData(image, 0, 0)
  cache = { field, size, logScale: opts.logScale, dynamicRangeDb: dr, canvas }
  return canvas
}

export interface ImagePanelRect {
  x: number
  y: number
  side: number
}

/**
 * 在画布上绘制「方形图像 + 竖直色标」面板，返回图像区域矩形。
 * 图像用 drawImage 放大，开启平滑以消除像素块感。
 */
export function drawFieldPanel(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  field: Float32Array,
  gridSize: number,
  opts: HeatmapOptions,
  palette: ScenePalette,
  labels: { top: string; bottom: string },
): ImagePanelRect {
  const padding = 34
  const colorbarW = 12
  const colorbarGap = 46
  const availW = canvasWidth - padding * 2 - colorbarW - colorbarGap
  const availH = canvasHeight - padding * 2
  const side = Math.max(40, Math.min(availW, availH))
  const x = padding + Math.max(0, (availW - side) / 2)
  const y = padding + Math.max(0, (availH - side) / 2)

  const source = fieldToCanvas(field, gridSize, opts)
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, x, y, side, side)
  ctx.strokeStyle = palette.chipBorder
  ctx.lineWidth = 1
  ctx.strokeRect(x + 0.5, y + 0.5, side - 1, side - 1)
  ctx.restore()

  // ---- 竖直色标 ----
  const barX = x + side + colorbarGap
  const barH = side * 0.62
  const barY = y + (side - barH) / 2
  const steps = 64
  for (let i = 0; i < steps; i += 1) {
    const t = 1 - i / (steps - 1)
    const [r, g, b] = colormap(t)
    ctx.fillStyle = `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`
    ctx.fillRect(barX, barY + (barH * i) / steps, colorbarW, barH / steps + 1)
  }
  ctx.strokeStyle = palette.chipBorder
  ctx.strokeRect(barX + 0.5, barY + 0.5, colorbarW - 1, barH - 1)

  ctx.save()
  ctx.font = "9.5px ui-monospace, Consolas, monospace"
  ctx.fillStyle = palette.textMuted
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  const topLabel = labels.top
  const bottomLabel = labels.bottom
  ctx.fillText(topLabel, barX + colorbarW + 4, barY + 2)
  ctx.fillText(bottomLabel, barX + colorbarW + 4, barY + barH - 2)
  ctx.restore()

  return { x, y, side }
}

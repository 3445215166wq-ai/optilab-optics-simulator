/**
 * 灰度图像显示辅助（Canvas 2D）。
 *
 * 与光学模块的矢量绘图不同，这里是把 Float32 像素场贴到画布上：
 *   - 用一个可复用的离屏 canvas 暂存 ImageData，避免每次重绘都分配大数组；
 *   - 用 drawImage 缩放（默认关闭平滑，保持像素边界清晰，便于观察模糊程度）；
 *   - 支持并排对比（原图 / 退化图）。
 */

import type { GrayImage } from '../core/imaging/image'
import { grayToRgba } from '../core/imaging/image'
import type { ScenePalette } from './palette'

interface CacheEntry {
  width: number
  height: number
  canvas: HTMLCanvasElement
}
let cache: CacheEntry | null = null

/** 把灰度图写入离屏 canvas（如尺寸不变则复用同一 canvas） */
export function grayToCanvas(img: GrayImage): HTMLCanvasElement {
  const w = Math.max(1, img.width)
  const h = Math.max(1, img.height)
  let canvas: HTMLCanvasElement
  if (cache && cache.width === w && cache.height === h) {
    canvas = cache.canvas
  } else {
    canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    cache = { width: w, height: h, canvas }
  }
  const ctx = canvas.getContext('2d')
  if (ctx) {
    // 用 createImageData + set 而不是 new ImageData(rgba,...)：
    // TS 6 的类型收紧了 ImageData 构造签名（要求 ArrayBuffer 而非 ArrayBufferLike）
    const imageData = ctx.createImageData(w, h)
    imageData.data.set(grayToRgba(img))
    ctx.putImageData(imageData, 0, 0)
  }
  return canvas
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** 在给定区域内按图像宽高比居中放置 */
export function fitRect(area: Rect, imageWidth: number, imageHeight: number): Rect {
  const aspect = imageHeight > 0 ? imageWidth / imageHeight : 1
  let w = area.w
  let h = w / aspect
  if (h > area.h) {
    h = area.h
    w = h * aspect
  }
  return { x: area.x + (area.w - w) / 2, y: area.y + (area.h - h) / 2, w, h }
}

export interface DrawImageOptions {
  smooth?: boolean
  border?: boolean
  label?: string
  labelColor?: string
}

/** 把灰度图画到指定矩形里，可选边框与左上角标签 */
export function drawGrayImage(
  ctx: CanvasRenderingContext2D,
  img: GrayImage,
  rect: Rect,
  palette: ScenePalette,
  options: DrawImageOptions = {},
): void {
  if (img.width === 0 || img.height === 0) return
  const source = grayToCanvas(img)
  ctx.save()
  ctx.imageSmoothingEnabled = options.smooth ?? false
  ctx.drawImage(source, rect.x, rect.y, rect.w, rect.h)
  if (options.border !== false) {
    ctx.strokeStyle = palette.chipBorder
    ctx.lineWidth = 1
    ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1)
  }
  if (options.label) {
    ctx.font = "10px ui-monospace, Consolas, monospace"
    const textW = ctx.measureText(options.label).width
    ctx.fillStyle = palette.chipBg
    ctx.fillRect(rect.x, rect.y, textW + 10, 17)
    ctx.fillStyle = options.labelColor ?? palette.textPrimary
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(options.label, rect.x + 5, rect.y + 9)
  }
  ctx.restore()
}

/** 画一个带刻度的竖直 Z 轴标尺（自动对焦模块用） */
export function drawZAxisGauge(
  ctx: CanvasRenderingContext2D,
  area: Rect,
  palette: ScenePalette,
  opts: {
    zMin: number
    zMax: number
    currentZ: number
    bestZ: number | null
    trueBestZ: number
  },
): void {
  const x = area.x + area.w / 2
  const top = area.y + 8
  const bottom = area.y + area.h - 8
  const toY = (z: number) =>
    bottom - ((z - opts.zMin) / Math.max(1e-9, opts.zMax - opts.zMin)) * (bottom - top)

  ctx.save()
  ctx.strokeStyle = palette.axis
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(x, top)
  ctx.lineTo(x, bottom)
  ctx.stroke()

  // 刻度（5 格）
  ctx.font = "9px ui-monospace, Consolas, monospace"
  ctx.fillStyle = palette.textMuted
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  for (let i = 0; i <= 5; i += 1) {
    const z = opts.zMin + ((opts.zMax - opts.zMin) * i) / 5
    const y = toY(z)
    ctx.beginPath()
    ctx.moveTo(x - 3, y)
    ctx.lineTo(x + 3, y)
    ctx.stroke()
    ctx.fillText(z.toFixed(1), x - 6, y)
  }

  const mark = (z: number, color: string, half: number, dashed: boolean) => {
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.setLineDash(dashed ? [4, 3] : [])
    ctx.beginPath()
    ctx.moveTo(x - half, toY(z))
    ctx.lineTo(x + half, toY(z))
    ctx.stroke()
    ctx.setLineDash([])
  }
  // 真值最佳焦点（虚机设定）与本次搜索结果
  mark(opts.trueBestZ, palette.textMuted, 12, true)
  if (opts.bestZ !== null) mark(opts.bestZ, palette.rayRefracted, 20, false)
  ctx.strokeStyle = palette.accent
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x + 6, toY(opts.currentZ))
  ctx.lineTo(x + 22, toY(opts.currentZ))
  ctx.stroke()
  ctx.restore()

  // 图例文字
  ctx.save()
  ctx.font = "9px ui-monospace, Consolas, monospace"
  ctx.textAlign = 'left'
  ctx.fillStyle = palette.accent
  ctx.fillText('当前 Z', x + 24, toY(opts.currentZ) + 3)
  if (opts.bestZ !== null) {
    ctx.fillStyle = palette.rayRefracted
    ctx.fillText('搜索最佳', x + 24, toY(opts.bestZ) + 3)
  }
  ctx.fillStyle = palette.textMuted
  ctx.fillText('真值', x + 24, toY(opts.trueBestZ) + 3)
  ctx.restore()
}

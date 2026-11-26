/**
 * Canvas 2D 绘图基础工具：网格坐标轴、线段、箭头、标注、比例尺。
 * 所有函数都接收世界坐标（mm）→ 由 Viewport 完成到屏幕坐标的映射，
 * 保证「物理量」与「像素」不混用。
 */

import type { Viewport } from './viewport'
import type { ScenePalette } from './palette'
import { niceStep } from '../core/geometry'

export interface Size {
  w: number
  h: number
}

export function fontMono(size: number, weight: number | string = 400): string {
  return `${weight} ${size}px ui-monospace, 'Cascadia Mono', 'JetBrains Mono', Consolas, monospace`
}

export function fontSans(size: number, weight: number | string = 500): string {
  return `${weight} ${size}px 'Segoe UI', system-ui, 'Microsoft YaHei', sans-serif`
}

/** 清屏并填充舞台底色 */
export function clearStage(ctx: CanvasRenderingContext2D, size: Size, palette: ScenePalette): void {
  ctx.save()
  ctx.setTransform(ctx.getTransform())
  ctx.fillStyle = palette.bg
  ctx.fillRect(0, 0, size.w, size.h)
  ctx.restore()
}

/**
 * 绘制工程网格 + 带单位标注的坐标轴。
 * 刻度步长使用 1/2/5×10^k 的「整洁值」，并自动跳过过密标签。
 */
export function drawGridAndAxes(
  ctx: CanvasRenderingContext2D,
  view: Viewport,
  palette: ScenePalette,
  opts: { axisLabel?: string; showYLabels?: boolean; targetTicksX?: number; targetTicksY?: number } = {},
): void {
  const { plot } = view
  const b = view.bounds
  const stepX = niceStep(b.xMax - b.xMin, opts.targetTicksX ?? 8)
  const stepY = niceStep(b.yMax - b.yMin, opts.targetTicksY ?? 5)

  ctx.save()
  ctx.beginPath()
  ctx.rect(plot.left, plot.top, plot.width, plot.height)
  ctx.clip()

  // ---- 网格线 ----
  ctx.lineWidth = 1
  const i0 = Math.ceil(b.xMin / stepX)
  const i1 = Math.floor(b.xMax / stepX)
  ctx.strokeStyle = palette.gridLine
  ctx.beginPath()
  for (let i = i0; i <= i1; i += 1) {
    const px = Math.round(view.px(i * stepX)) + 0.5
    ctx.moveTo(px, plot.top)
    ctx.lineTo(px, plot.bottom)
  }
  const j0 = Math.ceil(b.yMin / stepY)
  const j1 = Math.floor(b.yMax / stepY)
  for (let j = j0; j <= j1; j += 1) {
    const py = Math.round(view.py(j * stepY)) + 0.5
    ctx.moveTo(plot.left, py)
    ctx.lineTo(plot.right, py)
  }
  ctx.stroke()

  // ---- 光轴（y = 0）与竖直 y 轴（x = 0 处仅作视觉参考） ----
  const axisY = Math.round(view.py(0)) + 0.5
  const axisVisible = axisY > plot.top && axisY < plot.bottom
  if (axisVisible) {
    ctx.strokeStyle = palette.axis
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(plot.left, axisY)
    ctx.lineTo(plot.right, axisY)
    ctx.stroke()
    // 光轴箭头
    ctx.fillStyle = palette.axis
    ctx.beginPath()
    ctx.moveTo(plot.right, axisY)
    ctx.lineTo(plot.right - 7, axisY - 3.5)
    ctx.lineTo(plot.right - 7, axisY + 3.5)
    ctx.closePath()
    ctx.fill()
  }

  // ---- 刻度标签 ----
  const decimalsX = Math.max(0, Math.min(3, -Math.floor(Math.log10(stepX))))
  const labelY = axisVisible ? axisY + 11 : plot.bottom - 5
  const labelSpacingPx = stepX * view.scaleX
  ctx.font = fontMono(9.5)
  ctx.fillStyle = palette.textMuted
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  if (labelSpacingPx >= 30) {
    for (let i = i0; i <= i1; i += 1) {
      const wx = i * stepX
      if (Math.abs(wx) < stepX * 1e-6) continue // 原点标签单独处理，避免与 y 轴重叠
      const px = view.px(wx)
      if (px < plot.left + 8 || px > plot.right - 8) continue
      ctx.fillText(wx.toFixed(decimalsX), px, labelY)
    }
  }
  // 原点
  if (view.px(0) > plot.left + 8 && view.px(0) < plot.right - 8) {
    ctx.fillText('0', view.px(0), labelY)
  }

  if (opts.showYLabels !== false) {
    const decimalsY = Math.max(0, Math.min(3, -Math.floor(Math.log10(stepY))))
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    const spacingY = stepY * view.scaleY
    if (spacingY >= 22) {
      for (let j = j0; j <= j1; j += 1) {
        const wy = j * stepY
        if (Math.abs(wy) < stepY * 1e-6) continue
        const py = view.py(wy)
        if (py < plot.top + 6 || py > plot.bottom - 6) continue
        ctx.fillText(wy.toFixed(decimalsY), plot.left - 6, py)
      }
    }
  }

  // ---- 单位标注 ----
  if (axisVisible) {
    ctx.font = fontMono(10)
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    ctx.fillStyle = palette.textMuted
    ctx.fillText(opts.axisLabel ?? 'z (mm)', plot.right - 4, axisY - 4)
  }
  ctx.restore()
}

/** 绘制一条世界坐标线段 */
export function strokeSegment(
  ctx: CanvasRenderingContext2D,
  view: Viewport,
  a: { x: number; y: number },
  b: { x: number; y: number },
  color: string,
  width = 1.4,
  dash: number[] | null = null,
  alpha = 1,
): void {
  if (![a.x, a.y, b.x, b.y].every(Number.isFinite)) return
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  if (dash) ctx.setLineDash(dash)
  ctx.beginPath()
  ctx.moveTo(view.px(a.x), view.py(a.y))
  ctx.lineTo(view.px(b.x), view.py(b.y))
  ctx.stroke()
  ctx.restore()
}

/** 屏幕坐标箭头头部 */
export function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angleRad: number,
  size: number,
  color: string,
): void {
  ctx.save()
  ctx.fillStyle = color
  ctx.translate(x, y)
  ctx.rotate(angleRad)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(-size, size * 0.45)
  ctx.lineTo(-size * 0.72, 0)
  ctx.lineTo(-size, -size * 0.45)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

/** 竖直方向箭头（用于物高 / 像高） */
export function drawVerticalArrow(
  ctx: CanvasRenderingContext2D,
  view: Viewport,
  worldX: number,
  fromY: number,
  toY: number,
  color: string,
  opts: { width?: number; dash?: number[] | null; headSize?: number; alpha?: number } = {},
): void {
  const px = view.px(worldX)
  const yFrom = view.py(fromY)
  const yTo = view.py(toY)
  if (!Number.isFinite(px) || !Number.isFinite(yFrom) || !Number.isFinite(yTo)) return
  const width = opts.width ?? 2
  const headSize = opts.headSize ?? 7
  const alpha = opts.alpha ?? 1

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  if (opts.dash) ctx.setLineDash(opts.dash)

  const dir = Math.sign(yTo - yFrom) || -1
  const shorten = headSize * 0.8
  ctx.beginPath()
  ctx.moveTo(px, yFrom)
  ctx.lineTo(px, yTo + dir * shorten)
  ctx.stroke()

  ctx.setLineDash([])
  drawArrowHead(ctx, px, yTo, dir > 0 ? Math.PI / 2 : -Math.PI / 2, headSize, color)
  if (Math.abs(fromY) > 1e-9) {
    // 起点小圆点，明确「从光轴起算」
    ctx.beginPath()
    ctx.arc(px, yFrom, 1.8, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

export interface ChipOptions {
  align?: 'left' | 'center' | 'right'
  baseline?: 'top' | 'middle' | 'bottom'
  color?: string
  bg?: string
  border?: string | null
  size?: number
  mono?: boolean
  padding?: number
}

/** 带底色的文本标签（避免压在网格线上看不清） */
export function drawChip(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  palette: ScenePalette,
  opts: ChipOptions = {},
): { width: number; height: number } {
  const size = opts.size ?? 10.5
  const pad = opts.padding ?? 4
  const align = opts.align ?? 'left'
  const baseline = opts.baseline ?? 'middle'
  ctx.save()
  ctx.font = opts.mono === false ? fontSans(size) : fontMono(size)
  const textW = ctx.measureText(text).width
  const boxW = textW + pad * 2
  const boxH = size + pad * 2

  let bx = x
  if (align === 'center') bx = x - boxW / 2
  else if (align === 'right') bx = x - boxW
  let by = y
  if (baseline === 'middle') by = y - boxH / 2
  else if (baseline === 'bottom') by = y - boxH

  const bg = opts.bg ?? palette.chipBg
  if (bg !== 'transparent') {
    ctx.fillStyle = bg
    roundRectPath(ctx, bx, by, boxW, boxH, 2.5)
    ctx.fill()
  }
  const border = opts.border === undefined ? palette.chipBorder : opts.border
  if (border) {
    ctx.strokeStyle = border
    ctx.lineWidth = 1
    roundRectPath(ctx, bx + 0.5, by + 0.5, boxW - 1, boxH - 1, 2.5)
    ctx.stroke()
  }
  ctx.fillStyle = opts.color ?? palette.textPrimary
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, bx + pad, by + boxH / 2 + 0.5)
  ctx.restore()
  return { width: boxW, height: boxH }
}

export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.arcTo(x + w, y, x + w, y + radius, radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius)
  ctx.lineTo(x + radius, y + h)
  ctx.arcTo(x, y + h, x, y + h - radius, radius)
  ctx.lineTo(x, y + radius)
  ctx.arcTo(x, y, x + radius, y, radius)
  ctx.closePath()
}

/** 圆点标记（焦点、物点等） */
export function drawDot(
  ctx: CanvasRenderingContext2D,
  view: Viewport,
  worldX: number,
  worldY: number,
  radius: number,
  color: string,
  hollow = false,
): void {
  const px = view.px(worldX)
  const py = view.py(worldY)
  if (!Number.isFinite(px) || !Number.isFinite(py)) return
  ctx.save()
  ctx.beginPath()
  ctx.arc(px, py, radius, 0, Math.PI * 2)
  if (hollow) {
    ctx.strokeStyle = color
    ctx.lineWidth = 1.4
    ctx.stroke()
  } else {
    ctx.fillStyle = color
    ctx.fill()
  }
  ctx.restore()
}

/**
 * 尺寸线（用于标注物距 u / 像距 v）。
 * 在固定的屏幕高度上用双向箭头标出两个世界 x 之间的距离。
 */
export function drawDimension(
  ctx: CanvasRenderingContext2D,
  view: Viewport,
  worldX1: number,
  worldX2: number,
  screenY: number,
  label: string,
  color: string,
  palette: ScenePalette,
): void {
  const x1 = view.px(worldX1)
  const x2 = view.px(worldX2)
  if (!Number.isFinite(x1) || !Number.isFinite(x2) || Math.abs(x2 - x1) < 14) return
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.setLineDash([])
  // 端点竖线
  ctx.beginPath()
  ctx.moveTo(x1, screenY - 4)
  ctx.lineTo(x1, screenY + 4)
  ctx.moveTo(x2, screenY - 4)
  ctx.lineTo(x2, screenY + 4)
  ctx.stroke()
  // 主尺寸线
  ctx.beginPath()
  ctx.moveTo(x1, screenY)
  ctx.lineTo(x2, screenY)
  ctx.stroke()
  const dir = Math.sign(x2 - x1) || 1
  drawArrowHead(ctx, x2, screenY, dir > 0 ? 0 : Math.PI, 5, color)
  drawArrowHead(ctx, x1, screenY, dir > 0 ? Math.PI : 0, 5, color)
  ctx.restore()
  drawChip(ctx, label, (x1 + x2) / 2, screenY - 1, palette, {
    align: 'center',
    baseline: 'bottom',
    color,
    size: 9.5,
  })
}

/** 左下角比例尺：给出一段「整洁长度」对应的像素长度 */
export function drawScaleBar(
  ctx: CanvasRenderingContext2D,
  view: Viewport,
  palette: ScenePalette,
): void {
  const targetPx = Math.min(120, Math.max(48, view.plot.width * 0.18))
  const step = niceStep((targetPx / view.scaleX) * 1.4, 1)
  const barPx = step * view.scaleX
  if (!Number.isFinite(barPx) || barPx < 12 || barPx > view.plot.width * 0.6) return
  const x = view.plot.left + 6
  const y = view.plot.bottom - 10
  ctx.save()
  ctx.strokeStyle = palette.textMuted
  ctx.lineWidth = 1.2
  const big = step >= 1 ? step.toFixed(0) : step.toFixed(2)
  const unit = 'mm'
  ctx.beginPath()
  ctx.moveTo(x, y - 4)
  ctx.lineTo(x, y)
  ctx.lineTo(x + barPx, y)
  ctx.lineTo(x + barPx, y - 4)
  ctx.stroke()
  ctx.font = fontMono(9.5)
  ctx.fillStyle = palette.textMuted
  ctx.textAlign = 'left'
  ctx.textBaseline = 'bottom'
  ctx.fillText(`${big} ${unit}`, x + barPx + 6, y + 1)
  ctx.restore()
}

/** 参数非法 / 无数据时的舞台提示（避免出现空白画布） */
export function drawEmptyState(
  ctx: CanvasRenderingContext2D,
  size: Size,
  palette: ScenePalette,
  title: string,
  hint?: string,
): void {
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = palette.textMuted
  ctx.font = fontSans(13, 600)
  ctx.fillText(title, size.w / 2, size.h / 2 - (hint ? 10 : 0))
  if (hint) {
    ctx.font = fontSans(11.5, 400)
    ctx.fillText(hint, size.w / 2, size.h / 2 + 12)
  }
  ctx.restore()
}

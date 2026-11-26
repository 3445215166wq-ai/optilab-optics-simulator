/**
 * 模块二：反射 / 折射 / 全反射 场景渲染。
 *
 * 世界坐标：界面为 y = 0 的水平线，入射点在原点 O。
 *   介质 1 位于上方 (y > 0)，介质 2 位于下方 (y < 0)。
 *   光线自左上方向右下方入射。
 *
 * 视觉编码（真实数据驱动，非装饰）：
 *   光线线宽 ∝ 该路光线的光强占比（反射率 R / 透射率 T），
 *   因此「全反射」时反射光线最粗、折射光线消失，与物理一致。
 */

import type { RefractionResult } from '../core/optics/refraction'
import { fmt, fmtDeg } from '../core/format'
import type { ScenePalette } from './palette'
import { createViewport } from './viewport'
import type { Size } from './draw'
import {
  clearStage,
  drawArrowHead,
  drawChip,
  drawDot,
  drawEmptyState,
  drawGridAndAxes,
  strokeSegment,
} from './draw'

export interface RefractionSceneOptions {
  medium1Name: string
  medium2Name: string
  showAuxiliary: boolean
  showCriticalAngle: boolean
}

/** 光路绘制长度（世界单位 = mm，仅表示图形尺度） */
const RAY_LEN = 10
const VIEW_HALF = 11.5

export function drawRefractionScene(
  ctx: CanvasRenderingContext2D,
  size: Size,
  result: RefractionResult,
  options: RefractionSceneOptions,
  palette: ScenePalette,
): void {
  clearStage(ctx, size, palette)

  if (!result.ok) {
    drawEmptyState(ctx, size, palette, '参数非法，无法生成光路', result.errors[0] ?? '请检查右侧参数面板')
    return
  }

  const view = createViewport(size.w, size.h, {
    xMin: -VIEW_HALF,
    xMax: VIEW_HALF,
    yMin: -VIEW_HALF,
    yMax: VIEW_HALF,
  })
  const { plot } = view
  const originX = view.px(0)
  const originY = view.py(0)

  // ---------------- 1. 两种介质底色 ----------------
  ctx.save()
  ctx.fillStyle = palette.medium1Tint
  ctx.fillRect(plot.left, plot.top, plot.width, originY - plot.top)
  ctx.fillStyle = palette.medium2Tint
  ctx.fillRect(plot.left, originY, plot.width, plot.bottom - originY)
  ctx.restore()

  // ---------------- 2. 网格与坐标轴 ----------------
  drawGridAndAxes(ctx, view, palette, { axisLabel: 'x (mm)', targetTicksX: 8 })

  // ---------------- 3. 界面与法线 ----------------
  ctx.save()
  ctx.strokeStyle = palette.surface
  ctx.lineWidth = 1.8
  ctx.beginPath()
  ctx.moveTo(plot.left, originY)
  ctx.lineTo(plot.right, originY)
  ctx.stroke()
  ctx.restore()

  if (options.showAuxiliary) {
    ctx.save()
    ctx.strokeStyle = palette.normal
    ctx.setLineDash([5, 4])
    ctx.lineWidth = 1
    ctx.globalAlpha = 0.85
    ctx.beginPath()
    ctx.moveTo(originX, plot.top)
    ctx.lineTo(originX, plot.bottom)
    ctx.stroke()
    ctx.restore()
    drawChip(ctx, '法线 Normal', originX + 5, plot.top + 4, palette, {
      align: 'left',
      baseline: 'top',
      color: palette.normal,
      size: 9.5,
    })
  }

  // 介质标签
  drawChip(ctx, `介质 1 Medium 1  n₁ = ${result.n1.toFixed(4)}  ${options.medium1Name}`, plot.left + 6, originY - 6, palette, {
    align: 'left',
    baseline: 'bottom',
    color: palette.textSecondary,
    size: 10,
  })
  drawChip(ctx, `介质 2 Medium 2  n₂ = ${result.n2.toFixed(4)}  ${options.medium2Name}`, plot.left + 6, originY + 6, palette, {
    align: 'left',
    baseline: 'top',
    color: palette.textSecondary,
    size: 10,
  })

  // ---------------- 4. 临界角参考方向 ----------------
  if (options.showCriticalAngle && result.criticalAngleDeg !== null) {
    const c = (result.criticalAngleDeg * Math.PI) / 180
    const end = { x: Math.sin(c) * RAY_LEN, y: -Math.cos(c) * RAY_LEN }
    strokeSegment(ctx, view, { x: 0, y: 0 }, end, palette.rayBlocked, 1, [4, 4], 0.55)
    drawChip(ctx, `θc = ${fmtDeg(result.criticalAngleDeg, 2)}`, view.px(end.x) + 4, view.py(end.y), palette, {
      align: 'left',
      baseline: 'middle',
      color: palette.rayBlocked,
      size: 9.5,
    })
  }

  // ---------------- 5. 三条光线 ----------------
  const d1 = result.directions.incident
  const d3 = result.directions.reflected
  const start1 = { x: -d1.x * RAY_LEN, y: -d1.y * RAY_LEN }

  // 反射光线：线宽随反射率增加（真实数据）
  const reflWidth = 1.2 + 2.4 * result.fresnel.R
  strokeSegment(ctx, view, { x: 0, y: 0 }, { x: d3.x * RAY_LEN, y: d3.y * RAY_LEN }, palette.rayReflected, reflWidth, null, 1)
  arrowAt(ctx, view, { x: 0, y: 0 }, { x: d3.x * RAY_LEN, y: d3.y * RAY_LEN }, palette.rayReflected, 0.45)

  // 入射光线
  strokeSegment(ctx, view, start1, { x: 0, y: 0 }, palette.rayIncident, 1.8)
  arrowAt(ctx, view, start1, { x: 0, y: 0 }, palette.rayIncident, 0.62)

  // 折射光线（全反射时不存在）
  if (result.directions.refracted) {
    const d2 = result.directions.refracted
    const end = { x: d2.x * RAY_LEN, y: d2.y * RAY_LEN }
    const refrWidth = 1.2 + 2.4 * result.fresnel.T
    strokeSegment(ctx, view, { x: 0, y: 0 }, end, palette.rayRefracted, refrWidth)
    arrowAt(ctx, view, { x: 0, y: 0 }, end, palette.rayRefracted, 0.45)
  }

  drawDot(ctx, view, 0, 0, 3.2, palette.textPrimary)

  // ---------------- 6. 角度圆弧与标注 ----------------
  const arcR = Math.min(58, Math.max(34, Math.min(plot.width, plot.height) * 0.18))
  // 入射角：法线向上(−90°) ↔ 入射光线反向延长方向
  const aIn = Math.atan2(-Math.cos(result.theta1Rad), -Math.sin(result.theta1Rad))
  drawAngleArc(
    ctx, palette, originX, originY, arcR, aIn, -Math.PI / 2,
    palette.rayIncident, `θ₁ ${fmtDeg(result.theta1Deg, 1)}`,
  )

  // 反射角：法线向上 ↔ 反射光线方向
  const aRefl = Math.atan2(-Math.cos(result.theta1Rad), Math.sin(result.theta1Rad))
  drawAngleArc(
    ctx, palette, originX, originY, arcR * 0.86, -Math.PI / 2, aRefl,
    palette.rayReflected, `θ₁′ ${fmtDeg(result.thetaReflectDeg, 1)}`,
  )

  // 折射角：法线向下(+90°) ↔ 折射光线方向
  if (result.theta2Rad !== null) {
    const aRefr = Math.atan2(Math.cos(result.theta2Rad), Math.sin(result.theta2Rad))
    drawAngleArc(
      ctx, palette, originX, originY, arcR * 1.1, Math.PI / 2, aRefr,
      palette.rayRefracted, `θ₂ ${fmtDeg(result.theta2Deg, 1)}`,
    )
  }

  // ---------------- 7. 状态提示 ----------------
  if (result.isTIR) {
    drawChip(
      ctx,
      `全反射 TIR · sinθ₂ = ${fmt(result.sinTheta2, 3)} > 1 · R = 100%`,
      plot.right - 6,
      plot.top + 6,
      palette,
      { align: 'right', baseline: 'top', color: palette.rayBlocked, size: 10.5 },
    )
  } else if (result.criticalAngleDeg !== null) {
    drawChip(
      ctx,
      `临界角 θc = ${fmtDeg(result.criticalAngleDeg, 2)} · 反射率 R = ${(result.fresnel.R * 100).toFixed(1)}%`,
      plot.right - 6,
      plot.top + 6,
      palette,
      { align: 'right', baseline: 'top', color: palette.rayBlocked, size: 10 },
    )
  } else {
    drawChip(
      ctx,
      `光疏 → 光密：不存在临界角 · R = ${(result.fresnel.R * 100).toFixed(1)}%`,
      plot.right - 6,
      plot.top + 6,
      palette,
      { align: 'right', baseline: 'top', color: palette.textSecondary, size: 10 },
    )
  }

  // 光强占比说明（线宽编码）——由图例区以 HTML 标注，画布内不再重复
}

/** 画角度圆弧与标签 */
function drawAngleArc(
  ctx: CanvasRenderingContext2D,
  palette: ScenePalette,
  cx: number,
  cy: number,
  radius: number,
  a1: number,
  a2: number,
  color: string,
  label: string,
): void {
  const start = Math.min(a1, a2)
  const end = Math.max(a1, a2)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end - start < 0.004) return
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 1.1
  ctx.globalAlpha = 0.9
  ctx.beginPath()
  ctx.arc(cx, cy, radius, start, end)
  ctx.stroke()
  ctx.restore()

  const mid = (start + end) / 2
  const lx = cx + Math.cos(mid) * (radius + 18)
  const ly = cy + Math.sin(mid) * (radius + 18)
  drawChip(ctx, label, lx, ly, palette, {
    align: 'center',
    baseline: 'middle',
    color,
    size: 9.5,
  })
}

/** 在线段上按比例位置画方向箭头 */
function arrowAt(
  ctx: CanvasRenderingContext2D,
  view: ReturnType<typeof createViewport>,
  from: { x: number; y: number },
  to: { x: number; y: number },
  color: string,
  ratio: number,
): void {
  const ax = view.px(from.x)
  const ay = view.py(from.y)
  const bx = view.px(to.x)
  const by = view.py(to.y)
  if (![ax, ay, bx, by].every(Number.isFinite)) return
  if (Math.hypot(bx - ax, by - ay) < 24) return
  const px = ax + (bx - ax) * ratio
  const py = ay + (by - ay) * ratio
  drawArrowHead(ctx, px, py, Math.atan2(by - ay, bx - ax), 5.5, color)
}

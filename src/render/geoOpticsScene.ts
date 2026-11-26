/**
 * 模块一：薄透镜光路场景渲染。
 *
 * 渲染职责与计算职责严格分离：
 *   - 计算（core/optics/thinLens.ts）给出光线的世界坐标线段；
 *   - 本文件只负责坐标映射、图元绘制与标注排版。
 *
 * 图元约定：
 *   实线      = 真实光路
 *   虚线      = 虚像的反向延长线（非真实光路）
 *   半透明    = 被通光口径遮挡的主光线（示意用）
 */

import type { ThinLensResult } from '../core/optics/thinLens'
import { clipSegmentX } from '../core/geometry'
import { fmt } from '../core/format'
import type { ScenePalette } from './palette'
import { boundsFromPoints, createViewport } from './viewport'
import type { Bounds } from './viewport'
import type { Size } from './draw'
import {
  clearStage,
  drawArrowHead,
  drawChip,
  drawDimension,
  drawDot,
  drawEmptyState,
  drawGridAndAxes,
  drawScaleBar,
  drawVerticalArrow,
  fontMono,
  strokeSegment,
} from './draw'

export interface GeoSceneOptions {
  showPrincipalRays: boolean
  showBundleRays: boolean
  showVirtualExtensions: boolean
  showAnnotations: boolean
  showImagePlane: boolean
}

const ROLE_COLOR_KEY = {
  parallel: 'rayIncident',
  center: 'rayCenter',
  focal: 'rayRefracted',
  bundle: 'rayBundle',
} as const

/** 光路示意图允许的纵向拉伸（几何光学图表的常规做法，界面会标注实际倍率） */
export const GEO_STRETCH_OPTIONS = { allowStretchY: true, maxStretchY: 6 }

/**
 * 计算光路场景需要覆盖的世界范围。
 * 渲染层与界面标注（纵向放大倍率）共用此函数，保证两边对同一画面得出一致结论。
 */
export function computeGeoSceneBounds(result: ThinLensResult, options: GeoSceneOptions): Bounds {
  const xs = result.bounds
  const points: Array<{ x: number; y: number }> = [
    { x: xs.xMin, y: 0 },
    { x: xs.xMax, y: 0 },
    { x: -result.objectDistance, y: result.objectHeight },
    { x: 0, y: result.apertureRadius },
    { x: 0, y: -result.apertureRadius },
  ]
  if (result.image.z !== null && result.image.height !== null) {
    points.push({ x: result.image.z, y: result.image.height })
  }
  const rayList = [
    ...(options.showPrincipalRays ? result.principalRays : []),
    ...(options.showBundleRays ? result.bundleRays : []),
  ]
  for (const ray of rayList) {
    for (const seg of ray.segments) {
      if (seg.dashed && !options.showVirtualExtensions) continue
      const clipped = clipSegmentX({ from: seg.from, to: seg.to }, xs.xMin, xs.xMax)
      if (clipped) points.push(clipped.from, clipped.to)
    }
  }
  const bounds = boundsFromPoints(points, 0.06)
  // 保证竖直方向至少有 4 mm 的显示范围，避免极扁物体被放大到失真
  if (bounds.yMax - bounds.yMin < 4) {
    const mid = (bounds.yMax + bounds.yMin) / 2
    bounds.yMin = mid - 2
    bounds.yMax = mid + 2
  }
  return bounds
}

export function drawGeoOpticsScene(
  ctx: CanvasRenderingContext2D,
  size: Size,
  result: ThinLensResult,
  options: GeoSceneOptions,
  palette: ScenePalette,
): void {
  clearStage(ctx, size, palette)

  if (!result.ok) {
    drawEmptyState(
      ctx,
      size,
      palette,
      '参数非法，无法生成光路',
      result.errors[0] ?? '请检查右侧参数面板',
    )
    return
  }

  const { w, h } = size

  // ---------------- 1. 决定要绘制的光线，并按内容计算自适应视口 ----------------
  type RayWithKind = { ray: ThinLensResult['principalRays'][number]; principal: boolean }
  const rays: RayWithKind[] = []
  if (options.showPrincipalRays) {
    for (const ray of result.principalRays) rays.push({ ray, principal: true })
  }
  if (options.showBundleRays) {
    for (const ray of result.bundleRays) rays.push({ ray, principal: false })
  }

  const bounds = computeGeoSceneBounds(result, options)
  const view = createViewport(w, h, bounds, GEO_STRETCH_OPTIONS)

  // ---------------- 2. 背景网格与坐标轴 ----------------
  drawGridAndAxes(ctx, view, palette, { axisLabel: 'z (mm)', targetTicksX: 8 })

  // ---------------- 3. 透镜 ----------------
  drawLens(ctx, view, result, palette)

  // ---------------- 4. 焦点 / 像面 参考标记 ----------------
  if (options.showAnnotations) {
    drawFocalMarkers(ctx, view, result, palette)
  }
  if (options.showImagePlane && result.image.z !== null) {
    const px = view.px(result.image.z)
    ctx.save()
    ctx.strokeStyle = palette.accent
    ctx.globalAlpha = 0.55
    ctx.setLineDash([3, 3])
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(px, view.plot.top)
    ctx.lineTo(px, view.plot.bottom)
    ctx.stroke()
    ctx.restore()
    drawChip(ctx, '像面 Image Plane', px, view.plot.top + 2, palette, {
      align: 'center',
      baseline: 'top',
      color: palette.accent,
      size: 9.5,
    })
  }

  // ---------------- 5. 光线 ----------------
  for (const item of rays) {
    const { ray, principal } = item
    const color = palette[ROLE_COLOR_KEY[ray.role]]
    // 光锥较细较淡，主光线粗且醒目
    const width = principal ? 1.7 : 1
    let alpha = principal ? 1 : 0.5
    if (ray.blocked && principal) alpha = 0.34

    for (const seg of ray.segments) {
      if (seg.dashed) {
        if (!options.showVirtualExtensions) continue
        strokeSegment(ctx, view, seg.from, seg.to, palette.rayVirtual, 1, [5, 4], 0.8)
        continue
      }
      strokeSegment(ctx, view, seg.from, seg.to, color, width, null, alpha)
    }

    // 主光线加传播方向箭头，便于说明「光往哪走」
    if (principal && alpha > 0.5) {
      drawDirectionArrow(ctx, view, ray.segments[0], color, 0.62)
      const exit = ray.segments[1]
      if (exit) drawDirectionArrow(ctx, view, exit, color, 0.28)
    }

    // 被遮挡的主光线在透镜平面处打叉
    if (ray.blocked && principal) {
      const px = view.px(0)
      const py = view.py(ray.apertureHeight)
      ctx.save()
      ctx.strokeStyle = palette.rayBlocked
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.moveTo(px - 4, py - 4)
      ctx.lineTo(px + 4, py + 4)
      ctx.moveTo(px + 4, py - 4)
      ctx.lineTo(px - 4, py + 4)
      ctx.stroke()
      ctx.restore()
    }
  }

  // ---------------- 6. 物 / 像 ----------------
  const objPx = view.px(-result.objectDistance)
  drawVerticalArrow(
    ctx,
    view,
    -result.objectDistance,
    0,
    result.objectHeight,
    palette.objectArrow,
    { width: 2.2, dash: null, headSize: 7 },
  )
  if (options.showAnnotations) {
    drawChip(ctx, `物体 Object  h=${fmt(result.objectHeight, 1)}mm`, objPx, view.plot.top + 4, palette, {
      align: 'left',
      baseline: 'top',
      color: palette.objectArrow,
      size: 9.5,
    })
  }

  if (result.image.z !== null && result.image.height !== null) {
    const isVirtual = result.image.status === 'virtual'
    const color = isVirtual ? palette.imageVirtual : palette.imageArrow
    drawVerticalArrow(ctx, view, result.image.z, 0, result.image.height, color, {
      width: 2.2,
      dash: isVirtual ? [5, 4] : null,
      headSize: 7,
    })
    if (options.showAnnotations) {
      const label = `${isVirtual ? '虚像 Virtual' : '实像 Real'}  h′=${fmt(result.image.height, 1)}mm`
      drawChip(ctx, label, view.px(result.image.z), view.py(result.image.height) - 6, palette, {
        align: 'center',
        baseline: 'bottom',
        color,
        size: 9.5,
      })
    }
  } else if (result.image.status === 'infinite' && options.showAnnotations) {
    drawChip(ctx, '出射光平行于光轴 · 像在无穷远', view.plot.right - 6, view.plot.top + 26, palette, {
      align: 'right',
      baseline: 'top',
      color: palette.rayBlocked,
      size: 9.5,
    })
  }

  // ---------------- 7. 尺寸标注（物距 / 像距） ----------------
  if (options.showAnnotations) {
    const axisY = view.py(0)
    const baseY = axisY + 46 < view.plot.bottom ? axisY : view.plot.bottom - 46
    drawDimension(ctx, view, -result.objectDistance, 0, baseY + 16, `u = ${fmt(result.objectDistance, 1)} mm`, palette.objectArrow, palette)
    if (result.image.z !== null) {
      const color = result.image.status === 'virtual' ? palette.imageVirtual : palette.imageArrow
      drawDimension(ctx, view, 0, result.image.z, baseY + 34, `v = ${fmt(result.image.distance ?? 0, 1)} mm`, color, palette)
    }
  }

  // ---------------- 8. 比例尺 ----------------
  drawScaleBar(ctx, view, palette)
}

/** 透镜符号：凸透镜用两道向外凸的曲线，凹透镜用向内凹的曲线 */
function drawLens(
  ctx: CanvasRenderingContext2D,
  view: ReturnType<typeof createViewport>,
  result: ThinLensResult,
  palette: ScenePalette,
): void {
  const x0 = view.px(0)
  const yTop = view.py(result.apertureRadius)
  const yBot = view.py(-result.apertureRadius)
  const halfH = Math.abs(yBot - yTop) / 2
  const midY = (yTop + yBot) / 2
  const t = Math.max(3.5, Math.min(13, halfH * 0.2))

  ctx.save()
  ctx.beginPath()
  if (result.focalLengthSigned > 0) {
    // 双凸（会聚）
    ctx.moveTo(x0, yTop)
    ctx.quadraticCurveTo(x0 + t * 2, midY, x0, yBot)
    ctx.quadraticCurveTo(x0 - t * 2, midY, x0, yTop)
  } else {
    // 双凹（发散）
    ctx.moveTo(x0 - t, yTop)
    ctx.lineTo(x0 + t, yTop)
    ctx.quadraticCurveTo(x0 - t * 0.4, midY, x0 + t, yBot)
    ctx.lineTo(x0 - t, yBot)
    ctx.quadraticCurveTo(x0 + t * 0.4, midY, x0 - t, yTop)
  }
  ctx.closePath()
  ctx.fillStyle = palette.lensFill
  ctx.fill()
  ctx.strokeStyle = palette.lensStroke
  ctx.lineWidth = 1.6
  ctx.stroke()

  // 通光口径端点（镜框 / 光阑位置）
  ctx.strokeStyle = palette.lensStroke
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x0 - 7, yTop)
  ctx.lineTo(x0 + 7, yTop)
  ctx.moveTo(x0 - 7, yBot)
  ctx.lineTo(x0 + 7, yBot)
  ctx.stroke()
  ctx.restore()
}

/** 焦点标记：物方焦点 F（z = −f）与像方焦点 F′（z = +f） */
function drawFocalMarkers(
  ctx: CanvasRenderingContext2D,
  view: ReturnType<typeof createViewport>,
  result: ThinLensResult,
  palette: ScenePalette,
): void {
  const { xMin, xMax } = view.bounds
  const marks: Array<{ z: number; text: string }> = [
    { z: result.focalPoints.objectSideZ, text: 'F' },
    { z: result.focalPoints.imageSideZ, text: 'F′' },
  ]
  for (const mark of marks) {
    if (mark.z < xMin || mark.z > xMax) continue
    drawDot(ctx, view, mark.z, 0, 3, palette.marker, true)
    drawChip(ctx, mark.text, view.px(mark.z), view.py(0) + 16, palette, {
      align: 'center',
      baseline: 'top',
      color: palette.marker,
      size: 9.5,
    })
  }
  // 焦距标注
  drawChip(
    ctx,
    `f = ${fmt(Math.abs(result.focalLengthSigned), 1)} mm`,
    view.px(0),
    view.plot.top + 4,
    palette,
    { align: 'center', baseline: 'top', color: palette.lensStroke, size: 9.5 },
  )
}

/** 在线段上取比例位置画方向箭头 */
function drawDirectionArrow(
  ctx: CanvasRenderingContext2D,
  view: ReturnType<typeof createViewport>,
  seg: { from: { x: number; y: number }; to: { x: number; y: number } },
  color: string,
  ratio: number,
): void {
  const ax = view.px(seg.from.x)
  const ay = view.py(seg.from.y)
  const bx = view.px(seg.to.x)
  const by = view.py(seg.to.y)
  if (![ax, ay, bx, by].every(Number.isFinite)) return
  const len = Math.hypot(bx - ax, by - ay)
  if (len < 26) return
  const px = ax + (bx - ax) * ratio
  const py = ay + (by - ay) * ratio
  drawArrowHead(ctx, px, py, Math.atan2(by - ay, bx - ax), 5.5, color)
}

/** 图例用的光线样式表（HTML 图例与画布配色保持一致） */
export const GEO_RAY_LEGEND = [
  { key: 'parallel', colorVar: 'ray-incident', label: '平行光轴光线', labelEn: 'parallel ray', dashed: false },
  { key: 'center', colorVar: 'ray-center', label: '过光心光线', labelEn: 'chief ray', dashed: false },
  { key: 'focal', colorVar: 'ray-refracted', label: '过焦点光线', labelEn: 'focal ray', dashed: false },
  { key: 'bundle', colorVar: 'ray-bundle', label: '光锥采样', labelEn: 'ray bundle', dashed: false },
  { key: 'virtual', colorVar: 'ray-virtual', label: '虚像延长线', labelEn: 'virtual extension', dashed: true },
] as const

/** 舞台左下角提示文字用的字体（供模块覆盖层复用） */
export const SCENE_FONT = fontMono(10)

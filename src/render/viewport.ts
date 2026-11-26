/**
 * 世界坐标（mm）→ 屏幕坐标（CSS px）的自适应视口。
 *
 * 需求「光路自动缩放」由本模块实现：
 *   1. 先由物理计算结果给出需要显示的世界范围 bounds；
 *   2. 横向等比缩放，保证物距 / 像距的长度关系不被压缩；
 *   3. 纵向允许有限倍率拉伸（几何光学光路图的常规做法）：
 *      典型工况下横向跨度可达数百 mm，而通光口径只有几十 mm，
 *      若严格等比，光路会被压成一条细线，无法观察。
 *      拉伸倍率会以「纵向放大 N×」标注在界面上，属于**明确标注的示意处理**，
 *      所有数值结果仍来自严格计算，不受显示拉伸影响；
 *   4. 对退化范围（宽或高为 0）与极端缩放做保护，杜绝 Infinity/NaN 传播到画布。
 */

export interface Bounds {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
}

export interface ViewportOptions {
  /** 是否允许纵向拉伸（仅光路示意图开启） */
  allowStretchY?: boolean
  /** 纵向最大拉伸倍率，默认 6 */
  maxStretchY?: number
}

export interface ScalePlan {
  bounds: Bounds
  padX: number
  padY: number
  availW: number
  availH: number
  scaleX: number
  scaleY: number
  /** 纵向拉伸倍率 = scaleY / scaleX，1 表示严格等比 */
  stretch: number
}

export interface Viewport {
  scaleX: number
  scaleY: number
  /** 兼容取值：等于 scaleX（横向缩放） */
  scale: number
  stretch: number
  width: number
  height: number
  bounds: Bounds
  /** 世界 x（光轴方向，mm）→ 屏幕 x（px） */
  px(worldX: number): number
  /** 世界 y（高度方向，mm）→ 屏幕 y（px，注意屏幕 y 向下为正） */
  py(worldY: number): number
  /** 屏幕 x → 世界 x */
  wx(screenX: number): number
  /** 屏幕 y → 世界 y */
  wy(screenY: number): number
  /** 绘图区域（不含边距）的像素矩形 */
  plot: { left: number; top: number; right: number; bottom: number; width: number; height: number }
}

const MIN_SPAN = 1e-6
const MAX_SCALE = 400

function sanitize(bounds: Bounds): Bounds {
  let xMin = Math.min(bounds.xMin, bounds.xMax)
  let xMax = Math.max(bounds.xMin, bounds.xMax)
  let yMin = Math.min(bounds.yMin, bounds.yMax)
  let yMax = Math.max(bounds.yMin, bounds.yMax)

  if (!Number.isFinite(xMax - xMin) || xMax - xMin < MIN_SPAN) {
    const c = Number.isFinite(xMin) ? xMin : 0
    xMin = c - 1
    xMax = c + 1
  }
  if (!Number.isFinite(yMax - yMin) || yMax - yMin < MIN_SPAN) {
    const c = Number.isFinite(yMin) ? yMin : 0
    yMin = c - 1
    yMax = c + 1
  }
  return { xMin, xMax, yMin, yMax }
}

/**
 * 计算缩放方案（纯函数，渲染层与界面标注共用，保证两边得到同一结论）。
 */
export function planScale(
  width: number,
  height: number,
  rawBounds: Bounds,
  options: ViewportOptions = {},
): ScalePlan {
  const w = Math.max(1, width)
  const h = Math.max(1, height)
  const bounds = sanitize(rawBounds)

  const padX = Math.min(58, Math.max(16, w * 0.07))
  const padY = Math.min(34, Math.max(14, h * 0.075))
  const availW = Math.max(10, w - padX * 2)
  const availH = Math.max(10, h - padY * 2)

  const spanX = bounds.xMax - bounds.xMin
  const spanY = bounds.yMax - bounds.yMin

  const fitX = availW / spanX
  const fitY = availH / spanY

  let scaleX = Math.min(fitX, fitY)
  if (!Number.isFinite(scaleX) || scaleX <= 0) scaleX = 1
  scaleX = Math.min(scaleX, MAX_SCALE)

  let scaleY = scaleX
  if (options.allowStretchY && fitY > scaleX) {
    const maxStretch = options.maxStretchY ?? 6
    scaleY = Math.min(fitY, scaleX * maxStretch, MAX_SCALE)
  }

  return {
    bounds,
    padX,
    padY,
    availW,
    availH,
    scaleX,
    scaleY,
    stretch: scaleX > 0 ? scaleY / scaleX : 1,
  }
}

export function createViewport(
  width: number,
  height: number,
  bounds: Bounds,
  options: ViewportOptions = {},
): Viewport {
  const plan = planScale(width, height, bounds, options)
  const { scaleX, scaleY, padX, padY, availW, availH } = plan
  const b = plan.bounds

  const cx = (b.xMin + b.xMax) / 2
  const cy = (b.yMin + b.yMax) / 2
  const screenCx = padX + availW / 2
  const screenCy = padY + availH / 2

  return {
    scaleX,
    scaleY,
    scale: scaleX,
    stretch: plan.stretch,
    width: Math.max(1, width),
    height: Math.max(1, height),
    bounds: b,
    px: (worldX: number) => screenCx + (worldX - cx) * scaleX,
    py: (worldY: number) => screenCy - (worldY - cy) * scaleY,
    wx: (screenX: number) => cx + (screenX - screenCx) / scaleX,
    wy: (screenY: number) => cy - (screenY - screenCy) / scaleY,
    plot: {
      left: padX,
      top: padY,
      right: Math.max(1, width) - padX,
      bottom: Math.max(1, height) - padY,
      width: availW,
      height: availH,
    },
  }
}

/** 由一组世界坐标点估算包围盒（忽略非有限值） */
export function boundsFromPoints(points: Array<{ x: number; y: number }>, padRatio = 0.08): Bounds {
  let xMin = Number.POSITIVE_INFINITY
  let xMax = Number.NEGATIVE_INFINITY
  let yMin = Number.POSITIVE_INFINITY
  let yMax = Number.NEGATIVE_INFINITY
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
    if (p.x < xMin) xMin = p.x
    if (p.x > xMax) xMax = p.x
    if (p.y < yMin) yMin = p.y
    if (p.y > yMax) yMax = p.y
  }
  if (!Number.isFinite(xMin) || !Number.isFinite(xMax)) {
    return { xMin: -1, xMax: 1, yMin: -1, yMax: 1 }
  }
  if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) {
    yMin = -1
    yMax = 1
  }
  const padX = Math.max(0.5, (xMax - xMin) * padRatio)
  const padY = Math.max(0.5, (yMax - yMin) * padRatio)
  return { xMin: xMin - padX, xMax: xMax + padX, yMin: yMin - padY, yMax: yMax + padY }
}

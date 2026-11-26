/**
 * 二维几何基础工具：向量、线段裁剪、网格步长、采样。
 * 坐标系约定（所有光学场景共用）：
 *   x 轴 = 光轴 / 界面方向，向右为正，单位 mm
 *   y 轴 = 垂直光轴方向（高度），向上为正，单位 mm
 */

export interface Vec2 {
  x: number
  y: number
}

export interface Segment {
  from: Vec2
  to: Vec2
}

export function vec(x: number, y: number): Vec2 {
  return { x, y }
}

/** 在 [a, b] 上均匀取 n 个点（含端点）；n < 2 时返回端点 */
export function linspace(a: number, b: number, n: number): number[] {
  const count = Math.max(2, Math.round(n))
  const out = new Array<number>(count)
  for (let i = 0; i < count; i += 1) {
    out[i] = a + ((b - a) * i) / (count - 1)
  }
  return out
}

/**
 * 计算「好看」的网格步长：返回 1/2/5 × 10^k 形式中不小于 range/targetTicks 的最小值。
 * 用于绘制带单位标注的工程网格。
 */
export function niceStep(range: number, targetTicks = 8): number {
  if (!Number.isFinite(range) || range <= 0) return 1
  const rough = range / Math.max(1, targetTicks)
  const mag = Math.pow(10, Math.floor(Math.log10(rough)))
  const norm = rough / mag
  let step: number
  if (norm <= 1) step = 1
  else if (norm <= 2) step = 2
  else if (norm <= 5) step = 5
  else step = 10
  return step * mag
}

/**
 * 用 x ∈ [xMin, xMax] 竖直边界裁剪线段（Liang–Barsky 的 x 向简化版）。
 * 返回 null 表示线段完全落在窗口外。
 * 用途：自适应缩放的视口通常只关心窗口内的坐标范围，需要先裁剪再统计 y 范围。
 */
export function clipSegmentX(seg: Segment, xMin: number, xMax: number): Segment | null {
  const { from, to } = seg
  const dx = to.x - from.x
  if (Math.abs(dx) < 1e-12) {
    // 垂直线段：只要 x 在窗口内就保留
    if (from.x < xMin || from.x > xMax) return null
    return { from: { ...from }, to: { ...to } }
  }
  let t0 = 0
  let t1 = 1
  const p = [-dx, dx]
  const q = [from.x - xMin, xMax - from.x]
  for (let i = 0; i < 2; i += 1) {
    if (Math.abs(p[i]) < 1e-12) {
      if (q[i] < 0) return null
      continue
    }
    const r = q[i] / p[i]
    if (p[i] < 0) {
      if (r > t1) return null
      if (r > t0) t0 = r
    } else {
      if (r < t0) return null
      if (r < t1) t1 = r
    }
  }
  return {
    from: { x: from.x + t0 * dx, y: from.y + t0 * (to.y - from.y) },
    to: { x: from.x + t1 * dx, y: from.y + t1 * (to.y - from.y) },
  }
}

/** 两点距离 */
export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/** 线性插值 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

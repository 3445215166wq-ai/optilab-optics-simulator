/**
 * 基础数值工具（角度 / 单位换算 / 合法性判定）
 * 约定：所有光学长度统一使用毫米 (mm)，波长使用纳米 (nm)，角度对外使用度 (deg)。
 */

/** 1 度对应的弧度值 */
export const DEG = Math.PI / 180

/** 弧度 → 度 */
export function toDeg(rad: number): number {
  return rad / DEG
}

/** 度 → 弧度 */
export function toRad(deg: number): number {
  return deg * DEG
}

/** 把数值限制在 [lo, hi] 区间内 */
export function clamp(value: number, lo: number, hi: number): number {
  if (!Number.isFinite(value)) return lo
  return Math.min(hi, Math.max(lo, value))
}

/** 严格判断一个值是可用的有限数值 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** 判断两个数在相对误差容限内是否相等 */
export function approxEqual(a: number, b: number, relTol = 1e-9, absTol = 1e-12): boolean {
  if (!isNumber(a) || !isNumber(b)) return false
  return Math.abs(a - b) <= Math.max(absTol, relTol * Math.max(Math.abs(a), Math.abs(b)))
}

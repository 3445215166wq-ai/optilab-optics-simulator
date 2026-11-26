/**
 * 数值格式化：仪器面板上显示的文本统一从这里产生，
 * 保证「无数据 / 无穷远 / 指数过大」等边界情况都有明确显示，而不是 NaN。
 */

const DASH = '—'

/** 常规数值格式化；digits 为小数位。null/undefined/NaN → '—'，无穷 → '±∞' */
export function fmt(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined) return DASH
  if (typeof value !== 'number' || Number.isNaN(value)) return DASH
  if (!Number.isFinite(value)) return value > 0 ? '+∞' : '−∞'
  const abs = Math.abs(value)
  // 过大或过小的量级改用科学计数法，避免面板被长数字撑破
  if (abs !== 0 && (abs >= 1e6 || abs < 1e-3)) {
    return trimExp(value.toExponential(2))
  }
  const text = value.toFixed(digits)
  // 避免出现 "-0.00" 这种显示
  return text === `-${(0).toFixed(digits)}` ? (0).toFixed(digits) : text
}

/** 整数格式化 */
export function fmtInt(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH
  return Math.round(value).toString()
}

/** 百分比格式化：0.534 → "53.4 %" */
export function fmtPercent(ratio: number | null | undefined, digits = 1): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return DASH
  return `${(ratio * 100).toFixed(digits)} %`
}

/** 角度格式化：32.054 → "32.05°" */
export function fmtDeg(deg: number | null | undefined, digits = 2): string {
  if (deg === null || deg === undefined || !Number.isFinite(deg)) return DASH
  return `${deg.toFixed(digits)}°`
}

/** 带符号显示（用于放大率等需要强调方向的量） */
export function fmtSigned(value: number | null | undefined, digits = 3): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH
  const text = value.toFixed(digits)
  return value > 0 ? `+${text}` : text
}

function trimExp(text: string): string {
  return text.replace('e+', 'e').replace(/\.?0+e/, 'e')
}

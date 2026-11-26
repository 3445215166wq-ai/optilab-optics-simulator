/**
 * 内置合成靶标（程序生成，不是真实照片）。
 *
 * 自动对焦需要「有足够高频细节」的靶标，否则清晰度曲线在焦平面附近会过于平坦。
 * 这里提供三类经典合成图案，全部由程序按几何公式生成（2×2 超采样抗锯齿）：
 *   siemens —— 西门子星：分辨率随半径线性提高，是镜头/对焦测试的标准靶标；
 *   bars    —— 分辨率条：若干不同周期的水平/垂直条纹块，便于观察方向性模糊；
 *   pcb     —— 合成 PCB 图形：焊盘、走线、丝印字符块，模拟工业视觉的典型被测物。
 *
 * ⚠️ 均为**程序生成的合成靶标**，不代表任何真实被测零件。
 */

import { createGray, type GrayImage } from './image'

export type TargetId = 'siemens' | 'bars' | 'pcb'

export interface TargetInfo {
  id: TargetId
  label: string
  labelEn: string
  note: string
}

export const TARGETS: TargetInfo[] = [
  {
    id: 'siemens',
    label: '西门子星',
    labelEn: 'Siemens star',
    note: '扇形分辨率随半径变化，对焦曲线的峰最尖锐，最适合做对焦算法验证',
  },
  {
    id: 'bars',
    label: '分辨率条',
    labelEn: 'Resolution bars',
    note: '多组不同周期的条纹块，可看方向性模糊与截止频率',
  },
  {
    id: 'pcb',
    label: '合成 PCB 图形',
    labelEn: 'Synthetic PCB',
    note: '焊盘 + 走线 + 丝印块，模拟工业视觉典型被测物',
  },
]

const SUB = 2 // 每像素 2×2 超采样

/** 生成靶标（size × size，灰度 [0,1]） */
export function buildTarget(id: TargetId, size = 256): GrayImage {
  const n = Math.max(32, Math.round(size))
  const img = createGray(n, n)
  const step = 1 / SUB
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      let acc = 0
      for (let sy = 0; sy < SUB; sy += 1) {
        for (let sx = 0; sx < SUB; sx += 1) {
          const px = x + (sx + 0.5) * step
          const py = y + (sy + 0.5) * step
          acc += sampleTarget(id, px / n, py / n)
        }
      }
      img.data[y * n + x] = acc / (SUB * SUB)
    }
  }
  return img
}

/** 归一化坐标 (u,v) ∈ [0,1)² → 灰度值 */
function sampleTarget(id: TargetId, u: number, v: number): number {
  switch (id) {
    case 'siemens':
      return siemensStar(u, v)
    case 'bars':
      return resolutionBars(u, v)
    case 'pcb':
      return pcbPattern(u, v)
    default:
      return 0.5
  }
}

/** 西门子星：θ 方向交替黑白扇形，中心留白 */
function siemensStar(u: number, v: number): number {
  const dx = u - 0.5
  const dy = v - 0.5
  const r = Math.hypot(dx, dy)
  if (r > 0.46) return 0.08 // 靶标外的暗背景
  if (r < 0.06) return 0.92 // 中心留白，避免太细分不出
  const sectors = 36
  const ang = Math.atan2(dy, dx) // −π..π
  const t = (ang + Math.PI) / (2 * Math.PI) // 0..1
  const idx = Math.floor(t * sectors)
  return idx % 2 === 0 ? 0.95 : 0.05
}

/** 分辨率条：4×4 宫格，每格一组不同周期的条纹（前两列竖直、后两列水平） */
function resolutionBars(u: number, v: number): number {
  const cellU = Math.floor(u * 4)
  const cellV = Math.floor(v * 4)
  const lu = u * 4 - cellU
  const lv = v * 4 - cellV
  // 格子之间的分隔线
  if (lu < 0.04 || lv < 0.04) return 0.15

  const period = 0.9 / (2 + cellU + cellV) // 频率随格子变化
  const vertical = cellU < 2
  const phase = vertical ? (lu - 0.04) / period : (lv - 0.04) / period
  const stripe = Math.floor(phase) % 2 === 0
  // 每格内留白边
  const inner = vertical ? lu > 0.1 && lu < 0.94 : lv > 0.1 && lv < 0.94
  return inner ? (stripe ? 0.95 : 0.05) : 0.85
}

/** 合成 PCB：暗底 + 焊盘圆 + 走线 + 丝印字符块 */
function pcbPattern(u: number, v: number): number {
  let value = 0.18 // 基板

  // 网格走线
  const traceW = 0.022
  for (let i = 1; i <= 3; i += 1) {
    const t = i / 4
    if (Math.abs(v - t) < traceW) value = Math.max(value, 0.62)
    if (Math.abs(u - t) < traceW) value = Math.max(value, 0.62)
  }

  // 焊盘
  const pads: Array<[number, number, number]> = [
    [0.16, 0.16, 0.07],
    [0.84, 0.16, 0.07],
    [0.16, 0.84, 0.07],
    [0.84, 0.84, 0.07],
    [0.5, 0.5, 0.1],
    [0.5, 0.16, 0.05],
    [0.5, 0.84, 0.05],
  ]
  for (const [px, py, pr] of pads) {
    if (Math.hypot(u - px, v - py) < pr) value = Math.max(value, 0.9)
  }

  // BGA 阵列（高频细节）
  const gridN = 6
  const gridSpan = 0.22
  const gx = (u - (0.5 - gridSpan / 2)) / gridSpan
  const gy = (v - (0.5 - gridSpan / 2)) / gridSpan
  if (gx > 0 && gx < 1 && gy > 0 && gy < 1) {
    const cellX = gx * gridN - Math.floor(gx * gridN)
    const cellY = gy * gridN - Math.floor(gy * gridN)
    const inDot = cellX > 0.28 && cellX < 0.72 && cellY > 0.28 && cellY < 0.72
    value = inDot ? 0.95 : 0.3
  }

  // 丝印字符块（模拟文字区域）
  if (u > 0.08 && u < 0.42 && v > 0.62 && v < 0.78) {
    const cell = Math.floor((u - 0.08) / 0.028)
    const inside = u - 0.08 - cell * 0.028
    value = inside < 0.016 ? 0.92 : 0.18
  }

  return value
}

/** 靶标特性说明（供界面显示） */
export function targetContrastNote(id: TargetId): string {
  switch (id) {
    case 'siemens':
      return '扇形黑白交替，半径越大线宽越细，是评价分辨率与对焦的经典靶标'
    case 'bars':
      return '不同周期与方向的条纹，可用于判断模糊的方向性（如运动模糊）'
    case 'pcb':
      return '焊盘/走线/丝印混合图案，接近工业视觉实际被测物的频率成分'
    default:
      return ''
  }
}

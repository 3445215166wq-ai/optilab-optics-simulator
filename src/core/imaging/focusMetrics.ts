/**
 * ============================================================================
 * 图像清晰度评价函数（自动对焦的核心）
 * ============================================================================
 *
 * 三种经典算法的共同思路：**图像越清晰 → 高频分量越强**，因此都可以用
 * 「梯度的某种能量」作为对焦评分，并在最佳焦点处取极大值。
 *
 *   ① Laplacian Variance（拉普拉斯方差）
 *        L(x,y) = I(x+1,y) + I(x-1,y) + I(x,y+1) + I(x,y-1) − 4·I(x,y)
 *        score  = Var(L)
 *      对噪声最敏感（二阶差分放大噪声），胜在实现简单、计算量小。
 *
 *   ② Tenengrad（梯度幅值平方和，Sobel）
 *        Gx = Sobel_x * I ,  Gy = Sobel_y * I
 *        score = mean(Gx² + Gy²)
 *      对噪声的抑制比 Laplacian 好，是最常用的工程选择。
 *
 *   ③ Brenner Gradient（Brenner 梯度）
 *        score = mean( [I(x+2,y) − I(x,y)]² )
 *      只看水平方向、跨 2 像素的差分，计算最省，适合高速对焦。
 *
 * 【注意】三者的量纲不同、数值范围也不同，界面上会比较「归一化后的曲线形状」，
 * 而不会直接横向比较原始分数。评分绝对值只对本模块自身有意义。
 * ============================================================================
 */

import type { GrayImage } from './image'

export type FocusMetricKind = 'laplacian' | 'tenengrad' | 'brenner'

export interface FocusMetricInfo {
  kind: FocusMetricKind
  label: string
  labelEn: string
  formula: string
  note: string
}

export const FOCUS_METRICS: FocusMetricInfo[] = [
  {
    kind: 'laplacian',
    label: '拉普拉斯方差',
    labelEn: 'Laplacian Variance',
    formula: 'L = I(x±1,y)+I(x,y±1) − 4I(x,y) ；score = Var(L)',
    note: '二阶差分，对噪声最敏感；计算量小，适合快速评估',
  },
  {
    kind: 'tenengrad',
    label: 'Tenengrad 梯度',
    labelEn: 'Tenengrad',
    formula: 'score = mean(Gx² + Gy²)，G 由 Sobel 算子求得',
    note: '一阶梯度能量，抗噪与灵敏度较均衡，工程上最常用',
  },
  {
    kind: 'brenner',
    label: 'Brenner 梯度',
    labelEn: 'Brenner Gradient',
    formula: 'score = mean([I(x+2,y) − I(x,y)]²)',
    note: '跨 2 像素的水平差分，计算最省，适合高速对焦',
  },
]

/** 拉普拉斯方差：二阶差分的方差 */
export function laplacianVariance(img: GrayImage): number {
  const { width: w, height: h, data } = img
  if (w < 3 || h < 3) return 0
  let sum = 0
  let sumSq = 0
  let count = 0
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const i = y * w + x
      const lap = data[i - 1] + data[i + 1] + data[i - w] + data[i + w] - 4 * data[i]
      sum += lap
      sumSq += lap * lap
      count += 1
    }
  }
  if (count === 0) return 0
  const mean = sum / count
  return sumSq / count - mean * mean
}

/** Tenengrad：Sobel 梯度幅值平方的均值 */
export function tenengrad(img: GrayImage): number {
  const { width: w, height: h, data } = img
  if (w < 3 || h < 3) return 0
  let acc = 0
  let count = 0
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const i = y * w + x
      const tl = data[i - w - 1]
      const tc = data[i - w]
      const tr = data[i - w + 1]
      const ml = data[i - 1]
      const mr = data[i + 1]
      const bl = data[i + w - 1]
      const bc = data[i + w]
      const br = data[i + w + 1]
      const gx = tr + 2 * mr + br - (tl + 2 * ml + bl)
      const gy = bl + 2 * bc + br - (tl + 2 * tc + tr)
      acc += gx * gx + gy * gy
      count += 1
    }
  }
  return count === 0 ? 0 : acc / count
}

/** Brenner 梯度：跨 2 像素水平差分的平方均值 */
export function brennerGradient(img: GrayImage): number {
  const { width: w, height: h, data } = img
  if (w < 3 || h < 1) return 0
  let acc = 0
  let count = 0
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w - 2; x += 1) {
      const i = y * w + x
      const d = data[i + 2] - data[i]
      acc += d * d
      count += 1
    }
  }
  return count === 0 ? 0 : acc / count
}

/** 按类型计算清晰度评分 */
export function evaluateFocus(img: GrayImage, kind: FocusMetricKind): number {
  switch (kind) {
    case 'laplacian':
      return laplacianVariance(img)
    case 'tenengrad':
      return tenengrad(img)
    case 'brenner':
      return brennerGradient(img)
    default:
      return 0
  }
}

/** 取得评价函数的中文名 */
export function focusMetricLabel(kind: FocusMetricKind): string {
  return FOCUS_METRICS.find((m) => m.kind === kind)?.label ?? kind
}

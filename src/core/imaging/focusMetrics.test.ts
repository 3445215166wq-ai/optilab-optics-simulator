import { describe, expect, it } from 'vitest'
import { createGray, type GrayImage } from './image'
import { buildTarget } from './targets'
import {
  FOCUS_METRICS,
  brennerGradient,
  evaluateFocus,
  focusMetricLabel,
  laplacianVariance,
  tenengrad,
  type FocusMetricKind,
} from './focusMetrics'
import { gaussianBlur } from './degradation'

function targetImage(size = 96): GrayImage {
  return buildTarget('siemens', size)
}

describe('清晰度评价函数 — 基本性质', () => {
  it('平坦图像三种评分都为 0', () => {
    const flat = createGray(32, 32, 0.5)
    expect(laplacianVariance(flat)).toBeCloseTo(0, 12)
    expect(tenengrad(flat)).toBeCloseTo(0, 12)
    expect(brennerGradient(flat)).toBeCloseTo(0, 12)
  })

  it('线性梯度图像：拉普拉斯为 0，一阶梯度不为 0（二阶/一阶差分的本质区别）', () => {
    const img = createGray(32, 32)
    for (let y = 0; y < 32; y += 1) {
      for (let x = 0; x < 32; x += 1) img.data[y * 32 + x] = 0.1 + (0.8 * x) / 31
    }
    expect(laplacianVariance(img)).toBeCloseTo(0, 10)
    expect(tenengrad(img)).toBeGreaterThan(0)
    expect(brennerGradient(img)).toBeGreaterThan(0)
  })

  it('尺寸过小返回 0 而不是 NaN', () => {
    expect(laplacianVariance(createGray(2, 2, 0.5))).toBe(0)
    expect(tenengrad(createGray(2, 2, 0.5))).toBe(0)
    expect(brennerGradient(createGray(2, 2, 0.5))).toBe(0)
    expect(laplacianVariance(createGray(0, 0))).toBe(0)
  })

  it('图像整体缩放对比度时，评分按平方规律变化（能量类指标）', () => {
    const img = targetImage()
    const half = createGray(img.width, img.height)
    for (let i = 0; i < img.data.length; i += 1) half.data[i] = 0.5 + (img.data[i] - 0.5) * 0.5
    // 对比度减半 → 梯度减半 → 平方后 1/4
    expect(tenengrad(half)).toBeCloseTo(tenengrad(img) / 4, 6)
    expect(laplacianVariance(half)).toBeCloseTo(laplacianVariance(img) / 4, 6)
  })
})

describe('清晰度评价函数 — 与模糊的单调关系（自动对焦的前提）', () => {
  const kinds: FocusMetricKind[] = ['laplacian', 'tenengrad', 'brenner']

  it.each(kinds)('%s：模糊越强评分越低', (kind) => {
    const img = targetImage()
    const scores = [0, 0.5, 1, 2, 3, 4].map((s) => evaluateFocus(s === 0 ? img : gaussianBlur(img, s), kind))
    for (let i = 1; i < scores.length; i += 1) {
      expect(scores[i]).toBeLessThan(scores[i - 1])
    }
    expect(scores[0]).toBeGreaterThan(0)
  })

  it('西门子星靶标在三种指标下都能区分清晰/模糊', () => {
    const img = targetImage()
    const blurred = gaussianBlur(img, 2.5)
    for (const kind of kinds) {
      const a = evaluateFocus(img, kind)
      const b = evaluateFocus(blurred, kind)
      expect(a / b).toBeGreaterThan(2)
    }
  })
})

describe('评价函数元数据', () => {
  it('三种函数都有中文名与公式说明', () => {
    expect(FOCUS_METRICS.length).toBe(3)
    for (const m of FOCUS_METRICS) {
      expect(m.label.length).toBeGreaterThan(0)
      expect(m.labelEn.length).toBeGreaterThan(0)
      expect(m.formula).toContain('score')
      expect(m.note.length).toBeGreaterThan(0)
    }
  })

  it('focusMetricLabel 返回可读名称；未知类型回退为原值', () => {
    expect(focusMetricLabel('laplacian')).toBe('拉普拉斯方差')
    expect(focusMetricLabel('tenengrad')).toBe('Tenengrad 梯度')
    expect(focusMetricLabel('brenner')).toBe('Brenner 梯度')
    expect(focusMetricLabel('unknown' as FocusMetricKind)).toBe('unknown')
  })

  it('evaluateFocus 对未知类型返回 0（不抛异常）', () => {
    expect(evaluateFocus(targetImage(32), 'nope' as FocusMetricKind)).toBe(0)
  })
})

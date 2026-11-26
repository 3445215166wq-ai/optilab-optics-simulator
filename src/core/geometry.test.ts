import { describe, expect, it } from 'vitest'
import { clipSegmentX, linspace, niceStep, distance } from './geometry'

describe('geometry / niceStep', () => {
  it('返回 1/2/5×10^k 形式的「整洁」步长', () => {
    expect(niceStep(100, 10)).toBe(10)
    expect(niceStep(90, 8)).toBe(20)
    expect(niceStep(1, 8)).toBe(0.2)
    expect(niceStep(0.03, 6)).toBeCloseTo(0.005, 12)
    for (const range of [0.7, 3.3, 17, 260, 4800]) {
      const step = niceStep(range, 8)
      const mantissa = step / Math.pow(10, Math.floor(Math.log10(step)))
      expect([1, 2, 5, 10]).toContain(Number(mantissa.toFixed(6)))
    }
  })

  it('非法范围返回安全默认值', () => {
    expect(niceStep(0)).toBe(1)
    expect(niceStep(Number.NaN)).toBe(1)
    expect(niceStep(-5)).toBe(1)
  })
})

describe('geometry / linspace', () => {
  it('包含端点且等间距', () => {
    const v = linspace(-20, 20, 5)
    expect(v).toEqual([-20, -10, 0, 10, 20])
  })

  it('n < 2 时退化为端点', () => {
    expect(linspace(0, 1, 1)).toEqual([0, 1])
  })
})

describe('geometry / clipSegmentX', () => {
  it('按 x 边界裁剪并保留斜率', () => {
    const seg = clipSegmentX({ from: { x: -10, y: 0 }, to: { x: 10, y: 10 } }, 0, 5)
    expect(seg).not.toBeNull()
    expect(seg?.from.x).toBeCloseTo(0, 12)
    expect(seg?.from.y).toBeCloseTo(5, 12)
    expect(seg?.to.x).toBeCloseTo(5, 12)
    expect(seg?.to.y).toBeCloseTo(7.5, 12)
  })

  it('完全落在窗口外的线段返回 null', () => {
    expect(clipSegmentX({ from: { x: 20, y: 0 }, to: { x: 30, y: 5 } }, 0, 10)).toBeNull()
  })

  it('垂直线段按 x 位置保留或丢弃', () => {
    const inside = clipSegmentX({ from: { x: 5, y: -3 }, to: { x: 5, y: 3 } }, 0, 10)
    expect(inside?.from.y).toBe(-3)
    expect(clipSegmentX({ from: { x: 50, y: -3 }, to: { x: 50, y: 3 } }, 0, 10)).toBeNull()
  })

  it('水平线段长度不变', () => {
    const seg = clipSegmentX({ from: { x: -5, y: 2 }, to: { x: 15, y: 2 } }, 0, 10)
    expect(seg?.from).toEqual({ x: 0, y: 2 })
    expect(seg?.to).toEqual({ x: 10, y: 2 })
    expect(distance(seg!.from, seg!.to)).toBeCloseTo(10, 12)
  })
})

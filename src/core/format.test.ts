import { describe, expect, it } from 'vitest'
import { fmt, fmtDeg, fmtInt, fmtPercent, fmtSigned } from './format'
import { approxEqual, clamp, toDeg, toRad } from './units'

describe('format', () => {
  it('空值与无穷远有明确显示', () => {
    expect(fmt(null)).toBe('—')
    expect(fmt(undefined)).toBe('—')
    expect(fmt(Number.NaN)).toBe('—')
    expect(fmt(Number.POSITIVE_INFINITY)).toBe('+∞')
    expect(fmt(Number.NEGATIVE_INFINITY)).toBe('−∞')
  })

  it('常规数值按位数固定小数', () => {
    expect(fmt(150, 2)).toBe('150.00')
    expect(fmt(-7.5, 1)).toBe('-7.5')
    expect(fmt(0, 3)).toBe('0.000')
  })

  it('极大/极小值使用科学计数法', () => {
    expect(fmt(1.2e7, 2)).toBe('1.2e7')
    expect(fmt(0.0005, 2)).toBe('5e-4')
  })

  it('百分数、角度、整数、带符号数值', () => {
    expect(fmtPercent(0.534, 1)).toBe('53.4 %')
    expect(fmtPercent(null)).toBe('—')
    expect(fmtDeg(32.0338)).toBe('32.03°')
    expect(fmtInt(11.6)).toBe('12')
    expect(fmtSigned(-0.5)).toBe('-0.500')
    expect(fmtSigned(0.5)).toBe('+0.500')
  })
})

describe('units', () => {
  it('角度换算互逆', () => {
    expect(toDeg(Math.PI)).toBeCloseTo(180, 12)
    expect(toRad(45)).toBeCloseTo(Math.PI / 4, 12)
    expect(toDeg(toRad(37.5))).toBeCloseTo(37.5, 12)
  })

  it('clamp 处理非法值', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-5, 0, 10)).toBe(0)
    expect(clamp(15, 0, 10)).toBe(10)
    expect(clamp(Number.NaN, 3, 10)).toBe(3)
  })

  it('approxEqual 相对容差', () => {
    expect(approxEqual(1e-13, 0)).toBe(true)
    expect(approxEqual(1e-9, 0)).toBe(false)
    expect(approxEqual(100.00000001, 100)).toBe(true)
    expect(approxEqual(100.1, 100)).toBe(false)
    expect(approxEqual(Number.NaN, 1)).toBe(false)
  })
})

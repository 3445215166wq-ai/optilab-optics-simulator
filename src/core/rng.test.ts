import { describe, expect, it } from 'vitest'
import { createRng, hashSeed } from './rng'

describe('rng / 可复现性', () => {
  it('相同种子产生完全相同的序列', () => {
    const a = createRng(20240501)
    const b = createRng(20240501)
    const seqA = Array.from({ length: 50 }, () => a.next())
    const seqB = Array.from({ length: 50 }, () => b.next())
    expect(seqA).toEqual(seqB)
  })

  it('不同种子产生不同序列', () => {
    const a = Array.from({ length: 20 }, (_, i) => createRng(i + 1).next())
    expect(new Set(a).size).toBeGreaterThan(15)
  })

  it('字符串种子可稳定映射到 32 位整数', () => {
    expect(hashSeed('optilab')).toBe(hashSeed('optilab'))
    expect(hashSeed('optilab')).not.toBe(hashSeed('optilab2'))
    expect(hashSeed(42)).toBe(42)
  })

  it('next() 落在 [0,1) 区间', () => {
    const rng = createRng(7)
    for (let i = 0; i < 5000; i += 1) {
      const v = rng.next()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('range() 落在指定区间且大致均匀', () => {
    const rng = createRng('range')
    let sum = 0
    const n = 20000
    for (let i = 0; i < n; i += 1) {
      const v = rng.range(-3, 7)
      expect(v).toBeGreaterThanOrEqual(-3)
      expect(v).toBeLessThan(7)
      sum += v
    }
    expect(sum / n).toBeCloseTo(2, 1)
  })

  it('int() 产生区间内整数', () => {
    const rng = createRng('int')
    const seen = new Set<number>()
    for (let i = 0; i < 2000; i += 1) {
      const v = rng.int(1, 6)
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(6)
      seen.add(v)
    }
    expect(seen.size).toBe(6)
  })

  it('gaussian() 近似标准正态分布（均值 0、标准差 1）', () => {
    const rng = createRng('gauss')
    const n = 40000
    let sum = 0
    let sumSq = 0
    for (let i = 0; i < n; i += 1) {
      const v = rng.gaussian()
      sum += v
      sumSq += v * v
    }
    const mean = sum / n
    const std = Math.sqrt(sumSq / n - mean * mean)
    expect(Math.abs(mean)).toBeLessThan(0.02)
    expect(std).toBeGreaterThan(0.97)
    expect(std).toBeLessThan(1.03)
  })
})

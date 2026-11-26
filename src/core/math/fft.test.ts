import { describe, expect, it } from 'vitest'
import { fft1d, fft2d, fftShift2d, isPowerOfTwo, naiveDft } from './fft'

function seq(n: number): { re: Float64Array; im: Float64Array } {
  // 固定伪随机序列（可复现），避免用 Math.random 导致测试不稳定
  const re = new Float64Array(n)
  const im = new Float64Array(n)
  let s = 12345
  for (let i = 0; i < n; i += 1) {
    s = (s * 1103515245 + 12345) % 2147483648
    re[i] = s / 2147483648 - 0.5
    s = (s * 1103515245 + 12345) % 2147483648
    im[i] = s / 2147483648 - 0.5
  }
  return { re, im }
}

describe('fft1d — 与暴力 DFT 对照', () => {
  it('N = 8 时与暴力 DFT 逐点一致', () => {
    const { re, im } = seq(8)
    const expected = naiveDft(re, im)
    const outRe = Float64Array.from(re)
    const outIm = Float64Array.from(im)
    fft1d(outRe, outIm)
    for (let i = 0; i < 8; i += 1) {
      expect(outRe[i]).toBeCloseTo(expected.re[i], 10)
      expect(outIm[i]).toBeCloseTo(expected.im[i], 10)
    }
  })

  it('N = 64 时与暴力 DFT 逐点一致', () => {
    const { re, im } = seq(64)
    const expected = naiveDft(re, im)
    const outRe = Float64Array.from(re)
    const outIm = Float64Array.from(im)
    fft1d(outRe, outIm)
    let maxErr = 0
    for (let i = 0; i < 64; i += 1) {
      maxErr = Math.max(maxErr, Math.hypot(outRe[i] - expected.re[i], outIm[i] - expected.im[i]))
    }
    expect(maxErr).toBeLessThan(1e-9)
  })

  it('正变换后做逆变换可还原原信号', () => {
    const { re, im } = seq(32)
    const outRe = Float64Array.from(re)
    const outIm = Float64Array.from(im)
    fft1d(outRe, outIm)
    fft1d(outRe, outIm, true)
    for (let i = 0; i < 32; i += 1) {
      expect(outRe[i]).toBeCloseTo(re[i], 10)
      expect(outIm[i]).toBeCloseTo(im[i], 10)
    }
  })

  it('Parseval 能量守恒：Σ|x|² = (1/N)Σ|X|²', () => {
    const n = 128
    const { re, im } = seq(n)
    let e1 = 0
    for (let i = 0; i < n; i += 1) e1 += re[i] * re[i] + im[i] * im[i]
    fft1d(re, im)
    let e2 = 0
    for (let i = 0; i < n; i += 1) e2 += re[i] * re[i] + im[i] * im[i]
    expect(e2 / n).toBeCloseTo(e1, 9)
  })

  it('δ 函数变换为常量谱；常量信号变换为 δ', () => {
    const re = new Float64Array(8)
    const im = new Float64Array(8)
    re[0] = 1
    fft1d(re, im)
    for (let i = 0; i < 8; i += 1) {
      expect(re[i]).toBeCloseTo(1, 12)
      expect(im[i]).toBeCloseTo(0, 12)
    }

    const re2 = new Float64Array(8).fill(1)
    const im2 = new Float64Array(8)
    fft1d(re2, im2)
    expect(re2[0]).toBeCloseTo(8, 12)
    for (let i = 1; i < 8; i += 1) {
      expect(re2[i]).toBeCloseTo(0, 12)
    }
  })

  it('非法输入抛出明确错误', () => {
    expect(() => fft1d(new Float64Array(6), new Float64Array(6))).toThrow(/2 的幂/)
    expect(() => fft1d(new Float64Array(4), new Float64Array(5))).toThrow(/长度不一致/)
  })

  it('isPowerOfTwo 判定正确', () => {
    expect([1, 2, 4, 256, 1024].every(isPowerOfTwo)).toBe(true)
    expect([0, 3, 6, 100, -4].some(isPowerOfTwo)).toBe(false)
  })
})

describe('fft2d — 可分离性与可逆性', () => {
  it('二维可分离信号 f(y,x) = g(y)·h(x) 的变换等于两个一维变换的外积', () => {
    const size = 8
    const g = seq(size).re
    const h = seq(size + 3).re.slice(0, size)

    const re = new Float64Array(size * size)
    const im = new Float64Array(size * size)
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) re[y * size + x] = g[y] * h[x]
    }
    fft2d(re, im, size)

    const gRe = Float64Array.from(g)
    const gIm = new Float64Array(size)
    fft1d(gRe, gIm)
    const hRe = Float64Array.from(h)
    const hIm = new Float64Array(size)
    fft1d(hRe, hIm)

    for (let ky = 0; ky < size; ky += 1) {
      for (let kx = 0; kx < size; kx += 1) {
        // (a+bi)(c+di)
        const expRe = gRe[ky] * hRe[kx] - gIm[ky] * hIm[kx]
        const expIm = gRe[ky] * hIm[kx] + gIm[ky] * hRe[kx]
        expect(re[ky * size + kx]).toBeCloseTo(expRe, 9)
        expect(im[ky * size + kx]).toBeCloseTo(expIm, 9)
      }
    }
  })

  it('二维正逆变换可还原', () => {
    const size = 16
    const flat = seq(size * size)
    const re = Float64Array.from(flat.re)
    const im = Float64Array.from(flat.im)
    fft2d(re, im, size)
    fft2d(re, im, size, true)
    let maxErr = 0
    for (let i = 0; i < size * size; i += 1) {
      maxErr = Math.max(maxErr, Math.abs(re[i] - flat.re[i]), Math.abs(im[i] - flat.im[i]))
    }
    expect(maxErr).toBeLessThan(1e-10)
  })

  it('二维能量守恒', () => {
    const size = 16
    const { re, im } = seq(size * size)
    let e1 = 0
    for (let i = 0; i < size * size; i += 1) e1 += re[i] * re[i] + im[i] * im[i]
    fft2d(re, im, size)
    let e2 = 0
    for (let i = 0; i < size * size; i += 1) e2 += re[i] * re[i] + im[i] * im[i]
    expect(e2 / (size * size)).toBeCloseTo(e1, 8)
  })

  it('非方阵长度校验', () => {
    expect(() => fft2d(new Float64Array(15), new Float64Array(15), 4)).toThrow(/size²/)
    // 长度正确但不是 2 的幂（size = 3 → 9 元素）
    expect(() => fft2d(new Float64Array(9), new Float64Array(9), 3)).toThrow(/2 的幂/)
  })
})

describe('fftShift2d', () => {
  it('交换四象限两次可还原', () => {
    const size = 8
    const { re, im } = seq(size * size)
    const r0 = Float64Array.from(re)
    const i0 = Float64Array.from(im)
    fftShift2d(re, im, size)
    // 零频（原 [0,0]）应移到中心
    expect(re[(size / 2) * size + size / 2]).toBeCloseTo(r0[0], 12)
    fftShift2d(re, im, size)
    for (let i = 0; i < size * size; i += 1) {
      expect(re[i]).toBeCloseTo(r0[i], 12)
      expect(im[i]).toBeCloseTo(i0[i], 12)
    }
  })
})

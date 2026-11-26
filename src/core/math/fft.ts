/**
 * 基数 2 快速傅里叶变换（原地、双精度、无第三方依赖）。
 *
 * 为什么自己实现：
 *   - PSF / MTF 需要复光瞳的二维傅里叶变换，必须能控制精度与采样约定；
 *   - 便于写单元测试（与暴力 DFT 逐点对照），也便于将来迁入 Web Worker。
 *
 * 约定：正变换用 exp(−2πi·kn/N)，逆变换用 exp(+2πi·kn/N) 并除以 N。
 * 数据布局：单个方阵按行优先一维数组，索引 = y * size + x。
 */

/** 判断是否为 2 的整数次幂 */
export function isPowerOfTwo(n: number): boolean {
  return Number.isInteger(n) && n > 0 && (n & (n - 1)) === 0
}

/**
 * 一维复数 FFT（原地）。re/im 长度必须相等且为 2 的幂。
 */
export function fft1d(re: Float64Array, im: Float64Array, inverse = false): void {
  const n = re.length
  if (im.length !== n) throw new Error('fft1d: re/im 长度不一致')
  if (!isPowerOfTwo(n)) throw new Error(`fft1d: 长度必须是 2 的幂，当前 ${n}`)
  if (n === 1) return

  // 位反转置换
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      const tr = re[i]
      re[i] = re[j]
      re[j] = tr
      const ti = im[i]
      im[i] = im[j]
      im[j] = ti
    }
  }

  // 蝶形运算（迭代自底向上）
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len
    const wRe = Math.cos(ang)
    const wIm = Math.sin(ang)
    const half = len >> 1
    for (let i = 0; i < n; i += len) {
      let curRe = 1
      let curIm = 0
      for (let k = 0; k < half; k += 1) {
        const i1 = i + k
        const i2 = i + k + half
        const ur = re[i1]
        const ui = im[i1]
        const vr = re[i2] * curRe - im[i2] * curIm
        const vi = re[i2] * curIm + im[i2] * curRe
        re[i1] = ur + vr
        im[i1] = ui + vi
        re[i2] = ur - vr
        im[i2] = ui - vi
        const nextRe = curRe * wRe - curIm * wIm
        curIm = curRe * wIm + curIm * wRe
        curRe = nextRe
      }
    }
  }

  if (inverse) {
    for (let i = 0; i < n; i += 1) {
      re[i] /= n
      im[i] /= n
    }
  }
}

/**
 * 二维复数 FFT（原地，size × size 方阵）。
 * 实现方式：先对每一行做一维 FFT，再对每一列做一维 FFT（可分离性）。
 */
export function fft2d(re: Float64Array, im: Float64Array, size: number, inverse = false): void {
  if (re.length !== size * size || im.length !== size * size) {
    throw new Error('fft2d: 数组长度必须是 size²')
  }
  if (!isPowerOfTwo(size)) throw new Error(`fft2d: size 必须是 2 的幂，当前 ${size}`)

  const rowRe = new Float64Array(size)
  const rowIm = new Float64Array(size)

  // 按行
  for (let y = 0; y < size; y += 1) {
    const off = y * size
    for (let x = 0; x < size; x += 1) {
      rowRe[x] = re[off + x]
      rowIm[x] = im[off + x]
    }
    fft1d(rowRe, rowIm, inverse)
    for (let x = 0; x < size; x += 1) {
      re[off + x] = rowRe[x]
      im[off + x] = rowIm[x]
    }
  }

  // 按列
  const colRe = new Float64Array(size)
  const colIm = new Float64Array(size)
  for (let x = 0; x < size; x += 1) {
    for (let y = 0; y < size; y += 1) {
      colRe[y] = re[y * size + x]
      colIm[y] = im[y * size + x]
    }
    fft1d(colRe, colIm, inverse)
    for (let y = 0; y < size; y += 1) {
      re[y * size + x] = colRe[y]
      im[y * size + x] = colIm[y]
    }
  }
}

/**
 * 把频谱的零频移到中心（用于把 PSF 从「四角拼合」恢复为居中图样）。
 * 对偶数边长方阵交换四个象限；就地修改。
 */
export function fftShift2d(re: Float64Array, im: Float64Array, size: number): void {
  const half = size >> 1
  for (let y = 0; y < half; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const xa = x < half ? x + half : x - half
      const yb = y + half
      const i = y * size + x
      const j = yb * size + xa
      const tr = re[i]
      re[i] = re[j]
      re[j] = tr
      const ti = im[i]
      im[i] = im[j]
      im[j] = ti
    }
  }
}

/** 供测试使用的暴力 DFT（O(n²)，仅小尺寸） */
export function naiveDft(re: Float64Array, im: Float64Array): { re: Float64Array; im: Float64Array } {
  const n = re.length
  const outRe = new Float64Array(n)
  const outIm = new Float64Array(n)
  for (let k = 0; k < n; k += 1) {
    let sr = 0
    let si = 0
    for (let t = 0; t < n; t += 1) {
      const ang = (-2 * Math.PI * k * t) / n
      const c = Math.cos(ang)
      const s = Math.sin(ang)
      sr += re[t] * c - im[t] * s
      si += re[t] * s + im[t] * c
    }
    outRe[k] = sr
    outIm[k] = si
  }
  return { re: outRe, im: outIm }
}

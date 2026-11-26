/**
 * 可复现随机数发生器（Mulberry32）。
 * 为什么自己实现：浏览器 Math.random() 无法设定种子，实验结果无法复现；
 * 而本项目要求「随机仿真实验可复现」，因此统一使用带种子的 PRNG。
 * 参考：Mulberry32 属于小型快速 32 位状态 PRNG，周期 2^32，质量足够图像噪声仿真使用。
 */

export interface Rng {
  /** 下一个 [0,1) 均匀分布随机数 */
  next(): number
  /** 下一个 [min,max) 均匀分布随机数 */
  range(min: number, max: number): number
  /** 下一个 [min,max] 整数 */
  int(min: number, max: number): number
  /** 标准正态分布随机数（Box–Muller 变换） */
  gaussian(): number
  /** 当前种子（便于日志记录复现条件） */
  readonly seed: number
}

/** 由字符串种子派生 32 位整数种子（FNV-1a），便于用户输入任意文本种子 */
export function hashSeed(seed: string | number): number {
  if (typeof seed === 'number' && Number.isFinite(seed)) return Math.abs(Math.trunc(seed)) >>> 0
  const text = String(seed)
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function createRng(seed: string | number = 1): Rng {
  let state = hashSeed(seed) || 0x9e3779b9
  let spare: number | null = null

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  return {
    seed: state,
    next,
    range: (min: number, max: number) => min + (max - min) * next(),
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    gaussian: () => {
      if (spare !== null) {
        const v = spare
        spare = null
        return v
      }
      // Box–Muller：两个均匀分布 → 两个独立标准正态分布
      let u = 0
      let v = 0
      let s = 0
      do {
        u = next() * 2 - 1
        v = next() * 2 - 1
        s = u * u + v * v
      } while (s === 0 || s >= 1)
      const factor = Math.sqrt((-2 * Math.log(s)) / s)
      spare = v * factor
      return u * factor
    },
  }
}

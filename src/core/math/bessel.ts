/**
 * 第一类一阶贝塞尔函数 J₁(x)
 *
 * 用途：理想圆形孔径的夫琅禾费衍射（艾里斑）强度分布
 *      I(r) = I₀ · [ 2·J₁(v) / v ]² ,  v = π·D·r / (λ·f) = π·r / (λ·N)
 *
 * 算法：Numerical Recipes 的分段有理逼近
 *      |x| <  8 ：J₁(x) = x·P(x²)/Q(x²)，P、Q 为 6 次多项式
 *      |x| ≥ 8 ：渐近展开 J₁(x) ≈ √(2/πx)·[cos(x−3π/4)·A − sin(x−3π/4)·B]
 * 精度：|x| < 8 区间相对误差约 1e-8；|x| ≥ 8 的渐近段约 1e-4（换段处 J₁ ≈ 0.23，
 *      绝对误差 &lt; 3e-4），对艾里斑强度（按 J₁² 计算、副极大仅 1.75%）完全够用。
 */

/** 第一类一阶贝塞尔函数 J₁(x) */
export function besselJ1(x: number): number {
  if (!Number.isFinite(x)) return Number.NaN
  const ax = Math.abs(x)

  if (ax < 8) {
    const y = x * x
    const ans1 =
      x *
      (72362614232.0 +
        y *
          (-7895059235.0 +
            y * (242396853.1 + y * (-2972611.439 + y * (15704.4826 + y * -30.16036606)))))
    const ans2 =
      144725228442.0 +
      y * (2300535178.0 + y * (18583304.74 + y * (99447.43394 + y * (376.9991397 + y))))
    return ans1 / ans2
  }

  const z = 8 / ax
  const y = z * z
  const xx = ax - 2.356194491 // 3π/4
  const ans1 =
    1.0 +
    y *
      (0.183105e-2 +
        y * (-0.3516396496e-4 + y * (0.2457520174e-5 + y * -0.240337019e-6)))
  const ans2 =
    0.04687499995 +
    y *
      (-0.2002690873e-3 +
        y * (0.8449199096e-5 + y * (-0.88228987e-6 + y * 0.105787412e-6)))
  const ans = Math.sqrt(0.636619772 / ax) * (Math.cos(xx) * ans1 - z * Math.sin(xx) * ans2)
  return x < 0 ? -ans : ans
}

/**
 * 艾里斑归一化强度：I(v)/I(0) = [2·J₁(v)/v]²，v = 0 时取极限值 1。
 * v 为归一化半径，与物理半径的关系见 diffraction.ts。
 */
export function airyIntensity(v: number): number {
  const av = Math.abs(v)
  if (!Number.isFinite(av)) return 0
  if (av < 1e-8) return 1
  // 用 2J₁(v)/v 形式；v 很大时强度按 ~1/v³ 衰减，仍保持数值稳定
  const t = (2 * besselJ1(av)) / av
  return t * t
}

/** J₁ 的第 k 个正零点（1 ≤ k ≤ 3 用精确值，避免求解器开销） */
const J1_ZEROS = [3.831705970207512, 7.015586669815619, 10.173468135068678] as const

/**
 * 第 k 个暗环对应的归一化半径 v（k 从 1 开始）。
 * 高阶用 McBride 渐近式：j(1,k) ≈ (k + 1/4)π − 3/(8π(k + 1/4))，
 * 其中 (k + 1/4)π 来自 j(ν,k) ≈ (k + ν/2 − 1/4)π（ν = 1），
 * 第二项修正使 k = 1 时即可得到 3.8317。
 */
export function j1Zero(k: number): number {
  const kk = Math.round(k)
  if (kk >= 1 && kk <= J1_ZEROS.length) return J1_ZEROS[kk - 1]
  const base = (kk + 0.25) * Math.PI
  return base - 3 / (8 * Math.PI * (kk + 0.25))
}

/**
 * ============================================================================
 * 模块二核心：光的反射、折射与全反射（Snell 定律 + Fresnel 公式）
 * ============================================================================
 *
 * 【几何约定】（与渲染层一致）
 *   界面为水平线 y = 0；介质 1 在上方 (y > 0)，介质 2 在下方 (y < 0)。
 *   法线垂直于界面，角度一律「相对法线」度量：
 *       入射角 θ₁、反射角 θ₁'、折射角 θ₂，均 ∈ [0°, 90°)。
 *
 * 【核心定律】
 *   1. 反射定律：θ₁' = θ₁（反射角恒等于入射角）
 *   2. 折射定律（Snell）：n₁·sinθ₁ = n₂·sinθ₂
 *        ⇒ sinθ₂ = n₁/n₂ · sinθ₁ = sinθ₁ · (n₁/n₂)
 *   3. 全反射（TIR）：仅当光从光密介质射向光疏介质（n₁ > n₂）时可能发生。
 *        临界角 θc = arcsin(n₂ / n₁)
 *        θ₁ > θc ⇒ 无折射光，能量 100% 反射。
 *   4. 布儒斯特角 θB = arctan(n₂ / n₁)：在此角度下 p 偏振反射率为 0。
 *
 * 【Fresnel 反射率】（振幅反射系数，取最常见的正入射归一化形式）
 *        rs = (n₁cosθ₁ − n₂cosθ₂) / (n₁cosθ₁ + n₂cosθ₂)
 *        rp = (n₂cosθ₁ − n₁cosθ₂) / (n₂cosθ₁ + n₁cosθ₂)
 *        R_s = rs², R_p = rp², 自然光反射率 R = (R_s + R_p)/2
 *   无吸收介质满足能量守恒：T = 1 − R（功率透射率）。
 *   正入射 (θ₁=0) 时退化为经典形式 R = ((n₁−n₂)/(n₁+n₂))²。
 *
 * 【模型局限】
 *   折射率按标称常数处理，未计入色散（Sellmeier 方程）与吸收；
 *   界面按理想平面处理，不考虑表面粗糙度散射与镀膜多层干涉。
 * ============================================================================
 */

import { SPEED_OF_LIGHT_M_S } from '../constants'
import { DEG, toDeg } from '../units'

export interface MediumPreset {
  id: string
  label: string
  labelEn: string
  /** 参考折射率（通常取 587.6 nm 钠黄光 d 线附近） */
  n: number
  note: string
}

/** 介质折射率预设表（标称值，仅供参考，不随波长变化） */
export const MEDIA_PRESETS: readonly MediumPreset[] = [
  { id: 'vacuum', label: '真空', labelEn: 'Vacuum', n: 1.0, note: '理想参考介质' },
  { id: 'air', label: '空气', labelEn: 'Air', n: 1.000293, note: '标准状态 (15℃, 101.325 kPa)' },
  { id: 'water', label: '水', labelEn: 'Water', n: 1.333, note: '20℃ 可见光' },
  { id: 'quartz', label: '熔融石英', labelEn: 'Fused silica', n: 1.4585, note: 'UV/IR 光学常用' },
  { id: 'bk7', label: '冕牌玻璃 BK7', labelEn: 'Crown glass BK7', n: 1.5168, note: '最常用光学玻璃' },
  { id: 'flint', label: '火石玻璃 F2', labelEn: 'Flint glass F2', n: 1.6204, note: '高色散玻璃' },
  { id: 'sapphire', label: '蓝宝石', labelEn: 'Sapphire', n: 1.77, note: '耐磨窗口材料' },
  { id: 'silicon', label: '硅', labelEn: 'Silicon', n: 3.48, note: '红外波段 (≈1550 nm)，可见光不透明' },
  { id: 'diamond', label: '金刚石', labelEn: 'Diamond', n: 2.417, note: '极高折射率，临界角很小' },
]

export interface RefractionInput {
  /** 入射角 θ₁（度），0 ≤ θ₁ < 90 */
  incidenceAngleDeg: number
  /** 入射侧（上方介质）折射率 */
  n1: number
  /** 折射侧（下方介质）折射率 */
  n2: number
  /** 真空波长 λ₀（nm），仅用于换算介质中波长，不参与角度计算 */
  wavelengthNm: number
}

export interface FresnelTerms {
  /** s 偏振振幅反射系数 */
  rs: number
  /** p 偏振振幅反射系数 */
  rp: number
  /** s 偏振反射率 R_s = rs² */
  Rs: number
  /** p 偏振反射率 R_p = rp² */
  Rp: number
  /** 自然光（非偏振）反射率 */
  R: number
  /** 自然光透射率 T = 1 − R */
  T: number
}

export interface RefractionResult {
  ok: boolean
  errors: string[]
  warnings: string[]
  notes: string[]
  theta1Deg: number
  theta1Rad: number
  /** 折射角（度）；全反射时为 null */
  theta2Deg: number | null
  theta2Rad: number | null
  /** 反射角（度），恒等于入射角 */
  thetaReflectDeg: number
  /** sinθ₂ 的原始计算值（可能 > 1，正是全反射判据） */
  sinTheta2: number
  isTIR: boolean
  /** 临界角（度）；只在 n₁ > n₂ 时存在 */
  criticalAngleDeg: number | null
  /** 布儒斯特角（度） */
  brewsterAngleDeg: number
  fresnel: FresnelTerms
  n1: number
  n2: number
  /** 相对折射率 n₂/n₁ */
  relativeIndex: number
  wavelengthNm: number
  /** 介质中的光速（m/s） */
  speed1: number
  speed2: number
  /** 介质中的波长（nm） */
  wavelength1Nm: number
  wavelength2Nm: number
  /** 单位方向向量（y 轴向上为正；光线自左上方向下入射到原点） */
  directions: {
    incident: { x: number; y: number }
    reflected: { x: number; y: number }
    refracted: { x: number; y: number } | null
  }
}

const MIN_N = 1
const MAX_N = 4

function invalid(errors: string[], input: RefractionInput): RefractionResult {
  return {
    ok: false,
    errors,
    warnings: [],
    notes: [],
    theta1Deg: input.incidenceAngleDeg,
    theta1Rad: 0,
    theta2Deg: null,
    theta2Rad: null,
    thetaReflectDeg: input.incidenceAngleDeg,
    sinTheta2: 0,
    isTIR: false,
    criticalAngleDeg: null,
    brewsterAngleDeg: Number.NaN,
    fresnel: { rs: 0, rp: 0, Rs: 0, Rp: 0, R: 0, T: 1 },
    n1: input.n1,
    n2: input.n2,
    relativeIndex: Number.NaN,
    wavelengthNm: input.wavelengthNm,
    speed1: Number.NaN,
    speed2: Number.NaN,
    wavelength1Nm: Number.NaN,
    wavelength2Nm: Number.NaN,
    directions: {
      incident: { x: 0, y: -1 },
      reflected: { x: 0, y: 1 },
      refracted: null,
    },
  }
}

/**
 * 计算反射/折射/全反射及 Fresnel 反射率。
 * 纯函数，无副作用；相同输入必然得到相同输出。
 */
export function computeRefraction(input: RefractionInput): RefractionResult {
  const errors: string[] = []
  const warnings: string[] = []
  const notes: string[] = []

  const theta1Deg = Number(input.incidenceAngleDeg)
  const n1 = Number(input.n1)
  const n2 = Number(input.n2)
  const lambda = Number(input.wavelengthNm)

  if (!Number.isFinite(theta1Deg) || theta1Deg < 0 || theta1Deg >= 90) {
    errors.push('入射角 θ₁ 必须落在 [0°, 90°) 区间内')
  }
  if (!Number.isFinite(n1) || n1 < MIN_N || n1 > MAX_N) {
    errors.push(`入射侧折射率 n₁ 必须在 [${MIN_N}, ${MAX_N}] 范围内`)
  }
  if (!Number.isFinite(n2) || n2 < MIN_N || n2 > MAX_N) {
    errors.push(`折射侧折射率 n₂ 必须在 [${MIN_N}, ${MAX_N}] 范围内`)
  }
  if (!Number.isFinite(lambda) || lambda <= 0) {
    errors.push('波长 λ₀ 必须是正数（nm）')
  }
  if (errors.length > 0) return invalid(errors, input)

  const theta1Rad = theta1Deg * DEG
  const sinTheta1 = Math.sin(theta1Rad)
  const cosTheta1 = Math.cos(theta1Rad)

  // ---------------- 1. Snell 定律 ----------------
  // sinθ₂ = (n₁/n₂)·sinθ₁。若该值 > 1，说明不存在实数折射角 → 全反射
  const sinTheta2Raw = (n1 / n2) * sinTheta1
  const isTIR = sinTheta2Raw > 1 + 1e-12
  let theta2Rad: number | null = null
  let cosTheta2 = 0
  if (!isTIR) {
    const sinTheta2 = Math.min(1, sinTheta2Raw)
    theta2Rad = Math.asin(sinTheta2)
    cosTheta2 = Math.cos(theta2Rad)
  }

  // ---------------- 2. 临界角 / 布儒斯特角 ----------------
  const criticalAngleDeg = n1 > n2 ? toDeg(Math.asin(n2 / n1)) : null
  const brewsterAngleDeg = toDeg(Math.atan(n2 / n1))

  // ---------------- 3. Fresnel 反射率 ----------------
  let fresnel: FresnelTerms
  if (isTIR) {
    // 全反射：能量全部返回介质 1，且伴随相位突变（此处不处理相位）
    fresnel = { rs: 1, rp: 1, Rs: 1, Rp: 1, R: 1, T: 0 }
  } else {
    const rs = (n1 * cosTheta1 - n2 * cosTheta2) / (n1 * cosTheta1 + n2 * cosTheta2)
    const rp = (n2 * cosTheta1 - n1 * cosTheta2) / (n2 * cosTheta1 + n1 * cosTheta2)
    const Rs = rs * rs
    const Rp = rp * rp
    const R = 0.5 * (Rs + Rp)
    fresnel = { rs, rp, Rs, Rp, R, T: 1 - R }
  }

  // ---------------- 4. 介质中的光速与波长 ----------------
  const speed1 = SPEED_OF_LIGHT_M_S / n1
  const speed2 = SPEED_OF_LIGHT_M_S / n2
  const wavelength1Nm = lambda / n1
  const wavelength2Nm = lambda / n2

  // ---------------- 5. 提示信息 ----------------
  if (isTIR) {
    warnings.push(
      `全反射 (Total Internal Reflection)：sinθ₂ = ${sinTheta2Raw.toFixed(4)} > 1，无折射光，能量全部反射回介质 1。`,
    )
  } else if (n1 > n2 && theta1Deg > (criticalAngleDeg ?? 90) - 3) {
    warnings.push('入射角已接近临界角：折射光贴着界面传播，实际系统中界面微小起伏即可触发全反射。')
  }
  if (Math.abs(n1 - n2) < 1e-9) {
    notes.push('两介质折射率相同：界面等效不存在，光线不偏折且反射率为 0。')
  }
  if (n1 === 1 || n2 === 1) {
    notes.push('真空/空气折射率近似为 1，可作为「绝对折射率」的参考基准。')
  }
  notes.push('折射率按标称常数处理，未计入色散；改变波长只影响介质中波长显示，不改变折射角。')

  const theta2Deg = theta2Rad === null ? null : toDeg(theta2Rad)
  const refractedDir = theta2Rad === null ? null : { x: Math.sin(theta2Rad), y: -Math.cos(theta2Rad) }

  return {
    ok: true,
    errors,
    warnings,
    notes,
    theta1Deg,
    theta1Rad,
    theta2Deg,
    theta2Rad,
    thetaReflectDeg: theta1Deg,
    sinTheta2: sinTheta2Raw,
    isTIR,
    criticalAngleDeg,
    brewsterAngleDeg,
    fresnel,
    n1,
    n2,
    relativeIndex: n2 / n1,
    wavelengthNm: lambda,
    speed1,
    speed2,
    wavelength1Nm,
    wavelength2Nm,
    directions: {
      // 光线自左上方向右下方传播，入射到原点
      incident: { x: Math.sin(theta1Rad), y: -Math.cos(theta1Rad) },
      reflected: { x: Math.sin(theta1Rad), y: Math.cos(theta1Rad) },
      refracted: refractedDir,
    },
  }
}

/** 单次反射率计算（供曲线扫描复用，避免构造完整结果对象） */
export function fresnelReflectance(
  theta1Deg: number,
  n1: number,
  n2: number,
): { Rs: number; Rp: number; R: number; tir: boolean } {
  const t1 = theta1Deg * DEG
  const sinT2 = (n1 / n2) * Math.sin(t1)
  if (sinT2 > 1) return { Rs: 1, Rp: 1, R: 1, tir: true }
  const cosT1 = Math.cos(t1)
  const cosT2 = Math.sqrt(Math.max(0, 1 - sinT2 * sinT2))
  const rs = (n1 * cosT1 - n2 * cosT2) / (n1 * cosT1 + n2 * cosT2)
  const rp = (n2 * cosT1 - n1 * cosT2) / (n2 * cosT1 + n1 * cosT2)
  const Rs = rs * rs
  const Rp = rp * rp
  return { Rs, Rp, R: 0.5 * (Rs + Rp), tir: false }
}

/** 折射角扫描（供曲线图使用）；全反射区间返回 null，便于折线断开 */
export function refractionAngleDeg(theta1Deg: number, n1: number, n2: number): number | null {
  const sinT2 = (n1 / n2) * Math.sin(theta1Deg * DEG)
  if (sinT2 > 1) return null
  return toDeg(Math.asin(Math.min(1, sinT2)))
}

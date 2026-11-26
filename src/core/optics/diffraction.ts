/**
 * ============================================================================
 * 模块三核心：理想圆形孔径的夫琅禾费衍射与光学分辨率
 * ============================================================================
 *
 * 【物理模型】
 * 均匀平面波照明直径为 D 的圆形孔径，在焦平面（距离 f）上得到艾里斑（Airy pattern）：
 *
 *      I(r) = I₀ · [ 2·J₁(v) / v ]² ,      v = π·D·r / (λ·f) = π·r / (λ·N)
 *
 * 其中 N = f/D 为像方 F 数（工作 F 数），J₁ 为一阶贝塞尔函数。
 *
 * 【关键判据】（全部为**像方**，即传感器平面上的量）
 *   第一暗环半径：  r₁ = 1.22 · λ · N        （又称艾里斑半径）
 *   第一副极大约：  v = 5.1356 → r = 1.635·λ·N，强度仅为峰值的 1.75%
 *   瑞利判据：      Δ = 1.22 · λ · N         （两像点间距等于第一暗环半径时刚好可分辨）
 *   非相干截止频率：f_c = 1 / (λ · N)  [lp/mm]（≈ 2NA/λ，NA = n·sinθ）
 *
 * 【物方 ↔ 像方换算】
 * 横向放大率 m 把像方尺度换到物方：像方量除以 |m| 即得物方量（因为 h' = m·h）。
 *   物方艾里半径 = 1.22·λ·N / |m|
 *   物方截止频率 = |m| / (λ·N)
 *   数值孔径满足光学不变量 NA_obj = |m| · NA_img
 * 注意：**「分辨率 Δ = 1.22λN」默认指的是像方量**；直接把它当作物方分辨率会在 |m| ≠ 1 时错一个放大率。
 *
 * 【适用条件】
 *   1. 理想圆形孔径、均匀照明、无像差的夫琅禾费（远场/焦平面）衍射；
 *   2. 近轴、小角度：NA ≈ D/(2f) = 1/(2N)；
 *   3. 非相干成像才使用「截止频率 f_c = 1/(λN)」；相干成像的截止频率是它的一半；
 *   4. 不含像差、镀膜、偏振与像元采样（探测器 MTF）影响。
 * ============================================================================
 */

import { airyIntensity, j1Zero } from '../math/bessel'

export interface DiffractionInput {
  /** 真空波长 λ（nm） */
  wavelengthNm: number
  /** 像方（工作）F 数 N = f/D */
  fNumber: number
  /** 通光口径 D（mm） */
  apertureDiameterMm: number
  /** 横向放大率绝对值 |m|（用于像方/物方换算，1 表示 1:1） */
  magnification: number
}

export interface AiryRing {
  order: number
  /** 像方半径（μm） */
  radiusImgUm: number
  /** 归一化强度（峰值 = 1） */
  intensity: number
  kind: 'dark' | 'bright'
}

export interface DiffractionResult {
  ok: boolean
  errors: string[]
  warnings: string[]
  notes: string[]
  wavelengthNm: number
  wavelengthMm: number
  /** 像方（工作）F 数 */
  fNumber: number
  apertureDiameterMm: number
  /** 派生焦距 f = N·D（mm） */
  focalLengthMm: number
  magnification: number
  /** 像方数值孔径 NA' = n·sinθ' ≈ D/(2f) = 1/(2N) */
  naImage: number
  /** 物方数值孔径 NA = |m|·NA'（光学不变量） */
  naObject: number
  /* ---- 像方（传感器平面） ---- */
  airyRadiusImgUm: number
  airyDiameterImgUm: number
  rayleighImgUm: number
  cutoffImgCyclesPerMm: number
  /* ---- 物方（被摄物平面） ---- */
  airyRadiusObjUm: number
  rayleighObjUm: number
  cutoffObjCyclesPerMm: number
  /* ---- 曲线与图样 ---- */
  profile: { rUm: number[]; intensity: number[] }
  rings: AiryRing[]
  firstDarkRingImgUm: number
  secondaryMaxima: Array<{ radiusImgUm: number; intensity: number }>
  /** 二维图样建议的半宽（μm），取 4 个艾里半径 */
  imageHalfExtentUm: number
}

export const MIN_WAVELENGTH_NM = 200
export const MAX_WAVELENGTH_NM = 1600
export const MIN_F_NUMBER = 0.5
export const MAX_F_NUMBER = 64
export const MAX_APERTURE_MM = 500
export const MIN_MAGNIFICATION = 0.01
export const MAX_MAGNIFICATION = 100

/** 第一暗环系数：J₁ 的第一个零点 3.8317 / π = 1.21967 ≈ 1.22 */
export const AIRY_FACTOR = j1Zero(1) / Math.PI

function invalidResult(errors: string[], input: DiffractionInput): DiffractionResult {
  return {
    ok: false,
    errors,
    warnings: [],
    notes: [],
    wavelengthNm: input.wavelengthNm,
    wavelengthMm: Number.NaN,
    fNumber: input.fNumber,
    apertureDiameterMm: input.apertureDiameterMm,
    focalLengthMm: Number.NaN,
    magnification: input.magnification,
    naImage: Number.NaN,
    naObject: Number.NaN,
    airyRadiusImgUm: Number.NaN,
    airyDiameterImgUm: Number.NaN,
    rayleighImgUm: Number.NaN,
    cutoffImgCyclesPerMm: Number.NaN,
    airyRadiusObjUm: Number.NaN,
    rayleighObjUm: Number.NaN,
    cutoffObjCyclesPerMm: Number.NaN,
    profile: { rUm: [], intensity: [] },
    rings: [],
    firstDarkRingImgUm: Number.NaN,
    secondaryMaxima: [],
    imageHalfExtentUm: Number.NaN,
  }
}

/** 艾里斑强度：给定像方半径 r(mm)、波长 λ(mm)、像方 F 数 N */
export function airyIntensityAtRadius(rMm: number, wavelengthMm: number, fNumber: number): number {
  const v = (Math.PI * Math.abs(rMm)) / (wavelengthMm * fNumber)
  return airyIntensity(v)
}

/**
 * 采样二维艾里斑图样（纯函数，供渲染层转成热力图）。
 * 返回 size×size 数组，值为归一化强度（中心 = 1），行优先。
 */
export function sampleAiryImage(
  size: number,
  halfExtentUm: number,
  wavelengthNm: number,
  fNumber: number,
): Float32Array {
  const out = new Float32Array(size * size)
  if (!(size > 0) || !(halfExtentUm > 0) || !(wavelengthNm > 0) || !(fNumber > 0)) return out
  const wavelengthMm = wavelengthNm * 1e-6
  const halfExtentMm = halfExtentUm * 1e-3
  const scale = (2 * halfExtentMm) / size
  const c = (size - 1) / 2
  for (let y = 0; y < size; y += 1) {
    const dy = (y - c) * scale
    for (let x = 0; x < size; x += 1) {
      const dx = (x - c) * scale
      const r = Math.hypot(dx, dy)
      out[y * size + x] = airyIntensityAtRadius(r, wavelengthMm, fNumber)
    }
  }
  return out
}

/**
 * 计算圆形孔径的衍射与分辨率参数。纯函数，无副作用。
 */
export function computeDiffraction(input: DiffractionInput): DiffractionResult {
  const errors: string[] = []
  const warnings: string[] = []
  const notes: string[] = []

  const lambdaNm = Number(input.wavelengthNm)
  const fNumber = Number(input.fNumber)
  const diameterMm = Number(input.apertureDiameterMm)
  const mag = Number(input.magnification)

  if (!Number.isFinite(lambdaNm) || lambdaNm < MIN_WAVELENGTH_NM || lambdaNm > MAX_WAVELENGTH_NM) {
    errors.push(`波长 λ 必须在 ${MIN_WAVELENGTH_NM}–${MAX_WAVELENGTH_NM} nm 范围内`)
  }
  if (!Number.isFinite(fNumber) || fNumber < MIN_F_NUMBER || fNumber > MAX_F_NUMBER) {
    errors.push(`F 数 N 必须在 ${MIN_F_NUMBER}–${MAX_F_NUMBER} 范围内`)
  }
  if (!Number.isFinite(diameterMm) || diameterMm <= 0 || diameterMm > MAX_APERTURE_MM) {
    errors.push(`通光口径 D 必须在 (0, ${MAX_APERTURE_MM}] mm 范围内`)
  }
  if (!Number.isFinite(mag) || mag < MIN_MAGNIFICATION || mag > MAX_MAGNIFICATION) {
    errors.push(`放大率 |m| 必须在 ${MIN_MAGNIFICATION}–${MAX_MAGNIFICATION} 范围内`)
  }
  if (errors.length > 0) return invalidResult(errors, input)

  const wavelengthMm = lambdaNm * 1e-6
  const focalLengthMm = fNumber * diameterMm
  const naImage = Math.sin(Math.atan(diameterMm / (2 * focalLengthMm)))
  const naObject = naImage * mag

  // ---- 像方（传感器平面）----
  const airyRadiusImgMm = AIRY_FACTOR * wavelengthMm * fNumber
  const cutoffImg = 1 / (wavelengthMm * fNumber)

  // ---- 物方（把像方量按放大率折算）----
  const airyRadiusObjMm = airyRadiusImgMm / mag
  const cutoffObj = cutoffImg * mag

  const airyRadiusImgUm = airyRadiusImgMm * 1e3
  const firstDarkRingImgUm = airyRadiusImgUm

  // ---- 径向剖面（0 ~ 4 个艾里半径）----
  const samples = 320
  const rMaxMm = airyRadiusImgMm * 4
  const rUm: number[] = []
  const intensity: number[] = []
  for (let i = 0; i < samples; i += 1) {
    const r = (rMaxMm * i) / (samples - 1)
    rUm.push(r * 1e3)
    intensity.push(airyIntensityAtRadius(r, wavelengthMm, fNumber))
  }

  // ---- 暗环（J₁ 零点）与副极大（数值扫描，非硬编码）----
  const rings: AiryRing[] = []
  for (let k = 1; k <= 5; k += 1) {
    const v = j1Zero(k)
    const radiusMm = (v * wavelengthMm * fNumber) / Math.PI
    rings.push({
      order: k,
      radiusImgUm: radiusMm * 1e3,
      intensity: airyIntensityAtRadius(radiusMm, wavelengthMm, fNumber),
      kind: 'dark',
    })
  }
  const secondaryMaxima = findSecondaryMaxima(wavelengthMm, fNumber, airyRadiusImgMm, 3)
  for (const m of secondaryMaxima) {
    rings.push({ order: Math.round(m.vIndex), radiusImgUm: m.radiusImgUm, intensity: m.intensity, kind: 'bright' })
  }
  rings.sort((a, b) => a.radiusImgUm - b.radiusImgUm)

  // ---- 提示信息 ----
  if (fNumber < 1) {
    warnings.push(
      `F 数 N = ${fNumber.toFixed(2)} < 1：近轴近似 (NA ≈ 1/(2N)) 明显失效，真实系统还需考虑大孔径像差。`,
    )
  }
  if (fNumber > 22) {
    notes.push(
      `F 数较大（N = ${fNumber.toFixed(1)}）：衍射斑已明显大于常见像元尺寸，实际分辨率受衍射限制而非像元限制。`,
    )
  }
  notes.push(
    '艾里半径、瑞利判据与截止频率都是「像方」（传感器平面）量；物方数值 = 像方数值 ÷ |m|（截止频率则 × |m|）。',
  )
  notes.push(
    '截止频率 f_c = 1/(λN) 适用于「非相干」成像；相干成像的截止频率只有它的一半（1/(2λN)）。',
  )

  return {
    ok: true,
    errors,
    warnings,
    notes,
    wavelengthNm: lambdaNm,
    wavelengthMm,
    fNumber,
    apertureDiameterMm: diameterMm,
    focalLengthMm,
    magnification: mag,
    naImage,
    naObject,
    airyRadiusImgUm,
    airyDiameterImgUm: airyRadiusImgUm * 2,
    rayleighImgUm: airyRadiusImgUm,
    cutoffImgCyclesPerMm: cutoffImg,
    airyRadiusObjUm: airyRadiusObjMm * 1e3,
    rayleighObjUm: airyRadiusObjMm * 1e3,
    cutoffObjCyclesPerMm: cutoffObj,
    profile: { rUm, intensity },
    rings,
    firstDarkRingImgUm,
    secondaryMaxima: secondaryMaxima.map((m) => ({ radiusImgUm: m.radiusImgUm, intensity: m.intensity })),
    imageHalfExtentUm: airyRadiusImgUm * 4,
  }
}

/**
 * 扫描归一化强度曲线找副极大（局部最大值），返回位置与强度。
 * 用细化步长在相邻暗环之间搜索，属于真实数值计算而非查表。
 */
function findSecondaryMaxima(
  wavelengthMm: number,
  fNumber: number,
  airyRadiusMm: number,
  count: number,
): Array<{ vIndex: number; radiusImgUm: number; intensity: number }> {
  const out: Array<{ vIndex: number; radiusImgUm: number; intensity: number }> = []
  let vStart = j1Zero(1)
  for (let idx = 1; idx <= count; idx += 1) {
    const vEnd = idx < count ? j1Zero(idx + 1) : vStart + Math.PI
    let bestV = vStart
    let bestI = -1
    const steps = 2000
    for (let i = 0; i <= steps; i += 1) {
      const v = vStart + ((vEnd - vStart) * i) / steps
      const val = airyIntensity(v)
      if (val > bestI) {
        bestI = val
        bestV = v
      }
    }
    const radiusMm = (bestV * wavelengthMm * fNumber) / Math.PI
    out.push({ vIndex: idx, radiusImgUm: radiusMm * 1e3, intensity: bestI })
    vStart = vEnd
    void airyRadiusMm
  }
  return out
}

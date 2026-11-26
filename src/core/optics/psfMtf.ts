/**
 * ============================================================================
 * 模块四核心：PSF 与 MTF（复光瞳 + 二维 FFT 数值模型）
 * ============================================================================
 *
 * 【模型】
 * 圆形孔径 + 离焦的复光瞳函数（极坐标 ρ ∈ [0,1] 为归一化光瞳半径）：
 *
 *      P(ρ) = circ(ρ) · exp[ i·2π·W₂₀·ρ² ]
 *
 *   W₂₀ —— **离焦波像差**，单位是**波长 λ**（waves）。它表示光瞳边缘相对于中心
 *   多出来的光程差为 W₂₀·λ。ρ² 的二次型来自「离焦 = 波前曲率变化」。
 *   物理上 W₂₀ 与像面纵向偏移 Δz 的关系（近轴）：
 *
 *      W₂₀ = Δz / (8·λ·N²)        ⇒     Δz = 8·λ·N²·W₂₀
 *
 *   由此可得经典结论：W₂₀ = 0.25λ（四分之一波长判据）对应 Δz = 2λN²，
 *   这正是常用的「焦深 ±2λN²」的来源，可作为判据自检。
 *
 * 【计算链路】
 *   1. PSF(x,y) = | FT{ P } |²                  （相干传递后再取强度）
 *   2. OTF(ν)   = FT{ PSF } / FT{ PSF }(0)      （非相干传递函数）
 *   3. MTF(ν)   = |OTF(ν)|
 *   4. 斯特列尔比（近似、且对峰值精确）：S = |ΣP|² / (Σ|P|)²
 *
 * 【数值标定】（关键，否则 MTF 横轴会错）
 *   设网格 N×N、光瞳半径占 R 个采样点，光瞳采样间距为 dp：
 *      D = 2R·dp,  f = N_eff·D
 *      像面采样间距  dx = λ·f/(N·dp) = 2R·λ·N_eff / N      [mm]
 *      频率分辨率  dν = 1/(N·dx)  = 1/(2R·λ·N_eff)          [lp/mm]
 *      截止频率     ν_c = 1/(λ·N_eff)                       [lp/mm]
 *   于是 dν/ν_c = 1/(2R)，即**截止频率内可取的频点数只由 R 决定**（默认 R=25 → 50 点）；
 *   而 dx 由 2R/N 决定（默认 N=256, R=25 → 每个艾里半径约 6.25 个采样点）。
 *
 * 【验证】
 *   单元测试做两件事：①W₂₀ = 0 时数值 PSF 必须与解析艾里斑一致；
 *   ②数值 MTF 必须与解析衍射极限 MTF 一致
 *      MTF_diff(t) = (2/π)·[ arccos t − t·√(1−t²) ] ,  t = ν/ν_c
 *   这两条同时验证了光瞳构建、FFT 与坐标标定。
 *
 * 【局限】
 *   仅含离焦一种像差（不含球差/彗差/像散）、无偏振与镀膜、无探测器像元 MTF；
 *   光瞳圆形边界用 1 个采样宽的线性斜坡近似（抗锯齿），会带来约 1% 量级的 MTF 误差。
 * ============================================================================
 */

import { fft2d, fftShift2d } from '../math/fft'

export interface PsfInput {
  /** 真空波长 λ（nm） */
  wavelengthNm: number
  /** 像方（工作）F 数 N_eff = f/D */
  fNumber: number
  /** 离焦波像差 W₂₀（单位：λ） */
  defocusWaves: number
  /** 网格边长（2 的幂），默认 256 */
  gridSize?: number
  /** 光瞳半径占用的采样点数，默认 25 */
  pupilRadiusSamples?: number
}

export interface Curve {
  x: number[]
  y: number[]
}

export interface PsfResult {
  ok: boolean
  errors: string[]
  warnings: string[]
  notes: string[]
  wavelengthNm: number
  fNumber: number
  defocusWaves: number
  /** 等价的像面纵向离焦量（mm） */
  defocusMm: number
  /** 焦深参考 ±2λN²（mm） */
  depthOfFocusMm: number
  gridSize: number
  /** PSF 横向采样间距（μm） */
  pixelSizeUm: number
  /** PSF 网格覆盖的半宽（μm） */
  halfExtentUm: number
  /** 归一化 PSF（峰值 = 1），行优先 size×size */
  psf: Float32Array
  /** 径向平均截面 */
  crossSection: { rUm: number[]; intensity: number[] }
  /** 数值 MTF */
  mtf: Curve
  /** 解析衍射极限 MTF（参考曲线，同样在 ν ≤ ν_c 内） */
  mtfLimited: Curve
  /** 非相干截止频率（lp/mm） */
  cutoffCyclesPerMm: number
  /** 数值 MTF50（lp/mm）；达不到 0.5 时为 null */
  mtf50CyclesPerMm: number | null
  /** 衍射极限的 MTF50（lp/mm） */
  mtf50LimitedCyclesPerMm: number | null
  /** 斯特列尔比（峰值强度比） */
  strehlRatio: number
  /** 离焦引起的峰值下降（dB） */
  peakDropDb: number
}

export const MIN_DEFOCUS_WAVES = -5
export const MAX_DEFOCUS_WAVES = 5
const DEFAULT_GRID = 256
const DEFAULT_PUPIL_RADIUS = 25

/** 解析衍射极限 MTF（圆形孔径、非相干）：t = ν/ν_c */
export function diffractionLimitedMtf(t: number): number {
  const a = Math.abs(t)
  if (a >= 1) return 0
  return (2 / Math.PI) * (Math.acos(a) - a * Math.sqrt(1 - a * a))
}

function invalidResult(errors: string[], input: PsfInput): PsfResult {
  const zero: Curve = { x: [0], y: [0] }
  return {
    ok: false,
    errors,
    warnings: [],
    notes: [],
    wavelengthNm: input.wavelengthNm,
    fNumber: input.fNumber,
    defocusWaves: input.defocusWaves,
    defocusMm: Number.NaN,
    depthOfFocusMm: Number.NaN,
    gridSize: 0,
    pixelSizeUm: Number.NaN,
    halfExtentUm: Number.NaN,
    psf: new Float32Array(0),
    crossSection: { rUm: [], intensity: [] },
    mtf: zero,
    mtfLimited: zero,
    cutoffCyclesPerMm: Number.NaN,
    mtf50CyclesPerMm: null,
    mtf50LimitedCyclesPerMm: null,
    strehlRatio: Number.NaN,
    peakDropDb: Number.NaN,
  }
}

/** 在一维曲线上线性插值求 y = 0.5 的交点（用于 MTF50） */
export function findMtf50(curve: Curve): number | null {
  const { x, y } = curve
  for (let i = 1; i < y.length; i += 1) {
    const y0 = y[i - 1]
    const y1 = y[i]
    if (y0 >= 0.5 && y1 < 0.5) {
      const t = (y0 - 0.5) / (y0 - y1)
      return x[i - 1] + t * (x[i] - x[i - 1])
    }
  }
  return null
}

/**
 * 计算复光瞳 → PSF → MTF。纯函数；相同输入必然得到相同结果。
 */
export function computePsfMtf(input: PsfInput): PsfResult {
  const errors: string[] = []
  const warnings: string[] = []
  const notes: string[] = []

  const lambdaNm = Number(input.wavelengthNm)
  const fNumber = Number(input.fNumber)
  const w20 = Number(input.defocusWaves)
  const gridSize = Math.round(input.gridSize ?? DEFAULT_GRID)
  const pupilR = Math.round(input.pupilRadiusSamples ?? DEFAULT_PUPIL_RADIUS)

  if (!Number.isFinite(lambdaNm) || lambdaNm < 200 || lambdaNm > 1600) {
    errors.push('波长 λ 必须在 200–1600 nm 范围内')
  }
  if (!Number.isFinite(fNumber) || fNumber < 0.5 || fNumber > 64) {
    errors.push('F 数 N 必须在 0.5–64 范围内')
  }
  if (!Number.isFinite(w20) || Math.abs(w20) > 10) {
    errors.push('离焦 W₂₀ 必须在 ±10 λ 范围内')
  }
  if ((gridSize & (gridSize - 1)) !== 0 || gridSize < 64 || gridSize > 1024) {
    errors.push('网格边长必须是 64–1024 之间的 2 的幂')
  }
  if (!Number.isInteger(pupilR) || pupilR < 4 || pupilR * 4 > gridSize) {
    errors.push('光瞳半径采样数必须 ≥ 4 且不超过网格的 1/4')
  }
  if (errors.length > 0) return invalidResult(errors, input)

  const wavelengthMm = lambdaNm * 1e-6
  const n = gridSize
  const size2 = n * n

  // ---------------- 1. 构建复光瞳 P(ρ)·exp(i2πW₂₀ρ²) ----------------
  // 圆形边界的处理：每个像素用 4×4 子采样计算「落在圆内的面积占比」作为振幅，
  // 这样等效光瞳半径不偏大也不偏小（只用一圈线性斜坡会系统性缩小口径约 1/(2R)，
  // 导致 PSF 被略微展宽、艾里环位置偏移，进而放大 MTF 误差）。
  const re = new Float64Array(size2)
  const im = new Float64Array(size2)
  // 光瞳中心必须落在**整数像素** n/2 上：
  // 若用 (n−1)/2（半像素中心），PSF 峰值会落在两个采样点之间，
  // 之后按整数中心做径向统计就会把峰值附近「抹平」，使 PSF 看起来比解析艾里斑宽约 10%。
  const c = n / 2
  const subSamples = 4
  const subStep = 1 / (pupilR * subSamples) // 子采样步长（归一化光瞳坐标）
  let sumRe = 0
  let sumIm = 0
  let area = 0

  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      const baseX = (x - c) / pupilR
      const baseY = (y - c) / pupilR
      // 快速剔除：远在圆外的像素直接跳过
      if (Math.hypot(baseX, baseY) > 1 + subStep * 2) continue

      let inside = 0
      for (let sy = 0; sy < subSamples; sy += 1) {
        const oy = baseY + (sy + 0.5 - subSamples / 2) * subStep
        for (let sx = 0; sx < subSamples; sx += 1) {
          const ox = baseX + (sx + 0.5 - subSamples / 2) * subStep
          if (ox * ox + oy * oy <= 1) inside += 1
        }
      }
      if (inside === 0) continue
      const amp = inside / (subSamples * subSamples)
      const rho2 = baseX * baseX + baseY * baseY
      const phase = 2 * Math.PI * w20 * Math.min(rho2, 1)
      const idx = y * n + x
      re[idx] = amp * Math.cos(phase)
      im[idx] = amp * Math.sin(phase)
      sumRe += re[idx]
      sumIm += im[idx]
      area += amp
    }
  }

  // ---------------- 2. PSF = |FT{P}|² ----------------
  fft2d(re, im, n)
  const psfRaw = new Float64Array(size2)
  for (let i = 0; i < size2; i += 1) {
    psfRaw[i] = re[i] * re[i] + im[i] * im[i]
  }

  // ---------------- 3. 坐标标定 ----------------
  // dx = 2R·λ·N / n ；空中（n=1）近轴条件
  const dxMm = (2 * pupilR * wavelengthMm * fNumber) / n
  const pixelSizeUm = dxMm * 1e3
  const halfExtentUm = (n * dxMm * 1e3) / 2
  const dfCyclesPerMm = 1 / (n * dxMm)
  const cutoffCyclesPerMm = 1 / (wavelengthMm * fNumber)

  // ---------------- 4. 移频居中 + 归一化 + 径向截面 ----------------
  const shiftedRe = Float64Array.from(psfRaw)
  const shiftedIm = new Float64Array(size2)
  fftShift2d(shiftedRe, shiftedIm, n)

  const centerIdx = (n / 2) * n + n / 2
  const peak = shiftedRe[centerIdx]
  const psf = new Float32Array(size2)
  if (!(peak > 0) || !Number.isFinite(peak)) {
    errors.push('PSF 峰值异常（可能光瞳采样不足）')
    return invalidResult(errors, input)
  }
  for (let i = 0; i < size2; i += 1) psf[i] = shiftedRe[i] / peak

  const rUm: number[] = []
  const intensity: number[] = []
  const bins = 128
  const binSum = new Float64Array(bins)
  const binCount = new Float64Array(bins)
  const binRadiusSum = new Float64Array(bins)
  const maxR = n / 2
  for (let y = 0; y < n; y += 1) {
    const dy = y - n / 2
    for (let x = 0; x < n; x += 1) {
      const dxx = x - n / 2
      const rSamples = Math.hypot(dxx, dy)
      if (rSamples >= maxR) continue
      const b = Math.floor((rSamples / maxR) * bins)
      binSum[b] += psf[y * n + x]
      binRadiusSum[b] += rSamples
      binCount[b] += 1
    }
  }
  for (let b = 0; b < bins; b += 1) {
    if (binCount[b] === 0) continue
    // x 轴用该环带内**实际像素的平均半径**，而不是环带几何中点：
    // 整数半径上的像素数分布不均（例如 r∈[1,2) 内实际只有 r=1 与 √2 两圈），
    // 用几何中点会把曲线整体「向右挪」，使 PSF 看起来比解析解更宽。
    const meanRadiusSamples = binRadiusSum[b] / binCount[b]
    rUm.push(meanRadiusSamples * pixelSizeUm)
    intensity.push(binSum[b] / binCount[b])
  }

  // ---------------- 5. OTF = FT{PSF} / FT{PSF}(0) ----------------
  const otfRe = Float64Array.from(psfRaw) // 用未归一化 PSF，避免除零
  const otfIm = new Float64Array(size2)
  fft2d(otfRe, otfIm, n)
  const otfDc = otfRe[0]
  const mtf: Curve = { x: [], y: [] }
  const mtfLimited: Curve = { x: [], y: [] }
  // 取 k = 0 .. n/2（正频率，且不超过截止频率）
  for (let k = 0; k < n / 2; k += 1) {
    const freq = k * dfCyclesPerMm
    if (freq > cutoffCyclesPerMm * 1.0001) break
    mtf.x.push(freq)
    mtf.y.push(Math.abs(otfRe[k] / otfDc))
    mtfLimited.x.push(freq)
    mtfLimited.y.push(diffractionLimitedMtf(freq / cutoffCyclesPerMm))
  }
  if (mtf.x.length === 0) {
    mtf.x.push(0)
    mtf.y.push(1)
    mtfLimited.x.push(0)
    mtfLimited.y.push(1)
  }

  // ---------------- 6. 斯特列尔比（对峰值精确） ----------------
  const sumMag = Math.hypot(sumRe, sumIm)
  const areaSq = area * area
  const strehlRatio = areaSq > 0 ? (sumMag * sumMag) / areaSq : Number.NaN

  // ---------------- 7. 物理量换算与提示 ----------------
  const defocusMm = 8 * wavelengthMm * fNumber * fNumber * w20
  const depthOfFocusMm = 2 * wavelengthMm * fNumber * fNumber

  if (Math.abs(w20) >= 0.25) {
    warnings.push(
      `离焦 W₂₀ = ${w20.toFixed(2)} λ 已超过四分之一波长判据（0.25 λ），峰值强度与中高频 MTF 明显下降。`,
    )
  }
  notes.push(
    `离焦波像差 W₂₀ 指光瞳边缘相对中心的附加光程差，单位 λ；与本例 F 数下的像面偏移 Δz = 8λN²W₂₀ = ${(defocusMm * 1e3).toFixed(1)} μm 等效。焦深参考 ±2λN² = ±${(depthOfFocusMm * 1e3).toFixed(1)} μm。`,
  )
  notes.push(
    `PSF 采样间距 ${pixelSizeUm.toFixed(3)} μm，网格覆盖 ±${halfExtentUm.toFixed(1)} μm；频率分辨率 ${dfCyclesPerMm.toFixed(2)} lp/mm，截止频率 ${cutoffCyclesPerMm.toFixed(1)} lp/mm。`,
  )
  notes.push('MTF 由 |FT{PSF}| 归一化得到，未计入探测器像元 MTF 与镀膜、偏振效应。')

  return {
    ok: true,
    errors,
    warnings,
    notes,
    wavelengthNm: lambdaNm,
    fNumber,
    defocusWaves: w20,
    defocusMm,
    depthOfFocusMm,
    gridSize: n,
    pixelSizeUm,
    halfExtentUm,
    psf,
    crossSection: { rUm, intensity },
    mtf,
    mtfLimited,
    cutoffCyclesPerMm,
    mtf50CyclesPerMm: findMtf50(mtf),
    mtf50LimitedCyclesPerMm: findMtf50(mtfLimited),
    strehlRatio,
    peakDropDb: strehlRatio > 0 ? -10 * Math.log10(strehlRatio) : Number.POSITIVE_INFINITY,
  }
}

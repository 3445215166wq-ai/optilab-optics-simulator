/**
 * ============================================================================
 * 模块一核心：理想薄透镜近轴成像 + 光线追迹
 * ============================================================================
 *
 * 【物理模型】
 *   1. 薄透镜（thin lens）：忽略透镜厚度，把光线在前后表面的两次折射等效为
 *      在透镜「主平面」上的一次偏折。
 *   2. 近轴近似（paraxial approximation）：只考虑与光轴夹角很小的光线，
 *      用 sinθ ≈ tanθ ≈ θ 线性化，因此成像关系是严格的线性关系，不存在像差。
 *   3. 符号约定（本文件内部使用「实物正距离」约定，对外输出带符号结果）：
 *        - 光轴为 x 轴，光线从左向右传播；
 *        - 物距 u = objectDistance 始终 > 0，表示物体位于透镜左侧 u 处；
 *        - 焦距 f 带符号：凸透镜（会聚）f > 0，凹透镜（发散）f < 0；
 *        - 像距 v 由成像公式解出，v > 0 表示像在透镜右侧（实像），
 *          v < 0 表示像在透镜左侧（虚像）。
 *
 * 【核心公式】
 *   高斯成像公式（实物正约定）：   1/f = 1/u + 1/v     ⇒  v = f·u / (u − f)
 *   横向放大率：                  m = −v/u = h'/h
 *        m < 0 → 倒立（实像必然倒立）；  m > 0 → 正立（虚像必然正立）
 *   牛顿公式（可选互校验）：        x·x' = f²，x = u − f，x' = v − f
 *
 * 【特殊情况处理】
 *   u = f  → 分母为 0，出射光为平行光，像在无穷远，v 不取有限值（不做数值硬截断）；
 *   u < f  → v < 0，虚像，出射光线反向延长线相交，只能用眼睛/目镜观察；
 *   f < 0  → 凹透镜，对任意 u > 0 都有 v < 0，永远成正立缩小的虚像。
 *
 * 本模块只做「理想模型」计算，不含像差、衍射与镀膜效应，不能替代商业光学设计软件。
 * ============================================================================
 */

import type { Segment, Vec2 } from '../geometry'
import { linspace } from '../geometry'
import { toDeg } from '../units'

export type LensType = 'convex' | 'concave'

/** 成像性质 */
export type ImageStatus = 'real' | 'virtual' | 'infinite' | 'invalid'

export interface ThinLensInput {
  lensType: LensType
  /** 焦距绝对值 |f|，单位 mm（> 0） */
  focalLength: number
  /** 物距 u，单位 mm（> 0） */
  objectDistance: number
  /** 物高 h，单位 mm（≥ 0） */
  objectHeight: number
  /** 通光口径（孔径直径）D，单位 mm（> 0） */
  apertureDiameter: number
  /** 光锥采样光线数（建议奇数，保证有一条穿过光心），默认 11 */
  rayCount?: number
}

/** 一条光线被拆成的若干直线段；dashed=true 表示「虚像反向延长线」而非真实光路 */
export interface RaySegment extends Segment {
  dashed?: boolean
}

/** 主光线角色，用于配色与图例 */
export type RayRole = 'parallel' | 'center' | 'focal' | 'bundle'

export interface TracedRay {
  id: string
  role: RayRole
  label: string
  labelEn: string
  /** 光线在透镜平面上的高度 y（mm），用于判断是否被孔径拦截 */
  apertureHeight: number
  /** true = 该光线超出通光口径，真实系统中会被镜框/光阑挡住 */
  blocked: boolean
  segments: RaySegment[]
}

export interface ImageInfo {
  status: ImageStatus
  /** 像距 v（mm，带符号；null = 无穷远或无效） */
  distance: number | null
  /** 像面位置（与透镜主平面同一坐标原点，mm） */
  z: number | null
  /** 像高 h'（mm，带符号；负值表示倒立） */
  height: number | null
  /** 横向放大率 m */
  magnification: number | null
  /** |m| */
  absoluteMagnification: number | null
  /** 是否倒立 */
  isInverted: boolean
}

export interface ThinLensResult {
  ok: boolean
  errors: string[]
  warnings: string[]
  notes: string[]
  lensType: LensType
  /** 带符号焦距 f */
  focalLengthSigned: number
  focalLengthAbs: number
  objectDistance: number
  objectHeight: number
  apertureDiameter: number
  apertureRadius: number
  image: ImageInfo
  /** 焦点位置：物方焦点 F 在 z = −f，像方焦点 F' 在 z = +f */
  focalPoints: { objectSideZ: number; imageSideZ: number }
  /** 相对孔径倒数 F/# = |f| / D */
  fNumber: number
  /** 物方数值孔径（近轴，sin 用 tan 近似） */
  naObject: number
  /** 像方数值孔径（近轴）；无穷远成像时为 null */
  naImage: number | null
  /** 物方/像方会聚半角（度） */
  objectHalfAngleDeg: number
  imageHalfAngleDeg: number | null
  principalRays: TracedRay[]
  bundleRays: TracedRay[]
  /** 建议的绘制窗口（光轴方向，mm），渲染层据此自适应缩放 */
  bounds: { xMin: number; xMax: number }
  rayCount: number
}

export const MIN_FOCAL_LENGTH = 1
export const MIN_OBJECT_DISTANCE = 0.5
export const MAX_APERTURE_DIAMETER = 400
export const MAX_RAY_COUNT = 41
/** 超过该像距（300 m）视为成像于无穷远，仅用于避免绘制时数值爆炸 */
const MAX_ABS_IMAGE_MM = 3e5
/** 焦距容差（相对）：用于判定 u = f 的精确特殊情形 */
const FOCAL_TOL_REL = 1e-6

const RAY_META: Record<RayRole, { label: string; labelEn: string }> = {
  parallel: { label: '平行光轴光线', labelEn: 'Parallel ray' },
  center: { label: '过光心光线', labelEn: 'Chief ray' },
  focal: { label: '过物方焦点光线', labelEn: 'Focal ray' },
  bundle: { label: '光锥采样光线', labelEn: 'Ray bundle' },
}

/** 非法输入时返回的安全结果，保证 UI 永远不会拿到 NaN 去渲染 */
function invalidResult(errors: string[], input: ThinLensInput): ThinLensResult {
  return {
    ok: false,
    errors,
    warnings: [],
    notes: [],
    lensType: input.lensType,
    focalLengthSigned: 0,
    focalLengthAbs: Math.abs(input.focalLength) || 0,
    objectDistance: input.objectDistance || 0,
    objectHeight: input.objectHeight || 0,
    apertureDiameter: input.apertureDiameter || 0,
    apertureRadius: (input.apertureDiameter || 0) / 2,
    image: {
      status: 'invalid',
      distance: null,
      z: null,
      height: null,
      magnification: null,
      absoluteMagnification: null,
      isInverted: false,
    },
    focalPoints: { objectSideZ: 0, imageSideZ: 0 },
    fNumber: Number.NaN,
    naObject: Number.NaN,
    naImage: null,
    objectHalfAngleDeg: Number.NaN,
    imageHalfAngleDeg: null,
    principalRays: [],
    bundleRays: [],
    bounds: { xMin: -100, xMax: 100 },
    rayCount: 0,
  }
}

/** 把任意整数吸附到 [lo, hi] 内的奇数（保证必有一条穿过光心的光线） */
function clampOdd(value: number, lo: number, hi: number): number {
  let n = Math.round(Number.isFinite(value) ? value : lo)
  n = Math.min(hi, Math.max(lo, n))
  if (n % 2 === 0) n += 1
  return n % 2 === 0 ? n - 2 : n
}

/**
 * 计算薄透镜成像结果与光路。
 * 该函数是纯函数：相同输入必然产生相同输出，便于单元测试与结果复现。
 */
export function computeThinLens(input: ThinLensInput): ThinLensResult {
  const errors: string[] = []
  const warnings: string[] = []
  const notes: string[] = []

  const fMag = Number(input.focalLength)
  const u = Number(input.objectDistance)
  const h = Number(input.objectHeight)
  const D = Number(input.apertureDiameter)

  if (!Number.isFinite(fMag) || fMag < MIN_FOCAL_LENGTH) {
    errors.push(`焦距 |f| 必须是 ≥ ${MIN_FOCAL_LENGTH} mm 的数值（当前输入无效）`)
  }
  if (!Number.isFinite(u) || u < MIN_OBJECT_DISTANCE) {
    errors.push(`物距 u 必须是 ≥ ${MIN_OBJECT_DISTANCE} mm 的数值（当前输入无效）`)
  }
  if (!Number.isFinite(h) || h < 0) {
    errors.push('物高 h 必须是 ≥ 0 mm 的数值（当前输入无效）')
  }
  if (!Number.isFinite(D) || D <= 0 || D > MAX_APERTURE_DIAMETER) {
    errors.push(`通光口径 D 必须在 (0, ${MAX_APERTURE_DIAMETER}] mm 范围内`)
  }
  if (errors.length > 0) return invalidResult(errors, input)

  const f = input.lensType === 'concave' ? -fMag : fMag
  const R = D / 2
  const rayCount = clampOdd(input.rayCount ?? 11, 3, MAX_RAY_COUNT)

  // ---------------- 1. 高斯成像公式 ----------------
  const denom = u - f
  const focalTol = FOCAL_TOL_REL * Math.max(Math.abs(f), u)
  let atInfinity = Math.abs(denom) <= focalTol
  let v = atInfinity ? Number.NaN : (f * u) / denom

  if (!atInfinity && (!Number.isFinite(v) || Math.abs(v) > MAX_ABS_IMAGE_MM)) {
    atInfinity = true
    v = Number.NaN
  }

  const m = atInfinity ? Number.NaN : -v / u
  const hImage = atInfinity ? Number.NaN : m * h
  const status: ImageStatus = atInfinity ? 'infinite' : v > 0 ? 'real' : 'virtual'

  if (atInfinity) {
    warnings.push(
      '物距等于焦距 (u = f)：出射光线严格平行于光轴，像在无穷远，无法在有限距离上成像（本程序不做数值截断）。',
    )
  } else if (Math.abs(v) > 20 * Math.max(u, Math.abs(f))) {
    warnings.push(
      '物距接近焦距：像距 |v| 急剧增大，实际系统中像面尺寸、像差与照度都会严重恶化。',
    )
  }

  if (status === 'virtual') {
    notes.push(
      input.lensType === 'concave'
        ? '凹透镜（发散）对实物永远成 正立、缩小、虚像，像与物在透镜同侧。'
        : '物距小于焦距 (u < f)：成正立、放大的虚像（放大镜原理），像与物在透镜同侧。',
    )
  } else if (status === 'real') {
    notes.push('实像：由出射光线的真实会聚点形成，可被屏幕/相机传感器直接接收，且必然倒立。')
  }

  // ---------------- 2. 光路追迹 ----------------
  // 建议的绘制窗口：保证物、像、焦点都落在窗口内
  const leftNeed = Math.max(u, Math.abs(f), !atInfinity && v < 0 ? -v : 0)
  const rightNeed = Math.max(Math.abs(f), !atInfinity && v > 0 ? v : 0, u * 0.35, 40)
  const xMin = -leftNeed * 1.15 - 8
  const xMax = rightNeed * 1.15 + 8

  /**
   * 出射光线斜率：薄透镜近轴模型下，从物点出发的全部光线经透镜后
   * 必然通过像点 (v, h')（实像）或反向延长通过像点（虚像）。
   * 因此只需知道透镜平面上的高度 y 即可写出出射方向：
   *     k = (h' − y) / v
   * 无穷远成像时全部出射光线平行于「过光心的那条光线」，即 k = −h/u。
   */
  const exitSlope = (y: number): number => {
    if (atInfinity) return -h / u
    return (hImage - y) / v
  }

  const needsExtension = status === 'virtual'

  const buildSegments = (y: number): RaySegment[] => {
    const k = exitSlope(y)
    const segments: RaySegment[] = [
      // 入射段：物点 → 透镜平面
      { from: { x: -u, y: h }, to: { x: 0, y } },
      // 出射段：透镜平面 → 窗口右边界
      { from: { x: 0, y }, to: { x: xMax, y: y + k * xMax } },
    ]
    if (needsExtension) {
      // 虚像：出射光线的反向延长线（虚线），相交于虚像点
      segments.push({ from: { x: 0, y }, to: { x: xMin, y: y + k * xMin }, dashed: true })
    }
    return segments
  }

  const makeRay = (role: RayRole, id: string, y: number): TracedRay => {
    const meta = RAY_META[role]
    return {
      id,
      role,
      label: meta.label,
      labelEn: meta.labelEn,
      apertureHeight: y,
      blocked: Math.abs(y) > R + 1e-9,
      segments: buildSegments(y),
    }
  }

  const principalRays: TracedRay[] = []
  // ① 平行光轴入射 → 出射过像方焦点 F'（z = +f）
  principalRays.push(makeRay('parallel', 'principal-parallel', h))
  // ② 过光心 → 方向不变
  principalRays.push(makeRay('center', 'principal-center', 0))
  // ③ 过物方焦点 F（z = −f）入射 → 出射平行光轴
  const focalDenom = u - f
  if (Math.abs(focalDenom) > focalTol) {
    const yFocal = (-h * f) / focalDenom
    if (Number.isFinite(yFocal) && Math.abs(yFocal) <= 40 * Math.max(R, 1)) {
      principalRays.push(makeRay('focal', 'principal-focal', yFocal))
    } else {
      warnings.push('第三条主光线（过物方焦点）在透镜平面上的高度过大，已省略绘制。')
    }
  } else {
    warnings.push(
      '物点位于物方焦平面（u = f），过焦点主光线与平行光轴主光线重合，第三条主光线退化并省略。',
    )
  }

  const blockedPrincipal = principalRays.filter((ray) => ray.blocked)
  if (blockedPrincipal.length > 0) {
    warnings.push(
      `有 ${blockedPrincipal.length} 条主光线超出通光口径 D = ${D} mm（理想作图仍绘制，真实系统中会被镜框遮挡）。`,
    )
  }

  // 光锥采样光线：在通光口径内均匀取样，展示「光锥成像」与孔径的关系
  const bundleRays: TracedRay[] = []
  const heights = linspace(-R, R, rayCount)
  for (let i = 0; i < heights.length; i += 1) {
    bundleRays.push(makeRay('bundle', `bundle-${i}`, heights[i]))
  }

  // ---------------- 3. 派生光学参数 ----------------
  const fNumber = Math.abs(f) / D
  const objectHalfAngleDeg = toDeg(Math.atan(R / u))
  const naObject = Math.sin(Math.atan(R / u))
  const imageHalfAngleDeg = atInfinity ? null : toDeg(Math.atan(R / Math.abs(v)))
  const naImage = atInfinity ? null : Math.sin(Math.atan(R / Math.abs(v)))

  if (fNumber < 1) {
    warnings.push(
      `相对孔径 F/# = ${fNumber.toFixed(2)} 已达到或超过近轴近似适用范围，实际系统必须考虑球差等大孔径像差。`,
    )
  }

  return {
    ok: true,
    errors,
    warnings,
    notes,
    lensType: input.lensType,
    focalLengthSigned: f,
    focalLengthAbs: fMag,
    objectDistance: u,
    objectHeight: h,
    apertureDiameter: D,
    apertureRadius: R,
    image: {
      status,
      distance: atInfinity ? null : v,
      z: atInfinity ? null : v,
      height: atInfinity ? null : hImage,
      magnification: atInfinity ? null : m,
      absoluteMagnification: atInfinity ? null : Math.abs(m),
      isInverted: !atInfinity && m < 0,
    },
    focalPoints: { objectSideZ: -f, imageSideZ: f },
    fNumber,
    naObject,
    naImage,
    objectHalfAngleDeg,
    imageHalfAngleDeg,
    principalRays,
    bundleRays,
    bounds: { xMin, xMax },
    rayCount,
  }
}

/** 生成用于日志/报告的「仿真结论」一句话摘要 */
export function summarizeThinLens(result: ThinLensResult): string {
  if (!result.ok) return `参数非法：${result.errors.join('；')}`
  const { image, focalLengthSigned, objectDistance } = result
  const fType = focalLengthSigned > 0 ? '凸透镜' : '凹透镜'
  if (image.status === 'infinite') {
    return `${fType} f=${Math.abs(focalLengthSigned)}mm, u=${objectDistance}mm → 出射平行光，像在无穷远`
  }
  const kind = image.status === 'real' ? '实像' : '虚像'
  const orientation = (image.magnification ?? 0) < 0 ? '倒立' : '正立'
  return `${fType} f=${Math.abs(focalLengthSigned)}mm, u=${objectDistance}mm → v=${(image.distance ?? 0).toFixed(2)}mm, m=${(image.magnification ?? 0).toFixed(3)}, ${kind}·${orientation}`
}

/** 供渲染层使用：把结果中的关键点导出为世界坐标 */
export function keyPoints(result: ThinLensResult): {
  object: Vec2
  image: Vec2 | null
  frontFocal: Vec2
  backFocal: Vec2
} {
  const object: Vec2 = { x: -result.objectDistance, y: result.objectHeight }
  return {
    object,
    image:
      result.image.z === null || result.image.height === null
        ? null
        : { x: result.image.z, y: result.image.height },
    frontFocal: { x: result.focalPoints.objectSideZ, y: 0 },
    backFocal: { x: result.focalPoints.imageSideZ, y: 0 },
  }
}

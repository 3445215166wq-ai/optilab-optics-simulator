/** 模块一参数定义与预设工况 */
import type { LensType } from '@/core/optics/thinLens'
import type { ParamSection } from '@/components/ui/params'

export type GeoParams = {
  lensType: LensType
  /** 焦距绝对值 |f|，mm */
  focalLength: number
  /** 物距 u，mm */
  objectDistance: number
  /** 物高 h，mm */
  objectHeight: number
  /** 通光口径 D，mm */
  apertureDiameter: number
  /** 光锥采样光线数 */
  rayCount: number
}

export interface GeoViewOptions {
  showPrincipalRays: boolean
  showBundleRays: boolean
  showVirtualExtensions: boolean
  showAnnotations: boolean
  showImagePlane: boolean
}

export const GEO_DEFAULTS: GeoParams = {
  lensType: 'convex',
  focalLength: 100,
  objectDistance: 300,
  objectHeight: 15,
  apertureDiameter: 40,
  rayCount: 11,
}

export const GEO_DEFAULT_VIEW: GeoViewOptions = {
  showPrincipalRays: true,
  showBundleRays: true,
  showVirtualExtensions: true,
  showAnnotations: true,
  showImagePlane: true,
}

export const GEO_SCHEMA: ParamSection[] = [
  {
    title: '透镜',
    titleEn: 'Lens',
    fields: [
      {
        kind: 'segmented',
        key: 'lensType',
        label: '透镜类型',
        labelEn: 'Lens type',
        options: [
          { value: 'convex', label: '凸透镜 · 会聚', title: 'f > 0，会聚光线' },
          { value: 'concave', label: '凹透镜 · 发散', title: 'f < 0，发散光线' },
        ],
      },
      {
        kind: 'range',
        key: 'focalLength',
        label: '焦距 |f|',
        labelEn: 'Focal length',
        unit: 'mm',
        min: 20,
        max: 400,
        step: 5,
        hint: '输入焦距绝对值；凸透镜 f > 0，凹透镜内部按 f < 0 计算',
      },
      {
        kind: 'range',
        key: 'apertureDiameter',
        label: '通光口径 D',
        labelEn: 'Aperture diameter',
        unit: 'mm',
        min: 6,
        max: 120,
        step: 2,
        hint: '决定光锥范围与相对孔径 F/# = |f|/D',
      },
    ],
  },
  {
    title: '物体',
    titleEn: 'Object',
    fields: [
      {
        kind: 'range',
        key: 'objectDistance',
        label: '物距 u',
        labelEn: 'Object distance',
        unit: 'mm',
        min: 20,
        max: 900,
        step: 5,
        hint: '从透镜主平面量起。u > f 成实像；u = f 出射平行光；u < f 成正立放大虚像',
      },
      {
        kind: 'range',
        key: 'objectHeight',
        label: '物高 h',
        labelEn: 'Object height',
        unit: 'mm',
        min: 1,
        max: 40,
        step: 1,
      },
    ],
  },
  {
    title: '采样',
    titleEn: 'Sampling',
    fields: [
      {
        kind: 'range',
        key: 'rayCount',
        label: '光锥采样光线',
        labelEn: 'Ray count',
        unit: '条',
        min: 3,
        max: 31,
        step: 2,
        hint: '取奇数可保证有一条恰好穿过光心的光线',
      },
    ],
  },
]

export interface GeoPreset {
  id: string
  label: string
  labelEn: string
  hint: string
  patch: Partial<GeoParams>
}

/** 预设工况：覆盖教材中全部典型情形，用于快速验证公式行为 */
export const GEO_PRESETS: GeoPreset[] = [
  {
    id: 'u-gt-2f',
    label: 'u > 2f · 缩小倒立实像',
    labelEn: 'u > 2f',
    hint: '照相机典型工况：u = 300 mm, f = 100 mm → v = 150 mm, m = −0.5',
    patch: { lensType: 'convex', focalLength: 100, objectDistance: 300, objectHeight: 15, apertureDiameter: 40 },
  },
  {
    id: 'f-lt-u-lt-2f',
    label: 'f < u < 2f · 放大倒立实像',
    labelEn: 'f < u < 2f',
    hint: '投影/显微物镜工况：u = 150 mm, f = 100 mm → v = 300 mm, m = −2',
    patch: { lensType: 'convex', focalLength: 100, objectDistance: 150, objectHeight: 15, apertureDiameter: 40 },
  },
  {
    id: 'u-eq-f',
    label: 'u = f · 出射平行光',
    labelEn: 'u = f',
    hint: '准直工况：像在无穷远，像距不取有限值',
    patch: { lensType: 'convex', focalLength: 100, objectDistance: 100, objectHeight: 15, apertureDiameter: 40 },
  },
  {
    id: 'u-lt-f',
    label: 'u < f · 放大镜虚像',
    labelEn: 'u < f',
    hint: '放大镜工况：u = 60 mm, f = 100 mm → v = −150 mm, m = +2.5（虚像）',
    patch: { lensType: 'convex', focalLength: 100, objectDistance: 60, objectHeight: 15, apertureDiameter: 40 },
  },
  {
    id: 'concave',
    label: '凹透镜 · 缩小正立虚像',
    labelEn: 'Concave',
    hint: '凹透镜恒成正立缩小虚像：u = 300 mm, f = −100 mm → v = −66.7 mm, m = +0.333',
    patch: { lensType: 'concave', focalLength: 100, objectDistance: 300, objectHeight: 15, apertureDiameter: 40 },
  },
]

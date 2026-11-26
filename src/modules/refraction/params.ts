/** 模块二参数定义 */
import type { ParamSection } from '@/components/ui/params'

export type RefractionParams = {
  /** 入射角 θ₁（度） */
  incidenceAngle: number
  /** 入射侧（上方介质）折射率 */
  n1: number
  /** 折射侧（下方介质）折射率 */
  n2: number
  /** 真空波长 λ₀（nm），用于换算介质中波长 */
  wavelength: number
}

export const REFRACTION_DEFAULTS: RefractionParams = {
  incidenceAngle: 45,
  n1: 1.000293,
  n2: 1.333,
  wavelength: 550,
}

export const REFRACTION_SCHEMA: ParamSection[] = [
  {
    title: '入射条件',
    titleEn: 'Incidence',
    fields: [
      {
        kind: 'range',
        key: 'incidenceAngle',
        label: '入射角 θ₁',
        labelEn: 'Angle of incidence',
        unit: '°',
        min: 0,
        max: 89,
        step: 0.5,
        digits: 1,
        hint: '相对法线量取。θ₁ = 0 为正入射；接近 90° 为掠入射',
      },
      {
        kind: 'range',
        key: 'wavelength',
        label: '波长 λ₀',
        labelEn: 'Wavelength (vacuum)',
        unit: 'nm',
        min: 200,
        max: 1600,
        step: 10,
        hint: '仅影响介质中波长与光速显示；本模型折射率取常数，未计入色散',
      },
    ],
  },
  {
    title: '介质',
    titleEn: 'Media',
    fields: [
      {
        kind: 'range',
        key: 'n1',
        label: '入射侧折射率 n₁',
        labelEn: 'Index n1',
        unit: '',
        min: 1,
        max: 3.5,
        step: 0.001,
        digits: 4,
        hint: 'n₁ > n₂ 才有临界角，才可能发生全反射',
      },
      {
        kind: 'range',
        key: 'n2',
        label: '折射侧折射率 n₂',
        labelEn: 'Index n2',
        unit: '',
        min: 1,
        max: 3.5,
        step: 0.001,
        digits: 4,
        hint: '临界角 θc = arcsin(n₂/n₁)（仅 n₁ > n₂ 时存在）',
      },
    ],
  },
]

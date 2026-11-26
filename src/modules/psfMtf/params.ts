/** 模块四参数定义与预设 */
import type { ParamSection } from '@/components/ui/params'

export type PsfParams = {
  /** 波长 λ（nm） */
  wavelength: number
  /** 像方 F 数 N */
  fNumber: number
  /** 离焦波像差 W₂₀（单位 λ） */
  defocus: number
}

export type PsfViewOptions = {
  logScale: boolean
  showAiryReference: boolean
}

export const PSF_DEFAULTS: PsfParams = {
  wavelength: 550,
  fNumber: 8,
  defocus: 0,
}

export const PSF_DEFAULT_VIEW: PsfViewOptions = {
  logScale: true,
  showAiryReference: true,
}

export const PSF_SCHEMA: ParamSection[] = [
  {
    title: '光源与孔径',
    titleEn: 'Source & aperture',
    fields: [
      {
        kind: 'range',
        key: 'wavelength',
        label: '波长 λ',
        labelEn: 'Wavelength',
        unit: 'nm',
        min: 400,
        max: 700,
        step: 5,
        hint: '截止频率 f_c = 1/(λN)，波长越短通频带越宽',
      },
      {
        kind: 'range',
        key: 'fNumber',
        label: '像方 F 数 N',
        labelEn: 'F-number',
        unit: '',
        min: 1,
        max: 32,
        step: 0.5,
        digits: 1,
        hint: 'N 越大，衍射受限的截止频率越低、焦深越深',
      },
    ],
  },
  {
    title: '离焦',
    titleEn: 'Defocus',
    fields: [
      {
        kind: 'range',
        key: 'defocus',
        label: '离焦波像差 W₂₀',
        labelEn: 'Defocus wavefront',
        unit: 'λ',
        min: -2,
        max: 2,
        step: 0.05,
        digits: 2,
        hint: '光瞳边缘相对中心的附加光程差（单位：波长）。等价像面偏移 Δz = 8λN²W₂₀；|W₂₀| = 0.25 即焦深边界',
      },
    ],
  },
]

export interface PsfPreset {
  id: string
  label: string
  hint: string
  patch: Partial<PsfParams>
}

export const PSF_PRESETS: PsfPreset[] = [
  {
    id: 'focus',
    label: '理想焦平面（W₂₀ = 0）',
    hint: '此时 MTF 就是衍射极限曲线，PSF 为标准艾里斑',
    patch: { defocus: 0, fNumber: 8, wavelength: 550 },
  },
  {
    id: 'quarter',
    label: '焦深边界（W₂₀ = 0.25λ）',
    hint: '四分之一波长判据：Δz = 2λN²，MTF 开始明显下滑但仍可用',
    patch: { defocus: 0.25, fNumber: 8, wavelength: 550 },
  },
  {
    id: 'half',
    label: '明显离焦（W₂₀ = 0.5λ）',
    hint: '中高频 MTF 明显下降，是自动对焦模块要修正的典型工况',
    patch: { defocus: 0.5, fNumber: 8, wavelength: 550 },
  },
  {
    id: 'one',
    label: '严重离焦（W₂₀ = 1λ）',
    hint: '轴上强度接近零点（纯离焦圆孔在整数波长处出现轴上零点），必须重新对焦',
    patch: { defocus: 1, fNumber: 8, wavelength: 550 },
  },
  {
    id: 'fast',
    label: '大光圈 F/2.8',
    hint: '截止频率更高，但焦深极浅，对离焦更敏感',
    patch: { defocus: 0, fNumber: 2.8, wavelength: 550 },
  },
  {
    id: 'slow',
    label: '小光圈 F/16',
    hint: '焦深深、对离焦不敏感，但衍射受限严重',
    patch: { defocus: 0, fNumber: 16, wavelength: 550 },
  },
]

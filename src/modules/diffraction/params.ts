/** 模块三参数定义与预设 */
import type { ParamSection } from '@/components/ui/params'

export type DiffractionParams = {
  /** 波长 λ（nm） */
  wavelength: number
  /** 像方 F 数 N = f/D */
  fNumber: number
  /** 通光口径 D（mm） */
  aperture: number
  /** 横向放大率绝对值 |m| */
  magnification: number
}

export type DiffractionViewOptions = {
  logScale: boolean
  showRings: boolean
}

export const DIFFRACTION_DEFAULTS: DiffractionParams = {
  wavelength: 550,
  fNumber: 8,
  aperture: 25,
  magnification: 1,
}

export const DIFFRACTION_DEFAULT_VIEW: DiffractionViewOptions = {
  logScale: false,
  showRings: true,
}

export const DIFFRACTION_SCHEMA: ParamSection[] = [
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
        hint: '可见光 400–700 nm；艾里半径与 λ 成正比',
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
        hint: 'N = f/D；艾里半径 = 1.22λN，N 越大衍射斑越大',
      },
      {
        kind: 'range',
        key: 'aperture',
        label: '通光口径 D',
        labelEn: 'Aperture',
        unit: 'mm',
        min: 2,
        max: 100,
        step: 1,
        hint: '派生焦距 f = N·D；NA′ ≈ D/(2f) = 1/(2N)',
      },
    ],
  },
  {
    title: '成像条件',
    titleEn: 'Imaging condition',
    fields: [
      {
        kind: 'range',
        key: 'magnification',
        label: '放大率 |m|',
        labelEn: 'Magnification',
        unit: '×',
        min: 0.1,
        max: 20,
        step: 0.1,
        digits: 1,
        hint: '用于像方 ↔ 物方换算：物方尺寸 = 像方 ÷ |m|，物方截止频率 = 像方 × |m|',
      },
    ],
  },
]

export interface DiffractionPreset {
  id: string
  label: string
  hint: string
  patch: Partial<DiffractionParams>
}

export const DIFFRACTION_PRESETS: DiffractionPreset[] = [
  {
    id: 'f28',
    label: 'F/2.8 大光圈',
    hint: '衍射斑小、分辨率高，但景深浅（机器视觉常用大光圈提亮）',
    patch: { fNumber: 2.8, aperture: 25, wavelength: 550, magnification: 1 },
  },
  {
    id: 'f8',
    label: 'F/8 常用档',
    hint: '像差与衍射折中的经典档位',
    patch: { fNumber: 8, aperture: 25, wavelength: 550, magnification: 1 },
  },
  {
    id: 'f22',
    label: 'F/22 小光圈',
    hint: '景深深但衍射明显：艾里斑可达十几 μm，超过常见像元尺寸',
    patch: { fNumber: 22, aperture: 25, wavelength: 550, magnification: 1 },
  },
  {
    id: 'macro',
    label: '1:1 微距（|m| = 1）',
    hint: '像方与物方尺度相同，便于对照「物方分辨率」概念',
    patch: { fNumber: 8, aperture: 25, wavelength: 550, magnification: 1 },
  },
  {
    id: 'micro20x',
    label: '20× 显微（|m| = 20）',
    hint: '物方艾里半径只有像方的 1/20：高倍物方的分辨率极限更严苛',
    patch: { fNumber: 8, aperture: 25, wavelength: 550, magnification: 20 },
  },
  {
    id: 'blue',
    label: '蓝光 450 nm',
    hint: '波长越短衍射斑越小 —— 光刻与高分辨检测偏爱短波长',
    patch: { fNumber: 8, aperture: 25, wavelength: 450, magnification: 1 },
  },
]

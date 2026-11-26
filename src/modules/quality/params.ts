/** 模块六参数定义与预设（工业视觉成像质量测试） */
import type { ParamSection } from '@/components/ui/params'
import { DEGRADE_DEFAULTS, type DegradeParams } from '@/core/imaging/degradation'
import type { TargetId } from '@/core/imaging/targets'

export type QualitySource = TargetId | 'upload'

export interface QualityParams extends DegradeParams {
  /** 图像来源：三个内置合成靶标，或用户上传 */
  source: QualitySource
}

export const QUALITY_DEFAULTS: QualityParams = {
  ...DEGRADE_DEFAULTS,
  source: 'pcb',
}

/** 内部工作分辨率（SSIM 计算较贵，控制在 224² 以内保证交互流畅） */
export const QUALITY_WORK_SIZE = 224

export const QUALITY_SCHEMA: ParamSection[] = [
  {
    title: '光源与光学',
    titleEn: 'Optics',
    fields: [
      {
        kind: 'range',
        key: 'defocusSigma',
        label: '离焦模糊 σ',
        labelEn: 'Defocus (Gaussian approx.)',
        unit: 'px',
        min: 0,
        max: 6,
        step: 0.1,
        digits: 1,
        hint: '高斯模糊近似（图像退化近似模型，非严格离焦 PSF）',
      },
      {
        kind: 'range',
        key: 'motionLength',
        label: '运动模糊长度',
        labelEn: 'Motion blur',
        unit: 'px',
        min: 0,
        max: 40,
        step: 1,
        hint: '沿下方设定方向的线段 PSF 卷积',
      },
      {
        kind: 'range',
        key: 'motionAngleDeg',
        label: '运动方向',
        labelEn: 'Motion angle',
        unit: '°',
        min: 0,
        max: 180,
        step: 5,
        hint: '0° = 水平，90° = 垂直',
      },
      {
        kind: 'range',
        key: 'illuminationFalloff',
        label: '光照不均',
        labelEn: 'Illumination falloff',
        unit: '',
        min: 0,
        max: 1,
        step: 0.05,
        digits: 2,
        hint: '余弦暗角模型，模拟环形光源/镜头暗角',
      },
    ],
  },
  {
    title: '曝光与对比度',
    titleEn: 'Exposure',
    fields: [
      {
        kind: 'range',
        key: 'exposureGain',
        label: '曝光增益',
        labelEn: 'Gain',
        unit: '×',
        min: 0.2,
        max: 2.5,
        step: 0.05,
        digits: 2,
        hint: '< 1 欠曝，> 1 过曝（截断会造成高光丢失）',
      },
      {
        kind: 'range',
        key: 'exposureOffset',
        label: '亮度偏置',
        labelEn: 'Offset',
        unit: '',
        min: -0.5,
        max: 0.5,
        step: 0.02,
        digits: 2,
      },
      {
        kind: 'range',
        key: 'contrast',
        label: '对比度系数',
        labelEn: 'Contrast',
        unit: '×',
        min: 0.2,
        max: 1.6,
        step: 0.05,
        digits: 2,
        hint: '围绕中灰 0.5 缩放，< 1 表示对比度下降',
      },
    ],
  },
  {
    title: '传感器噪声',
    titleEn: 'Sensor',
    fields: [
      {
        kind: 'range',
        key: 'noiseSigma',
        label: '高斯噪声 σ',
        labelEn: 'Noise',
        unit: '',
        min: 0,
        max: 0.25,
        step: 0.005,
        digits: 3,
        hint: '带种子 PRNG，同种子可复现',
      },
      {
        kind: 'number',
        key: 'seed',
        label: '随机种子',
        labelEn: 'Seed',
        unit: '',
        min: 1,
        max: 99999999,
        step: 1,
      },
    ],
  },
]

/** 批量扫描的可选自变量 */
export type SweepKey = 'defocusSigma' | 'noiseSigma' | 'exposureGain' | 'motionLength' | 'contrast'

export interface SweepOption {
  key: SweepKey
  label: string
  labelEn: string
  min: number
  max: number
  steps: number
}

export const SWEEP_OPTIONS: SweepOption[] = [
  { key: 'defocusSigma', label: '离焦 σ', labelEn: 'Defocus σ', min: 0, max: 6, steps: 13 },
  { key: 'noiseSigma', label: '噪声 σ', labelEn: 'Noise σ', min: 0, max: 0.2, steps: 13 },
  { key: 'exposureGain', label: '曝光增益', labelEn: 'Gain', min: 0.2, max: 2.2, steps: 13 },
  { key: 'motionLength', label: '运动模糊长度', labelEn: 'Motion len', min: 0, max: 30, steps: 13 },
  { key: 'contrast', label: '对比度系数', labelEn: 'Contrast', min: 0.2, max: 1.6, steps: 13 },
]

export interface QualityPreset {
  id: string
  label: string
  hint: string
  patch: Partial<QualityParams>
}

export const QUALITY_PRESETS: QualityPreset[] = [
  {
    id: 'ideal',
    label: '理想成像（无退化）',
    hint: '作为参考基线：PSNR = +∞、SSIM = 1',
    patch: {
      defocusSigma: 0,
      motionLength: 0,
      illuminationFalloff: 0,
      contrast: 1,
      exposureGain: 1,
      exposureOffset: 0,
      noiseSigma: 0,
    },
  },
  {
    id: 'defocus',
    label: '离焦 2.0 px',
    hint: '典型的轻度离焦：清晰度与 SSIM 明显下降，PSNR 变化相对温和',
    patch: { defocusSigma: 2, motionLength: 0, noiseSigma: 0.01, exposureGain: 1, contrast: 1 },
  },
  {
    id: 'motion',
    label: '运动模糊 12 px @ 20°',
    hint: '产线运动中抓拍的拖影：细纹沿运动方向被抹平',
    patch: { motionLength: 12, motionAngleDeg: 20, defocusSigma: 0.5, noiseSigma: 0.01 },
  },
  {
    id: 'underexposed',
    label: '欠曝（增益 0.45）',
    hint: '照度不足：亮度与对比度同时下降，噪声占比变高',
    patch: { exposureGain: 0.45, exposureOffset: 0, noiseSigma: 0.03, defocusSigma: 0.5 },
  },
  {
    id: 'overexposed',
    label: '过曝（增益 1.8）',
    hint: '高光截断：亮区细节永久丢失，PSNR/SSIM 同时下降',
    patch: { exposureGain: 1.8, exposureOffset: 0.1, noiseSigma: 0.01 },
  },
  {
    id: 'uneven',
    label: '光照不均 + 低对比度',
    hint: '环形光源/暗角叠加低对比度：边缘细节最差',
    patch: { illuminationFalloff: 0.8, contrast: 0.5, noiseSigma: 0.02 },
  },
]

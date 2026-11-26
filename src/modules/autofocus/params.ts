/** 模块五参数定义与预设（自动对焦与设备性能测试） */
import type { ParamSection } from '@/components/ui/params'
import { FOCUS_METRICS, type FocusMetricKind } from '@/core/imaging/focusMetrics'
import type { TargetId } from '@/core/imaging/targets'

export type ScanStrategy = 'full' | 'coarseFine'

export interface AutofocusParams {
  /** 靶标 */
  target: TargetId
  /** 清晰度评价函数 */
  metric: FocusMetricKind
  /** 搜索策略 */
  strategy: ScanStrategy
  /** 起始 Z 位置（mm） */
  startZ: number
  /** 扫描范围（mm） */
  rangeMm: number
  /** 扫描步长（mm） */
  stepMm: number
  /** 仿真的真实最佳焦点（mm） */
  trueFocusZ: number
  /** 离焦模糊系数（σ px/mm） */
  blurPerMm: number
  /** 传感器噪声 σ */
  noiseSigma: number
  /** 曝光增益 */
  exposureGain: number
  /** 定位误差 ±mm */
  positionErrorMm: number
  /** 重复性测试次数 */
  repeatRuns: number
  /** PASS 判定阈值（mm） */
  thresholdMm: number
  /** 随机种子 */
  seed: number
}

export const AUTOFOCUS_DEFAULTS: AutofocusParams = {
  target: 'siemens',
  metric: 'tenengrad',
  strategy: 'coarseFine',
  startZ: 10,
  rangeMm: 6,
  stepMm: 0.1,
  trueFocusZ: 10.3,
  blurPerMm: 1.2,
  noiseSigma: 0.01,
  exposureGain: 1,
  positionErrorMm: 0.02,
  repeatRuns: 5,
  thresholdMm: 0.15,
  seed: 20240501,
}

/** 内部工作分辨率（兼顾速度与细节：192² 的单帧退化约 2 ms） */
export const WORK_SIZE = 192

export const AUTOFOCUS_SCHEMA: ParamSection[] = [
  {
    title: '靶标与算法',
    titleEn: 'Target & metric',
    fields: [
      {
        kind: 'select',
        key: 'target',
        label: '测试靶标',
        labelEn: 'Target',
        options: [
          { value: 'siemens', label: '西门子星（合成）' },
          { value: 'bars', label: '分辨率条（合成）' },
          { value: 'pcb', label: 'PCB 图形（合成）' },
        ],
        hint: '三个靶标均为程序生成的合成图案，可另在模块六上传真实图片',
      },
      {
        kind: 'segmented',
        key: 'metric',
        label: '清晰度评价函数',
        labelEn: 'Focus metric',
        options: FOCUS_METRICS.map((m) => ({ value: m.kind, label: m.label })),
        hint: '三种指标的绝对数值不可横向比较，但曲线的峰位置应当一致',
      },
      {
        kind: 'segmented',
        key: 'strategy',
        label: '搜索策略',
        labelEn: 'Search strategy',
        options: [
          { value: 'full', label: '全范围遍历' },
          { value: 'coarseFine', label: '粗调+精调' },
        ],
        hint: '全范围最可靠；粗调+精调捕获次数更少，是工程常用折中',
      },
    ],
  },
  {
    title: 'Z 轴与搜索',
    titleEn: 'Z stage',
    fields: [
      {
        kind: 'range',
        key: 'startZ',
        label: '初始 Z 位置',
        labelEn: 'Start Z',
        unit: 'mm',
        min: 5,
        max: 15,
        step: 0.1,
        digits: 1,
        hint: '扫描以该位置为中心',
      },
      {
        kind: 'range',
        key: 'rangeMm',
        label: '扫描范围',
        labelEn: 'Range',
        unit: 'mm',
        min: 0.5,
        max: 10,
        step: 0.5,
        digits: 1,
      },
      {
        kind: 'range',
        key: 'stepMm',
        label: '扫描步长',
        labelEn: 'Step',
        unit: 'mm',
        min: 0.02,
        max: 0.5,
        step: 0.01,
        digits: 2,
        hint: '步长越小对焦越准，但捕获次数与耗时随之上升（上限 400 次）',
      },
      {
        kind: 'range',
        key: 'trueFocusZ',
        label: '仿真真实焦点',
        labelEn: 'True focus Z',
        unit: 'mm',
        min: 5,
        max: 15,
        step: 0.1,
        digits: 1,
        hint: '仿真设备「真值」，对焦误差 = |搜索结果 − 真值|',
      },
    ],
  },
  {
    title: '成像与误差',
    titleEn: 'Imaging & errors',
    fields: [
      {
        kind: 'range',
        key: 'blurPerMm',
        label: '离焦模糊系数',
        labelEn: 'Blur per mm',
        unit: 'σ/mm',
        min: 0.2,
        max: 4,
        step: 0.1,
        digits: 1,
        hint: '离焦 1 mm 对应的高斯模糊 σ（像素）——图像退化近似模型的系数',
      },
      {
        kind: 'range',
        key: 'noiseSigma',
        label: '传感器噪声 σ',
        labelEn: 'Noise',
        unit: '',
        min: 0,
        max: 0.08,
        step: 0.005,
        digits: 3,
        hint: '带种子高斯噪声，可复现',
      },
      {
        kind: 'range',
        key: 'exposureGain',
        label: '曝光增益',
        labelEn: 'Exposure',
        unit: '×',
        min: 0.3,
        max: 2,
        step: 0.05,
        digits: 2,
      },
      {
        kind: 'range',
        key: 'positionErrorMm',
        label: '平台定位误差',
        labelEn: 'Positioning error',
        unit: '± mm',
        min: 0,
        max: 0.1,
        step: 0.005,
        digits: 3,
        hint: '每次移动后的实际位置随机偏差，是重复性误差的主要来源之一',
      },
    ],
  },
  {
    title: '重复性与判定',
    titleEn: 'Repeatability',
    fields: [
      {
        kind: 'range',
        key: 'repeatRuns',
        label: '重复次数',
        labelEn: 'Runs',
        unit: '次',
        min: 2,
        max: 20,
        step: 1,
        hint: '每次实验的起始位置在 ±扫描范围/4 内随机',
      },
      {
        kind: 'range',
        key: 'thresholdMm',
        label: 'PASS 阈值',
        labelEn: 'Threshold',
        unit: 'mm',
        min: 0.01,
        max: 0.5,
        step: 0.01,
        digits: 2,
        hint: '对焦误差 ≤ 阈值判为 PASS，并统计成功率',
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
        hint: '相同种子 + 相同参数 → 完全相同的实验结果',
      },
    ],
  },
]

export interface AutofocusPreset {
  id: string
  label: string
  hint: string
  patch: Partial<AutofocusParams>
}

export const AUTOFOCUS_PRESETS: AutofocusPreset[] = [
  {
    id: 'ideal',
    label: '理想平台（无噪声/无定位误差）',
    hint: '用于验证算法本身：对焦误差应 ≤ 一个扫描步长',
    patch: { noiseSigma: 0, positionErrorMm: 0, stepMm: 0.05, strategy: 'full' },
  },
  {
    id: 'realistic',
    label: '真实工况（含噪声与定位误差）',
    hint: '带噪声与平台误差的典型产线情况，可观察重复性统计',
    patch: { noiseSigma: 0.02, positionErrorMm: 0.03, stepMm: 0.1, strategy: 'coarseFine', thresholdMm: 0.15 },
  },
  {
    id: 'coarse',
    label: '大步长快速搜索',
    hint: '步长 0.3 mm：捕获次数少但精度受限，体现「速度 vs 精度」的权衡',
    patch: { stepMm: 0.3, strategy: 'coarseFine', rangeMm: 8 },
  },
  {
    id: 'lowlight',
    label: '低照度（欠曝 + 噪声）',
    hint: '曝光增益 0.45 + 噪声 0.05：清晰度评分整体下降，对焦更难',
    patch: { exposureGain: 0.45, noiseSigma: 0.05 },
  },
]

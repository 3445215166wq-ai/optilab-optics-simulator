/**
 * 实验模块注册表。
 * 阶段一实现模块一、二；其余模块以 planned 状态列出，导航中禁用，
 * 避免出现「看起来能点但没功能」的假按钮。
 */
import type { ModuleMeta } from './types'
import AutofocusModule from './autofocus/AutofocusModule.vue'
import DiffractionModule from './diffraction/DiffractionModule.vue'
import GeoOpticsModule from './geoOptics/GeoOpticsModule.vue'
import PsfMtfModule from './psfMtf/PsfMtfModule.vue'
import QualityModule from './quality/QualityModule.vue'
import RefractionModule from './refraction/RefractionModule.vue'

export const MODULES: ModuleMeta[] = [
  {
    id: 'geo-optics',
    index: '一',
    title: '几何光学与光线追迹',
    titleEn: 'Geometric Optics & Ray Tracing',
    short: '几何光学',
    phase: 1,
    status: 'ready',
    summary: '理想薄透镜成像：像距、放大率、实像/虚像、三条主光线与光锥追迹',
    component: GeoOpticsModule,
  },
  {
    id: 'refraction',
    index: '二',
    title: '光的传播与折射',
    titleEn: 'Reflection, Refraction & TIR',
    short: '折射与全反射',
    phase: 1,
    status: 'ready',
    summary: '斯涅尔定律、临界角、全反射与菲涅尔反射率实时计算',
    component: RefractionModule,
  },
  {
    id: 'diffraction',
    index: '三',
    title: '衍射与光学分辨率',
    titleEn: 'Diffraction & Resolution',
    short: '衍射与分辨率',
    phase: 2,
    status: 'ready',
    summary: '艾里斑解析模型、瑞利判据、截止空间频率，明确区分物方与像方参数',
    component: DiffractionModule,
  },
  {
    id: 'psf-mtf',
    index: '四',
    title: 'PSF 与 MTF 性能分析',
    titleEn: 'PSF & MTF Analysis',
    short: 'PSF / MTF',
    phase: 2,
    status: 'ready',
    summary: '复光瞳 + 二维 FFT 数值模型：离焦 PSF 热力图、MTF 曲线、衍射极限对照与 MTF50',
    component: PsfMtfModule,
  },
  {
    id: 'autofocus',
    index: '五',
    title: '自动对焦与设备性能测试',
    titleEn: 'Autofocus & Device Performance',
    short: '自动对焦',
    phase: 3,
    status: 'ready',
    summary: '虚拟 Z 轴平台 + 三种清晰度评价函数 + 全范围/粗精搜索 + 重复性统计与 PASS/FAIL 判定',
    component: AutofocusModule,
  },
  {
    id: 'image-quality',
    index: '六',
    title: '工业视觉成像质量测试',
    titleEn: 'Imaging Quality Test',
    short: '成像质量',
    phase: 3,
    status: 'ready',
    summary: '离焦/运动/曝光/噪声/照度退化与 SSIM、PSNR、清晰度指标，含批量扫描曲线与 ONNX 预留接口',
    component: QualityModule,
  },
  {
    id: 'report',
    index: '七',
    title: '自动化测试报告',
    titleEn: 'Automated Test Report',
    short: '测试报告',
    phase: 4,
    status: 'planned',
    summary: '实验记录、CSV/JSON/PNG 导出与可打印报告（阶段四实现）',
  },
]

export function findModule(id: string): ModuleMeta | null {
  return MODULES.find((m) => m.id === id) ?? null
}

export const DEFAULT_MODULE_ID = 'geo-optics'

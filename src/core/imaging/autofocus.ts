/**
 * ============================================================================
 * 模块五核心：虚拟 Z 轴平台 + 自动对焦搜索 + 重复性统计
 * ============================================================================
 *
 * 【虚拟设备声明】
 * 本文件描述的是一台**仿真**的 Z 轴运动平台与相机：没有实体硬件。
 * 所有画面、评分、误差、耗时统计都由本文件的程序计算产生。
 *
 * 【成像退化模型】
 * 离焦用**高斯模糊近似**：σ = blurPerMm × |z − z_focus|（**图像退化近似模型**，
 * 不是严格物理光学；严格离焦 PSF 见模块四的复光瞳 FFT 模型）。
 * 链路：基准靶标 → 离焦高斯模糊 → 曝光（增益/偏置）→ 传感器高斯噪声（带种子）。
 *
 * 【平台误差建模】
 *   - 定位误差：每次移动后的实际位置 zActual = zCmd + U(−e, +e)，e = positionErrorMm；
 *   - 传感器噪声：σ_noise，用带种子 PRNG，同一次实验可完整复现；
 *   - 因此「最佳焦点」的估计必然有残差，重复性测试统计的就是这个残差的分布。
 *
 * 【搜索策略】
 *   ① 全范围遍历 full：以步长 step 扫过整个扫描范围，取评分最大者 —— 最简单、最可靠，但捕获次数多；
 *   ② 粗调 + 精调 coarseFine：先用 step×coarseFactor 粗扫，再在最优点附近 ±1 个粗步长内用 step 精扫
 *      —— 捕获次数显著减少，是工程上常用的折中。
 *
 * 【PASS/FAIL】
 *   单次对焦误差 = |bestZ − trueZ| ≤ threshold 判为 PASS；重复性测试统计成功率。
 * ============================================================================
 */

import { evaluateFocus, type FocusMetricKind } from './focusMetrics'
import { gaussianBlur } from './degradation'
import { applyExposure } from './degradation'
import { addGaussianNoise } from './degradation'
import type { GrayImage } from './image'
import { createRng } from '../rng'

export interface PlatformConfig {
  baseImage: GrayImage
  /** 真实最佳焦点位置（仿真设定的「设备真值」，单位 mm） */
  bestFocusZ: number
  /** 每 mm 离焦对应的高斯模糊 σ（像素/mm）—— 退化近似模型的系数 */
  blurPerMm: number
  /** 传感器噪声 σ（0..0.1） */
  noiseSigma: number
  /** 曝光增益 */
  exposureGain: number
  /** 曝光偏置 */
  exposureOffset: number
  /** 定位误差 ±e（mm） */
  positionErrorMm: number
  /** 评价函数 */
  metric: FocusMetricKind
  /** 随机种子（同种子 → 同结果） */
  seed: number
}

export interface CaptureResult {
  zCommand: number
  zActual: number
  score: number
}

export interface SearchOptions {
  /** 起始 Z 位置（mm） */
  startZ: number
  /** 扫描范围（mm，以 startZ 为中心） */
  rangeMm: number
  /** 扫描步长（mm） */
  stepMm: number
  strategy: 'full' | 'coarseFine'
  /** 粗调步长相对精调步长的倍数（默认 4） */
  coarseFactor?: number
}

export interface ScanSample {
  zCommand: number
  zActual: number
  score: number
}

export interface ScanResult {
  ok: boolean
  errors: string[]
  strategy: 'full' | 'coarseFine'
  samples: ScanSample[]
  /** 评分最高的位置（用实际位置，反映平台定位误差的影响） */
  bestZ: number
  bestScore: number
  captureCount: number
  elapsedMs: number
  /** 与真值的误差绝对值（mm） */
  errorMm: number
  /** 归一化后的评分曲线（0..1），用于绘图 */
  normalizedScores: number[]
}

export const MAX_CAPTURES = 400
const MIN_STEP_MM = 0.0005

/** 由「命令位置 + 移动序号」确定性地产生定位误差 */
function actualZ(config: PlatformConfig, zCommand: number, moveIndex: number): number {
  if (!(config.positionErrorMm > 0)) return zCommand
  const rng = createRng(`${config.seed}:${moveIndex}:${zCommand.toFixed(6)}`)
  return zCommand + rng.range(-config.positionErrorMm, config.positionErrorMm)
}

/**
 * 在给定 Z 位置「拍摄」一帧并给出清晰度评分。
 * 纯函数性质：相同 (config, zCommand, moveIndex) 必然得到相同结果。
 */
export function capture(
  config: PlatformConfig,
  zCommand: number,
  moveIndex: number,
): { image: GrayImage; sample: CaptureResult } {
  const zAct = actualZ(config, zCommand, moveIndex)
  const defocus = Math.abs(zAct - config.bestFocusZ)
  const sigma = defocus * config.blurPerMm

  let image = config.baseImage
  if (sigma > 0.05) image = gaussianBlur(image, sigma)
  if (Math.abs(config.exposureGain - 1) > 0.001 || Math.abs(config.exposureOffset) > 0.001) {
    image = applyExposure(image, config.exposureGain, config.exposureOffset)
  }
  if (config.noiseSigma > 0) {
    // 噪声种子与位置绑定：同一位置反复拍摄得到同一帧，保证实验可复现
    image = addGaussianNoise(image, config.noiseSigma, Math.round(config.seed * 131 + zAct * 1e6))
  }

  return {
    image,
    sample: {
      zCommand,
      zActual: zAct,
      score: evaluateFocus(image, config.metric),
    },
  }
}

/** 只取评分（画实时读数用，避免重复计算图像） */
export function scoreAt(config: PlatformConfig, z: number, moveIndex = 0): number {
  return capture(config, z, moveIndex).sample.score
}

/** 校验搜索参数 */
function validate(options: SearchOptions): string[] {
  const errors: string[] = []
  if (!Number.isFinite(options.startZ)) errors.push('起始位置必须为有效数值')
  if (!(options.rangeMm > 0)) errors.push('扫描范围必须大于 0')
  if (!(options.stepMm >= MIN_STEP_MM)) errors.push(`扫描步长必须 ≥ ${MIN_STEP_MM} mm`)
  if (options.rangeMm > 0 && options.stepMm > 0) {
    const count = Math.ceil(options.rangeMm / options.stepMm) + 1
    if (count > MAX_CAPTURES) errors.push(`扫描点数 ${count} 超过上限 ${MAX_CAPTURES}，请增大步长或减小范围`)
  }
  return errors
}

/** 生成从 z0 到 z1 的等距采样点（含两端） */
function linspaceZ(z0: number, z1: number, step: number): number[] {
  const out: number[] = []
  const span = z1 - z0
  if (span <= 0) return [z0]
  const count = Math.floor(span / step + 1e-9)
  for (let i = 0; i <= count; i += 1) out.push(z0 + i * step)
  // 保证覆盖到终点（不足一步时补一个端点）
  if (out.length === 0 || Math.abs(out[out.length - 1] - z1) > step * 0.5) out.push(z1)
  return out
}

/**
 * 执行一次自动对焦。
 * 计时使用 performance.now()（Node 与浏览器都可用），用于给出「程序运行耗时」。
 */
export function runAutofocus(config: PlatformConfig, options: SearchOptions): ScanResult {
  const errors = validate(options)
  const strategy = options.strategy
  if (errors.length > 0) {
    return {
      ok: false,
      errors,
      strategy,
      samples: [],
      bestZ: Number.NaN,
      bestScore: Number.NaN,
      captureCount: 0,
      elapsedMs: 0,
      errorMm: Number.NaN,
      normalizedScores: [],
    }
  }

  const t0 = performance.now()
  const samples: ScanSample[] = []
  const zStart = options.startZ - options.rangeMm / 2
  const zEnd = options.startZ + options.rangeMm / 2
  let moveIndex = 0

  const doCapture = (z: number): ScanSample => {
    const { sample } = capture(config, z, moveIndex)
    moveIndex += 1
    samples.push(sample)
    return sample
  }

  if (strategy === 'full') {
    for (const z of linspaceZ(zStart, zEnd, options.stepMm)) doCapture(z)
  } else {
    const coarseStep = options.stepMm * (options.coarseFactor ?? 4)
    let bestCoarse = doCapture(zStart)
    for (const z of linspaceZ(zStart, zEnd, coarseStep).slice(1)) {
      const s = doCapture(z)
      if (s.score > bestCoarse.score) bestCoarse = s
    }
    // 精调：在最优点 ±1 个粗步长内用细步长扫
    const fineStart = Math.max(zStart, bestCoarse.zCommand - coarseStep)
    const fineEnd = Math.min(zEnd, bestCoarse.zCommand + coarseStep)
    for (const z of linspaceZ(fineStart, fineEnd, options.stepMm)) {
      // 跳过已经拍过的粗调点
      if (samples.some((s) => Math.abs(s.zCommand - z) < options.stepMm * 0.01)) continue
      doCapture(z)
    }
  }

  let best = samples[0]
  for (const s of samples) if (s.score > best.score) best = s
  const maxScore = Math.max(...samples.map((s) => s.score))
  const normalizedScores = samples.map((s) => (maxScore > 0 ? s.score / maxScore : 0))

  return {
    ok: true,
    errors: [],
    strategy,
    samples,
    bestZ: best.zActual,
    bestScore: best.score,
    captureCount: samples.length,
    elapsedMs: performance.now() - t0,
    errorMm: Math.abs(best.zActual - config.bestFocusZ),
    normalizedScores,
  }
}

/** 单次对焦结果（重复性测试用） */
export interface RepeatRun {
  run: number
  startZ: number
  bestZ: number
  errorMm: number
  captureCount: number
  elapsedMs: number
  ok: boolean
}

export interface RepeatabilityStats {
  ok: boolean
  errors: string[]
  runs: number
  thresholdMm: number
  meanErrorMm: number
  maxErrorMm: number
  stdErrorMm: number
  successCount: number
  successRate: number
  meanCaptureCount: number
  meanElapsedMs: number
  perRun: RepeatRun[]
}

/**
 * 重复性测试：连续做 runs 次自动对焦，统计误差分布与成功率。
 * 每次实验的起始位置在 startZ ± range/4 内随机（带种子），模拟实际操作的一致性差异。
 */
export function runRepeatability(
  config: PlatformConfig,
  options: SearchOptions,
  runs: number,
  thresholdMm: number,
): RepeatabilityStats {
  const errors = validate(options)
  const n = Math.max(1, Math.min(50, Math.round(runs)))
  if (errors.length > 0) {
    return {
      ok: false,
      errors,
      runs: n,
      thresholdMm,
      meanErrorMm: Number.NaN,
      maxErrorMm: Number.NaN,
      stdErrorMm: Number.NaN,
      successCount: 0,
      successRate: 0,
      meanCaptureCount: 0,
      meanElapsedMs: 0,
      perRun: [],
    }
  }

  const perRun: RepeatRun[] = []
  for (let i = 0; i < n; i += 1) {
    const rng = createRng(`${config.seed}:repeat:${i}`)
    const startZ = options.startZ + rng.range(-options.rangeMm / 4, options.rangeMm / 4)
    // 每次实验用不同噪声种子，模拟真实重复性
    const runConfig: PlatformConfig = { ...config, seed: config.seed + i * 977 }
    const result = runAutofocus(runConfig, { ...options, startZ })
    perRun.push({
      run: i + 1,
      startZ,
      bestZ: result.bestZ,
      errorMm: result.errorMm,
      captureCount: result.captureCount,
      elapsedMs: result.elapsedMs,
      ok: result.ok && result.errorMm <= thresholdMm,
    })
  }

  const errs = perRun.map((r) => r.errorMm)
  const mean = errs.reduce((a, b) => a + b, 0) / errs.length
  const variance = errs.reduce((a, b) => a + (b - mean) * (b - mean), 0) / errs.length
  const successCount = perRun.filter((r) => r.ok).length

  return {
    ok: true,
    errors: [],
    runs: n,
    thresholdMm,
    meanErrorMm: mean,
    maxErrorMm: Math.max(...errs),
    stdErrorMm: Math.sqrt(variance),
    successCount,
    successRate: successCount / n,
    meanCaptureCount: perRun.reduce((a, b) => a + b.captureCount, 0) / n,
    meanElapsedMs: perRun.reduce((a, b) => a + b.elapsedMs, 0) / n,
    perRun,
  }
}

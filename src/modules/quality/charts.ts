/**
 * 模块六特性曲线：
 *   ① 批量扫描：某个退化参数从 min 扫到 max，逐点计算 清晰度 / SSIM / PSNR
 *   ② 灰度直方图对比：原始 vs 退化（反映曝光/对比度/噪声的变化）
 * 所有数据由 degradeImage + focusMetrics + quality 实际计算，非示意。
 */
import type { EChartsOption } from 'echarts'
import type { ScenePalette } from '@/render/palette'
import type { GrayImage } from '@/core/imaging/image'
import type { SweepOption } from './params'

function axisCommon(palette: ScenePalette) {
  return {
    axisLine: { lineStyle: { color: palette.axis } },
    axisTick: { lineStyle: { color: palette.axis }, length: 3 },
    axisLabel: {
      color: palette.textMuted,
      fontSize: 9.5,
      fontFamily: 'ui-monospace, Consolas, monospace',
    },
    splitLine: { lineStyle: { color: palette.gridLine } },
    nameTextStyle: { color: palette.textMuted, fontSize: 10 },
  }
}

export interface SweepPoint {
  x: number
  sharpness: number
  ssim: number
  psnrDb: number
  brightness: number
  contrast: number
}

export function buildSweepChart(
  option: SweepOption,
  points: SweepPoint[],
  palette: ScenePalette,
): EChartsOption {
  const maxSharp = Math.max(...points.map((p) => p.sharpness), 1e-9)
  const finitePsnr = points.filter((p) => Number.isFinite(p.psnrDb)).map((p) => p.psnrDb)
  const psnrMax = finitePsnr.length ? Math.max(...finitePsnr) * 1.1 : 50

  return {
    animation: false,
    grid: { left: 52, right: 56, top: 32, bottom: 38 },
    tooltip: {
      trigger: 'axis',
      // 双 Y 轴 + 三条曲线时，cross 型 axisPointer 的标签会把多组数值挤在一起，改用竖线
      axisPointer: { type: 'line' },
      backgroundColor: palette.chipBg,
      borderColor: palette.chipBorder,
      textStyle: { color: palette.textPrimary, fontSize: 11 },
    },
    legend: {
      top: 0,
      right: 0,
      itemWidth: 14,
      itemHeight: 8,
      textStyle: { color: palette.textMuted, fontSize: 9.5 },
    },
    xAxis: {
      type: 'value',
      name: option.label,
      nameLocation: 'middle',
      nameGap: 22,
      min: option.min,
      max: option.max,
      ...axisCommon(palette),
    },
    yAxis: [
      {
        type: 'value',
        name: 'SSIM / 归一化清晰度',
        nameGap: 10,
        min: 0,
        max: 1.05,
        ...axisCommon(palette),
      },
      {
        type: 'value',
        name: 'PSNR (dB)',
        nameGap: 10,
        min: 0,
        max: Math.max(20, psnrMax),
        ...axisCommon(palette),
        // 放在 spread 之后覆盖，避免 splitLine 被重复指定
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: 'SSIM',
        type: 'line',
        showSymbol: false,
        lineStyle: { width: 1.9, color: palette.rayRefracted },
        itemStyle: { color: palette.rayRefracted },
        data: points.map((p) => [p.x, p.ssim]),
      },
      {
        name: '归一化清晰度',
        type: 'line',
        showSymbol: false,
        lineStyle: { width: 1.6, color: palette.accent },
        itemStyle: { color: palette.accent },
        data: points.map((p) => [p.x, p.sharpness / maxSharp]),
      },
      {
        name: 'PSNR',
        type: 'line',
        yAxisIndex: 1,
        showSymbol: false,
        lineStyle: { width: 1.4, color: palette.rayIncident, type: 'dashed' },
        itemStyle: { color: palette.rayIncident },
        data: points.map((p) => [p.x, Number.isFinite(p.psnrDb) ? p.psnrDb : null]),
      },
    ],
  }
}

/** 灰度直方图（64 档，归一化为概率密度） */
export function histogram(img: GrayImage, bins = 64): number[] {
  const out = new Array<number>(bins).fill(0)
  if (img.data.length === 0) return out
  for (let i = 0; i < img.data.length; i += 1) {
    const b = Math.min(bins - 1, Math.max(0, Math.floor(img.data[i] * bins)))
    out[b] += 1
  }
  const total = img.data.length
  return out.map((v) => v / total)
}

export function buildHistogramChart(
  original: GrayImage | null,
  degraded: GrayImage | null,
  palette: ScenePalette,
): EChartsOption {
  const bins = 64
  const xs = Array.from({ length: bins }, (_, i) => (i + 0.5) / bins)
  const histA = original ? histogram(original, bins) : []
  const histB = degraded ? histogram(degraded, bins) : []

  return {
    animation: false,
    grid: { left: 52, right: 20, top: 32, bottom: 38 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: palette.chipBg,
      borderColor: palette.chipBorder,
      textStyle: { color: palette.textPrimary, fontSize: 11 },
    },
    legend: {
      top: 0,
      right: 0,
      itemWidth: 14,
      itemHeight: 8,
      textStyle: { color: palette.textMuted, fontSize: 9.5 },
    },
    xAxis: {
      type: 'value',
      name: '灰度（0–1）',
      nameLocation: 'middle',
      nameGap: 22,
      min: 0,
      max: 1,
      ...axisCommon(palette),
    },
    yAxis: {
      type: 'value',
      name: '概率密度',
      nameGap: 10,
      ...axisCommon(palette),
    },
    series: [
      {
        name: '原始',
        type: 'line',
        showSymbol: false,
        step: 'middle',
        lineStyle: { width: 1.4, color: palette.textMuted },
        itemStyle: { color: palette.textMuted },
        areaStyle: { color: palette.textMuted, opacity: 0.12 },
        data: xs.map((x, i) => [x, histA[i] ?? 0]),
      },
      {
        name: '退化后',
        type: 'line',
        showSymbol: false,
        step: 'middle',
        lineStyle: { width: 1.6, color: palette.accent },
        itemStyle: { color: palette.accent },
        areaStyle: { color: palette.accent, opacity: 0.16 },
        data: xs.map((x, i) => [x, histB[i] ?? 0]),
      },
    ],
  }
}

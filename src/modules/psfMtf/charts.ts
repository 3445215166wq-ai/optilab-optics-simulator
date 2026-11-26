/**
 * 模块四特性曲线：
 *   ① MTF（数值 |FT{PSF}| 归一化）与解析衍射极限参考曲线对照
 *   ② PSF 径向截面：当前离焦 vs 衍射极限（解析艾里斑）
 * 数据全部来自 computePsfMtf / airyIntensityAtRadius 的实际计算。
 */
import type { EChartsOption } from 'echarts'
import type { ScenePalette } from '@/render/palette'
import type { PsfResult } from '@/core/optics/psfMtf'
import { airyIntensityAtRadius } from '@/core/optics/diffraction'
import { niceStep } from '@/core/geometry'

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

function tooltipCommon(palette: ScenePalette) {
  return {
    trigger: 'axis' as const,
    axisPointer: { type: 'cross' as const, label: { backgroundColor: palette.textSecondary } },
    backgroundColor: palette.chipBg,
    borderColor: palette.chipBorder,
    textStyle: { color: palette.textPrimary, fontSize: 11 },
  }
}

export interface PsfCharts {
  mtf: EChartsOption
  crossSection: EChartsOption
}

export function buildPsfCharts(result: PsfResult, palette: ScenePalette): PsfCharts {
  const mtfData: Array<[number, number]> = result.mtf.x.map((x, i) => [x, result.mtf.y[i]])
  const limitedData: Array<[number, number]> = result.mtfLimited.x.map((x, i) => [x, result.mtfLimited.y[i]])
  // 横轴取「整洁」上限：直接把 max 设成截止频率会产生重复的刻度标签
  const freqMax = result.ok
    ? Math.max(
        niceStep(result.cutoffCyclesPerMm, 5),
        Math.ceil(result.cutoffCyclesPerMm / niceStep(result.cutoffCyclesPerMm, 5)) *
          niceStep(result.cutoffCyclesPerMm, 5),
      )
    : 1

  const mtf: EChartsOption = {
    animation: false,
    grid: { left: 50, right: 20, top: 30, bottom: 38 },
    tooltip: tooltipCommon(palette),
    legend: {
      top: 0,
      right: 0,
      itemWidth: 14,
      itemHeight: 8,
      textStyle: { color: palette.textMuted, fontSize: 9.5 },
    },
    xAxis: {
      type: 'value',
      name: '空间频率 (lp/mm)',
      nameLocation: 'middle',
      nameGap: 22,
      min: 0,
      max: freqMax,
      ...axisCommon(palette),
    },
    yAxis: {
      type: 'value',
      name: 'MTF',
      nameGap: 10,
      min: 0,
      max: 1,
      ...axisCommon(palette),
    },
    series: [
      {
        name: '数值 MTF（当前离焦）',
        type: 'line',
        showSymbol: false,
        lineStyle: { width: 1.9, color: palette.accent },
        itemStyle: { color: palette.accent },
        data: mtfData,
        markLine:
          result.mtf50CyclesPerMm !== null
            ? {
                silent: true,
                symbol: 'none',
                lineStyle: { color: palette.rayBlocked, type: 'dashed', width: 1 },
                label: {
                  color: palette.rayBlocked,
                  fontSize: 9.5,
                  formatter: 'MTF50',
                  position: 'insideEndTop',
                },
                data: [{ xAxis: result.mtf50CyclesPerMm }, { yAxis: 0.5, lineStyle: { type: 'dotted' } }],
              }
            : undefined,
      },
      {
        name: '衍射极限（解析参考）',
        type: 'line',
        showSymbol: false,
        lineStyle: { width: 1.4, color: palette.rayRefracted, type: 'dashed' },
        itemStyle: { color: palette.rayRefracted },
        data: limitedData,
      },
    ],
  }

  // PSF 截面：离焦 vs 衍射极限
  const airyLimitUm = 1.21967 * (result.wavelengthNm * 1e-6) * result.fNumber * 1e3
  const rMax = result.ok ? Math.min(result.halfExtentUm, airyLimitUm * 4) : 20
  const crossData: Array<[number, number]> = []
  const limitData: Array<[number, number]> = []
  if (result.ok) {
    for (let i = 0; i < result.crossSection.rUm.length; i += 1) {
      const r = result.crossSection.rUm[i]
      if (r > rMax) break
      crossData.push([r, Math.max(result.crossSection.intensity[i], 1e-6)])
    }
    const lambdaMm = result.wavelengthNm * 1e-6
    for (let i = 0; i < 240; i += 1) {
      const rUm = (rMax * i) / 239
      limitData.push([rUm, Math.max(airyIntensityAtRadius(rUm * 1e-3, lambdaMm, result.fNumber), 1e-6)])
    }
  }

  const crossSection: EChartsOption = {
    animation: false,
    grid: { left: 50, right: 20, top: 30, bottom: 38 },
    tooltip: tooltipCommon(palette),
    legend: {
      top: 0,
      right: 0,
      itemWidth: 14,
      itemHeight: 8,
      textStyle: { color: palette.textMuted, fontSize: 9.5 },
    },
    xAxis: {
      type: 'value',
      name: '半径 r (μm)',
      nameLocation: 'middle',
      nameGap: 22,
      min: 0,
      max: rMax,
      ...axisCommon(palette),
    },
    yAxis: {
      type: 'log',
      name: 'I / I₀',
      nameGap: 10,
      min: 1e-4,
      max: 1,
      ...axisCommon(palette),
    },
    series: [
      {
        name: '当前离焦',
        type: 'line',
        showSymbol: false,
        lineStyle: { width: 1.9, color: palette.accent },
        itemStyle: { color: palette.accent },
        data: crossData,
      },
      {
        name: '衍射极限',
        type: 'line',
        showSymbol: false,
        lineStyle: { width: 1.2, color: palette.rayRefracted, type: 'dashed' },
        itemStyle: { color: palette.rayRefracted },
        data: limitData,
      },
    ],
  }

  return { mtf, crossSection }
}

/**
 * 模块三特性曲线：
 *   ① 径向光强分布 I(r)（对数纵轴，便于同时看清主瓣与暗环振铃）
 *   ② 艾里半径 / 瑞利判据随 F 数变化（三个波长族，展示波长影响）
 * 所有数据由 computeDiffraction / airyIntensityAtRadius 逐点计算。
 */
import type { EChartsOption } from 'echarts'
import type { ScenePalette } from '@/render/palette'
import { airyIntensityAtRadius, computeDiffraction, type DiffractionResult } from '@/core/optics/diffraction'
import type { DiffractionParams } from './params'

const SWEEP_SAMPLES = 160

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

export interface DiffractionCharts {
  profile: EChartsOption
  resolution: EChartsOption
}

export function buildDiffractionCharts(
  params: DiffractionParams,
  result: DiffractionResult,
  palette: ScenePalette,
): DiffractionCharts {
  // ---------- ① 径向光强分布 ----------
  const rMax = result.ok ? result.airyRadiusImgUm * 4 : 20
  const profileData: Array<[number, number]> = []
  if (result.ok) {
    const lambdaMm = params.wavelength * 1e-6
    for (let i = 0; i < 400; i += 1) {
      const rUm = (rMax * i) / 399
      const intensity = airyIntensityAtRadius(rUm * 1e-3, lambdaMm, params.fNumber)
      profileData.push([rUm, Math.max(intensity, 1e-6)])
    }
  }

  const profile: EChartsOption = {
    animation: false,
    grid: { left: 52, right: 18, top: 26, bottom: 38 },
    tooltip: tooltipCommon(palette),
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
      logBase: 10,
      ...axisCommon(palette),
    },
    series: [
      {
        name: '归一化强度',
        type: 'line',
        showSymbol: false,
        lineStyle: { width: 1.8, color: palette.accent },
        itemStyle: { color: palette.accent },
        data: profileData,
        markLine: result.ok
          ? {
              silent: true,
              symbol: 'none',
              lineStyle: { color: palette.rayBlocked, type: 'dashed', width: 1 },
              label: {
                color: palette.rayBlocked,
                fontSize: 9.5,
                formatter: 'r₁ = 1.22λN',
                position: 'insideEndTop',
              },
              data: [{ xAxis: result.airyRadiusImgUm }],
            }
          : undefined,
      },
    ],
  }

  // ---------- ② 分辨率随 F 数变化（波长族） ----------
  const wavelens = [450, 550, 650]
  const colors = [palette.rayReflected, palette.accent, palette.rayIncident]
  const fNumbers: number[] = []
  for (let i = 0; i < SWEEP_SAMPLES; i += 1) {
    fNumbers.push(1 + ((32 - 1) * i) / (SWEEP_SAMPLES - 1))
  }
  const series = wavelens.map((wl, idx) => ({
    name: `${wl} nm`,
    type: 'line' as const,
    showSymbol: false,
    lineStyle: {
      width: wl === params.wavelength ? 2.4 : 1.2,
      color: colors[idx],
      opacity: wl === params.wavelength ? 1 : 0.55,
      type: wl === params.wavelength ? ('solid' as const) : ('dashed' as const),
    },
    itemStyle: { color: colors[idx] },
    data: fNumbers.map((n) => [n, 1.21967 * (wl * 1e-6) * n * 1e3]),
  }))

  const resolution: EChartsOption = {
    animation: false,
    grid: { left: 52, right: 18, top: 30, bottom: 38 },
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
      name: '像方 F 数 N',
      nameLocation: 'middle',
      nameGap: 22,
      min: 1,
      max: 32,
      ...axisCommon(palette),
    },
    yAxis: {
      type: 'value',
      name: '艾里半径 (μm)',
      nameGap: 10,
      scale: true,
      ...axisCommon(palette),
    },
    series:
      result.ok
        ? [
            ...series,
            {
              name: '当前工况',
              type: 'scatter',
              symbolSize: 8,
              itemStyle: { color: palette.textPrimary, borderColor: palette.textPrimary },
              data: [[params.fNumber, result.airyRadiusImgUm]],
            },
          ]
        : series,
  }

  return { profile, resolution }
}

/** 供界面显示「不同 F 数下的分辨率」摘要用 */
export function airyRadiusFor(wavelengthNm: number, fNumber: number): number {
  const r = computeDiffraction({
    wavelengthNm,
    fNumber,
    apertureDiameterMm: 25,
    magnification: 1,
  })
  return r.ok ? r.airyRadiusImgUm : Number.NaN
}

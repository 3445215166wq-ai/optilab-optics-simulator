/**
 * 模块二特性曲线：逐点扫描入射角，数据全部来自折射/菲涅尔公式实算。
 */
import type { EChartsOption } from 'echarts'
import type { ScenePalette } from '@/render/palette'
import { fresnelReflectance, refractionAngleDeg } from '@/core/optics/refraction'
import type { RefractionParams } from './params'

const SAMPLES = 180
const MAX_ANGLE = 89.5

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

export function buildRefractionCharts(
  params: RefractionParams,
  criticalAngleDeg: number | null,
  brewsterAngleDeg: number,
  palette: ScenePalette,
): { angle: EChartsOption; reflectance: EChartsOption } {
  const angles: number[] = []
  for (let i = 0; i < SAMPLES; i += 1) {
    angles.push((MAX_ANGLE * i) / (SAMPLES - 1))
  }

  const angleData = angles.map((a) => [a, refractionAngleDeg(a, params.n1, params.n2)])
  const fresnelData = angles.map((a) => {
    const f = fresnelReflectance(a, params.n1, params.n2)
    return [a, f.Rs, f.Rp, f.R, 1 - f.R]
  })

  const currentRefr = refractionAngleDeg(params.incidenceAngle, params.n1, params.n2)
  const currentFresnel = fresnelReflectance(params.incidenceAngle, params.n1, params.n2)

  const angle: EChartsOption = {
    animation: false,
    grid: { left: 46, right: 20, top: 26, bottom: 38 },
    tooltip: tooltipCommon(palette),
    xAxis: {
      type: 'value',
      name: '入射角 θ₁ (°)',
      nameLocation: 'middle',
      nameGap: 22,
      min: 0,
      max: MAX_ANGLE,
      ...axisCommon(palette),
    },
    yAxis: {
      type: 'value',
      name: '折射角 θ₂ (°)',
      nameGap: 12,
      min: 0,
      max: 90,
      ...axisCommon(palette),
    },
    series: [
      {
        name: 'θ₂ (Snell)',
        type: 'line',
        showSymbol: false,
        connectNulls: false,
        lineStyle: { width: 1.8, color: palette.rayRefracted },
        itemStyle: { color: palette.rayRefracted },
        data: angleData,
        markLine: criticalAngleDeg
          ? {
              silent: true,
              symbol: 'none',
              lineStyle: { color: palette.rayBlocked, type: 'dashed', width: 1 },
              label: {
                color: palette.rayBlocked,
                fontSize: 9.5,
                formatter: 'θc',
                position: 'insideEndTop',
              },
              data: [{ xAxis: criticalAngleDeg }],
            }
          : undefined,
        markPoint:
          currentRefr !== null
            ? {
                symbol: 'circle',
                symbolSize: 7,
                itemStyle: { color: palette.rayIncident, borderColor: palette.textPrimary, borderWidth: 1 },
                label: { show: false },
                data: [{ name: '当前工况', coord: [params.incidenceAngle, currentRefr] }],
              }
            : undefined,
      },
      {
        name: 'θ₁ = θ₂ 参考线',
        type: 'line',
        showSymbol: false,
        lineStyle: { width: 1, color: palette.textMuted, type: 'dotted' },
        data: [
          [0, 0],
          [MAX_ANGLE, MAX_ANGLE],
        ],
      },
    ],
  }

  const reflectance: EChartsOption = {
    animation: false,
    grid: { left: 46, right: 20, top: 30, bottom: 38 },
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
      name: '入射角 θ₁ (°)',
      nameLocation: 'middle',
      nameGap: 22,
      min: 0,
      max: MAX_ANGLE,
      ...axisCommon(palette),
    },
    yAxis: {
      type: 'value',
      name: '反射率 / 透射率',
      nameGap: 12,
      min: 0,
      max: 1,
      ...axisCommon(palette),
    },
    series: [
      {
        name: 'R_s',
        type: 'line',
        showSymbol: false,
        lineStyle: { width: 1.4, color: palette.rayReflected },
        itemStyle: { color: palette.rayReflected },
        data: fresnelData.map((d) => [d[0], d[1]]),
      },
      {
        name: 'R_p',
        type: 'line',
        showSymbol: false,
        lineStyle: { width: 1.4, color: palette.rayIncident },
        itemStyle: { color: palette.rayIncident },
        data: fresnelData.map((d) => [d[0], d[2]]),
      },
      {
        name: 'R 自然光',
        type: 'line',
        showSymbol: false,
        lineStyle: { width: 1.9, color: palette.rayRefracted },
        itemStyle: { color: palette.rayRefracted },
        data: fresnelData.map((d) => [d[0], d[3]]),
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: palette.rayCenter, type: 'dashed', width: 1 },
          label: {
            color: palette.rayCenter,
            fontSize: 9.5,
            formatter: 'θB',
            position: 'insideEndTop',
          },
          data: [{ xAxis: brewsterAngleDeg }],
        },
        markPoint:
          !currentFresnel.tir
            ? {
                symbol: 'circle',
                symbolSize: 7,
                itemStyle: { color: palette.textPrimary },
                label: { show: false },
                data: [{ name: '当前工况', coord: [params.incidenceAngle, currentFresnel.R] }],
              }
            : undefined,
      },
      {
        name: 'T 透射率',
        type: 'line',
        showSymbol: false,
        lineStyle: { width: 1.2, color: palette.rayCenter, type: 'dashed' },
        itemStyle: { color: palette.rayCenter },
        data: fresnelData.map((d) => [d[0], d[4]]),
      },
    ],
  }

  return { angle, reflectance }
}

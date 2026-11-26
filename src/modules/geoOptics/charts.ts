/**
 * 模块一特性曲线：全部数据由 computeThinLens 实际扫描得到（非硬编码）。
 * 输出标准 ECharts option，交给 ChartPanel 渲染。
 */
import type { EChartsOption } from 'echarts'
import type { ScenePalette } from '@/render/palette'
import { computeThinLens } from '@/core/optics/thinLens'
import type { GeoParams } from './params'

interface SweepPoint {
  u: number
  v: number | null
  m: number | null
}

const SAMPLES = 220

/** 沿物距 u 扫描成像结果 */
function sweep(params: GeoParams): SweepPoint[] {
  const f = params.focalLength
  const uMin = Math.max(2, Math.min(f * 0.2, params.objectDistance * 0.9))
  const uMax = Math.max(f * 4, params.objectDistance * 1.25)
  const points: SweepPoint[] = []
  for (let i = 0; i < SAMPLES; i += 1) {
    const u = uMin + ((uMax - uMin) * i) / (SAMPLES - 1)
    const r = computeThinLens({
      lensType: params.lensType,
      focalLength: f,
      objectDistance: u,
      objectHeight: params.objectHeight,
      apertureDiameter: params.apertureDiameter,
      rayCount: 3,
    })
    // 超出显示范围的极端值置为 null，让曲线在渐近线处自然断开
    const vLimit = uMax * 4
    const mLimit = 12
    const v = r.image.distance !== null && Math.abs(r.image.distance) <= vLimit ? r.image.distance : null
    const m =
      r.image.magnification !== null && Math.abs(r.image.magnification) <= mLimit
        ? r.image.magnification
        : null
    points.push({ u, v, m })
  }
  return points
}

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

export interface GeoCharts {
  imageDistance: EChartsOption
  magnification: EChartsOption
}

export function buildGeoCharts(params: GeoParams, palette: ScenePalette): GeoCharts {
  const points = sweep(params)
  const fAbs = params.focalLength
  const current = computeThinLens({
    lensType: params.lensType,
    focalLength: fAbs,
    objectDistance: params.objectDistance,
    objectHeight: params.objectHeight,
    apertureDiameter: params.apertureDiameter,
    rayCount: 3,
  })

  // 只有凸透镜在 u = f 处存在渐近线；凹透镜无此奇点，不应画该参考线
  const showAsymptote = params.lensType === 'convex'

  const markLineF = showAsymptote
    ? {
        silent: true,
        symbol: 'none' as const,
        lineStyle: { color: palette.rayBlocked, type: 'dashed' as const, width: 1 },
        label: {
          color: palette.rayBlocked,
          fontSize: 9.5,
          formatter: 'u = f',
          position: 'insideEndTop' as const,
        },
        data: [{ xAxis: fAbs }],
      }
    : undefined

  const imageDistance: EChartsOption = {
    animation: false,
    grid: { left: 48, right: 20, top: 26, bottom: 38 },
    tooltip: tooltipCommon(palette),
    xAxis: {
      type: 'value',
      name: '物距 u (mm)',
      nameLocation: 'middle',
      nameGap: 22,
      min: 'dataMin',
      max: 'dataMax',
      ...axisCommon(palette),
    },
    yAxis: {
      type: 'value',
      name: '像距 v (mm)',
      nameGap: 12,
      scale: true,
      ...axisCommon(palette),
    },
    series: [
      {
        name: '像距 v',
        type: 'line',
        showSymbol: false,
        connectNulls: false,
        lineStyle: { width: 1.8, color: palette.accent },
        itemStyle: { color: palette.accent },
        data: points.map((p) => [p.u, p.v]),
        markLine: markLineF,
        markPoint:
          current.image.distance !== null &&
          Math.abs(current.image.distance) <= Math.max(1, Math.abs(points[points.length - 1]?.u ?? 1) * 4)
            ? {
                symbol: 'circle',
                symbolSize: 7,
                itemStyle: { color: palette.rayIncident, borderColor: palette.textPrimary, borderWidth: 1 },
                label: {
                  show: true,
                  position: 'top',
                  color: palette.textPrimary,
                  fontSize: 9.5,
                  formatter: '当前工况',
                },
                data: [{ name: '当前工况', coord: [params.objectDistance, current.image.distance] }],
              }
            : undefined,
      },
    ],
  }

  const magnification: EChartsOption = {
    animation: false,
    grid: { left: 48, right: 20, top: 26, bottom: 38 },
    tooltip: tooltipCommon(palette),
    xAxis: {
      type: 'value',
      name: '物距 u (mm)',
      nameLocation: 'middle',
      nameGap: 22,
      min: 'dataMin',
      max: 'dataMax',
      ...axisCommon(palette),
    },
    yAxis: {
      type: 'value',
      name: '放大率 m',
      nameGap: 12,
      scale: true,
      ...axisCommon(palette),
    },
    series: [
      {
        name: '放大率 m',
        type: 'line',
        showSymbol: false,
        connectNulls: false,
        lineStyle: { width: 1.8, color: palette.rayCenter },
        itemStyle: { color: palette.rayCenter },
        data: points.map((p) => [p.u, p.m]),
        markLine: showAsymptote
          ? {
              silent: true,
              symbol: 'none',
              lineStyle: { color: palette.rayBlocked, type: 'dashed', width: 1 },
              label: {
                color: palette.rayBlocked,
                fontSize: 9.5,
                formatter: 'u = f',
                position: 'insideEndTop',
              },
              data: [{ xAxis: fAbs }],
            }
          : {
              silent: true,
              symbol: 'none',
              lineStyle: { color: palette.gridLineStrong, type: 'solid', width: 1 },
              label: { show: true, color: palette.textMuted, fontSize: 9.5, formatter: 'm = 0', position: 'insideEndTop' },
              data: [{ yAxis: 0 }],
            },
        markPoint:
          current.image.magnification !== null && Math.abs(current.image.magnification) <= 12
            ? {
                symbol: 'circle',
                symbolSize: 7,
                itemStyle: { color: palette.rayIncident, borderColor: palette.textPrimary, borderWidth: 1 },
                label: { show: false },
                data: [{ name: '当前工况', coord: [params.objectDistance, current.image.magnification] }],
              }
            : undefined,
      },
    ],
  }

  return { imageDistance, magnification }
}

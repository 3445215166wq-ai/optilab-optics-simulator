/**
 * 模块五特性曲线：
 *   ① 清晰度 – Z 位置曲线（搜索过程实测点 + 真值焦点 + 搜索结果）
 *   ② 重复性测试的逐次对焦误差（柱状/棒棒糖），含 PASS 阈值线
 * 数据全部来自 runAutofocus / runRepeatability 的实际计算结果。
 */
import type { EChartsOption } from 'echarts'
import type { ScenePalette } from '@/render/palette'
import type { RepeatabilityStats, ScanResult } from '@/core/imaging/autofocus'
import { focusMetricLabel, type FocusMetricKind } from '@/core/imaging/focusMetrics'

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

/** 清晰度 – Z 曲线 */
export function buildFocusCurveChart(
  result: ScanResult | null,
  metric: FocusMetricKind,
  trueFocusZ: number,
  palette: ScenePalette,
): EChartsOption {
  const points: Array<[number, number]> =
    result && result.ok ? result.samples.map((s, i) => [s.zCommand, result.normalizedScores[i]]) : []

  return {
    animation: false,
    grid: { left: 52, right: 20, top: 28, bottom: 38 },
    tooltip: {
      ...tooltipCommon(palette),
      formatter: undefined,
    },
    xAxis: {
      type: 'value',
      name: 'Z 位置 (mm)',
      nameLocation: 'middle',
      nameGap: 22,
      scale: true,
      ...axisCommon(palette),
    },
    yAxis: {
      type: 'value',
      name: '归一化清晰度',
      nameGap: 10,
      min: 0,
      max: 1.05,
      ...axisCommon(palette),
    },
    series: [
      {
        name: focusMetricLabel(metric),
        type: 'line',
        showSymbol: points.length < 60,
        symbolSize: 4,
        lineStyle: { width: 1.8, color: palette.accent },
        itemStyle: { color: palette.accent },
        data: points,
        markLine: points.length
          ? {
              silent: true,
              symbol: 'none',
              lineStyle: { color: palette.textMuted, type: 'dashed', width: 1 },
              label: {
                color: palette.textMuted,
                fontSize: 9.5,
                formatter: '真值焦点',
                position: 'insideEndTop',
              },
              data: [{ xAxis: trueFocusZ }],
            }
          : undefined,
        markPoint:
          result && result.ok
            ? {
                symbol: 'circle',
                symbolSize: 9,
                itemStyle: { color: palette.rayRefracted, borderColor: palette.textPrimary, borderWidth: 1 },
                label: {
                  show: true,
                  position: 'top',
                  color: palette.rayRefracted,
                  fontSize: 9.5,
                  formatter: '搜索最佳',
                },
                data: [{ name: 'best', coord: [result.bestZ, 1] }],
              }
            : undefined,
      },
    ],
  }
}

/** 重复性测试：逐次对焦误差 */
export function buildRepeatChart(
  stats: RepeatabilityStats | null,
  palette: ScenePalette,
): EChartsOption {
  const runs = stats && stats.ok ? stats.perRun : []
  return {
    animation: false,
    grid: { left: 52, right: 20, top: 28, bottom: 38 },
    tooltip: tooltipCommon(palette),
    xAxis: {
      type: 'category',
      name: '实验序号',
      nameLocation: 'middle',
      nameGap: 22,
      data: runs.map((r) => `#${r.run}`),
      ...axisCommon(palette),
    },
    yAxis: {
      type: 'value',
      name: '对焦误差 (mm)',
      nameGap: 10,
      min: 0,
      ...axisCommon(palette),
    },
    series: [
      {
        name: '对焦误差',
        type: 'bar',
        barMaxWidth: 18,
        itemStyle: {
          color: (params: { dataIndex: number }) =>
            runs[params.dataIndex]?.ok ? palette.rayRefracted : palette.rayBlocked,
        },
        data: runs.map((r) => Number(r.errorMm.toFixed(5))),
        markLine:
          stats && stats.ok
            ? {
                silent: true,
                symbol: 'none',
                lineStyle: { color: palette.rayBlocked, type: 'dashed', width: 1 },
                label: {
                  color: palette.rayBlocked,
                  fontSize: 9.5,
                  formatter: 'PASS 阈值',
                  position: 'insideEndTop',
                },
                data: [{ yAxis: stats.thresholdMm }],
              }
            : undefined,
      },
    ],
  }
}

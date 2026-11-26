<script setup lang="ts">
/**
 * 模块五：自动对焦与设备性能测试（虚拟 Z 轴平台 · 仿真设备）
 *
 * 交互模型：
 *   - 拖动「当前位置 Z」→ 实时看到该位置的图像与清晰度评分（单帧计算，约 2 ms）；
 *   - 点「执行自动对焦」→ 按当前策略跑完整搜索，给出最佳焦点、误差、次数与耗时；
 *   - 点「重复性测试」→ 连续做 N 次，统计均值/最大误差/标准差/成功率。
 * 所有误差与性能数据均由本页程序实际计算产生，没有预置数值。
 */
import { computed, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import ExperimentWorkspace from '@/components/layout/ExperimentWorkspace.vue'
import CanvasStage from '@/components/ui/CanvasStage.vue'
import ChartPanel from '@/components/ui/ChartPanel.vue'
import FoldSection from '@/components/ui/FoldSection.vue'
import ParamPanel from '@/components/ui/ParamPanel.vue'
import StatGrid from '@/components/ui/StatGrid.vue'
import TheoryPanel from './TheoryPanel.vue'
import { buildFocusCurveChart, buildRepeatChart } from './charts'
import {
  AUTOFOCUS_DEFAULTS,
  AUTOFOCUS_PRESETS,
  AUTOFOCUS_SCHEMA,
  WORK_SIZE,
  type AutofocusParams,
  type AutofocusPreset,
} from './params'
import {
  capture,
  runAutofocus,
  runRepeatability,
  type PlatformConfig,
  type RepeatabilityStats,
  type ScanResult,
} from '@/core/imaging/autofocus'
import { focusMetricLabel, FOCUS_METRICS } from '@/core/imaging/focusMetrics'
import { buildTarget, targetContrastNote } from '@/core/imaging/targets'
import { fmt } from '@/core/format'
import { clearStage, drawChip } from '@/render/draw'
import { drawGrayImage, drawZAxisGauge, fitRect } from '@/render/imageView'
import type { ParamValue } from '@/components/ui/params'
import type { StatItem } from '@/components/ui/statTypes'
import { pushLog, useExperimentLog } from '@/stores/log'
import { useTheme } from '@/stores/theme'

const MODULE_NAME = '自动对焦'

type Tone = 'ok' | 'accent' | 'warn' | 'err' | 'muted'

interface HeroItem {
  label: string
  labelEn: string
  value: string
  unit?: string
  tone: Tone
  note: string
}

const params = reactive<AutofocusParams>({ ...AUTOFOCUS_DEFAULTS })
const { palette } = useTheme()

/** 手动当前位置（mm） */
const manualZ = ref(params.startZ)
const searchResult = shallowRef<ScanResult | null>(null)
const repeatStats = shallowRef<RepeatabilityStats | null>(null)
const busy = ref(false)

/** 基准靶标（切换靶标或尺寸变化才重建） */
const baseImage = computed(() => buildTarget(params.target, WORK_SIZE))

const platformConfig = computed<PlatformConfig>(() => ({
  baseImage: baseImage.value,
  bestFocusZ: params.trueFocusZ,
  blurPerMm: params.blurPerMm,
  noiseSigma: params.noiseSigma,
  exposureGain: params.exposureGain,
  exposureOffset: 0,
  positionErrorMm: params.positionErrorMm,
  metric: params.metric,
  seed: params.seed,
}))

/** 当前位置的一帧（纯计算，约 2 ms） */
const liveFrame = computed(() => capture(platformConfig.value, manualZ.value, 0))

const scanOptions = computed(() => ({
  startZ: params.startZ,
  rangeMm: params.rangeMm,
  stepMm: params.stepMm,
  strategy: params.strategy,
  coarseFactor: 4,
}))

/** 参数一变，旧的搜索结果就失效（避免看到与当前参数不符的数字） */
watch(
  () => [
    params.target,
    params.metric,
    params.strategy,
    params.startZ,
    params.rangeMm,
    params.stepMm,
    params.trueFocusZ,
    params.blurPerMm,
    params.noiseSigma,
    params.exposureGain,
    params.positionErrorMm,
    params.seed,
  ],
  () => {
    searchResult.value = null
    repeatStats.value = null
  },
)

function drawScene(ctx: CanvasRenderingContext2D, size: { w: number; h: number }): void {
  clearStage(ctx, size, palette.value)
  const pal = palette.value
  const showImage = searchResult.value?.ok
    ? capture(platformConfig.value, searchResult.value.bestZ, 0)
    : liveFrame.value

  const gaugeW = 96
  const area = { x: 12, y: 12, w: size.w - gaugeW - 24, h: size.h - 24 }
  const rect = fitRect(area, showImage.image.width, showImage.image.height)
  drawGrayImage(ctx, showImage.image, rect, pal, {
    border: true,
    label: `Z = ${showImage.sample.zActual.toFixed(3)} mm · 实际位置`,
    labelColor: pal.accent,
  })

  // 清晰度读数
  const metricInfo = FOCUS_METRICS.find((m) => m.kind === params.metric)
  drawChip(
    ctx,
    `清晰度（${focusMetricLabel(params.metric)}）= ${showImage.sample.score.toFixed(5)}`,
    rect.x + 4,
    rect.y + rect.h - 20,
    pal,
    { align: 'left', baseline: 'top', color: pal.rayRefracted, size: 9.5 },
  )
  if (metricInfo) {
    drawChip(ctx, metricInfo.formula, rect.x + 4, rect.y + rect.h - 38, pal, {
      align: 'left',
      baseline: 'top',
      color: pal.textMuted,
      size: 9,
    })
  }

  // Z 轴标尺
  drawZAxisGauge(
    ctx,
    { x: size.w - gaugeW, y: 12, w: gaugeW, h: size.h - 24 },
    pal,
    {
      zMin: params.startZ - params.rangeMm / 2,
      zMax: params.startZ + params.rangeMm / 2,
      currentZ: manualZ.value,
      bestZ: searchResult.value?.ok ? searchResult.value.bestZ : null,
      trueBestZ: params.trueFocusZ,
    },
  )
}

async function executeAutofocus(): Promise<void> {
  busy.value = true
  await new Promise((r) => setTimeout(r, 16))
  try {
    const result = runAutofocus(platformConfig.value, scanOptions.value)
    searchResult.value = result
    if (result.ok) {
      manualZ.value = Number(result.bestZ.toFixed(3))
      pushLog(
        'ok',
        MODULE_NAME,
        `自动对焦完成：策略=${params.strategy === 'full' ? '全范围' : '粗调+精调'}，评价函数=${focusMetricLabel(params.metric)}，最佳 Z=${result.bestZ.toFixed(3)} mm，误差=${result.errorMm.toFixed(4)} mm，捕获 ${result.captureCount} 次，耗时 ${result.elapsedMs.toFixed(1)} ms`,
      )
    } else {
      pushLog('warn', MODULE_NAME, `自动对焦被拒绝：${result.errors.join('；')}`)
    }
  } finally {
    busy.value = false
  }
}

async function executeRepeatability(): Promise<void> {
  busy.value = true
  await new Promise((r) => setTimeout(r, 16))
  try {
    const stats = runRepeatability(
      platformConfig.value,
      scanOptions.value,
      params.repeatRuns,
      params.thresholdMm,
    )
    repeatStats.value = stats
    if (stats.ok) {
      pushLog(
        'info',
        MODULE_NAME,
        `重复性测试完成（${stats.runs} 次）：平均误差 ${(stats.meanErrorMm * 1e3).toFixed(2)} μm，最大 ${(stats.maxErrorMm * 1e3).toFixed(2)} μm，标准差 ${(stats.stdErrorMm * 1e3).toFixed(2)} μm，成功率 ${(stats.successRate * 100).toFixed(0)}%`,
      )
    } else {
      pushLog('warn', MODULE_NAME, `重复性测试被拒绝：${stats.errors.join('；')}`)
    }
  } finally {
    busy.value = false
  }
}

function applyPreset(preset: AutofocusPreset): void {
  Object.assign(params, preset.patch)
  manualZ.value = params.startZ
  pushLog('info', MODULE_NAME, `应用预设「${preset.label}」：${preset.hint}`)
}

function resetParams(): void {
  Object.assign(params, AUTOFOCUS_DEFAULTS)
  manualZ.value = params.startZ
  searchResult.value = null
  repeatStats.value = null
  pushLog('info', MODULE_NAME, '参数已重置为默认值')
}

function updateParam(key: string, value: ParamValue): void {
  ;(params as unknown as Record<string, ParamValue>)[key] = value
}

const charts = computed(() => ({
  curve: buildFocusCurveChart(
    searchResult.value,
    params.metric,
    params.trueFocusZ,
    palette.value,
  ),
  repeat: buildRepeatChart(repeatStats.value, palette.value),
}))

const passJudge = computed(() => {
  const r = searchResult.value
  if (!r || !r.ok) return { text: '未执行', tone: 'muted' as Tone }
  return r.errorMm <= params.thresholdMm
    ? { text: 'PASS', tone: 'ok' as Tone }
    : { text: 'FAIL', tone: 'err' as Tone }
})

const heroStats = computed<HeroItem[]>(() => {
  const frame = liveFrame.value
  const r = searchResult.value
  return [
    {
      label: '当前 Z 位置',
      labelEn: 'Current Z',
      value: fmt(frame.sample.zActual, 3),
      unit: 'mm',
      tone: 'accent',
      note: `命令位置 ${fmt(manualZ.value, 3)} mm（含定位误差）`,
    },
    {
      label: '当前清晰度评分',
      labelEn: focusMetricLabel(params.metric),
      value: fmt(frame.sample.score, 5),
      tone: 'muted',
      note: '评分绝对值只对本模块有意义，比较看曲线形状',
    },
    {
      label: '搜索最佳焦点',
      labelEn: 'Best focus Z',
      value: r && r.ok ? fmt(r.bestZ, 3) : '—',
      unit: r && r.ok ? 'mm' : '',
      tone: r && r.ok ? 'ok' : 'muted',
      note: r && r.ok ? `真值 ${fmt(params.trueFocusZ, 3)} mm` : '点击「执行自动对焦」开始',
    },
    {
      label: '对焦误差',
      labelEn: '|ΔZ| / judge',
      value: r && r.ok ? fmt(r.errorMm * 1e3, 2) : '—',
      unit: r && r.ok ? 'μm' : '',
      tone: passJudge.value.tone,
      note: r && r.ok ? `${passJudge.value.text}（阈值 ${fmt(params.thresholdMm * 1e3, 0)} μm）` : '—',
    },
  ]
})

const auxStats = computed(() => {
  const r = searchResult.value
  const s = repeatStats.value
  return [
    { label: '捕获次数', labelEn: 'captures', value: r && r.ok ? `${r.captureCount}` : '—' },
    { label: '单次耗时', labelEn: 'elapsed', value: r && r.ok ? `${fmt(r.elapsedMs, 1)} ms` : '—' },
    {
      label: '搜索策略',
      labelEn: 'strategy',
      value: params.strategy === 'full' ? '全范围遍历' : '粗调+精调（4×）',
    },
    {
      label: '重复性成功率',
      labelEn: 'success rate',
      value: s && s.ok ? `${(s.successRate * 100).toFixed(0)} %（${s.successCount}/${s.runs}）` : '—',
    },
  ]
})

const advancedStats = computed<StatItem[]>(() => {
  const s = repeatStats.value
  return [
    {
      label: '平均对焦误差',
      labelEn: 'mean error',
      value: s && s.ok ? fmt(s.meanErrorMm * 1e3, 2) : '—',
      unit: 'μm',
      tone: 'accent',
    },
    {
      label: '最大误差',
      labelEn: 'max error',
      value: s && s.ok ? fmt(s.maxErrorMm * 1e3, 2) : '—',
      unit: 'μm',
      tone: 'warn',
    },
    {
      label: '标准差',
      labelEn: 'std dev',
      value: s && s.ok ? fmt(s.stdErrorMm * 1e3, 2) : '—',
      unit: 'μm',
      tone: 'muted',
      note: '重复性（稳定性）的核心指标',
    },
    {
      label: '平均捕获次数',
      labelEn: 'avg captures',
      value: s && s.ok ? fmt(s.meanCaptureCount, 1) : '—',
      tone: 'muted',
    },
    {
      label: '平均耗时',
      labelEn: 'avg elapsed',
      value: s && s.ok ? fmt(s.meanElapsedMs, 1) : '—',
      unit: 'ms',
      tone: 'muted',
    },
    {
      label: '工作分辨率',
      labelEn: 'work size',
      value: `${WORK_SIZE}²`,
      tone: 'muted',
      note: '内部处理分辨率（显示时放大）',
    },
  ]
})

useExperimentLog(MODULE_NAME, () => {
  const r = searchResult.value
  if (!r || !r.ok) return null
  return `最佳 Z=${r.bestZ.toFixed(3)}mm（真值 ${params.trueFocusZ}mm），误差 ${(r.errorMm * 1e3).toFixed(1)}μm，捕获 ${r.captureCount} 次 / ${r.elapsedMs.toFixed(0)}ms`
})

onMounted(() => {
  pushLog(
    'info',
    MODULE_NAME,
    '模块加载完成：虚拟 Z 轴平台（仿真设备），离焦采用高斯模糊近似（图像退化近似模型），评级由 Laplacian/Tenengrad/Brenner 实时计算',
  )
})
</script>

<template>
  <ExperimentWorkspace initial-tab="results" :initial-dock-height="280">
    <template #stage>
      <CanvasStage :draw="drawScene">
        <div class="stage__overlay">
          <div class="stage__row">
            <div class="stage__toolbar">
              <label class="z-slider">
                <span>当前位置 Z</span>
                <input
                  v-model.number="manualZ"
                  class="slider"
                  type="range"
                  :min="params.startZ - params.rangeMm / 2"
                  :max="params.startZ + params.rangeMm / 2"
                  :step="params.stepMm / 2"
                />
                <span class="mono">{{ manualZ.toFixed(3) }} mm</span>
              </label>
              <button class="btn btn--sm btn--primary" :disabled="busy" @click="executeAutofocus">
                {{ busy ? '计算中…' : '执行自动对焦' }}
              </button>
              <button class="btn btn--sm" :disabled="busy" @click="executeRepeatability">
                重复性测试 ×{{ params.repeatRuns }}
              </button>
              <button class="btn btn--sm btn--ghost" @click="resetParams">重置</button>
            </div>
            <div class="stage__badges">
              <span class="badge badge--warn">仿真设备 SIMULATED</span>
              <span class="badge badge--muted">离焦 = 高斯近似</span>
            </div>
          </div>
          <div class="stage__row" style="align-items: flex-end">
            <div class="stage__legend legend">
              <span class="legend__item" style="color: var(--accent)">
                <span class="legend__swatch" />
                <span style="color: var(--text-2)">当前 Z</span>
              </span>
              <span class="legend__item" style="color: var(--ray-refracted)">
                <span class="legend__swatch" />
                <span style="color: var(--text-2)">搜索最佳</span>
              </span>
              <span class="legend__item" style="color: var(--text-3)">
                <span class="legend__swatch legend__swatch--dashed" />
                <span style="color: var(--text-2)">真值焦点</span>
              </span>
            </div>
            <span class="badge badge--muted">{{ targetContrastNote(params.target) }}</span>
          </div>
        </div>
      </CanvasStage>
    </template>

    <template #params>
      <ParamPanel
        title="实验参数"
        subtitle="Parameters"
        :sections="AUTOFOCUS_SCHEMA"
        :model="params"
        @update="updateParam"
        @invalid="(msg: string) => pushLog('warn', MODULE_NAME, msg)"
      >
        <template #actions>
          <button class="btn btn--sm" @click="resetParams">重置</button>
        </template>
        <template #footer>
          <div class="section-title">预设工况 <span class="muted xs">· Presets</span></div>
          <div class="preset-list">
            <button
              v-for="preset in AUTOFOCUS_PRESETS"
              :key="preset.id"
              class="preset"
              :title="preset.hint"
              @click="applyPreset(preset)"
            >
              <span class="preset__label">{{ preset.label }}</span>
              <span class="preset__hint">{{ preset.hint }}</span>
            </button>
          </div>
          <div class="model-note">
            虚拟 Z 轴平台为<strong>仿真设备</strong>；离焦用高斯模糊近似
            （<strong>图像退化近似模型</strong>，非严格物理光学）。所有误差与统计数据均由本页程序实算。
          </div>
        </template>
      </ParamPanel>
    </template>

    <template #results>
      <div class="pane-stack">
        <div v-if="searchResult && !searchResult.ok" class="callout callout--err">
          <span class="callout__icon">!</span>
          <div>{{ searchResult.errors.join('；') }}</div>
        </div>
        <div v-if="repeatStats && !repeatStats.ok" class="callout callout--err">
          <span class="callout__icon">!</span>
          <div>{{ repeatStats.errors.join('；') }}</div>
        </div>
        <div class="callout callout--info">
          <span class="callout__icon">i</span>
          <div>
            离焦采用<strong>高斯模糊近似</strong>（σ = 模糊系数 × 离焦量），属<strong>图像退化近似模型</strong>，
            非严格物理光学；严格离焦 PSF 请见模块四。仿真设备无实体硬件。
          </div>
        </div>

        <section class="group">
          <div class="group-head">
            <span class="group-head__title">对焦结果</span>
            <span class="group-head__en">Autofocus result</span>
            <span class="panel__spacer" />
            <span class="badge" :class="`badge--${passJudge.tone === 'muted' ? 'muted' : passJudge.tone}`">
              {{ passJudge.text }}
            </span>
          </div>
          <div class="hero-grid">
            <div v-for="item in heroStats" :key="item.label" class="hero" :class="`hero--${item.tone}`">
              <div class="hero__label">
                {{ item.label }}<span class="hero__label-en">{{ item.labelEn }}</span>
              </div>
              <div class="hero__value">
                {{ item.value }}<span v-if="item.unit" class="hero__unit">{{ item.unit }}</span>
              </div>
              <div class="hero__note">{{ item.note }}</div>
            </div>
          </div>
        </section>

        <section class="group">
          <div class="group-head">
            <span class="group-head__title">性能与统计</span>
            <span class="group-head__en">Performance</span>
          </div>
          <div class="aux-grid">
            <div v-for="item in auxStats" :key="item.label" class="aux-row">
              <span class="aux-row__label">
                {{ item.label }}<span class="aux-row__en">{{ item.labelEn }}</span>
              </span>
              <span class="aux-row__value">{{ item.value }}</span>
            </div>
          </div>
        </section>

        <FoldSection title="重复性统计明细" title-en="Repeatability">
          <StatGrid :items="advancedStats" />
          <p class="group-note">
            重复性测试每次实验的起始位置在 ±扫描范围/4 内随机、并使用不同噪声种子，
            因此误差分布反映「同一台设备反复对焦的一致性」。标准差越小表示越稳定。
          </p>
        </FoldSection>

        <FoldSection title="计算过程与公式" title-en="Worked example">
          <code class="formula">离焦量 = |z_actual − z_focus| ；σ_blur = 离焦量 × 模糊系数</code>
          <code class="formula formula--calc">
            本次：z_focus = {{ fmt(params.trueFocusZ, 3) }} mm，模糊系数
            {{ fmt(params.blurPerMm, 1) }} σ/mm，噪声 σ = {{ fmt(params.noiseSigma, 3) }}，
            定位误差 ±{{ fmt(params.positionErrorMm, 3) }} mm
          </code>
          <code class="formula formula--calc">
            扫描：范围 {{ fmt(params.rangeMm, 1) }} mm / 步长 {{ fmt(params.stepMm, 2) }} mm
            ⇒ 全范围需 {{ Math.floor(params.rangeMm / params.stepMm) + 1 }} 次捕获（粗精策略更少）
          </code>
          <code class="formula formula--calc">
            判定：|ΔZ| = {{ searchResult && searchResult.ok ? fmt(searchResult.errorMm * 1e3, 2) : '—' }} μm
            {{ searchResult && searchResult.ok ? (searchResult.errorMm <= params.thresholdMm ? '≤' : '>') : '?' }}
            阈值 {{ fmt(params.thresholdMm * 1e3, 0) }} μm ⇒ {{ passJudge.text }}
          </code>
          <p class="group-note">
            <strong>准确度</strong>看平均误差，<strong>重复性</strong>看标准差与最大误差，
            <strong>可靠性</strong>看成功率 —— 三者共同描述自动对焦的工程性能。
          </p>
        </FoldSection>

        <TheoryPanel />
      </div>
    </template>

    <template #charts>
      <div class="chart-row">
        <div class="chart-box">
          <div class="chart-box__head">
            <span class="chart-box__title">清晰度 – Z 位置曲线</span>
            <span>搜索实测点 · 归一化</span>
          </div>
          <ChartPanel :option="charts.curve" :height="190" />
        </div>
        <div class="chart-box">
          <div class="chart-box__head">
            <span class="chart-box__title">重复性：逐次对焦误差</span>
            <span>绿色 = PASS，红色 = FAIL</span>
          </div>
          <ChartPanel :option="charts.repeat" :height="190" />
        </div>
      </div>
      <p class="xs muted" style="padding: 0 2px">
        曲线由实际逐点拍摄与评分得到（非拟合）；点击「执行自动对焦 / 重复性测试」后填充。
      </p>
    </template>
  </ExperimentWorkspace>
</template>

<style scoped>
.pane-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.group-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 6px;
}

.group-head__title {
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--text-2);
}

.group-head__en {
  font-size: 9.5px;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.group-note {
  margin-top: 6px;
  font-size: var(--fs-xs);
  line-height: 1.6;
  color: var(--text-3);
}

.z-slider {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 6px;
  font-size: var(--fs-xs);
  color: var(--text-2);
}

.z-slider .slider {
  width: 120px;
}

.preset-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.preset {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 5px 8px;
  text-align: left;
  border: 1px solid var(--border);
  border-left: 2px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--bg-panel-2);
}

.preset:hover {
  background: var(--bg-elevated);
  border-left-color: var(--accent);
}

.preset__label {
  font-size: var(--fs-sm);
  color: var(--text-1);
}

.preset__hint {
  font-size: 10px;
  color: var(--text-3);
  line-height: 1.3;
}

.model-note {
  margin-top: 10px;
  padding: 7px 9px;
  border-radius: var(--radius-sm);
  border-left: 3px solid var(--warn);
  background: var(--warn-soft);
  font-size: var(--fs-xs);
  line-height: 1.5;
  color: var(--text-2);
}
</style>

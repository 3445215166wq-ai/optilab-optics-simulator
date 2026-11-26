<script setup lang="ts">
/**
 * 模块四：PSF 与 MTF 光学性能分析（复光瞳 + 二维 FFT 数值模型）
 * 计算链路：复光瞳 → FFT → PSF → FFT → OTF → MTF，全部在浏览器本地完成。
 */
import { computed, onMounted, reactive } from 'vue'
import ExperimentWorkspace from '@/components/layout/ExperimentWorkspace.vue'
import CanvasStage from '@/components/ui/CanvasStage.vue'
import ChartPanel from '@/components/ui/ChartPanel.vue'
import FoldSection from '@/components/ui/FoldSection.vue'
import ParamPanel from '@/components/ui/ParamPanel.vue'
import StatGrid from '@/components/ui/StatGrid.vue'
import TheoryPanel from './TheoryPanel.vue'
import { buildPsfCharts } from './charts'
import {
  PSF_DEFAULTS,
  PSF_DEFAULT_VIEW,
  PSF_PRESETS,
  PSF_SCHEMA,
  type PsfParams,
  type PsfPreset,
  type PsfViewOptions,
} from './params'
import { computePsfMtf } from '@/core/optics/psfMtf'
import { fmt, fmtPercent } from '@/core/format'
import { drawPsfScene } from '@/render/psfScene'
import type { ParamValue } from '@/components/ui/params'
import type { StatItem } from '@/components/ui/statTypes'
import { pushLog, useExperimentLog } from '@/stores/log'
import { useRecorder } from '@/stores/experiments'
import { useTheme } from '@/stores/theme'

const MODULE_NAME = 'PSF / MTF'

type Tone = 'ok' | 'accent' | 'warn' | 'err' | 'muted'

interface HeroItem {
  label: string
  labelEn: string
  value: string
  unit?: string
  tone: Tone
  note: string
}

const params = reactive<PsfParams>({ ...PSF_DEFAULTS })
const view = reactive<PsfViewOptions>({ ...PSF_DEFAULT_VIEW })
const { palette } = useTheme()

const result = computed(() =>
  computePsfMtf({
    wavelengthNm: params.wavelength,
    fNumber: params.fNumber,
    defocusWaves: params.defocus,
  }),
)

const charts = computed(() => buildPsfCharts(result.value, palette.value))

function drawScene(ctx: CanvasRenderingContext2D, size: { w: number; h: number }): void {
  drawPsfScene(ctx, size, result.value, { ...view }, palette.value)
}

function updateParam(key: string, value: ParamValue): void {
  ;(params as unknown as Record<string, ParamValue>)[key] = value
}

function applyPreset(preset: PsfPreset): void {
  Object.assign(params, preset.patch)
  pushLog('info', MODULE_NAME, `应用预设「${preset.label}」：${preset.hint}`)
}

function resetParams(): void {
  Object.assign(params, PSF_DEFAULTS)
  Object.assign(view, PSF_DEFAULT_VIEW)
  pushLog('info', MODULE_NAME, '参数与显示选项已重置为默认值')
}

const heroStats = computed<HeroItem[]>(() => {
  const r = result.value
  if (!r.ok) return []
  const f50 = r.mtf50CyclesPerMm
  const f50Limit = r.mtf50LimitedCyclesPerMm
  const ratio = f50 !== null && f50Limit ? f50 / f50Limit : null
  return [
    {
      label: 'MTF50',
      labelEn: 'MTF = 0.5 处频率',
      value: f50 === null ? '—' : fmt(f50, 1),
      unit: f50 === null ? '' : 'lp/mm',
      tone: f50 === null ? 'warn' : ratio !== null && ratio > 0.9 ? 'ok' : 'accent',
      note:
        f50Limit === null
          ? '衍射极限 MTF50 无定义'
          : ratio !== null && ratio >= 0.98
            ? `已达衍射极限 ${fmt(f50Limit, 1)} lp/mm`
            : `衍射极限 ${fmt(f50Limit, 1)} lp/mm · 达成 ${fmtPercent(Math.min(ratio ?? 0, 1), 1)}`,
    },
    {
      label: '截止频率',
      labelEn: 'ν_c = 1/(λN)',
      value: fmt(r.cutoffCyclesPerMm, 1),
      unit: 'lp/mm',
      tone: 'muted',
      note: '非相干成像的理论上限，与离焦无关',
    },
    {
      label: '斯特列尔比',
      labelEn: 'Strehl ratio',
      value: fmt(r.strehlRatio, 3),
      tone:
        r.strehlRatio > 0.8 ? 'ok' : r.strehlRatio > 0.4 ? 'accent' : r.strehlRatio > 0.05 ? 'warn' : 'err',
      note: '轴上峰值比：纯离焦在 W₂₀ = 1λ、2λ… 处趋于 0',
    },
    {
      label: '轴上峰值下降',
      labelEn: 'Peak drop',
      value: Number.isFinite(r.peakDropDb) ? fmt(r.peakDropDb, 2) : '∞',
      unit: 'dB',
      tone: r.peakDropDb < 1 ? 'ok' : r.peakDropDb < 3 ? 'accent' : 'warn',
      note: '−10·log₁₀(Strehl)',
    },
  ]
})

const auxStats = computed(() => {
  const r = result.value
  if (!r.ok) return []
  return [
    { label: '离焦波像差', labelEn: 'W₂₀', value: `${fmt(r.defocusWaves, 2)} λ` },
    { label: '等价像面偏移', labelEn: 'Δz = 8λN²W₂₀', value: `${fmt(r.defocusMm * 1e3, 1)} μm` },
    { label: '焦深（±2λN²）', labelEn: 'DOF', value: `±${fmt(r.depthOfFocusMm * 1e3, 1)} μm` },
    { label: 'PSF 采样间距', labelEn: 'dx', value: `${fmt(r.pixelSizeUm, 3)} μm` },
  ]
})

const advancedStats = computed<StatItem[]>(() => {
  const r = result.value
  if (!r.ok) return []
  const df = r.mtf.x.length > 1 ? r.mtf.x[1] - r.mtf.x[0] : Number.NaN
  return [
    {
      label: '网格 / 光瞳采样',
      labelEn: 'grid / pupil R',
      value: `${r.gridSize}² / 25`,
      tone: 'muted',
      note: '二维 FFT 边长与光瞳半径采样数',
    },
    {
      label: '频率分辨率',
      labelEn: 'dν',
      value: fmt(df, 2),
      unit: 'lp/mm',
      tone: 'muted',
      note: `截止频率内约 ${r.mtf.x.length} 个频点`,
    },
    {
      label: 'PSF 覆盖半宽',
      labelEn: 'half extent',
      value: fmt(r.halfExtentUm, 1),
      unit: 'μm',
      tone: 'muted',
      note: '超出该范围的旁瓣会周期性折叠',
    },
    {
      label: '衍射极限 MTF50',
      labelEn: 'MTF50 limit',
      value: r.mtf50LimitedCyclesPerMm === null ? '—' : fmt(r.mtf50LimitedCyclesPerMm, 1),
      unit: 'lp/mm',
      tone: 'muted',
      note: '≈ 0.403 ν_c',
    },
  ]
})

const recorder = useRecorder({
  moduleId: 'psf-mtf',
  moduleName: MODULE_NAME,
  params: () => params,
  stats: () => heroStats.value,
  anomalies: () => [...result.value.errors, ...result.value.warnings],
  modelNotes: [
    '复光瞳 + FFT 数值模型：仅含离焦一种像差，不含球差/彗差/色差与探测器像元 MTF；圆孔边界用子采样近似，MTF 误差约 1%。',
  ],
})

function recordExperiment(): void {
  const rec = recorder.capture()
  pushLog('ok', MODULE_NAME, `已记录实验 ${rec.id}（可在「测试报告」模块查看与导出）`, { manual: true })
}

useExperimentLog(MODULE_NAME, () => {
  const r = result.value
  if (!r.ok) return null
  return `λ=${fmt(r.wavelengthNm, 0)}nm, N=${fmt(r.fNumber, 2)}, W₂₀=${fmt(r.defocusWaves, 2)}λ → MTF50=${fmt(r.mtf50CyclesPerMm, 1)}lp/mm，Strehl=${fmt(r.strehlRatio, 3)}，ν_c=${fmt(r.cutoffCyclesPerMm, 1)}lp/mm`
})

onMounted(() => {
  pushLog(
    'info',
    MODULE_NAME,
    '模块加载完成：复光瞳 P=circ·exp(i2πW₂₀ρ²) → 二维 FFT → PSF → FFT → MTF，全部本地计算',
  )
})
</script>

<template>
  <ExperimentWorkspace initial-tab="results" :initial-dock-height="268">
    <template #stage>
      <CanvasStage :draw="drawScene">
        <div class="stage__overlay">
          <div class="stage__row">
            <div class="stage__toolbar">
              <button
                class="chip"
                :class="{ 'chip--on': view.logScale }"
                title="PSF 动态范围很大，对数显示才能看清旁瓣结构"
                @click="view.logScale = !view.logScale"
              >
                对数显示
              </button>
              <button
                class="chip"
                :class="{ 'chip--on': view.showAiryReference }"
                title="画出衍射极限的艾里半径，便于比较模糊程度"
                @click="view.showAiryReference = !view.showAiryReference"
              >
                艾里参考圆
              </button>
              <button class="btn btn--sm btn--ghost" @click="resetParams">重置</button>
              <button class="btn btn--sm" title="把当前参数与结果存入测试报告" @click="recordExperiment">
                记录实验
              </button>
            </div>
            <div class="stage__badges">
              <span class="badge badge--accent">复光瞳 + FFT 数值模型</span>
              <span class="badge badge--muted">PSF / MTF · Simulated</span>
            </div>
          </div>
          <div class="stage__row" style="align-items: flex-end">
            <div class="stage__legend legend">
              <span class="legend__item" style="color: var(--accent)">
                <span class="legend__swatch legend__swatch--dashed" />
                <span style="color: var(--text-2)">衍射极限艾里半径</span>
              </span>
              <span class="legend__item" style="color: var(--text-3)">
                <span class="legend__swatch legend__swatch--dot" />
                <span style="color: var(--text-2)">中心十字（像面原点）</span>
              </span>
            </div>
            <span class="badge badge--muted">色标：峰值 = 1</span>
          </div>
        </div>
      </CanvasStage>
    </template>

    <template #params>
      <ParamPanel
        title="实验参数"
        subtitle="Parameters"
        :sections="PSF_SCHEMA"
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
              v-for="preset in PSF_PRESETS"
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
            数值模型：复光瞳 + 二维 FFT。仅含<strong>离焦</strong>一种像差，不含球差/彗差/色差，
            也不含探测器像元 MTF；网格 {{ result.ok ? result.gridSize : 256 }}²，MTF 与解析衍射极限的偏差约 1%。
          </div>
        </template>
      </ParamPanel>
    </template>

    <template #results>
      <div class="pane-stack">
        <div v-if="!result.ok" class="callout callout--err">
          <span class="callout__icon">!</span>
          <div>{{ result.errors.join('；') }}</div>
        </div>
        <template v-else>
          <div v-for="w in result.warnings" :key="w" class="callout callout--warn">
            <span class="callout__icon">△</span>
            <div>{{ w }}</div>
          </div>
        </template>

        <section class="group">
          <div class="group-head">
            <span class="group-head__title">核心性能指标</span>
            <span class="group-head__en">Core performance</span>
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
            <span class="group-head__title">离焦与采样</span>
            <span class="group-head__en">Defocus & sampling</span>
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

        <FoldSection title="高级参数（数值模型标定）" title-en="Advanced">
          <StatGrid :items="advancedStats" />
          <p class="group-note">
            MTF 横轴的标定关系：像面采样间距 dx = 2R·λ·N / n，频率分辨率 dν = 1/(n·dx) = 1/(2R·λ·N)，
            截止频率 ν_c = 1/(λN)。因此「截止频率内的频点数」只由光瞳半径采样数 R 决定（默认 25 → 50 点）。
          </p>
        </FoldSection>

        <FoldSection title="计算过程与公式推导" title-en="Worked example">
          <code class="formula">复光瞳：P(ρ) = circ(ρ)·exp(i·2π·W₂₀·ρ²)，ρ = 归一化光瞳半径</code>
          <code class="formula formula--calc">
            W₂₀ = {{ fmt(result.defocusWaves, 2) }} λ ⇒ Δz = 8λN²W₂₀ = 8 ×
            {{ fmt(result.wavelengthNm, 0) }} nm × {{ fmt(result.fNumber, 2) }}² ×
            {{ fmt(result.defocusWaves, 2) }} = {{ fmt(result.defocusMm * 1e3, 2) }} μm
          </code>
          <code class="formula formula--calc">
            ν_c = 1/(λN) = 1/({{ fmt(result.wavelengthNm, 0) }} nm × {{ fmt(result.fNumber, 2) }}) =
            {{ fmt(result.cutoffCyclesPerMm, 2) }} lp/mm
          </code>
          <code class="formula formula--calc">
            Strehl = |ΣP|² / (Σ|P|)² = {{ fmt(result.strehlRatio, 4) }}（轴上峰值比，对峰值精确）
          </code>
          <p class="group-note">
            <strong>计算链路：</strong>构建复光瞳 → 二维 FFT 得场 → 取模方得 PSF（归一化）→ 再做一次 FFT 得 OTF →
            取模并归一化得 MTF → 线性插值求 MTF50。
            <br />
            <strong>验证方式：</strong>W₂₀ = 0 时数值 MTF 与解析衍射极限 (2/π)(arccos t − t√(1−t²)) 对照，
            单元测试中偏差 &lt; 1.5%；W₂₀ = 0.25λ 对应 Δz = 2λN² 也与焦深判据自洽。
          </p>
        </FoldSection>

        <TheoryPanel />
      </div>
    </template>

    <template #charts>
      <div class="chart-row">
        <div class="chart-box">
          <div class="chart-box__head">
            <span class="chart-box__title">MTF 曲线</span>
            <span>数值 MTF vs 衍射极限 · MTF50 标注</span>
          </div>
          <ChartPanel :option="charts.mtf" :height="180" />
        </div>
        <div class="chart-box">
          <div class="chart-box__head">
            <span class="chart-box__title">PSF 径向截面</span>
            <span>当前离焦 vs 衍射极限（对数纵轴）</span>
          </div>
          <ChartPanel :option="charts.crossSection" :height="180" />
        </div>
      </div>
      <p class="xs muted" style="padding: 0 2px">
        MTF 由 |FT{PSF}| 归一化得到（非拟合曲线）；衍射极限参考曲线为解析式，用于验证数值模型。
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

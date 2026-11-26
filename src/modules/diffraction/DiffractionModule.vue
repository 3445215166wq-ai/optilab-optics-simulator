<script setup lang="ts">
/**
 * 模块三：衍射与光学分辨率（理想圆形孔径 · 艾里斑解析模型）
 * 结果同样按三级信息层级展示：核心 → 辅助 → 高级（折叠）/ 计算过程（折叠）。
 */
import { computed, onMounted, reactive } from 'vue'
import ExperimentWorkspace from '@/components/layout/ExperimentWorkspace.vue'
import CanvasStage from '@/components/ui/CanvasStage.vue'
import ChartPanel from '@/components/ui/ChartPanel.vue'
import FoldSection from '@/components/ui/FoldSection.vue'
import ParamPanel from '@/components/ui/ParamPanel.vue'
import StatGrid from '@/components/ui/StatGrid.vue'
import TheoryPanel from './TheoryPanel.vue'
import { buildDiffractionCharts } from './charts'
import {
  DIFFRACTION_DEFAULTS,
  DIFFRACTION_DEFAULT_VIEW,
  DIFFRACTION_PRESETS,
  DIFFRACTION_SCHEMA,
  type DiffractionParams,
  type DiffractionPreset,
  type DiffractionViewOptions,
} from './params'
import { computeDiffraction } from '@/core/optics/diffraction'
import { fmt, fmtPercent } from '@/core/format'
import { drawDiffractionScene } from '@/render/diffractionScene'
import type { ParamValue } from '@/components/ui/params'
import type { StatItem } from '@/components/ui/statTypes'
import { pushLog, useExperimentLog } from '@/stores/log'
import { useTheme } from '@/stores/theme'

const MODULE_NAME = '衍射与分辨率'

type Tone = 'ok' | 'accent' | 'warn' | 'muted'

interface HeroItem {
  label: string
  labelEn: string
  value: string
  unit?: string
  tone: Tone
  note: string
}

const params = reactive<DiffractionParams>({ ...DIFFRACTION_DEFAULTS })
const view = reactive<DiffractionViewOptions>({ ...DIFFRACTION_DEFAULT_VIEW })
const { palette } = useTheme()

const result = computed(() =>
  computeDiffraction({
    wavelengthNm: params.wavelength,
    fNumber: params.fNumber,
    apertureDiameterMm: params.aperture,
    magnification: params.magnification,
  }),
)

const charts = computed(() => buildDiffractionCharts({ ...params }, result.value, palette.value))

function drawScene(ctx: CanvasRenderingContext2D, size: { w: number; h: number }): void {
  drawDiffractionScene(ctx, size, result.value, { ...view }, palette.value)
}

function updateParam(key: string, value: ParamValue): void {
  ;(params as unknown as Record<string, ParamValue>)[key] = value
}

function applyPreset(preset: DiffractionPreset): void {
  Object.assign(params, preset.patch)
  pushLog('info', MODULE_NAME, `应用预设「${preset.label}」：${preset.hint}`)
}

function resetParams(): void {
  Object.assign(params, DIFFRACTION_DEFAULTS)
  Object.assign(view, DIFFRACTION_DEFAULT_VIEW)
  pushLog('info', MODULE_NAME, '参数与显示选项已重置为默认值')
}

/** ① 核心结论：像方为主、物方对照 */
const heroStats = computed<HeroItem[]>(() => {
  const r = result.value
  if (!r.ok) return []
  return [
    {
      label: '像方艾里半径',
      labelEn: 'r₁ = 1.22λN',
      value: fmt(r.airyRadiusImgUm, 2),
      unit: 'μm',
      tone: 'accent',
      note: `瑞利判据 Δ = ${fmt(r.rayleighImgUm, 2)} μm（像方）`,
    },
    {
      label: '物方艾里半径',
      labelEn: 'r₁ / |m|',
      value: fmt(r.airyRadiusObjUm, 2),
      unit: 'μm',
      tone: 'ok',
      note: `|m| = ${fmt(r.magnification, 2)}× 折算到物平面`,
    },
    {
      label: '像方截止频率',
      labelEn: 'f_c = 1/(λN)',
      value: fmt(r.cutoffImgCyclesPerMm, 1),
      unit: 'lp/mm',
      tone: 'muted',
      note: `物方 ${fmt(r.cutoffObjCyclesPerMm, 1)} lp/mm（×|m|）`,
    },
    {
      label: '艾里斑直径',
      labelEn: '2r₁',
      value: fmt(r.airyDiameterImgUm, 2),
      unit: 'μm',
      tone: 'muted',
      note: '中心亮斑到第一暗环的两倍',
    },
  ]
})

/** ② 辅助参数 */
const auxStats = computed(() => {
  const r = result.value
  if (!r.ok) return []
  const darkRings = r.rings.filter((x) => x.kind === 'dark')
  return [
    { label: '第一暗环', labelEn: '1st dark', value: `${fmt(darkRings[0]?.radiusImgUm, 2)} μm` },
    { label: '第二暗环', labelEn: '2nd dark', value: `${fmt(darkRings[1]?.radiusImgUm, 2)} μm` },
    {
      label: '第一副极大',
      labelEn: '1st side lobe',
      value: r.secondaryMaxima[0]
        ? `${fmt(r.secondaryMaxima[0].radiusImgUm, 2)} μm · ${fmtPercent(r.secondaryMaxima[0].intensity, 2)}`
        : '—',
    },
    { label: '像方 NA′, 物方 NA', labelEn: 'NA', value: `${fmt(r.naImage, 4)} / ${fmt(r.naObject, 4)}` },
  ]
})

/** ③ 高级参数（折叠） */
const advancedStats = computed<StatItem[]>(() => {
  const r = result.value
  if (!r.ok) return []
  return [
    {
      label: '派生焦距',
      labelEn: 'f = N·D',
      value: fmt(r.focalLengthMm, 2),
      unit: 'mm',
      tone: 'muted',
      note: '由 F 数与口径派生，不单独调节',
    },
    {
      label: '波长（介质内按真空计）',
      labelEn: 'λ',
      value: fmt(r.wavelengthNm, 0),
      unit: 'nm',
      tone: 'muted',
      note: `= ${fmt(r.wavelengthMm * 1e3, 3)} μm`,
    },
    {
      label: '艾里斑面积内能量',
      labelEn: 'Encircled (1st ring)',
      value: '83.8',
      unit: '%',
      tone: 'muted',
      note: '解析结论：第一暗环内约 83.8% 能量（1−J₀²−J₁²）',
    },
    {
      label: 'F 数 / 相对孔径',
      labelEn: 'N / (D/f)',
      value: `${fmt(r.fNumber, 2)} / ${fmt(1 / r.fNumber, 3)}`,
      tone: 'muted',
      note: 'N 越大相对孔径越小',
    },
  ]
})

useExperimentLog(MODULE_NAME, () => {
  const r = result.value
  if (!r.ok) return null
  return `λ=${fmt(r.wavelengthNm, 0)}nm, N=${fmt(r.fNumber, 2)}, |m|=${fmt(r.magnification, 2)} → 像方艾里半径 ${fmt(r.airyRadiusImgUm, 2)}μm，物方 ${fmt(r.airyRadiusObjUm, 2)}μm，f_c=${fmt(r.cutoffImgCyclesPerMm, 1)}lp/mm`
})

onMounted(() => {
  pushLog(
    'info',
    MODULE_NAME,
    '模块加载完成：艾里斑解析模型 I(r)=I₀[2J₁(v)/v]²（贝塞尔函数数值计算，非示意图），全部本地实时计算',
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
                title="对数显示可看清 1.75% / 0.42% 的副极大与暗环"
                @click="view.logScale = !view.logScale"
              >
                对数显示
              </button>
              <button
                class="chip"
                :class="{ 'chip--on': view.showRings }"
                title="标出艾里半径与第二暗环"
                @click="view.showRings = !view.showRings"
              >
                判据圆
              </button>
              <button class="btn btn--sm btn--ghost" @click="resetParams">重置</button>
            </div>
            <div class="stage__badges">
              <span class="badge badge--accent">艾里斑 · 解析模型</span>
              <span class="badge badge--muted">Airy · Simulated</span>
            </div>
          </div>
          <div class="stage__row" style="align-items: flex-end">
            <div class="stage__legend legend">
              <span class="legend__item" style="color: var(--accent)">
                <span class="legend__swatch legend__swatch--dashed" />
                <span style="color: var(--text-2)">艾里半径 / 瑞利判据</span>
              </span>
              <span class="legend__item" style="color: var(--ray-virtual)">
                <span class="legend__swatch legend__swatch--dot" />
                <span style="color: var(--text-2)">第二暗环</span>
              </span>
            </div>
            <span class="badge badge--muted">图幅半宽 = 4 个艾里半径</span>
          </div>
        </div>
      </CanvasStage>
    </template>

    <template #params>
      <ParamPanel
        title="实验参数"
        subtitle="Parameters"
        :sections="DIFFRACTION_SCHEMA"
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
              v-for="preset in DIFFRACTION_PRESETS"
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
            解析模型：理想圆形孔径、无像差、非相干成像。艾里半径为<strong>像方</strong>量，
            物方数值需除以 |m|；不含探测器像元 MTF。
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
          <div v-for="n in result.notes" :key="n" class="callout callout--info">
            <span class="callout__icon">i</span>
            <div>{{ n }}</div>
          </div>
        </template>

        <section class="group">
          <div class="group-head">
            <span class="group-head__title">核心分辨率结论</span>
            <span class="group-head__en">Core resolution</span>
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
            <span class="group-head__title">辅助参数</span>
            <span class="group-head__en">Secondary</span>
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

        <FoldSection title="高级参数" title-en="Advanced">
          <StatGrid :items="advancedStats" />
        </FoldSection>

        <FoldSection title="计算过程与公式推导" title-en="Worked example">
          <code class="formula">I(r) = I₀·[2J₁(v)/v]²，v = π·r/(λN)（J₁ 由数值方法计算）</code>
          <code class="formula formula--calc">
            r₁ = 1.2197 × λ × N = 1.2197 × {{ fmt(result.wavelengthNm, 0) }} nm ×
            {{ fmt(result.fNumber, 2) }} = {{ fmt(result.airyRadiusImgUm, 3) }} μm（像方）
          </code>
          <code class="formula formula--calc">
            物方：r₁ / |m| = {{ fmt(result.airyRadiusImgUm, 3) }} / {{ fmt(result.magnification, 2) }} =
            {{ fmt(result.airyRadiusObjUm, 3) }} μm
          </code>
          <code class="formula formula--calc">
            f_c = 1/(λ·N) = 1/({{ fmt(result.wavelengthMm * 1e3, 3) }} μm × {{ fmt(result.fNumber, 2) }}) =
            {{ fmt(result.cutoffImgCyclesPerMm, 2) }} lp/mm（像方）
          </code>
          <p class="group-note">
            <strong>单位链：</strong>λ (nm) → mm 参与计算 → 结果以 μm 显示；空间频率用 lp/mm（线对每毫米）。
            <br />
            <strong>适用条件：</strong>理想圆形孔径、均匀照明、无像差、非相干成像、近轴（NA ≈ 1/(2N)）。
          </p>
        </FoldSection>

        <TheoryPanel />
      </div>
    </template>

    <template #charts>
      <div class="chart-row">
        <div class="chart-box">
          <div class="chart-box__head">
            <span class="chart-box__title">径向光强分布</span>
            <span>对数纵轴 · 可见暗环与副极大</span>
          </div>
          <ChartPanel :option="charts.profile" :height="180" />
        </div>
        <div class="chart-box">
          <div class="chart-box__head">
            <span class="chart-box__title">分辨率随 F 数变化</span>
            <span>三个波长族 · 当前工况标点</span>
          </div>
          <ChartPanel :option="charts.resolution" :height="180" />
        </div>
      </div>
      <p class="xs muted" style="padding: 0 2px">
        左图 400 点逐点计算艾里强度；右图在 160 个 F 数采样点上计算 1.22λN 家族曲线，均非拟合示意。
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

<script setup lang="ts">
/**
 * 模块一：几何光学与光线追迹（理想薄透镜近轴模型）
 *
 * 信息层级（自上而下、权重递减）：
 *   ① 核心成像结果：像距 / 放大倍率 / 像高 / 成像性质 —— 大数值卡片
 *   ② 辅助光学参数：物方焦点 / 像方焦点 / 成像区间 —— 紧凑低权重
 *   ③ 高级光学参数：名义 F 数 / 有效 F 数 / 物方 NA / 像方 NA —— 折叠，默认关闭
 *   ④ 计算过程与公式推导 —— 折叠，默认关闭
 */
import { computed, onMounted, reactive } from 'vue'
import ExperimentWorkspace from '@/components/layout/ExperimentWorkspace.vue'
import CanvasStage from '@/components/ui/CanvasStage.vue'
import ChartPanel from '@/components/ui/ChartPanel.vue'
import FoldSection from '@/components/ui/FoldSection.vue'
import ParamPanel from '@/components/ui/ParamPanel.vue'
import StatGrid from '@/components/ui/StatGrid.vue'
import TheoryPanel from './TheoryPanel.vue'
import { buildGeoCharts } from './charts'
import {
  GEO_DEFAULTS,
  GEO_DEFAULT_VIEW,
  GEO_PRESETS,
  GEO_SCHEMA,
  type GeoParams,
  type GeoPreset,
  type GeoViewOptions,
} from './params'
import { computeThinLens, summarizeThinLens } from '@/core/optics/thinLens'
import { fmt } from '@/core/format'
import {
  GEO_RAY_LEGEND,
  GEO_STRETCH_OPTIONS,
  computeGeoSceneBounds,
  drawGeoOpticsScene,
} from '@/render/geoOpticsScene'
import { planScale } from '@/render/viewport'
import type { ParamValue } from '@/components/ui/params'
import type { StatItem } from '@/components/ui/statTypes'
import { pushLog, useExperimentLog } from '@/stores/log'
import { useRecorder } from '@/stores/experiments'
import { useTheme } from '@/stores/theme'

const MODULE_NAME = '几何光学'

type Tone = 'ok' | 'accent' | 'warn' | 'muted'

interface HeroItem {
  label: string
  labelEn: string
  value: string
  unit?: string
  tone: Tone
  note: string
}

interface AuxItem {
  label: string
  labelEn: string
  value: string
}

const params = reactive<GeoParams>({ ...GEO_DEFAULTS })
const view = reactive<GeoViewOptions>({ ...GEO_DEFAULT_VIEW })
const canvasSize = reactive({ w: 0, h: 0 })
const { palette } = useTheme()

const result = computed(() => computeThinLens({ ...params }))
const charts = computed(() => buildGeoCharts({ ...params }, palette.value))

function drawScene(ctx: CanvasRenderingContext2D, size: { w: number; h: number }): void {
  drawGeoOpticsScene(ctx, size, result.value, { ...view }, palette.value)
}

function onStageResize(size: { w: number; h: number }): void {
  canvasSize.w = size.w
  canvasSize.h = size.h
}

/**
 * 光路图纵向拉伸倍率标注。
 * 典型工况行宽比可达十几倍，严格等比会把光路压成细线；
 * 纵向只做有限拉伸并在界面标注实际倍率，数值结果不受影响。
 */
const scaleLabel = computed(() => {
  if (canvasSize.w < 10 || canvasSize.h < 10) return '自适应缩放 Auto-fit'
  const bounds = computeGeoSceneBounds(result.value, { ...view })
  const plan = planScale(canvasSize.w, canvasSize.h, bounds, GEO_STRETCH_OPTIONS)
  return plan.stretch > 1.15 ? `纵向放大 ${plan.stretch.toFixed(1)}× · 示意` : '等比缩放 Auto-fit'
})

/** 图例只显示当前真正画出来的内容，避免「图例有、画面没有」 */
const legendItems = computed(() =>
  GEO_RAY_LEGEND.filter((item) => {
    if (item.key === 'bundle') return view.showBundleRays
    if (item.key === 'virtual') return result.value.image.status === 'virtual'
    return true
  }),
)

function updateParam(key: string, value: ParamValue): void {
  ;(params as unknown as Record<string, ParamValue>)[key] = value
}

function toggleView(key: keyof GeoViewOptions): void {
  view[key] = !view[key]
  if (key === 'showBundleRays') {
    pushLog('info', MODULE_NAME, `光锥显示已${view.showBundleRays ? '开启' : '关闭'}（高级辅助显示）`)
  }
}

function applyPreset(preset: GeoPreset): void {
  Object.assign(params, preset.patch)
  pushLog('info', MODULE_NAME, `应用预设工况「${preset.label}」：${preset.hint}`)
}

function resetParams(): void {
  Object.assign(params, GEO_DEFAULTS)
  Object.assign(view, GEO_DEFAULT_VIEW)
  pushLog('info', MODULE_NAME, '参数与显示选项已重置为默认值')
}

function onInvalid(message: string): void {
  pushLog('warn', MODULE_NAME, message)
}

const regimeText = computed(() => {
  const r = result.value
  if (!r.ok) return '参数非法'
  if (r.image.status === 'infinite') return 'u = |f| · 出射平行光'
  if (r.lensType === 'concave') return '凹透镜 · 正立缩小虚像'
  const ratio = r.objectDistance / r.focalLengthAbs
  if (ratio > 2.0001) return 'u > 2f · 缩小倒立实像'
  if (ratio > 1.0001) return 'f < u < 2f · 放大倒立实像'
  return 'u < f · 放大正立虚像'
})

/** ① 核心成像结果（大数值、主视觉） */
const heroStats = computed<HeroItem[]>(() => {
  const r = result.value
  if (!r.ok) return []
  const img = r.image
  const isReal = img.status === 'real'
  const isVirtual = img.status === 'virtual'
  const tone: Tone = isReal ? 'ok' : isVirtual ? 'accent' : 'warn'

  return [
    {
      label: '像距',
      labelEn: 'v',
      value: img.distance === null ? '∞' : fmt(img.distance, 2),
      unit: img.distance === null ? '' : 'mm',
      tone,
      note:
        img.distance === null
          ? '出射光平行，像在无穷远'
          : img.distance > 0
            ? '透镜右侧 · 实像侧'
            : '透镜左侧 · 与物同侧',
    },
    {
      label: '横向放大倍率',
      labelEn: 'm = −v/u',
      value: fmt(img.magnification, 3),
      tone,
      note:
        img.magnification === null
          ? '无有限像点'
          : Math.abs(Math.abs(img.magnification) - 1) < 0.001
            ? '等大 |m| = 1'
            : Math.abs(img.magnification) > 1
              ? `放大 ${fmt(Math.abs(img.magnification), 2)}×`
              : `缩小 ${fmt(Math.abs(img.magnification), 2)}×`,
    },
    {
      label: '像高',
      labelEn: 'h′ = m·h',
      value: fmt(img.height, 2),
      unit: img.height === null ? '' : 'mm',
      tone: img.height === null ? 'muted' : img.isInverted ? 'accent' : 'ok',
      note: img.height === null ? '—' : img.isInverted ? '负值 · 倒立' : '正值 · 正立',
    },
    {
      label: '成像性质',
      labelEn: 'Image type',
      value: isReal ? '实像' : isVirtual ? '虚像' : '无穷远',
      tone,
      note: isReal ? '可由屏幕 / 传感器接收' : isVirtual ? '反向延长线相交，仅可目视' : '准直输出',
    },
  ]
})

/** ② 辅助光学参数（紧凑、低权重） */
const auxStats = computed<AuxItem[]>(() => {
  const r = result.value
  if (!r.ok) return []
  const objectFocal = r.focalPoints.objectSideZ
  const imageFocal = r.focalPoints.imageSideZ
  return [
    {
      label: '物方焦点 F',
      labelEn: 'z = −f',
      value: `${fmt(objectFocal, 1)} mm · ${objectFocal < 0 ? '左侧' : '右侧'}`,
    },
    {
      label: '像方焦点 F′',
      labelEn: 'z = +f',
      value: `${fmt(imageFocal, 1)} mm · ${imageFocal < 0 ? '左侧' : '右侧'}`,
    },
    {
      label: '成像区间',
      labelEn: 'u/|f| = ' + fmt(r.objectDistance / r.focalLengthAbs, 2),
      value: regimeText.value,
    },
  ]
})

/** ③ 高级光学参数（折叠，默认关闭） */
const advancedStats = computed<StatItem[]>(() => {
  const r = result.value
  if (!r.ok) return []
  const m = r.image.magnification
  const nEff = r.effectiveFNumber
  return [
    {
      label: '名义 F 数',
      labelEn: 'N = |f|/D',
      value: fmt(r.fNumber, 2),
      tone: r.fNumber < 1 ? 'warn' : 'muted',
      note: r.fNumber < 1 ? '大孔径：近轴近似适用性下降' : '按无限共轭定义',
    },
    {
      label: '有效 F 数',
      labelEn: 'N_eff = |v|/D',
      value: nEff === null ? '—' : fmt(nEff, 2),
      tone: 'muted',
      note:
        nEff === null
          ? '出射平行光，无会聚锥（趋于 ∞）'
          : r.image.status === 'real'
            ? `= N·(1+|m|) = ${fmt(r.fNumber * (1 + Math.abs(m ?? 0)), 2)}`
            : '虚像：出射光发散，取像方锥等效值',
    },
    {
      label: '物方数值孔径',
      labelEn: 'NA = n·sinθ',
      value: fmt(r.naObject, 3),
      tone: 'muted',
      note: `半角 ${fmt(r.objectHalfAngleDeg, 2)}° · 默认空气 n≈1`,
    },
    {
      label: '像方数值孔径',
      labelEn: 'NA′ = n·sinθ′',
      value: fmt(r.naImage, 3),
      tone: 'muted',
      note:
        r.image.status === 'infinite'
          ? '平行出射，会聚半角为 0'
          : `半角 ${fmt(r.imageHalfAngleDeg, 2)}°`,
    },
  ]
})

const recorder = useRecorder({
  moduleId: 'geo-optics',
  moduleName: MODULE_NAME,
  params: () => params,
  stats: () => heroStats.value,
  anomalies: () => [...result.value.errors, ...result.value.warnings],
  modelNotes: ['理想薄透镜近轴模型：不含像差、衍射与镀膜；光路纵向拉伸仅影响显示，不改变数值结果。'],
})

function recordExperiment(): void {
  const rec = recorder.capture()
  pushLog('ok', MODULE_NAME, `已记录实验 ${rec.id}（可在「测试报告」模块查看与导出）`, { manual: true })
}

useExperimentLog(MODULE_NAME, () => {
  const r = result.value
  if (!r.ok) return null
  return `${summarizeThinLens(r)}（D=${r.apertureDiameter}mm, N=${fmt(r.fNumber, 2)}）`
})

onMounted(() => {
  pushLog(
    'info',
    MODULE_NAME,
    '模块加载完成：理想薄透镜近轴模型（1/f = 1/u + 1/v），结果由本地实时光线追迹计算',
  )
})
</script>

<template>
  <ExperimentWorkspace initial-tab="results" :initial-dock-height="268">
    <!-- ============ 中央：光路可视化 ============ -->
    <template #stage>
      <CanvasStage :draw="drawScene" @resize="onStageResize">
        <div class="stage__overlay">
          <div class="stage__row">
            <div class="stage__toolbar">
              <button
                class="chip"
                :class="{ 'chip--on': view.showBundleRays }"
                title="按通光口径采样的光锥与光束填充（可选高级辅助）"
                @click="toggleView('showBundleRays')"
              >
                光锥（高级）
              </button>
              <button
                class="chip"
                :class="{ 'chip--on': view.showAnnotations }"
                title="焦点、物/像、尺寸与比例尺标注"
                @click="toggleView('showAnnotations')"
              >
                标注
              </button>
              <button
                class="chip"
                :class="{ 'chip--on': view.showImagePlane }"
                title="像面位置参考线"
                @click="toggleView('showImagePlane')"
              >
                像面
              </button>
              <button class="btn btn--sm btn--ghost" title="恢复默认参数" @click="resetParams">
                重置
              </button>
              <button class="btn btn--sm" title="把当前参数与结果存入测试报告" @click="recordExperiment">
                记录实验
              </button>
            </div>
            <div class="stage__badges">
              <span class="badge badge--accent">理想薄透镜 · 近轴模型</span>
              <span class="badge badge--muted">Paraxial · Simulated</span>
            </div>
          </div>

          <div class="stage__row" style="align-items: flex-end">
            <div class="stage__legend legend">
              <span
                v-for="item in legendItems"
                :key="item.key"
                class="legend__item"
                :style="{ color: `var(--${item.colorVar})` }"
              >
                <span class="legend__swatch" :class="{ 'legend__swatch--dashed': item.dashed }" />
                <span style="color: var(--text-2)">{{ item.label }}</span>
              </span>
            </div>
            <span class="badge badge--muted">{{ scaleLabel }}</span>
          </div>
        </div>
      </CanvasStage>
    </template>

    <!-- ============ 右侧：参数 ============ -->
    <template #params>
      <ParamPanel
        title="实验参数"
        subtitle="Parameters"
        :sections="GEO_SCHEMA"
        :model="params"
        @update="updateParam"
        @invalid="onInvalid"
      >
        <template #actions>
          <button class="btn btn--sm" title="恢复默认参数" @click="resetParams">重置</button>
        </template>
        <template #footer>
          <div class="section-title">预设工况 <span class="muted xs">· Presets</span></div>
          <div class="preset-list">
            <button
              v-for="preset in GEO_PRESETS"
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
            理想薄透镜近轴模型：不含像差、衍射与镀膜；光路图纵向拉伸仅为可读性，
            <strong>不影响任何计算数值</strong>。
          </div>
        </template>
      </ParamPanel>
    </template>

    <!-- ============ 底部：结果 / 曲线 / 日志 ============ -->
    <template #results>
      <div class="pane-stack">
        <!-- 参数非法与提示 -->
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

        <!-- ① 核心成像结果 -->
        <section class="group">
          <div class="group-head">
            <span class="group-head__title">核心成像结果</span>
            <span class="group-head__en">Core image results</span>
          </div>
          <div class="hero-grid">
            <div
              v-for="item in heroStats"
              :key="item.label"
              class="hero"
              :class="`hero--${item.tone}`"
            >
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

        <!-- ② 辅助光学参数 -->
        <section class="group">
          <div class="group-head">
            <span class="group-head__title">辅助光学参数</span>
            <span class="group-head__en">Secondary parameters</span>
          </div>
          <div class="aux-grid">
            <div v-for="item in auxStats" :key="item.label" class="aux-row">
              <span class="aux-row__label">
                {{ item.label }}<span class="aux-row__en">{{ item.labelEn }}</span>
              </span>
              <span class="aux-row__value">{{ item.value }}</span>
            </div>
          </div>
          <p class="group-note">
            坐标原点取透镜主平面，向右（光传播方向）为正，单位 mm；焦点位置 z = ∓f 会随焦距符号自动落在相应侧。
          </p>
        </section>

        <!-- ③ 高级光学参数（默认关闭） -->
        <FoldSection title="高级光学参数" title-en="Advanced parameters">
          <StatGrid :items="advancedStats" />
          <p class="group-note">
            名义 F 数 N = |f|/D 按无限共轭定义；有限物距下真正决定像面照度（∝1/N_eff²）与衍射斑尺寸的是
            <strong>有效 F 数 N_eff = |v|/D</strong>，成实像时可进一步写成 N·(1+|m|)（1:1 成像时 N_eff = 2N）。
            两者只在无穷远成像时相等；虚像时出射光发散，N_eff 只作为像方锥的等效量。
            数值孔径按 NA = n·sinθ 计算，本模型默认空气（n ≈ 1）；近轴近似要求孔径角与视场角都较小。
          </p>
        </FoldSection>

        <!-- ④ 计算过程与公式推导（默认关闭） -->
        <FoldSection title="计算过程与公式推导" title-en="Worked example">
          <code class="formula">高斯成像公式：1/f = 1/u + 1/v ⇒ v = f·u/(u − f) ［f、u、v 单位 mm］</code>
          <code class="formula">横向放大率：m = h′/h = −v/u ［无量纲；m &lt; 0 倒立，m &gt; 0 正立］</code>
          <code class="formula">牛顿公式（互校用）：(u − f)(v − f) = f² ［mm²］</code>
          <code class="formula formula--calc">
            代入：{{ result.lensType === 'convex' ? '凸透镜' : '凹透镜' }} f = {{ fmt(result.focalLengthSigned, 1) }}
            mm，u = {{ fmt(result.objectDistance, 1) }} mm
          </code>
          <code class="formula formula--calc">
            v = ({{ fmt(result.focalLengthSigned, 1) }} × {{ fmt(result.objectDistance, 1) }}) / ({{
              fmt(result.objectDistance, 1)
            }}
            − {{ fmt(result.focalLengthSigned, 1) }}) = {{ fmt(result.image.distance, 3) }} mm
          </code>
          <code class="formula formula--calc">
            m = −({{ fmt(result.image.distance, 3) }}) / {{ fmt(result.objectDistance, 1) }} =
            {{ fmt(result.image.magnification, 4) }} ；
            h′ = m·h = {{ fmt(result.image.magnification, 4) }} × {{ fmt(result.objectHeight, 1) }} =
            {{ fmt(result.image.height, 3) }} mm
          </code>
          <p class="group-note">
            <strong>符号约定：</strong>光线自左向右；u &gt; 0（物在左侧）；凸透镜 f &gt; 0、凹透镜 f &lt; 0；
            v &gt; 0 为实像（右侧）、v &lt; 0 为虚像（左侧）。
            <br />
            <strong>适用条件：</strong>近轴近似（sinθ ≈ tanθ ≈ θ）、薄透镜（忽略厚度）、单色光、不含像差与衍射。
            当 F 数过小、视场过大或需要定量像质评价时，应改用实际光线追迹或阶段二的 PSF/MTF 分析。
          </p>
        </FoldSection>

        <TheoryPanel />
      </div>
    </template>

    <template #charts>
      <div class="chart-row">
        <div class="chart-box">
          <div class="chart-box__head">
            <span class="chart-box__title">像距 – 物距特性</span>
            <span>v(u){{ result.lensType === 'convex' ? '，渐近线 u = f' : '，凹透镜无渐近线' }}</span>
          </div>
          <ChartPanel :option="charts.imageDistance" :height="180" />
        </div>
        <div class="chart-box">
          <div class="chart-box__head">
            <span class="chart-box__title">放大率 – 物距特性</span>
            <span>m(u)，m = −1 为等大点</span>
          </div>
          <ChartPanel :option="charts.magnification" :height="180" />
        </div>
      </div>
      <p class="xs muted" style="padding: 0 2px">
        曲线由薄透镜公式在 220 个物距采样点上逐点计算得到；超出可视范围的极端值断开显示（非插值、非拟合）。
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
  letter-spacing: 0.02em;
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
  transition: background var(--t-fast), border-color var(--t-fast);
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

<script setup lang="ts">
/**
 * 模块一：几何光学与光线追迹（理想薄透镜近轴模型）
 * 计算 → 绘图 → 面板 三层分离：本组件只负责编排与交互。
 */
import { computed, onMounted, reactive } from 'vue'
import ExperimentWorkspace from '@/components/layout/ExperimentWorkspace.vue'
import CanvasStage from '@/components/ui/CanvasStage.vue'
import ChartPanel from '@/components/ui/ChartPanel.vue'
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
import { useTheme } from '@/stores/theme'

const MODULE_NAME = '几何光学'

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
 * 典型工况下行宽比可达十几倍，严格等比会把光路压成一条细线，
 * 因此纵向做有限拉伸，并在界面上明确标注实际倍率（数值结果不受影响）。
 */
const scaleLabel = computed(() => {
  if (canvasSize.w < 10 || canvasSize.h < 10) return '自适应缩放 Auto-fit'
  const bounds = computeGeoSceneBounds(result.value, { ...view })
  const plan = planScale(canvasSize.w, canvasSize.h, bounds, GEO_STRETCH_OPTIONS)
  return plan.stretch > 1.15 ? `纵向放大 ${plan.stretch.toFixed(1)}× · 示意` : '等比缩放 Auto-fit'
})

function updateParam(key: string, value: ParamValue): void {
  ;(params as unknown as Record<string, ParamValue>)[key] = value
}

function toggleView(key: keyof GeoViewOptions): void {
  view[key] = !view[key]
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
  if (r.image.status === 'infinite') return 'u = f · 出射平行光'
  if (r.lensType === 'concave') return '凹透镜 · 恒为正立缩小虚像'
  const ratio = r.objectDistance / r.focalLengthAbs
  if (ratio > 2.0001) return 'u > 2f · 缩小倒立实像'
  if (ratio > 1.0001) return 'f < u < 2f · 放大倒立实像'
  return 'u < f · 放大正立虚像'
})

const stats = computed<StatItem[]>(() => {
  const r = result.value
  if (!r.ok) return []
  const img = r.image
  const isVirtual = img.status === 'virtual'
  const isReal = img.status === 'real'

  const items: StatItem[] = [
    {
      label: '像距',
      labelEn: 'v',
      value: img.distance === null ? '∞' : fmt(img.distance, 2),
      unit: img.distance === null ? '' : 'mm',
      tone: isReal ? 'ok' : isVirtual ? 'accent' : 'warn',
      note:
        img.distance === null
          ? '像在无穷远，无有限像距'
          : img.distance > 0
            ? '像在透镜右侧（实像侧）'
            : '像在透镜左侧（与物同侧）',
    },
    {
      label: '横向放大率',
      labelEn: 'm = −v/u',
      value: fmt(img.magnification, 3),
      tone: isReal ? 'ok' : isVirtual ? 'accent' : 'warn',
      note:
        img.magnification === null
          ? '—'
          : Math.abs(Math.abs(img.magnification) - 1) < 0.001
            ? '等大成像 |m| = 1'
            : Math.abs(img.magnification) > 1
              ? `放大 ${fmt(Math.abs(img.magnification), 2)}×`
              : `缩小 ${fmt(Math.abs(img.magnification), 2)}×`,
    },
    {
      label: '像高',
      labelEn: 'h′ = m·h',
      value: fmt(img.height, 2),
      unit: img.height === null ? '' : 'mm',
      note: img.height === null ? '—' : img.isInverted ? '倒立（负值）' : '正立（正值）',
    },
    {
      label: '成像性质',
      labelEn: 'Image type',
      value: img.status === 'real' ? '实像' : img.status === 'virtual' ? '虚像' : '无穷远',
      tone: isReal ? 'ok' : isVirtual ? 'accent' : 'warn',
      note: isReal ? '可被屏幕/传感器接收' : isVirtual ? '仅能用目镜观察' : '准直输出',
    },
    {
      label: '成像区间',
      labelEn: 'u / f regime',
      value: regimeText.value,
      tone: 'muted',
      note: `u/f = ${fmt(r.objectDistance / r.focalLengthAbs, 2)}`,
    },
    {
      label: '物方焦点 F',
      labelEn: 'Object focal point',
      value: fmt(r.focalPoints.objectSideZ, 1),
      unit: 'mm',
      note: '光心为原点，z = −f',
    },
    {
      label: '像方焦点 F′',
      labelEn: 'Image focal point',
      value: fmt(r.focalPoints.imageSideZ, 1),
      unit: 'mm',
      note: 'z = +f',
    },
    {
      label: '相对孔径倒数',
      labelEn: 'F/# = |f|/D',
      value: fmt(r.fNumber, 2),
      tone: r.fNumber < 1 ? 'warn' : 'muted',
      note: r.fNumber < 1 ? '超出近轴近似适用范围' : '越小进光量越大',
    },
    {
      label: '物方数值孔径',
      labelEn: 'NA object',
      value: fmt(r.naObject, 3),
      note: '近轴 NA ≈ sinθ，θ = atan(D/2u)',
    },
    {
      label: '像方数值孔径',
      labelEn: 'NA image',
      value: r.naImage === null ? '—' : fmt(r.naImage, 3),
      note: r.naImage === null ? '无穷远成像无定义' : '像方会聚半角',
    },
  ]
  return items
})

useExperimentLog(MODULE_NAME, () => {
  const r = result.value
  if (!r.ok) return null
  return `${summarizeThinLens(r)}（D=${r.apertureDiameter}mm, F/#=${fmt(r.fNumber, 2)}）`
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
  <ExperimentWorkspace initial-tab="results" :initial-dock-height="256">
    <!-- ============ 中央：光路可视化 ============ -->
    <template #stage>
      <CanvasStage :draw="drawScene" @resize="onStageResize">
        <div class="stage__overlay">
          <div class="stage__row">
            <div class="stage__toolbar">
              <button
                class="chip"
                :class="{ 'chip--on': view.showPrincipalRays }"
                @click="toggleView('showPrincipalRays')"
              >
                主光线
              </button>
              <button
                class="chip"
                :class="{ 'chip--on': view.showBundleRays }"
                @click="toggleView('showBundleRays')"
              >
                光锥
              </button>
              <button
                class="chip"
                :class="{ 'chip--on': view.showVirtualExtensions }"
                @click="toggleView('showVirtualExtensions')"
              >
                虚像延长线
              </button>
              <button
                class="chip"
                :class="{ 'chip--on': view.showAnnotations }"
                @click="toggleView('showAnnotations')"
              >
                标注
              </button>
              <button
                class="chip"
                :class="{ 'chip--on': view.showImagePlane }"
                @click="toggleView('showImagePlane')"
              >
                像面
              </button>
              <button class="btn btn--sm btn--ghost" title="恢复默认参数" @click="resetParams">
                重置
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
                v-for="item in GEO_RAY_LEGEND"
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
            本模块采用<strong>理想薄透镜近轴模型</strong>，不含像差、衍射与镀膜效应，
            结果用于理解成像规律与公式验证，不构成商业光学设计依据。
          </div>
        </template>
      </ParamPanel>
    </template>

    <!-- ============ 底部：结果 / 曲线 / 日志 ============ -->
    <template #results>
      <div v-if="!result.ok" class="callout callout--err">
        <span class="callout__icon">!</span>
        <div>{{ result.errors.join('；') }}</div>
      </div>
      <div v-for="w in result.warnings" :key="w" class="callout callout--warn">
        <span class="callout__icon">△</span>
        <div>{{ w }}</div>
      </div>
      <div v-for="n in result.notes" :key="n" class="callout callout--info">
        <span class="callout__icon">i</span>
        <div>{{ n }}</div>
      </div>

      <StatGrid :items="stats" />

      <div class="section-title">计算过程 <span class="muted xs">· Worked example</span></div>
      <code class="formula">
        {{ result.lensType === 'convex' ? '凸透镜' : '凹透镜' }}：f = {{ fmt(result.focalLengthSigned, 1) }} mm，u
        = {{ fmt(result.objectDistance, 1) }} mm
      </code>
      <code class="formula formula--calc">
        v = f·u/(u − f) = ({{ fmt(result.focalLengthSigned, 1) }} × {{ fmt(result.objectDistance, 1) }}) / ({{
          fmt(result.objectDistance, 1)
        }}
        − {{ fmt(result.focalLengthSigned, 1) }}) = {{ fmt(result.image.distance, 3) }} mm
      </code>
      <code class="formula formula--calc">
        m = −v/u = −({{ fmt(result.image.distance, 3) }}) / {{ fmt(result.objectDistance, 1) }} =
        {{ fmt(result.image.magnification, 4) }} ；h′ = m·h = {{ fmt(result.image.height, 3) }} mm
      </code>

      <TheoryPanel />
    </template>

    <template #charts>
      <div class="chart-row">
        <div class="chart-box">
          <div class="chart-box__head">
            <span class="chart-box__title">像距 – 物距特性</span>
            <span>v(u)，渐近线 u = f</span>
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
        曲线由薄透镜公式在 220 个物距采样点上逐点计算得到；超出可视范围的极端值已断开显示（非插值、非拟合）。
      </p>
    </template>
  </ExperimentWorkspace>
</template>

<style scoped>
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

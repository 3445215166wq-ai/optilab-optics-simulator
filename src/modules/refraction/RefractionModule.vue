<script setup lang="ts">
/**
 * 模块二：光的传播与折射（反射定律 / 斯涅尔定律 / 全反射 / 菲涅尔反射率）
 */
import { computed, onMounted, reactive } from 'vue'
import ExperimentWorkspace from '@/components/layout/ExperimentWorkspace.vue'
import CanvasStage from '@/components/ui/CanvasStage.vue'
import ChartPanel from '@/components/ui/ChartPanel.vue'
import ParamPanel from '@/components/ui/ParamPanel.vue'
import StatGrid from '@/components/ui/StatGrid.vue'
import TheoryPanel from './TheoryPanel.vue'
import { buildRefractionCharts } from './charts'
import { REFRACTION_DEFAULTS, REFRACTION_SCHEMA, type RefractionParams } from './params'
import { MEDIA_PRESETS, computeRefraction } from '@/core/optics/refraction'
import { fmt, fmtDeg, fmtPercent } from '@/core/format'
import { drawRefractionScene } from '@/render/refractionScene'
import type { ParamValue } from '@/components/ui/params'
import type { StatItem } from '@/components/ui/statTypes'
import { pushLog, useExperimentLog } from '@/stores/log'
import { useRecorder } from '@/stores/experiments'
import { useTheme } from '@/stores/theme'

const MODULE_NAME = '折射与全反射'

const params = reactive<RefractionParams>({ ...REFRACTION_DEFAULTS })
const view = reactive({ showAuxiliary: true, showCriticalAngle: true })
const { palette } = useTheme()

const result = computed(() =>
  computeRefraction({
    incidenceAngleDeg: params.incidenceAngle,
    n1: params.n1,
    n2: params.n2,
    wavelengthNm: params.wavelength,
  }),
)

const charts = computed(() =>
  buildRefractionCharts(
    { ...params },
    result.value.criticalAngleDeg,
    result.value.brewsterAngleDeg,
    palette.value,
  ),
)

const medium1Name = computed(
  () => MEDIA_PRESETS.find((m) => Math.abs(m.n - params.n1) < 1e-6)?.label ?? '自定义介质',
)
const medium2Name = computed(
  () => MEDIA_PRESETS.find((m) => Math.abs(m.n - params.n2) < 1e-6)?.label ?? '自定义介质',
)

const medium1Id = computed<string>({
  get: () => MEDIA_PRESETS.find((m) => Math.abs(m.n - params.n1) < 1e-6)?.id ?? 'custom',
  set: (id) => {
    const preset = MEDIA_PRESETS.find((m) => m.id === id)
    if (!preset) return
    params.n1 = preset.n
    pushLog('info', MODULE_NAME, `入射侧介质切换为「${preset.label} ${preset.labelEn}」n₁ = ${preset.n}`)
  },
})

const medium2Id = computed<string>({
  get: () => MEDIA_PRESETS.find((m) => Math.abs(m.n - params.n2) < 1e-6)?.id ?? 'custom',
  set: (id) => {
    const preset = MEDIA_PRESETS.find((m) => m.id === id)
    if (!preset) return
    params.n2 = preset.n
    pushLog('info', MODULE_NAME, `折射侧介质切换为「${preset.label} ${preset.labelEn}」n₂ = ${preset.n}`)
  },
})

function drawScene(ctx: CanvasRenderingContext2D, size: { w: number; h: number }): void {
  drawRefractionScene(
    ctx,
    size,
    result.value,
    {
      medium1Name: medium1Name.value,
      medium2Name: medium2Name.value,
      showAuxiliary: view.showAuxiliary,
      showCriticalAngle: view.showCriticalAngle,
    },
    palette.value,
  )
}

function updateParam(key: string, value: ParamValue): void {
  ;(params as unknown as Record<string, ParamValue>)[key] = value
}

function resetParams(): void {
  Object.assign(params, REFRACTION_DEFAULTS)
  view.showAuxiliary = true
  view.showCriticalAngle = true
  pushLog('info', MODULE_NAME, '参数已重置为默认值（空气 → 水，θ₁ = 45°）')
}

/** 一键切到「水 → 空气」全反射演示 */
function loadTirDemo(): void {
  params.n1 = 1.333
  params.n2 = 1.000293
  params.incidenceAngle = 60
  pushLog('info', MODULE_NAME, '加载全反射演示：水 → 空气，θ₁ = 60° > θc ≈ 48.6°')
}

const stats = computed<StatItem[]>(() => {
  const r = result.value
  if (!r.ok) return []
  const items: StatItem[] = [
    {
      label: '入射角',
      labelEn: 'θ₁',
      value: fmt(r.theta1Deg, 1),
      unit: '°',
      tone: 'accent',
      note: '相对法线量取',
    },
    {
      label: '反射角',
      labelEn: 'θ₁′',
      value: fmt(r.thetaReflectDeg, 1),
      unit: '°',
      tone: 'muted',
      note: '反射定律：恒等于入射角',
    },
    {
      label: '折射角',
      labelEn: 'θ₂',
      value: r.theta2Deg === null ? '无' : fmt(r.theta2Deg, 2),
      unit: r.theta2Deg === null ? '' : '°',
      tone: r.isTIR ? 'err' : 'ok',
      note: r.isTIR ? '全反射：不存在折射光' : `sinθ₂ = ${fmt(r.sinTheta2, 4)}`,
    },
    {
      label: '临界角',
      labelEn: 'θc',
      value: r.criticalAngleDeg === null ? '不存在' : fmt(r.criticalAngleDeg, 2),
      unit: r.criticalAngleDeg === null ? '' : '°',
      tone: r.criticalAngleDeg === null ? 'muted' : 'warn',
      note: r.criticalAngleDeg === null ? '光疏 → 光密不会全反射' : 'arcsin(n₂/n₁)',
    },
    {
      label: '全反射判断',
      labelEn: 'TIR',
      value: r.isTIR ? '发生' : '未发生',
      tone: r.isTIR ? 'err' : 'ok',
      note: r.criticalAngleDeg === null ? '当前方向无临界角' : `θ₁ ${r.isTIR ? '>' : '≤'} θc`,
    },
    {
      label: '布儒斯特角',
      labelEn: 'θB',
      value: fmt(r.brewsterAngleDeg, 2),
      unit: '°',
      note: '该角度 p 偏振反射率为 0',
    },
    {
      label: '反射率（自然光）',
      labelEn: 'R',
      value: fmtPercent(r.fresnel.R, 2),
      tone: r.isTIR ? 'err' : 'warn',
      note: 'R = (Rs + Rp)/2',
    },
    {
      label: '透射率',
      labelEn: 'T = 1 − R',
      value: fmtPercent(r.fresnel.T, 2),
      tone: r.isTIR ? 'err' : 'ok',
      note: '无吸收介质能量守恒',
    },
    {
      label: 'R_s / R_p',
      labelEn: 'Polarization',
      value: `${(r.fresnel.Rs * 100).toFixed(2)} / ${(r.fresnel.Rp * 100).toFixed(2)}`,
      unit: '%',
      tone: 'muted',
      note: 's / p 偏振分量',
    },
    {
      label: '介质 1 中光速',
      labelEn: 'v₁ = c/n₁',
      value: fmt(r.speed1 / 1e8, 4),
      unit: '×10⁸ m/s',
      tone: 'muted',
    },
    {
      label: '介质 2 中光速',
      labelEn: 'v₂ = c/n₂',
      value: fmt(r.speed2 / 1e8, 4),
      unit: '×10⁸ m/s',
      tone: 'muted',
    },
    {
      label: '介质中波长 λ₂',
      labelEn: 'λ₀/n₂',
      value: fmt(r.wavelength2Nm, 2),
      unit: 'nm',
      tone: 'muted',
      note: `λ₀ = ${fmt(r.wavelengthNm, 0)} nm`,
    },
  ]
  return items
})

const REFRACTION_LEGEND = [
  { label: '入射光线 Incident', colorVar: 'ray-incident', dashed: false },
  { label: '反射光线 Reflected', colorVar: 'ray-reflected', dashed: false },
  { label: '折射光线 Refracted', colorVar: 'ray-refracted', dashed: false },
  { label: '临界角方向 θc', colorVar: 'ray-blocked', dashed: true },
] as const

const recorder = useRecorder({
  moduleId: 'refraction',
  moduleName: MODULE_NAME,
  params: () => params,
  stats: () => stats.value,
  anomalies: () => [...result.value.errors, ...result.value.warnings],
  modelNotes: ['理想平面界面 + 恒定折射率：未计入色散、吸收、镀膜与表面散射。'],
})

function recordExperiment(): void {
  const rec = recorder.capture()
  pushLog('ok', MODULE_NAME, `已记录实验 ${rec.id}（可在「测试报告」模块查看与导出）`, { manual: true })
}

useExperimentLog(MODULE_NAME, () => {
  const r = result.value
  if (!r.ok) return null
  const tir = r.isTIR ? '全反射' : `θ₂=${fmt(r.theta2Deg ?? 0, 2)}°`
  return `n₁=${fmt(r.n1, 4)} → n₂=${fmt(r.n2, 4)}，θ₁=${fmt(r.theta1Deg, 1)}° → ${tir}，R=${fmtPercent(r.fresnel.R, 2)}`
})

onMounted(() => {
  pushLog(
    'info',
    MODULE_NAME,
    '模块加载完成：斯涅尔定律 n₁sinθ₁ = n₂sinθ₂ + 菲涅尔反射率，全部由本地实时计算',
  )
})
</script>

<template>
  <ExperimentWorkspace initial-tab="results" :initial-dock-height="256">
    <template #stage>
      <CanvasStage :draw="drawScene">
        <div class="stage__overlay">
          <div class="stage__row">
            <div class="stage__toolbar">
              <button
                class="chip"
                :class="{ 'chip--on': view.showAuxiliary }"
                @click="view.showAuxiliary = !view.showAuxiliary"
              >
                法线 / 辅助线
              </button>
              <button
                class="chip"
                :class="{ 'chip--on': view.showCriticalAngle }"
                @click="view.showCriticalAngle = !view.showCriticalAngle"
              >
                临界角
              </button>
              <button class="btn btn--sm btn--ghost" title="恢复默认参数" @click="resetParams">重置</button>
              <button class="btn btn--sm" title="把当前参数与结果存入测试报告" @click="recordExperiment">
                记录实验
              </button>
              <button
                class="btn btn--sm btn--primary"
                title="水 → 空气，60° 入射触发全反射"
                @click="loadTirDemo"
              >
                全反射演示
              </button>
            </div>
            <div class="stage__badges">
              <span class="badge badge--accent">理想平面界面 · 恒定折射率</span>
              <span class="badge badge--muted">Snell + Fresnel · Simulated</span>
            </div>
          </div>

          <div class="stage__row" style="align-items: flex-end">
            <div class="stage__legend legend">
              <span
                v-for="item in REFRACTION_LEGEND"
                :key="item.label"
                class="legend__item"
                :style="{ color: `var(--${item.colorVar})` }"
              >
                <span class="legend__swatch" :class="{ 'legend__swatch--dashed': item.dashed }" />
                <span style="color: var(--text-2)">{{ item.label }}</span>
              </span>
            </div>
            <span class="badge badge--muted">线宽 ∝ 光强占比 · 角度相对法线</span>
          </div>
        </div>
      </CanvasStage>
    </template>

    <template #params>
      <ParamPanel
        title="实验参数"
        subtitle="Parameters"
        :sections="REFRACTION_SCHEMA"
        :model="params"
        @update="updateParam"
        @invalid="(msg: string) => pushLog('warn', MODULE_NAME, msg)"
      >
        <template #actions>
          <button class="btn btn--sm" title="恢复默认参数" @click="resetParams">重置</button>
        </template>
        <template #footer>
          <div class="section-title">介质预设 <span class="muted xs">· Media presets</span></div>
          <div class="field">
            <div class="field__top">
              <label class="field__label">
                入射侧介质
                <span class="field__label-en">Medium 1 (n₁)</span>
              </label>
            </div>
            <select v-model="medium1Id" class="select">
              <option v-for="m in MEDIA_PRESETS" :key="m.id" :value="m.id">
                {{ m.label }} · n = {{ m.n }}
              </option>
              <option value="custom" disabled>自定义（手动输入）</option>
            </select>
            <p class="field__hint">
              {{ MEDIA_PRESETS.find((m) => m.id === medium1Id)?.note ?? '当前为手动输入的折射率' }}
            </p>
          </div>
          <div class="field">
            <div class="field__top">
              <label class="field__label">
                折射侧介质
                <span class="field__label-en">Medium 2 (n₂)</span>
              </label>
            </div>
            <select v-model="medium2Id" class="select">
              <option v-for="m in MEDIA_PRESETS" :key="m.id" :value="m.id">
                {{ m.label }} · n = {{ m.n }}
              </option>
              <option value="custom" disabled>自定义（手动输入）</option>
            </select>
            <p class="field__hint">
              {{ MEDIA_PRESETS.find((m) => m.id === medium2Id)?.note ?? '当前为手动输入的折射率' }}
            </p>
          </div>
          <div class="model-note">
            折射率为<strong>标称常数</strong>（一般对应 587.6 nm 钠黄光），未计入色散与吸收；
            界面按理想平面处理，不含镀膜与表面散射。
          </div>
        </template>
      </ParamPanel>
    </template>

    <template #results>
      <div v-if="!result.ok" class="callout callout--err">
        <span class="callout__icon">!</span>
        <div>{{ result.errors.join('；') }}</div>
      </div>
      <div v-for="w in result.warnings" :key="w" class="callout callout--warn">
        <span class="callout__icon">△</span>
        <div>{{ w }}</div>
      </div>
      <div
        v-if="result.ok && !result.isTIR && result.criticalAngleDeg !== null"
        class="callout callout--info"
      >
        <span class="callout__icon">i</span>
        <div>
          当前 θ₁ = {{ fmt(result.theta1Deg, 1) }}° 小于临界角
          {{ fmtDeg(result.criticalAngleDeg, 2) }}，仍有折射光；继续增大入射角直到超过临界角即可观察到全反射。
        </div>
      </div>

      <StatGrid :items="stats" />

      <div class="section-title">计算过程 <span class="muted xs">· Worked example</span></div>
      <code class="formula">
        n₁ = {{ fmt(params.n1, 4) }}（{{ medium1Name }}）→ n₂ = {{ fmt(params.n2, 4) }}（{{
          medium2Name
        }}），θ₁ = {{ fmt(result.theta1Deg, 1) }}°
      </code>
      <code class="formula formula--calc">
        sinθ₂ = (n₁/n₂)·sinθ₁ = ({{ fmt(result.n1, 4) }}/{{ fmt(result.n2, 4) }}) × sin({{
          fmt(result.theta1Deg, 1)
        }}°) = {{ fmt(result.sinTheta2, 6) }}
      </code>
      <code v-if="!result.isTIR" class="formula formula--calc">
        θ₂ = arcsin({{ fmt(result.sinTheta2, 6) }}) = {{ fmtDeg(result.theta2Deg, 3) }} ；反射角 θ₁′ = θ₁ =
        {{ fmt(result.thetaReflectDeg, 1) }}°
      </code>
      <code v-else class="formula formula--calc">
        sinθ₂ = {{ fmt(result.sinTheta2, 6) }} &gt; 1 ⇒ 无实数解 ⇒ 全反射（θ₁ &gt; θc =
        {{ fmtDeg(result.criticalAngleDeg, 2) }}）
      </code>
      <code v-if="result.criticalAngleDeg !== null" class="formula formula--calc">
        θc = arcsin(n₂/n₁) = arcsin({{ fmt(result.n2 / result.n1, 6) }}) =
        {{ fmtDeg(result.criticalAngleDeg, 3) }}
      </code>
      <code class="formula formula--calc">
        R = (Rs + Rp)/2 = ({{ (result.fresnel.Rs * 100).toFixed(3) }}% + ({{
          (result.fresnel.Rp * 100).toFixed(3)
        }}%)/2 = {{ fmtPercent(result.fresnel.R, 3) }} ；T = 1 − R = {{ fmtPercent(result.fresnel.T, 3) }}
      </code>

      <TheoryPanel />
    </template>

    <template #charts>
      <div class="chart-row">
        <div class="chart-box">
          <div class="chart-box__head">
            <span class="chart-box__title">折射角 – 入射角</span>
            <span>Snell 曲线，虚线为 θ₁ = θ₂ 参考</span>
          </div>
          <ChartPanel :option="charts.angle" :height="180" />
        </div>
        <div class="chart-box">
          <div class="chart-box__head">
            <span class="chart-box__title">反射率 / 透射率 – 入射角</span>
            <span>菲涅尔公式，θB 处 R_p = 0</span>
          </div>
          <ChartPanel :option="charts.reflectance" :height="180" />
        </div>
      </div>
      <p class="xs muted" style="padding: 0 2px">
        曲线在 0°–89.5° 内按 180 点逐点计算；进入全反射区后折射角无定义，曲线断开而非插值。
      </p>
    </template>
  </ExperimentWorkspace>
</template>

<style scoped>
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

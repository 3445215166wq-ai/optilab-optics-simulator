<script setup lang="ts">
/**
 * 模块六：工业视觉成像质量测试
 *
 * 支持内置合成靶标与用户上传图片；退化项全部按物理顺序链路作用。
 * 指标（亮度/对比度/清晰度/PSNR/SSIM）与批量扫描曲线均由本地实算。
 * ONNX 检测接口为预留状态，界面不产生任何检测结果。
 */
import { computed, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import ExperimentWorkspace from '@/components/layout/ExperimentWorkspace.vue'
import CanvasStage from '@/components/ui/CanvasStage.vue'
import ChartPanel from '@/components/ui/ChartPanel.vue'
import FoldSection from '@/components/ui/FoldSection.vue'
import ParamPanel from '@/components/ui/ParamPanel.vue'
import StatGrid from '@/components/ui/StatGrid.vue'
import TheoryPanel from './TheoryPanel.vue'
import { buildHistogramChart, buildSweepChart, type SweepPoint } from './charts'
import {
  QUALITY_DEFAULTS,
  QUALITY_PRESETS,
  QUALITY_SCHEMA,
  QUALITY_WORK_SIZE,
  SWEEP_OPTIONS,
  type QualityParams,
  type QualityPreset,
  type SweepKey,
} from './params'
import { degradeImage } from '@/core/imaging/degradation'
import { laplacianVariance, tenengrad, brennerGradient } from '@/core/imaging/focusMetrics'
import { computeQuality } from '@/core/imaging/quality'
import { rgbaToGray, resizeNearest, type GrayImage } from '@/core/imaging/image'
import { TARGETS, buildTarget, targetContrastNote } from '@/core/imaging/targets'
import { createDetectorAdapter, detectorStatusLine } from '@/core/imaging/onnx'
import { fmt } from '@/core/format'
import { clearStage, drawChip, drawEmptyState } from '@/render/draw'
import { drawGrayImage, fitRect } from '@/render/imageView'
import type { ParamValue } from '@/components/ui/params'
import type { StatItem } from '@/components/ui/statTypes'
import { pushLog, useExperimentLog } from '@/stores/log'
import { useTheme } from '@/stores/theme'

const MODULE_NAME = '成像质量'

type Tone = 'ok' | 'accent' | 'warn' | 'err' | 'muted'

interface HeroItem {
  label: string
  labelEn: string
  value: string
  unit?: string
  tone: Tone
  note: string
}

const params = reactive<QualityParams>({ ...QUALITY_DEFAULTS })
const { palette } = useTheme()

/** 用户上传的图像（已转为灰度并统一到工作分辨率） */
const uploaded = shallowRef<GrayImage | null>(null)
const uploadName = ref('')
const sweepKey = ref<SweepKey>('defocusSigma')
const sweepPoints = shallowRef<SweepPoint[]>([])
const sweepRunning = ref(false)

const detector = createDetectorAdapter()
const detectorLine = detectorStatusLine(detector)

/** 基准图（未退化） */
const original = computed<GrayImage | null>(() => {
  if (params.source === 'upload') return uploaded.value
  return buildTarget(params.source, QUALITY_WORK_SIZE)
})

/** 退化结果 */
const degradedResult = computed(() => {
  const src = original.value
  if (!src) return null
  return degradeImage(src, {
    defocusSigma: params.defocusSigma,
    motionLength: params.motionLength,
    motionAngleDeg: params.motionAngleDeg,
    illuminationFalloff: params.illuminationFalloff,
    contrast: params.contrast,
    exposureGain: params.exposureGain,
    exposureOffset: params.exposureOffset,
    noiseSigma: params.noiseSigma,
    seed: params.seed,
  })
})

const metrics = computed(() => {
  const src = original.value
  const deg = degradedResult.value?.image
  if (!src || !deg) return null
  const q = computeQuality(src, deg)
  return {
    ...q,
    laplacian: laplacianVariance(deg),
    tenengrad: tenengrad(deg),
    brenner: brennerGradient(deg),
    laplacianRef: laplacianVariance(src),
  }
})

function drawScene(ctx: CanvasRenderingContext2D, size: { w: number; h: number }): void {
  clearStage(ctx, size, palette.value)
  const pal = palette.value
  const src = original.value
  const deg = degradedResult.value?.image ?? null
  if (!src || !deg) {
    drawEmptyState(ctx, size, pal, '未选择图像来源', '请选择内置合成靶标或上传一张图片')
    return
  }

  const gap = 16
  const halfW = (size.w - 24 - gap) / 2
  const area = { x: 12, y: 34, w: halfW, h: size.h - 46 }
  const rectA = fitRect(area, src.width, src.height)
  const rectB = fitRect({ ...area, x: area.x + halfW + gap }, deg.width, deg.height)

  drawGrayImage(ctx, src, rectA, pal, { border: true, label: '原始 Original', labelColor: pal.textPrimary })
  drawGrayImage(ctx, deg, rectB, pal, {
    border: true,
    label: '退化后 Degraded',
    labelColor: pal.accent,
  })

  const applied = degradedResult.value?.applied ?? []
  drawChip(
    ctx,
    applied.length ? `已生效：${applied.join(' + ')}` : '无退化（基线）',
    size.w / 2,
    8,
    pal,
    { align: 'center', baseline: 'top', color: applied.length ? pal.accent : pal.textMuted, size: 9.5 },
  )
}

// ---------- 上传 ----------
function onUpload(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(img, 0, 0)
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const gray = rgbaToGray(data.data, canvas.width, canvas.height)
      // 统一到工作分辨率（长边 = 工作尺寸），保持宽高比
      const scale = QUALITY_WORK_SIZE / Math.max(gray.width, gray.height)
      const w = Math.max(32, Math.round(gray.width * scale))
      const h = Math.max(32, Math.round(gray.height * scale))
      uploaded.value = resizeNearest(gray, w, h)
      uploadName.value = file.name
      params.source = 'upload'
      pushLog('info', MODULE_NAME, `已加载上传图片「${file.name}」（${img.width}×${img.height} → 工作尺寸 ${w}×${h}）`)
      sweepPoints.value = []
    }
    img.onerror = () => pushLog('warn', MODULE_NAME, `图片加载失败：${file.name}`)
    img.src = String(reader.result)
  }
  reader.onerror = () => pushLog('warn', MODULE_NAME, '文件读取失败')
  reader.readAsDataURL(file)
  input.value = ''
}

// ---------- 批量扫描 ----------
async function runSweep(): Promise<void> {
  const src = original.value
  if (!src) return
  const option = SWEEP_OPTIONS.find((o) => o.key === sweepKey.value)
  if (!option) return
  sweepRunning.value = true
  await new Promise((r) => setTimeout(r, 16))
  try {
    const points: SweepPoint[] = []
    for (let i = 0; i < option.steps; i += 1) {
      const x = option.min + ((option.max - option.min) * i) / (option.steps - 1)
      const local = { ...params, [option.key]: x } as QualityParams
      const { image } = degradeImage(src, local)
      const q = computeQuality(src, image)
      points.push({
        x,
        sharpness: laplacianVariance(image),
        ssim: q.ssim,
        psnrDb: q.psnrDb,
        brightness: q.brightness,
        contrast: q.contrast,
      })
    }
    sweepPoints.value = points
    pushLog(
      'ok',
      MODULE_NAME,
      `批量扫描完成：${option.label} 从 ${option.min} 到 ${option.max}（${option.steps} 点），逐点计算清晰度/SSIM/PSNR`,
    )
  } finally {
    sweepRunning.value = false
  }
}

watch(sweepKey, () => {
  sweepPoints.value = []
})

function updateParam(key: string, value: ParamValue): void {
  ;(params as unknown as Record<string, ParamValue>)[key] = value
}

function applyPreset(preset: QualityPreset): void {
  Object.assign(params, preset.patch)
  pushLog('info', MODULE_NAME, `应用预设「${preset.label}」：${preset.hint}`)
}

function resetParams(): void {
  Object.assign(params, QUALITY_DEFAULTS)
  sweepPoints.value = []
  pushLog('info', MODULE_NAME, '参数已重置为默认值')
}

const charts = computed(() => {
  const option = SWEEP_OPTIONS.find((o) => o.key === sweepKey.value) ?? SWEEP_OPTIONS[0]
  return {
    sweep: buildSweepChart(option, sweepPoints.value, palette.value),
    histogram: buildHistogramChart(original.value, degradedResult.value?.image ?? null, palette.value),
  }
})

const heroStats = computed<HeroItem[]>(() => {
  const m = metrics.value
  if (!m) return []
  const psnrInfinite = !Number.isFinite(m.psnrDb)
  return [
    {
      label: 'SSIM 结构相似度',
      labelEn: 'SSIM',
      value: fmt(m.ssim, 4),
      tone: m.ssim > 0.9 ? 'ok' : m.ssim > 0.7 ? 'accent' : m.ssim > 0.4 ? 'warn' : 'err',
      note: '1 = 与原始完全相同；> 0.9 视觉上通常仍很接近',
    },
    {
      label: 'PSNR 峰值信噪比',
      labelEn: 'PSNR',
      value: psnrInfinite ? '+∞' : fmt(m.psnrDb, 2),
      unit: psnrInfinite ? '' : 'dB',
      tone: psnrInfinite ? 'ok' : m.psnrDb > 30 ? 'ok' : m.psnrDb > 20 ? 'accent' : 'warn',
      note: '逐像素误差；对整体亮度偏移敏感、对模糊不敏感',
    },
    {
      label: '平均亮度',
      labelEn: 'Mean',
      value: fmt(m.brightness, 3),
      tone: m.brightness < 0.2 || m.brightness > 0.85 ? 'warn' : 'muted',
      note:
        m.brightness < 0.2
          ? '偏暗：欠曝会压低信噪比'
          : m.brightness > 0.85
            ? '偏亮：存在高光截断风险'
            : '曝光落在可用区间',
    },
    {
      label: 'RMS 对比度',
      labelEn: 'Contrast',
      value: fmt(m.contrast, 3),
      tone: 'muted',
      note: '像素标准差；太小意味着细节平淡难检',
    },
  ]
})

const sharpnessStats = computed<StatItem[]>(() => {
  const m = metrics.value
  if (!m) return []
  const ratio = m.laplacianRef > 0 ? m.laplacian / m.laplacianRef : Number.NaN
  return [
    {
      label: '拉普拉斯方差',
      labelEn: 'Laplacian Var',
      value: fmt(m.laplacian, 5),
      tone: 'muted',
      note: `原始 ${fmt(m.laplacianRef, 5)}（保留 ${fmt(ratio * 100, 1)}%）`,
    },
    { label: 'Tenengrad', labelEn: 'Tenengrad', value: fmt(m.tenengrad, 5), tone: 'muted' },
    { label: 'Brenner 梯度', labelEn: 'Brenner', value: fmt(m.brenner, 5), tone: 'muted' },
    {
      label: '已生效退化项',
      labelEn: 'Applied',
      value: `${degradedResult.value?.applied.length ?? 0}`,
      unit: '项',
      tone: 'accent',
      note: (degradedResult.value?.applied ?? []).join('、') || '无（基线）',
    },
  ]
})

useExperimentLog(MODULE_NAME, () => {
  const m = metrics.value
  if (!m) return null
  return `SSIM=${fmt(m.ssim, 4)}，PSNR=${Number.isFinite(m.psnrDb) ? fmt(m.psnrDb, 2) + 'dB' : '+∞'}，亮度=${fmt(m.brightness, 3)}，对比度=${fmt(m.contrast, 3)}，拉普拉斯方差=${fmt(m.laplacian, 5)}`
})

onMounted(() => {
  pushLog(
    'info',
    MODULE_NAME,
    '模块加载完成：退化链路（照度→对比度→模糊→曝光→噪声）与 SSIM/PSNR 全部本地实算；缺陷检测模型未接入，不输出任何检测结果',
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
              <input
                id="quality-upload"
                type="file"
                accept="image/*"
                class="sr-only"
                @change="onUpload"
              />
              <label class="btn btn--sm" for="quality-upload">上传图片</label>
              <button
                class="btn btn--sm btn--ghost"
                :disabled="!uploaded"
                :title="uploaded ? '切回内置合成靶标' : '尚未上传图片'"
                @click="params.source = 'pcb'"
              >
                用内置靶标
              </button>
              <button class="btn btn--sm btn--ghost" @click="resetParams">重置</button>
            </div>
            <div class="stage__badges">
              <span class="badge badge--warn">仿真设备 SIMULATED</span>
              <span class="badge badge--muted">来源：{{ params.source === 'upload' ? uploadName || '上传图片' : '合成靶标' }}</span>
            </div>
          </div>
          <div class="stage__row" style="align-items: flex-end">
            <span class="badge badge--muted">{{ params.source === 'upload' ? '用户上传图片' : targetContrastNote(params.source) }}</span>
            <span class="badge badge--muted">离焦 = 高斯近似（退化模型）</span>
          </div>
        </div>
      </CanvasStage>
    </template>

    <template #params>
      <ParamPanel
        title="退化参数"
        subtitle="Degradation"
        :sections="QUALITY_SCHEMA"
        :model="params"
        @update="updateParam"
        @invalid="(msg: string) => pushLog('warn', MODULE_NAME, msg)"
      >
        <template #actions>
          <button class="btn btn--sm" @click="resetParams">重置</button>
        </template>
        <template #footer>
          <div class="section-title">图像来源 <span class="muted xs">· Source</span></div>
          <div class="seg" role="group">
            <button
              v-for="t in TARGETS"
              :key="t.id"
              class="seg__item"
              :class="{ 'seg__item--on': params.source === t.id }"
              :title="t.note"
              @click="params.source = t.id"
            >
              {{ t.label }}
            </button>
            <button
              class="seg__item"
              :class="{ 'seg__item--on': params.source === 'upload' }"
              :disabled="!uploaded"
              :title="uploaded ? `已上传：${uploadName}` : '请先点击舞台左上角「上传图片」'"
              @click="params.source = 'upload'"
            >
              上传
            </button>
          </div>

          <div class="section-title">批量扫描 <span class="muted xs">· Sweep</span></div>
          <div class="field">
            <div class="field__top">
              <label class="field__label">
                扫描变量
                <span class="field__label-en">Sweep parameter</span>
              </label>
            </div>
            <select v-model="sweepKey" class="select">
              <option v-for="o in SWEEP_OPTIONS" :key="o.key" :value="o.key">{{ o.label }}</option>
            </select>
            <p class="field__hint">固定其余参数、只扫这一个变量，观察指标曲线的拐点</p>
          </div>
          <button class="btn btn--block btn--primary" :disabled="sweepRunning" @click="runSweep">
            {{ sweepRunning ? '扫描中…' : '执行批量扫描（13 点）' }}
          </button>

          <div class="section-title">预设工况 <span class="muted xs">· Presets</span></div>
          <div class="preset-list">
            <button
              v-for="preset in QUALITY_PRESETS"
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
            离焦为<strong>高斯模糊近似</strong>（图像退化近似模型），非严格物理光学。
            缺陷检测模型<strong>未接入</strong>，本页不产生任何检测准确率/漏检率。
          </div>
        </template>
      </ParamPanel>
    </template>

    <template #results>
      <div class="pane-stack">
        <div class="callout callout--info">
          <span class="callout__icon">i</span>
          <div>
            退化链路按物理顺序作用：照度不均 → 对比度 → 光学模糊（离焦高斯近似 / 运动线段 PSF）→ 曝光 →
            传感器噪声。指标由原始图与退化图实际比对计算。
          </div>
        </div>

        <section class="group">
          <div class="group-head">
            <span class="group-head__title">质量指标</span>
            <span class="group-head__en">Quality metrics</span>
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

        <FoldSection title="清晰度指标与退化明细" title-en="Sharpness & applied">
          <StatGrid :items="sharpnessStats" />
          <p class="group-note">
            清晰度指标的绝对数值依赖图像内容与尺寸，只能在同一图像的不同退化之间比较；
            括号内的百分比表示相对原始图保留了多少高频能量。
          </p>
        </FoldSection>

        <FoldSection title="缺陷检测接口（未接入）" title-en="Detection interface">
          <div class="callout callout--warn">
            <span class="callout__icon">△</span>
            <div>{{ detectorLine }}</div>
          </div>
          <p class="group-note">
            接口契约已定义在 <code>src/core/imaging/onnx.ts</code>（DetectorAdapter）。
            接入真实模型后才可能统计「成像质量 → 缺陷检出率」；当前不显示任何检测框、类别、置信度或准确率。
          </p>
        </FoldSection>

        <FoldSection title="计算过程与公式" title-en="Worked example">
          <code class="formula">MSE = mean[(I_ref − I_test)²] ；PSNR = 10·log₁₀(1/MSE)</code>
          <code class="formula formula--calc">
            本次：SSIM = {{ metrics ? fmt(metrics.ssim, 4) : '—' }}，PSNR =
            {{ metrics ? (Number.isFinite(metrics.psnrDb) ? fmt(metrics.psnrDb, 2) + ' dB' : '+∞') : '—' }}，
            亮度 = {{ metrics ? fmt(metrics.brightness, 4) : '—' }}，对比度 =
            {{ metrics ? fmt(metrics.contrast, 4) : '—' }}
          </code>
          <code class="formula formula--calc">
            清晰度（拉普拉斯方差）：退化后 {{ metrics ? fmt(metrics.laplacian, 5) : '—' }} / 原始
            {{ metrics ? fmt(metrics.laplacianRef, 5) : '—' }}
          </code>
          <p class="group-note">
            <strong>单位：</strong>亮度与对比度归一化到 0–1（8bit 时乘以 255 即为灰度级）；PSNR 用 dB；
            SSIM 无量纲（1 = 完全相同）。
          </p>
        </FoldSection>

        <TheoryPanel />
      </div>
    </template>

    <template #charts>
      <div class="chart-row">
        <div class="chart-box">
          <div class="chart-box__head">
            <span class="chart-box__title">批量扫描曲线</span>
            <span>SSIM / 归一化清晰度 / PSNR</span>
          </div>
          <ChartPanel :option="charts.sweep" :height="190" />
        </div>
        <div class="chart-box">
          <div class="chart-box__head">
            <span class="chart-box__title">灰度直方图对比</span>
            <span>原始 vs 退化后</span>
          </div>
          <ChartPanel :option="charts.histogram" :height="190" />
        </div>
      </div>
      <p class="xs muted" style="padding: 0 2px">
        {{ sweepPoints.length ? `扫描已完成 ${sweepPoints.length} 点` : '尚未执行批量扫描：点击右侧「执行批量扫描」' }}；
        直方图实时随退化参数更新。
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

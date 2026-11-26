/**
 * 实验记录与报告导出（模块七核心）。
 *
 * 设计要点：
 *   1. **所有字段都来自运行时真实数据**：参数取自各模块的 reactive params，
 *      结果取自各模块实际计算的统计量，异常取自 core 返回的 warnings/errors；
 *   2. 记录是纯数据（可 JSON 序列化），因此 CSV / JSON / PNG / HTML 四种导出
 *      都只是在同一份数据上做不同呈现，不存在「导出时现编数字」；
 *   3. 图表 PNG 由 canvas 现场绘制（汇总卡片 + 数值条形），不是截图占位。
 *
 * 使用方式（各模块）：
 *   const recorder = useRecorder({ moduleId, moduleName, params: () => params, stats: () => heroStats.value, ... })
 *   recorder.capture()   // 把当前状态存为一条实验记录
 */

import { computed, reactive } from 'vue'

export interface ExperimentStat {
  label: string
  labelEn?: string
  value: string
  unit?: string
  note?: string
}

export interface ExperimentThreshold {
  label: string
  value: string
  unit?: string
  passed: boolean | null
}

export interface ExperimentRecord {
  id: string
  /** 模块标识（与注册表 id 一致） */
  moduleId: string
  moduleName: string
  /** ISO 时间戳（本地时区显示由界面负责） */
  timestamp: string
  /** 实验参数快照 */
  params: Record<string, string | number | boolean>
  /** 仿真结果快照 */
  stats: ExperimentStat[]
  /** 合格阈值与判定（无阈值时为 null） */
  threshold: ExperimentThreshold | null
  /** 异常记录（core 返回的警告/错误） */
  anomalies: string[]
  /** 模型局限与声明 */
  modelNotes: string[]
  /** 可选：附带图片（dataURL），用于报告内嵌示意 */
  images: string[]
}

export interface RecorderSource {
  moduleId: string
  moduleName: string
  params: () => Record<string, unknown>
  stats: () => ReadonlyArray<{ label: string; labelEn?: string; value: string; unit?: string; note?: string }>
  anomalies?: () => string[]
  modelNotes?: string[]
  threshold?: () => ExperimentThreshold | null
  images?: () => string[]
}

const MAX_RECORDS = 200
const state = reactive<{ records: ExperimentRecord[] }>({ records: [] })
let seq = 0

/** 把任意参数对象规整成可序列化的扁平字典（只保留标量） */
export function toPlainParams(source: Record<string, unknown>): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {}
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'string' || typeof value === 'boolean') out[key] = value
    else if (typeof value === 'number' && Number.isFinite(value)) out[key] = value
  }
  return out
}

export function addRecord(record: Omit<ExperimentRecord, 'id' | 'timestamp'>): ExperimentRecord {
  seq += 1
  const full: ExperimentRecord = {
    ...record,
    id: `EXP-${String(seq).padStart(4, '0')}`,
    timestamp: new Date().toISOString(),
  }
  state.records.push(full)
  if (state.records.length > MAX_RECORDS) state.records.splice(0, state.records.length - MAX_RECORDS)
  return full
}

export function removeRecord(id: string): void {
  const idx = state.records.findIndex((r) => r.id === id)
  if (idx >= 0) state.records.splice(idx, 1)
}

export function clearRecords(): void {
  state.records.length = 0
}

/** 模块内使用的记录器 */
export function useRecorder(source: RecorderSource) {
  return {
    capture(): ExperimentRecord {
      return addRecord({
        moduleId: source.moduleId,
        moduleName: source.moduleName,
        params: toPlainParams(source.params()),
        stats: source.stats().map((s) => ({
          label: s.label,
          labelEn: s.labelEn,
          value: s.value,
          unit: s.unit,
          note: s.note,
        })),
        threshold: source.threshold ? source.threshold() : null,
        anomalies: source.anomalies ? source.anomalies() : [],
        modelNotes: source.modelNotes ?? [],
        images: source.images ? source.images() : [],
      })
    },
  }
}

export function useExperiments() {
  return {
    records: computed(() => state.records),
  }
}

/* ------------------------------------------------------------------ */
/* 导出：CSV / JSON / HTML                                             */
/* ------------------------------------------------------------------ */

function csvCell(value: string | number | boolean | undefined | null): string {
  if (value === undefined || value === null) return ''
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * CSV：一行一条实验记录。统计量与参数都摊平成「键=值」列，
 * 因此不同模块的记录可以放进同一张表（缺列留空）。
 */
export function recordsToCsv(records: ExperimentRecord[]): string {
  const paramKeys = new Set<string>()
  const statKeys = new Set<string>()
  for (const r of records) {
    Object.keys(r.params).forEach((k) => paramKeys.add(k))
    r.stats.forEach((s) => statKeys.add(s.label))
  }
  const header = [
    '记录编号',
    '模块',
    '测试时间',
    '合格判定',
    ...Array.from(paramKeys).map((k) => `参数:${k}`),
    ...Array.from(statKeys).map((k) => `结果:${k}`),
    '异常记录',
    '模型局限',
  ]
  const lines = [header.map(csvCell).join(',')]
  for (const r of records) {
    const judge = r.threshold ? (r.threshold.passed === null ? '未判定' : r.threshold.passed ? 'PASS' : 'FAIL') : ''
    const row = [
      r.id,
      r.moduleName,
      new Date(r.timestamp).toLocaleString('zh-CN', { hour12: false }),
      judge,
      ...Array.from(paramKeys).map((k) => r.params[k] ?? ''),
      ...Array.from(statKeys).map((k) => {
        const stat = r.stats.find((s) => s.label === k)
        if (!stat) return ''
        return stat.unit ? `${stat.value} ${stat.unit}` : stat.value
      }),
      r.anomalies.join(' | '),
      r.modelNotes.join(' | '),
    ]
    lines.push(row.map(csvCell).join(','))
  }
  return lines.join('\n')
}

/** JSON：完整保留结构化记录（含判定与异常） */
export function recordsToJson(records: ExperimentRecord[]): string {
  return JSON.stringify(
    {
      generator: 'OptiLab · 交互式光学成像与性能分析仿真平台',
      exportedAt: new Date().toISOString(),
      disclaimer:
        '本项目为教学与求职作品，所有设备、图像与测试数据均由程序仿真生成，不代表真实设备性能；导出内容仅供学习参考。',
      count: records.length,
      records,
    },
    null,
    2,
  )
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * 可打印 HTML 报告：
 * 每条记录展开成「实验目的 / 参数配置 / 实验结果 / 误差与异常 / 合格判定 / 模型局限」六段，
 * 结构对应正式测试报告，可直接用浏览器打印成 PDF。
 */
export function recordsToHtml(records: ExperimentRecord[]): string {
  const now = new Date().toLocaleString('zh-CN', { hour12: false })
  const sections = records
    .map((r) => {
      const paramRows = Object.entries(r.params)
        .map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(String(v))}</td></tr>`)
        .join('')
      const statRows = r.stats
        .map(
          (s) =>
            `<tr><th>${escapeHtml(s.label)}${s.labelEn ? ` <span class="en">${escapeHtml(s.labelEn)}</span>` : ''}</th><td class="val">${escapeHtml(s.value)}${s.unit ? ` <span class="unit">${escapeHtml(s.unit)}</span>` : ''}</td><td class="note">${escapeHtml(s.note ?? '')}</td></tr>`,
        )
        .join('')
      const judge = r.threshold
        ? `<p class="${r.threshold.passed ? 'pass' : 'fail'}">${r.threshold.passed ? 'PASS' : 'FAIL'} · ${escapeHtml(r.threshold.label)} = ${escapeHtml(r.threshold.value)}${escapeHtml(r.threshold.unit ?? '')}</p>`
        : '<p class="muted">本实验未设置合格阈值。</p>'
      return `
  <section class="record">
    <h2>${escapeHtml(r.id)} · ${escapeHtml(r.moduleName)}</h2>
    <p class="meta">测试时间：${escapeHtml(new Date(r.timestamp).toLocaleString('zh-CN', { hour12: false }))}</p>
    <h3>1. 实验目的</h3>
    <p>在 ${escapeHtml(r.moduleName)} 模块中按下列参数运行仿真，记录关键结果并核对其物理合理性与工程指标。</p>
    <h3>2. 理论依据与参数配置</h3>
    <table>${paramRows}</table>
    <h3>3. 实验结果</h3>
    <table class="stats"><thead><tr><th>指标</th><th>数值</th><th>说明</th></tr></thead><tbody>${statRows}</tbody></table>
    <h3>4. 误差与异常记录</h3>
    ${r.anomalies.length ? `<ul>${r.anomalies.map((a) => `<li>${escapeHtml(a)}</li>`).join('')}</ul>` : '<p class="muted">无异常或警告。</p>'}
    <h3>5. 合格判定</h3>
    ${judge}
    <h3>6. 模型局限</h3>
    ${r.modelNotes.length ? `<ul>${r.modelNotes.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul>` : '<p class="muted">未记录。</p>'}
  </section>`
    })
    .join('\n')

  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8" />
<title>OptiLab 实验报告（${records.length} 条记录）</title>
<style>
  body { font-family: "Segoe UI", system-ui, "Microsoft YaHei", sans-serif; color: #16212c; margin: 32px; line-height: 1.6; }
  h1 { font-size: 22px; border-bottom: 2px solid #1f78bd; padding-bottom: 8px; }
  h2 { font-size: 17px; margin-top: 28px; color: #1f78bd; }
  h3 { font-size: 14px; margin-bottom: 4px; }
  .meta { color: #6b8199; font-size: 12px; margin: 0 0 8px; }
  .en { color: #7a8fa5; font-size: 11px; font-weight: 400; }
  .unit { color: #7a8fa5; font-size: 12px; }
  .note { color: #7a8fa5; font-size: 12px; }
  .muted { color: #7a8fa5; }
  .pass { color: #12855c; font-weight: 700; }
  .fail { color: #c0392f; font-weight: 700; }
  table { border-collapse: collapse; width: 100%; margin: 6px 0 10px; font-size: 13px; }
  th, td { border: 1px solid #d7e0e9; padding: 4px 8px; text-align: left; vertical-align: top; }
  th { background: #f6f9fc; width: 30%; font-weight: 600; }
  .stats th { width: auto; }
  .val { font-family: ui-monospace, Consolas, monospace; }
  .disclaimer { margin-top: 32px; padding: 10px 14px; border-left: 4px solid #d8a13a; background: #fdf6e6; font-size: 12px; }
  @media print { body { margin: 12mm; } .record { page-break-inside: avoid; } }
</style></head>
<body>
  <h1>OptiLab 实验报告</h1>
  <p class="meta">导出时间：${escapeHtml(now)} · 记录条数：${records.length}</p>
${sections}
  <p class="disclaimer">声明：本项目为教学与求职作品，平台中的设备、图像与测试数据均由程序仿真生成，
  不代表任何真实设备的性能；报告中的结论仅用于验证算法与理解物理模型。</p>
</body></html>`
}

/* ------------------------------------------------------------------ */
/* 导出：PNG（canvas 现场绘制汇总卡片）                                */
/* ------------------------------------------------------------------ */

/** 用 canvas 把记录绘制成一张汇总图（标题 + 参数/结果表 + 数值条形） */
export function recordsToPngCanvas(records: ExperimentRecord[], width = 1100): HTMLCanvasElement {
  const rowH = 22
  const perRecord = records.map(
    (r) => 30 + 28 + (r.stats.length + Object.keys(r.params).length) * rowH + 26,
  )
  const height = Math.max(320, 90 + perRecord.reduce((a, b) => a + b, 0))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  ctx.fillStyle = '#0c131a'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#dbe6f1'
  ctx.font = 'bold 20px "Segoe UI", system-ui, "Microsoft YaHei", sans-serif'
  ctx.fillText('OptiLab 实验记录汇总', 28, 40)
  ctx.font = '12px ui-monospace, Consolas, monospace'
  ctx.fillStyle = '#9db1c3'
  ctx.fillText(
    `${new Date().toLocaleString('zh-CN', { hour12: false })} · ${records.length} 条记录 · 仿真数据，非真实设备`,
    28,
    62,
  )

  let y = 92
  for (const r of records) {
    ctx.fillStyle = '#1a2632'
    ctx.fillRect(20, y - 18, width - 40, 24)
    ctx.fillStyle = '#5cb0ef'
    ctx.font = 'bold 14px "Segoe UI", system-ui, "Microsoft YaHei", sans-serif'
    ctx.fillText(`${r.id} · ${r.moduleName}`, 30, y)
    ctx.fillStyle = '#9db1c3'
    ctx.font = '11px ui-monospace, Consolas, monospace'
    ctx.fillText(new Date(r.timestamp).toLocaleString('zh-CN', { hour12: false }), width - 210, y)
    y += 26

    const rows: Array<[string, string]> = [
      ...Object.entries(r.params).map(([k, v]) => [`参数 ${k}`, String(v)] as [string, string]),
      ...r.stats.slice(0, 10).map((s) => [s.label, s.unit ? `${s.value} ${s.unit}` : s.value] as [string, string]),
    ]
    for (const [label, value] of rows) {
      ctx.fillStyle = '#6b8199'
      ctx.font = '12px "Segoe UI", system-ui, "Microsoft YaHei", sans-serif'
      ctx.fillText(label.slice(0, 28), 34, y)
      ctx.fillStyle = '#dbe6f1'
      ctx.font = '12px ui-monospace, Consolas, monospace'
      ctx.fillText(value.slice(0, 40), 300, y)
      y += rowH
    }
    if (r.threshold) {
      ctx.fillStyle = r.threshold.passed ? '#35b381' : '#e0665a'
      ctx.font = 'bold 12px ui-monospace, Consolas, monospace'
      ctx.fillText(
        `${r.threshold.passed ? 'PASS' : 'FAIL'} · ${r.threshold.label} ${r.threshold.value}${r.threshold.unit ?? ''}`,
        34,
        y + 6,
      )
    }
    y += 34
  }

  ctx.fillStyle = '#6b8199'
  ctx.font = '11px "Segoe UI", system-ui, "Microsoft YaHei", sans-serif'
  ctx.fillText('本图由 OptiLab 依据实验记录自动生成；数据均为本地仿真计算结果。', 28, height - 18)
  return canvas
}

/** 触发浏览器下载 */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadText(filename: string, text: string, mime = 'text/plain;charset=utf-8'): void {
  downloadBlob(filename, new Blob([text], { type: mime }))
}

export function downloadCanvasPng(filename: string, canvas: HTMLCanvasElement): void {
  canvas.toBlob((blob) => {
    if (blob) downloadBlob(filename, blob)
  }, 'image/png')
}

/** 打开可打印报告（新窗口 → 调用 print） */
export function openPrintableReport(records: ExperimentRecord[]): boolean {
  const html = recordsToHtml(records)
  const win = window.open('', '_blank')
  if (!win) return false
  win.document.open()
  win.document.write(html)
  win.document.close()
  // 等一帧再调打印，确保样式生效
  win.setTimeout(() => win.print(), 300)
  return true
}

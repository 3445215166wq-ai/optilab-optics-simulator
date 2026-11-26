<script setup lang="ts">
/**
 * 模块七：自动化测试报告
 *
 * 数据来源：各实验模块点击「记录实验」时调用 useRecorder().capture()，
 * 把当时的参数、结果、阈值判定、异常与模型局限存成一条结构化记录（src/stores/experiments.ts）。
 * 本页只做呈现与导出：CSV / JSON / PNG 汇总图 / 可打印 HTML 报告。
 */
import { computed, ref } from 'vue'
import {
  clearRecords,
  downloadCanvasPng,
  downloadText,
  openPrintableReport,
  recordsToCsv,
  recordsToHtml,
  recordsToJson,
  recordsToPngCanvas,
  removeRecord,
  useExperiments,
  type ExperimentRecord,
} from '@/stores/experiments'
import { pushLog } from '@/stores/log'
import { useNavigation } from '@/stores/navigation'

const MODULE_NAME = '测试报告'
const { records } = useExperiments()
const { setActiveModule } = useNavigation()
const selectedId = ref<string | null>(null)
const message = ref('')

/** 空状态下的引导：直接跳到实验模块去记录 */
function goRecord(): void {
  setActiveModule('geo-optics')
  pushLog('info', MODULE_NAME, '已跳转到「几何光学」，点工具栏「记录实验」即可生成记录')
}

const selected = computed<ExperimentRecord | null>(
  () => records.value.find((r) => r.id === selectedId.value) ?? records.value[records.value.length - 1] ?? null,
)

function stamp(): string {
  const d = new Date()
  const p = (v: number) => String(v).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

function flash(text: string): void {
  message.value = text
  window.setTimeout(() => {
    if (message.value === text) message.value = ''
  }, 2600)
}

function ensureRecords(): boolean {
  if (records.value.length === 0) {
    flash('还没有实验记录：请先到任意实验模块点击工具栏上的「记录实验」')
    return false
  }
  return true
}

function exportCsv(): void {
  if (!ensureRecords()) return
  downloadText(`optilab-records-${stamp()}.csv`, recordsToCsv(records.value), 'text/csv;charset=utf-8')
  pushLog('ok', MODULE_NAME, `已导出 CSV（${records.value.length} 条记录）`)
  flash('CSV 已导出')
}

function exportJson(): void {
  if (!ensureRecords()) return
  downloadText(`optilab-records-${stamp()}.json`, recordsToJson(records.value), 'application/json;charset=utf-8')
  pushLog('ok', MODULE_NAME, `已导出 JSON（${records.value.length} 条记录）`)
  flash('JSON 已导出')
}

function exportPng(): void {
  if (!ensureRecords()) return
  const canvas = recordsToPngCanvas(records.value)
  downloadCanvasPng(`optilab-records-${stamp()}.png`, canvas)
  pushLog('ok', MODULE_NAME, `已导出汇总图 PNG（${canvas.width}×${canvas.height}）`)
  flash('PNG 已导出')
}

function printReport(): void {
  if (!ensureRecords()) return
  const ok = openPrintableReport(records.value)
  if (ok) {
    pushLog('ok', MODULE_NAME, `已打开可打印报告（${records.value.length} 条记录）`)
    flash('报告已在新窗口打开，可直接打印 / 另存为 PDF')
  } else {
    // 弹窗被拦截时，退化为下载 HTML 文件
    downloadText(`optilab-report-${stamp()}.html`, recordsToHtml(records.value), 'text/html;charset=utf-8')
    flash('新窗口被浏览器拦截，已改为下载 HTML 报告文件')
  }
}

function onRemove(id: string): void {
  removeRecord(id)
  pushLog('info', MODULE_NAME, `已删除记录 ${id}`)
}

function onClear(): void {
  const n = records.value.length
  clearRecords()
  pushLog('warn', MODULE_NAME, `已清空全部实验记录（${n} 条）`)
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', { hour12: false })
}

function judgeOf(r: ExperimentRecord): { text: string; cls: string } {
  if (!r.threshold) return { text: '—', cls: 'muted' }
  if (r.threshold.passed === null) return { text: '未判定', cls: 'muted' }
  return r.threshold.passed ? { text: 'PASS', cls: 'pass' } : { text: 'FAIL', cls: 'fail' }
}
</script>

<template>
  <div class="rp">
    <header class="rp__head">
      <div class="rp__title">
        <span class="rp__title-cn">自动化测试报告</span>
        <span class="rp__title-en">Automated Test Report</span>
        <span class="badge badge--accent">{{ records.length }} 条记录</span>
      </div>
      <div class="rp__actions">
        <button class="btn btn--sm" @click="exportCsv">导出 CSV</button>
        <button class="btn btn--sm" @click="exportJson">导出 JSON</button>
        <button class="btn btn--sm" @click="exportPng">导出 PNG</button>
        <button class="btn btn--sm btn--primary" @click="printReport">打印 HTML 报告</button>
        <button class="btn btn--sm btn--ghost" :disabled="!records.length" @click="onClear">清空</button>
      </div>
    </header>

    <div v-if="message" class="rp__msg callout callout--info">
      <span class="callout__icon">i</span>
      <div>{{ message }}</div>
    </div>

    <div class="rp__body">
      <section class="rp__list">
        <table class="rp-table">
          <thead>
            <tr>
              <th>编号</th>
              <th>模块</th>
              <th>测试时间</th>
              <th>判定</th>
              <th>异常</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="r in [...records].reverse()"
              :key="r.id"
              :class="{ 'rp-table__row--on': selected?.id === r.id }"
              @click="selectedId = r.id"
            >
              <td class="mono">{{ r.id }}</td>
              <td>{{ r.moduleName }}</td>
              <td class="mono xs">{{ fmtTime(r.timestamp) }}</td>
              <td>
                <span class="rp-judge" :class="judgeOf(r).cls">{{ judgeOf(r).text }}</span>
              </td>
              <td class="xs muted">{{ r.anomalies.length ? `${r.anomalies.length} 条` : '—' }}</td>
              <td>
                <button class="btn btn--sm btn--ghost" title="删除该记录" @click.stop="onRemove(r.id)">
                  删除
                </button>
              </td>
            </tr>
            <tr v-if="!records.length">
              <td colspan="6">
                <div class="empty rp-empty">
                  <div class="rp-empty__title">还没有实验记录</div>
                  <ol class="rp-empty__steps">
                    <li>到左侧任意实验模块（如「几何光学」），调好参数</li>
                    <li>点舞台左上角工具栏里的 <strong>「记录实验」</strong></li>
                    <li>回到本页即可看到记录，并导出 CSV / JSON / PNG / 打印报告</li>
                  </ol>
                  <button class="btn btn--sm btn--primary" @click="goRecord">去「几何光学」记录一条</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <aside v-if="selected" class="rp__detail">
        <div class="rp-detail__head">
          <div>
            <div class="rp-detail__id mono">{{ selected.id }}</div>
            <div class="rp-detail__module">{{ selected.moduleName }}</div>
            <div class="xs muted">{{ fmtTime(selected.timestamp) }}</div>
          </div>
        </div>

        <div class="section-title">参数配置 <span class="muted xs">· Parameters</span></div>
        <div class="kv">
          <template v-for="(v, k) in selected.params" :key="k">
            <span class="kv__k">{{ k }}</span>
            <span class="kv__v">{{ v }}</span>
          </template>
        </div>

        <div class="section-title">实验结果 <span class="muted xs">· Results</span></div>
        <div class="kv">
          <template v-for="s in selected.stats" :key="s.label">
            <span class="kv__k">
              {{ s.label }}
              <span v-if="s.labelEn" class="xs muted">{{ s.labelEn }}</span>
            </span>
            <span class="kv__v">{{ s.value }}<span v-if="s.unit" class="muted"> {{ s.unit }}</span></span>
          </template>
        </div>

        <template v-if="selected.threshold">
          <div class="section-title">合格判定 <span class="muted xs">· Verdict</span></div>
          <div class="callout" :class="selected.threshold.passed ? 'callout--ok' : 'callout--err'">
            <span class="callout__icon">{{ selected.threshold.passed ? '✓' : '!' }}</span>
            <div>
              {{ selected.threshold.passed ? 'PASS' : 'FAIL' }} · {{ selected.threshold.label }} =
              {{ selected.threshold.value }}{{ selected.threshold.unit ?? '' }}
            </div>
          </div>
        </template>

        <div class="section-title">异常记录 <span class="muted xs">· Anomalies</span></div>
        <ul v-if="selected.anomalies.length" class="rp-detail__list">
          <li v-for="a in selected.anomalies" :key="a">{{ a }}</li>
        </ul>
        <p v-else class="xs muted">无异常或警告。</p>

        <div class="section-title">模型局限 <span class="muted xs">· Limitations</span></div>
        <ul v-if="selected.modelNotes.length" class="rp-detail__list">
          <li v-for="m in selected.modelNotes" :key="m">{{ m }}</li>
        </ul>
        <p v-else class="xs muted">未记录。</p>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.rp {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--bg-app);
}

.rp__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-strong);
  background: var(--bg-panel);
}

.rp__title {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.rp__title-cn {
  font-size: var(--fs-lg);
  font-weight: 600;
  color: var(--text-1);
}

.rp__title-en {
  font-size: var(--fs-xs);
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.rp__actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.rp__msg {
  margin: 8px 14px 0;
}

.rp__body {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 330px;
}

.rp__list {
  min-height: 0;
  overflow: auto;
  padding: 10px 14px;
}

.rp__detail {
  min-height: 0;
  overflow-y: auto;
  padding: 10px 12px 20px;
  border-left: 1px solid var(--border);
  background: var(--bg-panel);
}

.rp-table {
  width: 100%;
  font-size: var(--fs-sm);
  border-collapse: collapse;
}

.rp-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 6px 8px;
  text-align: left;
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--text-3);
  background: var(--bg-panel-2);
  border-bottom: 1px solid var(--border);
}

.rp-table td {
  padding: 6px 8px;
  border-bottom: 1px solid var(--border);
  color: var(--text-2);
}

.rp-table tbody tr {
  cursor: pointer;
}

.rp-table tbody tr:hover {
  background: var(--bg-hover);
}

.rp-table__row--on {
  background: var(--bg-active);
}

.rp-judge {
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: var(--fs-xs);
}

.rp-judge.pass {
  color: var(--ok);
}

.rp-judge.fail {
  color: var(--err);
}

.rp-judge.muted {
  color: var(--text-3);
}

.rp-detail__head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px dashed var(--border);
}

.rp-detail__id {
  font-size: var(--fs-sm);
  color: var(--accent-strong);
  font-weight: 700;
}

.rp-detail__module {
  font-size: var(--fs-md);
  color: var(--text-1);
}

.rp-detail__list {
  margin: 4px 0 0;
  padding-left: 16px;
  font-size: var(--fs-xs);
  line-height: 1.55;
  color: var(--text-2);
}

.rp-empty {
  gap: 8px;
  text-align: left;
  align-items: flex-start;
  padding: 18px 22px;
}

.rp-empty__title {
  font-size: var(--fs-md);
  color: var(--text-1);
  font-weight: 600;
}

.rp-empty__steps {
  margin: 0 0 4px;
  padding-left: 18px;
  font-size: var(--fs-sm);
  line-height: 1.7;
  color: var(--text-2);
}

.rp-empty__steps strong {
  color: var(--accent-strong);
}

@media (max-width: 1080px) {
  .rp__body {
    grid-template-columns: 1fr;
  }

  .rp__detail {
    border-left: none;
    border-top: 1px solid var(--border);
    max-height: 42vh;
  }
}
</style>

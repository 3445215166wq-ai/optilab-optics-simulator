/**
 * 模块三：艾里斑二维图样渲染。
 *
 * 画面元素（自下而上）：方形衍射图样 → 中心十字与 μm 刻度 → Rayleigh 判据虚线圆
 * → 第二暗环虚线圆 → 文字标注 → 比例尺。
 * 像素到物理尺寸严格按「图幅半宽 = 4 个艾里半径」换算，标注的 μm 值来自计算结果。
 */

import type { DiffractionResult } from '../core/optics/diffraction'
import { sampleAiryImage } from '../core/optics/diffraction'
import type { ScenePalette } from './palette'
import type { Size } from './draw'
import { clearStage, drawChip, drawEmptyState } from './draw'
import { drawFieldPanel } from './heatmap'

export interface DiffractionSceneOptions {
  logScale: boolean
  showRings: boolean
}

const PATTERN_SIZE = 256

/** 缓存艾里图样（参数不变时不重复采样 256×256） */
let cachedKey = ''
let cachedField: Float32Array = new Float32Array(0)

function getAiryField(result: DiffractionResult): Float32Array {
  const key = `${result.wavelengthNm}|${result.fNumber}|${result.imageHalfExtentUm.toFixed(6)}`
  if (key === cachedKey && cachedField.length > 0) return cachedField
  cachedField = sampleAiryImage(PATTERN_SIZE, result.imageHalfExtentUm, result.wavelengthNm, result.fNumber)
  cachedKey = key
  return cachedField
}

export function drawDiffractionScene(
  ctx: CanvasRenderingContext2D,
  size: Size,
  result: DiffractionResult,
  options: DiffractionSceneOptions,
  palette: ScenePalette,
): void {
  clearStage(ctx, size, palette)

  if (!result.ok) {
    drawEmptyState(ctx, size, palette, '参数非法，无法生成衍射图样', result.errors[0] ?? '请检查右侧参数面板')
    return
  }

  const field = getAiryField(result)
  const rect = drawFieldPanel(
    ctx,
    size.w,
    size.h,
    field,
    PATTERN_SIZE,
    { logScale: options.logScale, dynamicRangeDb: 40 },
    palette,
    { top: '1', bottom: options.logScale ? '10⁻⁴' : '0' },
  )

  const cx = rect.x + rect.side / 2
  const cy = rect.y + rect.side / 2
  // 像素/μm：图幅半宽 = 4 个艾里半径
  const pxPerUm = rect.side / (2 * result.imageHalfExtentUm)

  ctx.save()
  ctx.beginPath()
  ctx.rect(rect.x, rect.y, rect.side, rect.side)
  ctx.clip()

  // ---- 中心十字线 ----
  ctx.strokeStyle = palette.chipBorder
  ctx.setLineDash([2, 3])
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(rect.x, cy)
  ctx.lineTo(rect.x + rect.side, cy)
  ctx.moveTo(cx, rect.y)
  ctx.lineTo(cx, rect.y + rect.side)
  ctx.stroke()
  ctx.setLineDash([])

  // ---- 判据圆 ----
  if (options.showRings) {
    const circles: Array<{ rUm: number; color: string; label: string; dash: number[] }> = [
      {
        rUm: result.airyRadiusImgUm,
        color: palette.accent,
        label: `r₁ = ${result.airyRadiusImgUm.toFixed(2)} μm（艾里半径 / 瑞利判据）`,
        dash: [5, 4],
      },
    ]
    const secondRing = result.rings.filter((x) => x.kind === 'dark')[1]
    if (secondRing) {
      circles.push({
        rUm: secondRing.radiusImgUm,
        color: palette.rayVirtual,
        label: `第二暗环 ${secondRing.radiusImgUm.toFixed(2)} μm`,
        dash: [3, 4],
      })
    }
    for (const circle of circles) {
      const rPx = circle.rUm * pxPerUm
      if (rPx < 2 || rPx > rect.side) continue
      ctx.strokeStyle = circle.color
      ctx.lineWidth = 1.2
      ctx.setLineDash(circle.dash)
      ctx.beginPath()
      ctx.arc(cx, cy, rPx, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
    }
  }
  ctx.restore()

  // ---- 半径标注（画面外右上角，避免压住图样） ----
  drawChip(
    ctx,
    `艾里半径 r₁ = ${result.airyRadiusImgUm.toFixed(2)} μm · 直径 ${result.airyDiameterImgUm.toFixed(2)} μm`,
    rect.x + 6,
    rect.y + 6,
    palette,
    { align: 'left', baseline: 'top', color: palette.accent, size: 10 },
  )

  // ---- 坐标轴刻度（μm） ----
  drawAxisTicks(ctx, rect, pxPerUm, result.imageHalfExtentUm, palette)
}

/** 在图像下沿与左沿画 μm 刻度 */
function drawAxisTicks(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; side: number },
  pxPerUm: number,
  halfExtentUm: number,
  palette: ScenePalette,
): void {
  const targetTicks = 6
  const rawStep = (2 * halfExtentUm) / targetTicks
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const norm = rawStep / mag
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag

  const cx = rect.x + rect.side / 2
  const cy = rect.y + rect.side / 2
  const digits = Math.max(0, Math.min(2, -Math.floor(Math.log10(step))))
  const kMax = Math.floor(halfExtentUm / step)

  ctx.save()
  ctx.font = "9px ui-monospace, Consolas, monospace"

  // x 轴（下沿）
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  for (let k = -kMax; k <= kMax; k += 1) {
    if (k === 0) continue
    const px = cx + k * step * pxPerUm
    if (px < rect.x + 12 || px > rect.x + rect.side - 12) continue
    ctx.fillStyle = palette.textMuted
    ctx.fillRect(px - 0.5, rect.y + rect.side, 1, 3)
    ctx.fillText((k * step).toFixed(digits), px, rect.y + rect.side + 5)
  }

  // y 轴（左沿）
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  for (let k = -kMax; k <= kMax; k += 1) {
    if (k === 0) continue
    const py = cy - k * step * pxPerUm
    if (py < rect.y + 12 || py > rect.y + rect.side - 12) continue
    ctx.fillStyle = palette.textMuted
    ctx.fillRect(rect.x - 3, py - 0.5, 3, 1)
    ctx.fillText((k * step).toFixed(digits), rect.x - 6, py)
  }

  // 单位
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillStyle = palette.textMuted
  ctx.fillText('位置 (μm)', rect.x + rect.side + 6, rect.y + rect.side + 5)
  ctx.restore()
}

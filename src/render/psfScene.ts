/**
 * 模块四：PSF 二维热力图渲染。
 *
 * 元素：PSF 热力图（线性/对数）→ 中心十字 → 衍射极限艾里半径参考圆（虚线）
 *      → W₂₀ 与峰值标注 → μm 刻度。
 * 该参考圆把「离焦前」的衍射极限尺度画在同一坐标系里，
 * 便于直观看出离焦把能量摊开了多少 —— 这是 MTF 下降的几何原因。
 */

import type { PsfResult } from '../core/optics/psfMtf'
import type { ScenePalette } from './palette'
import type { Size } from './draw'
import { clearStage, drawChip, drawEmptyState } from './draw'
import { drawFieldPanel } from './heatmap'

export interface PsfSceneOptions {
  logScale: boolean
  showAiryReference: boolean
}

export function drawPsfScene(
  ctx: CanvasRenderingContext2D,
  size: Size,
  result: PsfResult,
  options: PsfSceneOptions,
  palette: ScenePalette,
): void {
  clearStage(ctx, size, palette)

  if (!result.ok) {
    drawEmptyState(ctx, size, palette, '参数非法，无法生成 PSF', result.errors[0] ?? '请检查右侧参数面板')
    return
  }

  const rect = drawFieldPanel(
    ctx,
    size.w,
    size.h,
    result.psf,
    result.gridSize,
    { logScale: options.logScale, dynamicRangeDb: 40 },
    palette,
    { top: '1', bottom: options.logScale ? '10⁻⁴' : '0' },
  )

  const cx = rect.x + rect.side / 2
  const cy = rect.y + rect.side / 2
  // 图幅半宽（μm）对应 result.halfExtentUm
  const pxPerUm = rect.side / (2 * result.halfExtentUm)

  ctx.save()
  ctx.beginPath()
  ctx.rect(rect.x, rect.y, rect.side, rect.side)
  ctx.clip()

  // 中心十字
  ctx.strokeStyle = palette.chipBorder
  ctx.setLineDash([2, 3])
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(rect.x, cy)
  ctx.lineTo(rect.x + rect.side, cy)
  ctx.moveTo(cx, rect.y)
  ctx.lineTo(cx, rect.y + rect.side)
  ctx.stroke()

  // 衍射极限艾里半径参考圆（用当前 λ、N 的解析值）
  if (options.showAiryReference) {
    const airyUm = 1.21967 * (result.wavelengthNm * 1e-6) * result.fNumber * 1e3
    const rPx = airyUm * pxPerUm
    if (rPx > 2 && rPx < rect.side) {
      ctx.strokeStyle = palette.accent
      ctx.lineWidth = 1.2
      ctx.setLineDash([5, 4])
      ctx.beginPath()
      ctx.arc(cx, cy, rPx, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.setLineDash([])
  }
  ctx.restore()

  // 标注
  const defocusLabel =
    Math.abs(result.defocusWaves) < 0.005
      ? '焦平面（W₂₀ = 0）'
      : `离焦 W₂₀ = ${result.defocusWaves.toFixed(2)} λ（≈ Δz ${(result.defocusMm * 1e3).toFixed(1)} μm）`
  drawChip(ctx, `PSF · ${defocusLabel}`, rect.x + 6, rect.y + 6, palette, {
    align: 'left',
    baseline: 'top',
    color: palette.textPrimary,
    size: 10,
  })
  if (options.showAiryReference) {
    const airyUm = 1.21967 * (result.wavelengthNm * 1e-6) * result.fNumber * 1e3
    drawChip(
      ctx,
      `虚线圆 = 衍射极限艾里半径 ${airyUm.toFixed(2)} μm`,
      rect.x + 6,
      rect.y + 24,
      palette,
      { align: 'left', baseline: 'top', color: palette.accent, size: 9.5 },
    )
  }
  drawChip(
    ctx,
    `网格 ${result.gridSize}² · 像素 ${result.pixelSizeUm.toFixed(3)} μm · 覆盖 ±${result.halfExtentUm.toFixed(0)} μm`,
    rect.x + 6,
    rect.y + rect.side - 6,
    palette,
    { align: 'left', baseline: 'bottom', color: palette.textMuted, size: 9.5 },
  )
}

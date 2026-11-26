/**
 * 画布调色板的约束测试。
 * 目的：把「光锥填充透明度必须落在 5%~10%」这类**显示规范**固化成测试，
 * 避免后续调色时不小心把辅助填充画得过重、抢掉主光线的视觉地位。
 */
import { describe, expect, it } from 'vitest'
import { getScenePalette } from './palette'

function alphaOf(rgba: string): number {
  const match = rgba.match(/rgba?\(([^)]+)\)/)
  if (!match) return Number.NaN
  const parts = match[1].split(',').map((s) => Number.parseFloat(s.trim()))
  return parts.length === 4 ? parts[3] : 1
}

describe('palette / 光锥填充透明度', () => {
  it('深色与浅色主题的光锥填充透明度都在 5%~10% 之间', () => {
    for (const theme of ['dark', 'light'] as const) {
      const palette = getScenePalette(theme)
      const alpha = alphaOf(palette.rayBeamFill)
      expect(Number.isFinite(alpha)).toBe(true)
      expect(alpha).toBeGreaterThanOrEqual(0.05)
      expect(alpha).toBeLessThanOrEqual(0.1)
    }
  })

  it('三条典型光线使用互不相同的颜色（可区分性）', () => {
    for (const theme of ['dark', 'light'] as const) {
      const palette = getScenePalette(theme)
      const colors = new Set([palette.rayIncident, palette.rayCenter, palette.rayRefracted])
      expect(colors.size).toBe(3)
      // 实像/虚像/延长线也必须彼此可区分
      expect(palette.imageArrow).not.toBe(palette.imageVirtual)
      expect(palette.rayVirtual).not.toBe(palette.rayBlocked)
    }
  })
})

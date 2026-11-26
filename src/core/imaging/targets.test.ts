import { describe, expect, it } from 'vitest'
import { buildTarget, targetContrastNote, TARGETS, type TargetId } from './targets'
import { imageMean, imageStdDev } from './image'
import { tenengrad } from './focusMetrics'

describe('合成靶标', () => {
  it.each(['siemens', 'bars', 'pcb'] as TargetId[])('%s：尺寸正确且有足够对比度', (id) => {
    const img = buildTarget(id, 128)
    expect(img.width).toBe(128)
    expect(img.height).toBe(128)
    expect(img.data.length).toBe(128 * 128)
    // 均值落在中间区间、标准差足够大（有细节），且全部取值合法
    const mean = imageMean(img)
    expect(mean).toBeGreaterThan(0.1)
    expect(mean).toBeLessThan(0.9)
    expect(imageStdDev(img)).toBeGreaterThan(0.1)
    for (const v of img.data) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })

  it('确定性：相同参数生成完全相同的图', () => {
    const a = buildTarget('siemens', 64)
    const b = buildTarget('siemens', 64)
    expect(Array.from(a.data)).toEqual(Array.from(b.data))
  })

  it('三个靶标的高频含量都足以驱动自动对焦', () => {
    for (const id of ['siemens', 'bars', 'pcb'] as TargetId[]) {
      const img = buildTarget(id, 96)
      expect(tenengrad(img)).toBeGreaterThan(0.001)
    }
  })

  it('西门子星为扇形结构：左右镜像呈明暗互补（黑白互换）', () => {
    const n = 96
    const img = buildTarget('siemens', n)
    let complementary = 0
    let total = 0
    // 36 个扇区（偶数）→ 绕垂直轴镜像后扇区序号奇偶互换，因此黑白恰好互补
    for (let y = 8; y < n - 8; y += 1) {
      for (let x = 8; x < n / 2; x += 1) {
        const dx = x - n / 2
        const dy = y - n / 2
        if (Math.hypot(dx, dy) > n * 0.4) continue // 只看星形内部
        const a = img.data[y * n + x]
        const b = img.data[y * n + (n - 1 - x)]
        if (Math.abs(a + b - 1) < 0.25) complementary += 1
        total += 1
      }
    }
    expect(total).toBeGreaterThan(100)
    expect(complementary / total).toBeGreaterThan(0.9)
  })

  it('元数据完整：每个靶标都有中英文名与说明', () => {
    expect(TARGETS.length).toBe(3)
    for (const t of TARGETS) {
      expect(t.label.length).toBeGreaterThan(0)
      expect(t.labelEn.length).toBeGreaterThan(0)
      expect(targetContrastNote(t.id).length).toBeGreaterThan(0)
    }
  })

  it('最小尺寸下限 32', () => {
    expect(buildTarget('bars', 8).width).toBe(32)
  })
})

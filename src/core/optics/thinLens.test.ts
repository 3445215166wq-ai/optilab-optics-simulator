/**
 * 薄透镜成像模型单元测试
 * 验证策略：与解析解 / 独立公式（高斯公式、牛顿公式）互相校验，
 * 而不是「跑一遍看有没有报错」。
 */
import { describe, expect, it } from 'vitest'
import type { ThinLensInput, ThinLensResult } from './thinLens'
import { computeThinLens, keyPoints, summarizeThinLens } from './thinLens'

function make(over: Partial<ThinLensInput> = {}): ThinLensInput {
  return {
    lensType: 'convex',
    focalLength: 100,
    objectDistance: 300,
    objectHeight: 15,
    apertureDiameter: 40,
    rayCount: 11,
    ...over,
  }
}

/** 取一条光线的出射段（第 2 段） */
function exitSegment(result: ThinLensResult, rayIndex: number) {
  const ray = result.bundleRays[rayIndex]
  return ray.segments[1]
}

describe('computeThinLens — 高斯成像公式', () => {
  it('满足 1/f = 1/u + 1/v（多组参数）', () => {
    const cases: Array<[number, number, number]> = [
      [100, 300, 150],
      [50, 200, 66.6666666667],
      [200, 500, 333.3333333333],
      [35, 120, 49.4117647059],
      [120, 1000, 136.3636363636],
    ]
    for (const [f, u, expectedV] of cases) {
      const r = computeThinLens(make({ focalLength: f, objectDistance: u }))
      expect(r.ok).toBe(true)
      expect(r.image.distance).toBeCloseTo(expectedV, 6)
      // 直接校验成像公式本身
      const inv = 1 / f - 1 / u
      expect(1 / (r.image.distance as number)).toBeCloseTo(inv, 10)
    }
  })

  it('u = 2f 时成倒立等大实像：v = 2f, m = −1', () => {
    const r = computeThinLens(make({ focalLength: 100, objectDistance: 200, objectHeight: 12 }))
    expect(r.image.status).toBe('real')
    expect(r.image.distance).toBeCloseTo(200, 9)
    expect(r.image.magnification).toBeCloseTo(-1, 9)
    expect(r.image.height).toBeCloseTo(-12, 9)
    expect(r.image.isInverted).toBe(true)
  })

  it('u > 2f 成缩小实像；f < u < 2f 成放大实像', () => {
    const far = computeThinLens(make({ focalLength: 100, objectDistance: 400 }))
    expect(far.image.absoluteMagnification as number).toBeLessThan(1)
    expect(far.image.status).toBe('real')

    const near = computeThinLens(make({ focalLength: 100, objectDistance: 150 }))
    expect(near.image.absoluteMagnification as number).toBeGreaterThan(1)
    expect(near.image.status).toBe('real')
    expect(near.image.distance).toBeCloseTo(300, 9)
  })

  it('满足牛顿公式 (u − f)(v − f) = f²', () => {
    for (const u of [120, 175, 250, 480, 900]) {
      const f = 85
      const r = computeThinLens(make({ focalLength: f, objectDistance: u }))
      const v = r.image.distance as number
      expect((u - f) * (v - f)).toBeCloseTo(f * f, 6)
    }
  })

  it('物体趋于无穷远时像距趋于焦距（像方焦点的定义）', () => {
    const f = 100
    const u = 100000
    const r = computeThinLens(make({ focalLength: f, objectDistance: u }))
    // 解析式 v = f·u/(u−f) = f/(1 − f/u)，与焦距的相对偏差应约为 f/u = 0.1%
    const expected = (f * u) / (u - f)
    expect(r.image.distance as number).toBeCloseTo(expected, 9)
    expect(Math.abs((r.image.distance as number) - f) / f).toBeLessThan(2e-3)
    expect(r.image.distance as number).toBeGreaterThan(f)
  })
})

describe('computeThinLens — 特殊与边界情况', () => {
  it('u = f 时判定为成像于无穷远，不返回有限像距', () => {
    const r = computeThinLens(make({ focalLength: 120, objectDistance: 120 }))
    expect(r.image.status).toBe('infinite')
    expect(r.image.distance).toBeNull()
    expect(r.image.magnification).toBeNull()
    expect(r.image.height).toBeNull()
    expect(r.warnings.join()).toContain('无穷远')
    // 出射光线应互相平行：所有出射段斜率一致
    const slopes = r.bundleRays.map((ray) => {
      const s = ray.segments[1]
      return (s.to.y - s.from.y) / (s.to.x - s.from.x)
    })
    for (const s of slopes) expect(s).toBeCloseTo(slopes[0], 9)
  })

  it('u < f 时成正立放大虚像（放大镜），且带反向延长线', () => {
    const r = computeThinLens(make({ focalLength: 100, objectDistance: 60, objectHeight: 15 }))
    expect(r.image.status).toBe('virtual')
    expect(r.image.distance as number).toBeCloseTo(-150, 9)
    expect(r.image.magnification as number).toBeCloseTo(2.5, 9)
    expect(r.image.height as number).toBeCloseTo(37.5, 9)
    expect(r.image.isInverted).toBe(false)
    // 虚像必须有虚线延长段
    expect(r.bundleRays[0].segments.some((s) => s.dashed)).toBe(true)
  })

  it('凹透镜对实物永远成正立缩小虚像', () => {
    for (const u of [20, 80, 200, 1000]) {
      const r = computeThinLens(make({ lensType: 'concave', focalLength: 100, objectDistance: u }))
      expect(r.ok).toBe(true)
      expect(r.focalLengthSigned).toBe(-100)
      expect(r.image.status).toBe('virtual')
      expect(r.image.distance as number).toBeLessThan(0)
      expect(r.image.absoluteMagnification as number).toBeLessThan(1)
      expect(r.image.isInverted).toBe(false)
    }
    // 与解析式 v = f·u/(u−f) 对照
    const r = computeThinLens(make({ lensType: 'concave', focalLength: 100, objectDistance: 200 }))
    expect(r.image.distance as number).toBeCloseTo((-100 * 200) / (200 + 100), 9)
  })

  it('凹透镜在任意物距下都不会成实像', () => {
    for (let u = 1; u <= 500; u += 37) {
      const r = computeThinLens(make({ lensType: 'concave', focalLength: 60, objectDistance: u }))
      expect(r.image.status).not.toBe('real')
    }
  })

  it('物距接近焦距时给出像距急剧增大警告', () => {
    const r = computeThinLens(make({ focalLength: 100, objectDistance: 101 }))
    expect(r.image.distance as number).toBeCloseTo(10100, 6)
    expect(r.warnings.some((w) => w.includes('接近焦距'))).toBe(true)
  })

  it('对非法输入返回结构化错误而不是 NaN', () => {
    const bad: Array<Partial<ThinLensInput>> = [
      { objectDistance: 0 },
      { objectDistance: -50 },
      { focalLength: 0 },
      { focalLength: Number.NaN },
      { apertureDiameter: 0 },
      { objectHeight: -3 },
    ]
    for (const over of bad) {
      const r = computeThinLens(make(over))
      expect(r.ok).toBe(false)
      expect(r.errors.length).toBeGreaterThan(0)
      expect(r.image.status).toBe('invalid')
      expect(r.image.distance).toBeNull()
      expect(Number.isNaN(r.image.magnification)).toBe(false)
    }
  })

  it('相同输入完全可复现（纯函数）', () => {
    const a = computeThinLens(make())
    const b = computeThinLens(make())
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})

describe('computeThinLens — 光线追迹几何正确性', () => {
  it('全部出射光线通过像点（实像情形）', () => {
    const r = computeThinLens(make({ focalLength: 100, objectDistance: 300, objectHeight: 15 }))
    const v = r.image.distance as number
    const hi = r.image.height as number
    for (let i = 0; i < r.bundleRays.length; i += 1) {
      const seg = exitSegment(r, i)
      const slope = (seg.to.y - seg.from.y) / (seg.to.x - seg.from.x)
      // 从透镜平面出发、斜率为 slope 的直线，在 x = v 处的高度应为 h'
      expect(seg.from.y + slope * v).toBeCloseTo(hi, 6)
    }
  })

  it('虚像情形：反向延长线通过虚像点', () => {
    const r = computeThinLens(make({ focalLength: 100, objectDistance: 60, objectHeight: 15 }))
    const v = r.image.distance as number // 负值
    const hi = r.image.height as number
    expect(v).toBeLessThan(0)
    for (const ray of r.bundleRays) {
      const ext = ray.segments.find((s) => s.dashed)
      expect(ext).toBeDefined()
      const seg = ext as { from: { x: number; y: number }; to: { x: number; y: number } }
      const slope = (seg.to.y - seg.from.y) / (seg.to.x - seg.from.x)
      expect(seg.from.y + slope * v).toBeCloseTo(hi, 6)
    }
  })

  it('平行光轴主光线出射后通过像方焦点', () => {
    const r = computeThinLens(make({ focalLength: 100, objectDistance: 300, objectHeight: 15 }))
    const ray = r.principalRays.find((x) => x.role === 'parallel')
    expect(ray).toBeDefined()
    const seg = (ray as { segments: Array<{ from: { x: number; y: number }; to: { x: number; y: number } }> })
      .segments[1]
    const slope = (seg.to.y - seg.from.y) / (seg.to.x - seg.from.x)
    const yAtFocus = seg.from.y + slope * r.focalPoints.imageSideZ
    expect(yAtFocus).toBeCloseTo(0, 6)
  })

  it('过光心主光线方向不变', () => {
    const r = computeThinLens(make({ focalLength: 100, objectDistance: 300, objectHeight: 15 }))
    const ray = r.principalRays.find((x) => x.role === 'center')
    const segs = (ray as { segments: Array<{ from: { x: number; y: number }; to: { x: number; y: number } }> })
      .segments
    const s1 = (segs[0].to.y - segs[0].from.y) / (segs[0].to.x - segs[0].from.x)
    const s2 = (segs[1].to.y - segs[1].from.y) / (segs[1].to.x - segs[1].from.x)
    expect(s2).toBeCloseTo(s1, 9)
    expect(segs[1].from.y).toBeCloseTo(0, 9)
  })

  it('过物方焦点主光线出射后平行于光轴', () => {
    const r = computeThinLens(make({ focalLength: 100, objectDistance: 300, objectHeight: 15 }))
    const ray = r.principalRays.find((x) => x.role === 'focal')
    expect(ray).toBeDefined()
    const seg = (ray as { segments: Array<{ from: { x: number; y: number }; to: { x: number; y: number } }> })
      .segments[1]
    expect(seg.to.y - seg.from.y).toBeCloseTo(0, 9)
    // 入射段应通过物方焦点 (−f, 0)
    const inc = (ray as { segments: Array<{ from: { x: number; y: number }; to: { x: number; y: number } }> })
      .segments[0]
    const k = (inc.to.y - inc.from.y) / (inc.to.x - inc.from.x)
    expect(inc.from.y + k * (r.focalPoints.objectSideZ - inc.from.x)).toBeCloseTo(0, 6)
  })

  it('孔径小于主光线高度时标记为被遮挡', () => {
    const r = computeThinLens(make({ focalLength: 100, objectDistance: 300, objectHeight: 15, apertureDiameter: 10 }))
    const ray = r.principalRays.find((x) => x.role === 'parallel')
    expect(ray?.blocked).toBe(true)
    expect(r.warnings.join()).toContain('通光口径')
  })

  it('光锥采样点全部落在通光口径内', () => {
    const r = computeThinLens(make({ apertureDiameter: 40 }))
    for (const ray of r.bundleRays) {
      expect(Math.abs(ray.apertureHeight)).toBeLessThanOrEqual(20 + 1e-9)
    }
    // 采样数为奇数，保证穿过光心的光线存在
    expect(r.bundleRays.length % 2).toBe(1)
  })
})

describe('computeThinLens — 派生光学量', () => {
  it('F/# = |f| / D', () => {
    const r = computeThinLens(make({ focalLength: 100, apertureDiameter: 25 }))
    expect(r.fNumber).toBeCloseTo(4, 12)
  })

  it('物方数值孔径 NA ≈ sin(atan(D/2u))', () => {
    const r = computeThinLens(make({ focalLength: 100, objectDistance: 250, apertureDiameter: 30 }))
    const expected = Math.sin(Math.atan(15 / 250))
    expect(r.naObject).toBeCloseTo(expected, 12)
    expect(r.naImage as number).toBeGreaterThan(r.naObject)
  })

  it('有效 F 数 N_eff = |v|/D；实像时恒等于 N·(1 + |m|)', () => {
    // 由高斯公式可证明：实像（v > 0）时 |v|/D = (|f|/D)·(1+|m|)，这里逐点对照两组独立表达式
    for (const u of [120, 150, 300, 480, 900]) {
      const r = computeThinLens(make({ focalLength: 100, objectDistance: u, apertureDiameter: 40 }))
      expect(r.image.status).toBe('real')
      const D = 40
      const v = r.image.distance as number
      const m = r.image.magnification as number
      expect(r.effectiveFNumber as number).toBeCloseTo(Math.abs(v) / D, 9)
      expect(r.effectiveFNumber as number).toBeCloseTo(r.fNumber * (1 + Math.abs(m)), 9)
      // 有限共轭下有效 F 数必然大于名义 F 数
      expect(r.effectiveFNumber as number).toBeGreaterThan(r.fNumber)
    }
  })

  it('虚像情形：N_eff 仍取 |v|/D，但 N·(1+|m|) 关系式不适用', () => {
    const r = computeThinLens(make({ focalLength: 100, objectDistance: 60, apertureDiameter: 40 }))
    expect(r.image.status).toBe('virtual')
    const v = r.image.distance as number // −150
    const m = r.image.magnification as number // +2.5
    expect(r.effectiveFNumber as number).toBeCloseTo(Math.abs(v) / 40, 9) // 3.75
    // 名义 F 数 2.5，N·(1+|m|) = 8.75，与 |v|/D 明显不同：
    // 该恒等式仅在出射光真实会聚（实像）时成立，虚像时不能使用
    expect(r.fNumber * (1 + Math.abs(m))).toBeCloseTo(8.75, 9)
    expect(r.effectiveFNumber as number).toBeLessThan(r.fNumber * (1 + Math.abs(m)))
  })

  it('1:1 成像（u = 2f）时有效 F 数为名义 F 数的 2 倍', () => {
    const r = computeThinLens(make({ focalLength: 100, objectDistance: 200, apertureDiameter: 25 }))
    expect(r.fNumber).toBeCloseTo(4, 9)
    expect(r.effectiveFNumber as number).toBeCloseTo(8, 9)
  })

  it('成像于无穷远时像方会聚半角为 0（不是「无定义」），有效 F 数趋于无穷', () => {
    const r = computeThinLens(make({ focalLength: 120, objectDistance: 120, apertureDiameter: 40 }))
    expect(r.image.status).toBe('infinite')
    expect(r.naImage).toBe(0)
    expect(r.imageHalfAngleDeg).toBe(0)
    expect(r.effectiveFNumber).toBeNull()
    expect(r.naObject).toBeGreaterThan(0)
  })

  it('关键点坐标与输入一致', () => {
    const r = computeThinLens(make({ focalLength: 100, objectDistance: 300, objectHeight: 15 }))
    const kp = keyPoints(r)
    expect(kp.object).toEqual({ x: -300, y: 15 })
    expect(kp.frontFocal).toEqual({ x: -100, y: 0 })
    expect(kp.backFocal).toEqual({ x: 100, y: 0 })
    expect(kp.image?.x).toBeCloseTo(150, 9)
    expect(kp.image?.y).toBeCloseTo(-7.5, 9)
  })

  it('摘要文本可读且包含关键数值', () => {
    const r = computeThinLens(make())
    const text = summarizeThinLens(r)
    expect(text).toContain('凸透镜')
    expect(text).toContain('实像')
    expect(text).toContain('倒立')
  })
})

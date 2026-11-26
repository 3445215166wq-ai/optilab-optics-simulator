/**
 * 「面向用户的文本」卫生检查（显示规范回归测试）。
 *
 * 背景：界面把 core 返回的 errors / warnings / notes 直接当**纯文本**渲染，
 * 不支持 Markdown。一旦在字符串里写了 `**加粗**` 或反引号，用户就会看到裸符号。
 * 分层上也不该让计算层带展示标记 —— 强调应该由渲染层（HTML/CSS）负责。
 *
 * 这个测试把这条规范固化下来，防止以后再犯。
 */
import { describe, expect, it } from 'vitest'
import { computeThinLens } from './thinLens'
import { computeRefraction } from './refraction'
import { computeDiffraction } from './diffraction'
import { computePsfMtf } from './psfMtf'

const MARKDOWN_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: 'Markdown 加粗 **', re: /\*\*/ },
  { name: '反引号 `', re: /`/ },
  { name: 'Markdown 标题 #', re: /(^|\s)#{1,6}\s/ },
  { name: 'Markdown 链接 ](', re: /\]\(/ },
  { name: 'Markdown 列表 - ', re: /(^|\n)\s*[-*+]\s/ },
]

function collectText(): string[] {
  const lens = computeThinLens({
    lensType: 'convex',
    focalLength: 100,
    objectDistance: 300,
    objectHeight: 15,
    apertureDiameter: 40,
    rayCount: 11,
  })
  const lensVirtual = computeThinLens({
    lensType: 'concave',
    focalLength: 100,
    objectDistance: 60,
    objectHeight: 15,
    apertureDiameter: 10,
    rayCount: 11,
  })
  const lensInvalid = computeThinLens({
    lensType: 'convex',
    focalLength: 0,
    objectDistance: 0,
    objectHeight: -1,
    apertureDiameter: 0,
  })
  const refr = computeRefraction({ incidenceAngleDeg: 60, n1: 1.333, n2: 1.000293, wavelengthNm: 550 })
  const refrInvalid = computeRefraction({ incidenceAngleDeg: 90, n1: 0.5, n2: 5, wavelengthNm: 0 })
  const diff = computeDiffraction({
    wavelengthNm: 550,
    fNumber: 1.2,
    apertureDiameterMm: 25,
    magnification: 20,
  })
  const diffInvalid = computeDiffraction({
    wavelengthNm: 100,
    fNumber: 0.1,
    apertureDiameterMm: 0,
    magnification: 0,
  })
  const psf = computePsfMtf({ wavelengthNm: 550, fNumber: 8, defocusWaves: 0.6 })
  const psfInvalid = computePsfMtf({ wavelengthNm: 100, fNumber: 0.1, defocusWaves: 20 })

  const results = [lens, lensVirtual, lensInvalid, refr, refrInvalid, diff, diffInvalid, psf, psfInvalid]
  const out: string[] = []
  for (const r of results) {
    out.push(...r.errors, ...r.warnings, ...r.notes)
  }
  return out
}

describe('面向用户的文本不含 Markdown 标记', () => {
  it('errors / warnings / notes 全部是纯文本', () => {
    const texts = collectText()
    expect(texts.length).toBeGreaterThan(10)
    for (const text of texts) {
      for (const { name, re } of MARKDOWN_PATTERNS) {
        expect(re.test(text), `文本命中「${name}」：${text}`).toBe(false)
      }
    }
  })

  it('文本非空且不含未替换的占位符', () => {
    for (const text of collectText()) {
      expect(text.trim().length).toBeGreaterThan(0)
      expect(text).not.toContain('undefined')
      expect(text).not.toContain('NaN')
      expect(text).not.toContain('${')
    }
  })
})

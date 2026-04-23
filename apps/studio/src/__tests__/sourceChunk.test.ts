import { describe, expect, it } from 'vitest'
import { chunkByHeadings } from '../utils/sourceChunk'
import { estimateTokens } from '../utils/tokenEstimate'

describe('chunkByHeadings', () => {
  it('returns empty array for empty text', () => {
    expect(chunkByHeadings('', { targetTokens: 100 })).toEqual([])
    expect(chunkByHeadings('   \n  \n', { targetTokens: 100 })).toEqual([])
  })

  it('keeps a single small section as one segment', () => {
    const text = '# Title\n\nShort body.'
    const segs = chunkByHeadings(text, { targetTokens: 500 })
    expect(segs).toHaveLength(1)
    expect(segs[0].heading).toBe('Title')
    expect(segs[0].body).toContain('Short body')
  })

  it('splits on H1/H2 headings into separate segments', () => {
    const text = `# Intro\n\nFirst paragraph.\n\n## Details\n\nSecond paragraph.`
    const segs = chunkByHeadings(text, { targetTokens: 500 })
    expect(segs).toHaveLength(2)
    expect(segs[0].heading).toBe('Intro')
    expect(segs[1].heading).toBe('Details')
  })

  it('uses a fallback heading when text has no headings', () => {
    const text = 'Just a paragraph without any heading.'
    const segs = chunkByHeadings(text, { targetTokens: 500 })
    expect(segs).toHaveLength(1)
    expect(segs[0].heading).toBe('段落')
  })

  it('subdivides a single section that exceeds the target tokens', () => {
    const paragraph = '这是一句话。'.repeat(200) // ~1200 CJK tokens estimated
    const text = `# Long\n\n${paragraph}\n\n${paragraph}\n\n${paragraph}`
    const segs = chunkByHeadings(text, { targetTokens: 500 })
    // Must split into multiple buckets
    expect(segs.length).toBeGreaterThan(1)
    for (const s of segs) {
      // Each bucket should not drastically exceed the target
      expect(s.tokenEstimate).toBeLessThan(1500)
    }
  })

  it('annotates buckets with (i/n) suffix when a section is split', () => {
    const paragraph = '这是一句话。'.repeat(200)
    const text = `# Long\n\n${paragraph}\n\n${paragraph}\n\n${paragraph}`
    const segs = chunkByHeadings(text, { targetTokens: 500 })
    if (segs.length > 1) {
      expect(segs[0].heading).toMatch(/Long \(1\//)
      expect(segs.at(-1)!.heading).toMatch(/\d+\)$/)
    }
  })

  it('assigns sequential indices starting at 0', () => {
    const text = `# A\n\nA body\n\n# B\n\nB body\n\n# C\n\nC body`
    const segs = chunkByHeadings(text, { targetTokens: 500 })
    expect(segs.map(s => s.index)).toEqual([0, 1, 2])
  })

  it('computes tokenEstimate for each segment', () => {
    const text = `# Section\n\nSome English text here to count.`
    const segs = chunkByHeadings(text, { targetTokens: 500 })
    expect(segs[0].tokenEstimate).toBeGreaterThan(0)
    expect(segs[0].tokenEstimate).toBeLessThanOrEqual(estimateTokens(segs[0].body))
  })

  it('prepends overlap tail from previous segment when overlapTokens > 0', () => {
    const text = `# A\n\nfirst section body with distinguishable tail.\n\n# B\n\nsecond body start.`
    const segs = chunkByHeadings(text, { targetTokens: 500, overlapTokens: 10 })
    expect(segs).toHaveLength(2)
    // The second segment should contain some tail of the first
    expect(segs[1].body).toMatch(/tail|section|first/)
  })

  it('does not prepend overlap when overlapTokens is 0 (default)', () => {
    const text = `# A\n\nabc\n\n# B\n\nxyz`
    const segs = chunkByHeadings(text, { targetTokens: 500 })
    expect(segs[1].body.trim()).toBe('xyz')
  })

  it('ignores sections that are empty after trimming', () => {
    const text = `# Empty\n\n   \n\n# Real\n\nBody.`
    const segs = chunkByHeadings(text, { targetTokens: 500 })
    expect(segs).toHaveLength(1)
    expect(segs[0].heading).toBe('Real')
  })
})

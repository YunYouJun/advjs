import { describe, expect, it } from 'vitest'
import { parseSource } from '../utils/sourceParser'

describe('parseSource — text', () => {
  it('derives title from the first H1 heading in the body', async () => {
    const src = await parseSource({ type: 'text', content: '# 我的故事\n\n从前有座山。' })
    expect(src.title).toBe('我的故事')
    expect(src.type).toBe('text')
    expect(src.segments.length).toBeGreaterThan(0)
  })

  it('falls back to filename when no heading is found', async () => {
    const src = await parseSource({ type: 'text', content: 'No headings here.', filename: 'note.txt' })
    expect(src.title).toBe('note')
  })

  it('uses 未命名素材 when neither heading nor filename is available', async () => {
    const src = await parseSource({ type: 'text', content: '' })
    expect(src.title).toBe('未命名素材')
  })

  it('exposes totalTokens and segmentCount in metadata', async () => {
    const src = await parseSource({ type: 'text', content: '# Title\n\nBody content.' })
    expect(src.metadata.segmentCount).toBe(src.segments.length)
    expect(src.metadata.totalTokens).toBeGreaterThan(0)
  })
})

describe('parseSource — markdown', () => {
  it('parses YAML frontmatter and surfaces string/number values into metadata', async () => {
    const raw = `---\ntitle: 我的手册\nversion: 3\n---\n\n# Body heading\n\nContent.`
    const src = await parseSource({ type: 'markdown', content: raw })
    expect(src.title).toBe('我的手册')
    expect(src.metadata.version).toBe(3)
  })

  it('tolerates malformed frontmatter and still parses the body', async () => {
    const raw = `---\nthis is: not: valid: yaml\n---\n\n# Still works\n\nOK.`
    const src = await parseSource({ type: 'markdown', content: raw })
    expect(src.title).toBe('Still works')
  })

  it('returns the raw input for debugging', async () => {
    const raw = `# Title\nHello.`
    const src = await parseSource({ type: 'markdown', content: raw })
    expect(src.raw).toBe(raw)
  })
})

describe('parseSource — chat-log', () => {
  it('parses JSON chat logs into a transcript with speaker stats', async () => {
    const raw = JSON.stringify([
      { speaker: 'Alice', content: 'Hello!' },
      { speaker: 'Bob', content: 'Hi.' },
      { speaker: 'Alice', content: 'How are you?' },
    ])
    const src = await parseSource({ type: 'chat-log', content: raw })
    expect(src.type).toBe('chat-log')
    expect(src.metadata.speakerCount).toBe(2)
    expect(src.metadata.messageCount).toBe(3)
    // Chat logs always suggest the customer-service template
    expect(src.suggestedTemplateId).toBe('customer-service')
  })

  it('parses plain "Speaker: message" transcripts', async () => {
    const raw = `Alice：你好！\nBob：早。\nAlice：吃了吗？`
    const src = await parseSource({ type: 'chat-log', content: raw })
    expect(src.metadata.messageCount).toBe(3)
    expect(src.metadata.speakers).toContain('Alice')
  })

  it('parses WeChat-export style timestamped logs', async () => {
    const raw = `[2024-01-01 12:00:00] Alice\nHello world\n[2024-01-01 12:01:00] Bob\nHi there`
    const src = await parseSource({ type: 'chat-log', content: raw })
    expect(src.metadata.messageCount).toBe(2)
  })
})

describe('parseSource — template suggestion heuristics', () => {
  it('suggests training-drill when SOP/合规 keywords appear', async () => {
    const src = await parseSource({
      type: 'text',
      content: '# 客诉处理 SOP\n\n员工必须遵循合规流程。',
    })
    expect(src.suggestedTemplateId).toBe('training-drill')
  })

  it('suggests life-story for reminiscence-flavored text', async () => {
    const src = await parseSource({
      type: 'text',
      content: '# 奶奶的一生\n\n我记得小时候外婆和我说过……',
    })
    expect(src.suggestedTemplateId).toBe('life-story')
  })

  it('suggests anti-fraud for scam-related keywords', async () => {
    const src = await parseSource({
      type: 'text',
      content: '# 反诈案例\n\n不法分子冒充公检法实施诈骗。',
    })
    expect(src.suggestedTemplateId).toBe('anti-fraud')
  })

  it('leaves suggestion undefined when no keywords match', async () => {
    const src = await parseSource({
      type: 'text',
      content: 'Random technical content about algorithms and graph theory.',
    })
    expect(src.suggestedTemplateId).toBeUndefined()
  })
})

describe('parseSource — unsupported types', () => {
  it('throws for pdf (Week 3 scope)', async () => {
    await expect(parseSource({ type: 'pdf', content: '' })).rejects.toThrow(/Week 3/)
  })

  it('throws for url (Week 3 scope)', async () => {
    await expect(parseSource({ type: 'url', content: '' })).rejects.toThrow(/Week 3/)
  })
})

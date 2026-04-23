import type { AiBridge } from '../utils/projectGenerator'
import { describe, expect, it } from 'vitest'
import { generateProject } from '../utils/projectGenerator'
import { parseSource } from '../utils/sourceParser'
import { getTemplate } from '../utils/templates/loadTemplate'

// ---------------------------------------------------------------------------
// Mock AI bridge: returns scripted JSON per step
// ---------------------------------------------------------------------------

interface ScriptedResponse {
  /** Optional predicate to match a request. If omitted the response applies in order. */
  match?: (messages: { role: string, content: string }[]) => boolean
  content: string
}

function createScriptedBridge(responses: ScriptedResponse[]): AiBridge {
  let cursor = 0
  return {
    isConfigured: () => true,
    async request(messages) {
      // Try predicate-matched responses first
      for (const r of responses) {
        if (r.match && r.match(messages as any))
          return r.content
      }
      // Otherwise serve the next ordered response
      const next = responses[cursor++]
      if (!next)
        throw new Error(`[mock] no response for request #${cursor}`)
      return next.content
    },
  }
}

function charactersJson() {
  return JSON.stringify({
    characters: [
      {
        id: 'grandma',
        name: '奶奶',
        tags: ['长辈'],
        voiceHint: 'warm-elder',
        personality: '温和、坚韧',
        background: '出生于海边渔村。',
        speechStyle: '平静，不急不缓。',
      },
      {
        id: 'grandchild',
        name: '小孙',
        voiceHint: 'warm-young',
        personality: '好奇',
        background: '城市里长大的大学生。',
      },
    ],
  })
}

function chapterJson(i: number, phase: string) {
  return JSON.stringify({
    chapter: {
      filename: `${String(i).padStart(2, '0')}-${phase}.adv.md`,
      title: `第 ${i} 章 · ${phase}`,
      phase,
      plotSummary: `${phase} 的梗概`,
      body: `【海边，清晨，外景】\n@grandma\n「你还记得那年的海吗？」\n\n- 还记得\n- 记不太清了`,
      choices: [
        { label: '还记得' },
        { label: '记不太清了' },
      ],
      sceneRefs: ['seaside'],
    },
  })
}

function scenesJson() {
  return JSON.stringify({
    scenes: [
      {
        id: 'seaside',
        name: '海边',
        description: '渔村清晨的海边',
        imagePrompt: 'A quiet seaside fishing village at dawn',
        type: 'image',
        linkedLocation: 'village-shore',
      },
    ],
    locations: [
      {
        id: 'village-shore',
        name: '渔村海岸',
        type: 'outdoor',
        description: '奶奶童年的故乡海岸',
      },
    ],
  })
}

function knowledgeJson() {
  return JSON.stringify({
    entries: [
      { id: 'fishing-village', title: '渔村背景', domain: '时代', body: '80 年代东南沿海渔村的日常。' },
    ],
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function buildOpts(overrides?: { aiBridge?: AiBridge }) {
  const source = await parseSource({
    type: 'text',
    content: '# 奶奶的一生\n\n从海边的小村说起…',
  })
  const template = getTemplate('life-story')!
  return {
    source,
    template,
    projectName: '奶奶的一生',
    projectSlug: 'grandma-story',
    ...overrides,
  }
}

describe('generateProject — happy path', () => {
  it('produces character, chapter, scene, location, knowledge, readme, world, outline, and import-log files', async () => {
    const template = getTemplate('life-story')!
    const responses: ScriptedResponse[] = [
      { content: charactersJson() },
      ...template.chapterStructure.map((p, i) => ({ content: chapterJson(i + 1, p.phase) })),
      { content: scenesJson() },
      { content: knowledgeJson() },
    ]
    const bridge = createScriptedBridge(responses)

    const res = await generateProject(await buildOpts({ aiBridge: bridge }))

    expect(res.draftMode).toBe(false)
    expect(res.failedSteps).toEqual([])
    expect(res.stats.characters).toBe(2)
    expect(res.stats.chapters).toBe(template.chapterStructure.length)
    expect(res.stats.scenes).toBe(1)
    expect(res.stats.locations).toBe(1)
    expect(res.stats.knowledge).toBe(1)

    const paths = res.files.map(f => f.path)
    expect(paths).toContain('README.md')
    expect(paths).toContain('adv/world.md')
    expect(paths).toContain('adv/outline.md')
    expect(paths).toContain('adv/.import-log.md')
    expect(paths).toContain('adv/characters/grandma.character.md')
    expect(paths).toContain('adv/characters/grandchild.character.md')
    expect(paths).toContain('adv/scenes/seaside.md')
    expect(paths).toContain('adv/locations/village-shore.md')
    expect(paths.some(p => p.startsWith('adv/chapters/'))).toBe(true)
    expect(paths.some(p => p.startsWith('adv/knowledge/'))).toBe(true)

    // Character file is valid YAML frontmatter + body
    const grandma = res.files.find(f => f.path === 'adv/characters/grandma.character.md')!
    expect(grandma.content).toContain('id: grandma')
    expect(grandma.content).toContain('name: 奶奶')

    // Chapter file body preserves AdvScript-style scene header
    const chapter = res.files.find(f => f.path.startsWith('adv/chapters/'))!
    expect(chapter.content).toContain('【海边')
    expect(chapter.content).toContain('@grandma')
  })
})

describe('generateProject — graceful degradation', () => {
  it('propagates error and aborts if characters step fails', async () => {
    const bridge = createScriptedBridge([
      // invalid JSON twice (PARSE_RETRIES = 1, so 2 attempts total)
      { content: 'not valid json' },
      { content: 'still not valid' },
    ])
    await expect(generateProject(await buildOpts({ aiBridge: bridge }))).rejects.toThrow()
  })

  it('flips draftMode when scenes step fails but earlier steps succeeded', async () => {
    const template = getTemplate('life-story')!
    const bridge = createScriptedBridge([
      { content: charactersJson() },
      ...template.chapterStructure.map((p, i) => ({ content: chapterJson(i + 1, p.phase) })),
      // invalid scenes JSON twice
      { content: 'not valid' },
      { content: 'also not valid' },
      // then knowledge still succeeds
      { content: knowledgeJson() },
    ])
    const res = await generateProject(await buildOpts({ aiBridge: bridge }))
    expect(res.draftMode).toBe(true)
    expect(res.failedSteps).toContain('scenes')
    expect(res.stats.scenes).toBe(0)
    expect(res.stats.characters).toBe(2)
    expect(res.stats.chapters).toBe(template.chapterStructure.length)
    expect(res.stats.knowledge).toBe(1)
  })

  it('continues after a single chapter failure and marks the step as failed', async () => {
    const template = getTemplate('life-story')!
    // Pattern: first chapter invalid ×2 retries, remaining chapters valid, then scenes + knowledge valid
    const responses: ScriptedResponse[] = [
      { content: charactersJson() },
      { content: 'not valid' },
      { content: 'not valid again' },
      ...template.chapterStructure.slice(1).map((p, i) => ({ content: chapterJson(i + 2, p.phase) })),
      { content: scenesJson() },
      { content: knowledgeJson() },
    ]
    const bridge = createScriptedBridge(responses)
    const res = await generateProject(await buildOpts({ aiBridge: bridge }))
    expect(res.failedSteps).toContain('chapters')
    expect(res.stats.chapters).toBe(template.chapterStructure.length - 1)
    expect(res.draftMode).toBe(true)
  })
})

describe('generateProject — signal', () => {
  it('throws AbortError when signal is pre-aborted', async () => {
    const bridge = createScriptedBridge([
      { content: charactersJson() },
    ])
    const controller = new AbortController()
    controller.abort()
    await expect(generateProject({ ...await buildOpts({ aiBridge: bridge }), signal: controller.signal }))
      .rejects
      .toThrow(/abort/i)
  })
})

describe('generateProject — progress events', () => {
  it('emits start → complete for characters and eventually done', async () => {
    const template = getTemplate('life-story')!
    const bridge = createScriptedBridge([
      { content: charactersJson() },
      ...template.chapterStructure.map((p, i) => ({ content: chapterJson(i + 1, p.phase) })),
      { content: scenesJson() },
      { content: knowledgeJson() },
    ])
    const events: string[] = []
    await generateProject({
      ...await buildOpts({ aiBridge: bridge }),
      onProgress: e => events.push(`${e.step}:${e.phase}`),
    })
    expect(events).toContain('characters:start')
    expect(events).toContain('characters:complete')
    expect(events).toContain('chapters:start')
    expect(events).toContain('chapters:complete')
    expect(events).toContain('done:complete')
  })
})

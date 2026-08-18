import type { AdvCharacter } from '@advjs/types'
import type { AgentRequest, AgentRuntime } from '../agent/core/contracts'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  AGENT_TOOL_META,
  getAgentTool,
  invokeAgentTool,
  listAgentTools,
} from '../utils/aiAuthoring/agentRegistry'
import { generateChapterDraft } from '../utils/aiAuthoring/chapterDraftGenerator'
import {
  checkChapterConsistency,
  __internal as consistencyInternal,
} from '../utils/aiAuthoring/consistencyChecker'
import { generateOutline } from '../utils/aiAuthoring/outlineGenerator'
import {
  __internal as plotInternal,
  suggestPlot,
} from '../utils/aiAuthoring/plotSuggester'
import {
  buildChapterDraftPrompt,
  buildOutlinePrompt,
} from '../utils/aiAuthoring/prompts'
import {
  classifyError,
  fail,
  notConfiguredError,
  ok,
} from '../utils/aiAuthoring/result'
import {
  __internal as roleplayInternal,
  simulateRoleplay,
  transcriptToAdvScript,
} from '../utils/aiAuthoring/roleplaySimulator'
import { AiApiError } from '../utils/aiClient'

const characters: AdvCharacter[] = [
  {
    id: 'alice',
    name: '爱丽丝',
    personality: '温柔但腹黑',
    appearance: '银发红眸',
  } as AdvCharacter,
  {
    id: 'bob',
    name: '鲍勃',
    personality: '理性冷静',
  } as AdvCharacter,
]

describe('buildOutlinePrompt', () => {
  it('includes world.md content and character ids', () => {
    const prompt = buildOutlinePrompt({
      worldMd: '故事发生在 2089 年的赛博东京。',
      characters,
    })
    expect(prompt).toContain('故事发生在 2089 年的赛博东京。')
    expect(prompt).toContain('@alice')
    expect(prompt).toContain('@bob')
    expect(prompt).toContain('## 总览')
  })

  it('handles empty world.md gracefully', () => {
    const prompt = buildOutlinePrompt({
      worldMd: '',
      characters,
    })
    expect(prompt).toContain('世界设定为空')
    expect(prompt).toContain('@alice')
  })

  it('handles zero characters with a fallback note', () => {
    const prompt = buildOutlinePrompt({
      worldMd: 'world content',
      characters: [],
    })
    expect(prompt).toContain('暂无角色卡')
  })

  it('appends author hint when provided', () => {
    const prompt = buildOutlinePrompt({
      worldMd: 'w',
      characters,
      hint: '赛博朋克基调',
    })
    expect(prompt).toContain('作者引导')
    expect(prompt).toContain('赛博朋克基调')
  })

  it('omits hint section when hint is whitespace only', () => {
    const prompt = buildOutlinePrompt({
      worldMd: 'w',
      characters,
      hint: '   ',
    })
    expect(prompt).not.toContain('# 作者引导')
  })
})

describe('buildChapterDraftPrompt', () => {
  it('includes AdvScript syntax block and chapter info', () => {
    const prompt = buildChapterDraftPrompt({
      worldMd: 'world',
      outlineMd: 'outline',
      chapterTitle: '第一章 · 邂逅',
      chapterPlotSummary: '主角与神秘少女初次相遇',
      characters,
    })
    expect(prompt).toContain('AdvScript 语法')
    expect(prompt).toContain('@id 另起一行')
    expect(prompt).toContain('第一章 · 邂逅')
    expect(prompt).toContain('主角与神秘少女初次相遇')
    expect(prompt).toContain('@alice')
    expect(prompt).toContain('@bob')
    expect(prompt).toContain('不要 YAML frontmatter')
  })

  it('omits plot summary line when undefined', () => {
    const prompt = buildChapterDraftPrompt({
      worldMd: 'world',
      outlineMd: 'outline',
      chapterTitle: '第二章',
      characters,
    })
    expect(prompt).not.toContain('梗概：')
  })

  it('falls back to narration hint when no characters chosen', () => {
    const prompt = buildChapterDraftPrompt({
      worldMd: 'world',
      outlineMd: 'outline',
      chapterTitle: 'ch3',
      characters: [],
    })
    expect(prompt).toContain('保守使用旁白叙述')
  })
})

describe('generator guards (AI not configured)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('generateOutline returns not_configured error when AI is not configured', async () => {
    const result = await generateOutline({
      worldMd: 'w',
      characters,
    })
    expect(result.data).toBeUndefined()
    expect(result.error?.type).toBe('not_configured')
    expect(result.error?.retryable).toBe(false)
  })

  it('generateChapterDraft returns not_configured error when AI is not configured', async () => {
    const result = await generateChapterDraft({
      worldMd: 'w',
      outlineMd: 'o',
      chapter: { filename: 'ch.adv.md', title: 'ch', content: '' },
      characters,
    })
    expect(result.error?.type).toBe('not_configured')
  })

  it('suggestPlot returns not_configured error when AI is not configured', async () => {
    const result = await suggestPlot({
      chapter: { filename: 'ch.adv.md', title: 'ch', content: '' },
      characters,
    })
    expect(result.error?.type).toBe('not_configured')
  })

  it('simulateRoleplay returns not_configured error when AI is not configured', async () => {
    const result = await simulateRoleplay({
      characters,
      goal: 'meet for the first time',
    })
    expect(result.error?.type).toBe('not_configured')
  })

  it('simulateRoleplay surfaces error when input is invalid', async () => {
    // Configure check fires first (not_configured); when configured + empty
    // characters, the function returns the 'unknown' (invalid input) variant.
    const result = await simulateRoleplay({
      characters: [],
      goal: 'meet',
    })
    expect(result.error?.retryable).toBe(false)
    expect(['not_configured', 'unknown']).toContain(result.error?.type)
  })

  it('checkChapterConsistency returns not_configured error when AI is not configured', async () => {
    const result = await checkChapterConsistency({
      chapter: { filename: 'ch.adv.md', title: 'ch', content: 'body' },
      characters,
    })
    expect(result.error?.type).toBe('not_configured')
  })
})

describe('plotSuggester validate', () => {
  it('parses well-formed suggestions and trims whitespace', () => {
    const out = plotInternal.validate({
      suggestions: [
        { label: ' Twist  ', synopsis: '  things go sideways  ', hook: 'gun reveal' },
        { label: 'Calm', synopsis: 'tea time' },
      ],
    })
    expect(out).toEqual([
      { label: 'Twist', synopsis: 'things go sideways', hook: 'gun reveal' },
      { label: 'Calm', synopsis: 'tea time', hook: '' },
    ])
  })

  it('throws when no valid suggestion exists', () => {
    expect(() => plotInternal.validate({ suggestions: [{ label: null }] })).toThrow()
  })

  it('builds prompt including chapter title and characters', () => {
    const prompt = plotInternal.buildPrompt({
      chapter: { filename: 'c.adv.md', title: '第三章', content: 'body' },
      characters,
    })
    expect(prompt).toContain('第三章')
    expect(prompt).toContain('@alice')
    expect(prompt).toContain('JSON Schema')
  })
})

describe('consistencyChecker validate', () => {
  it('normalizes unknown kind/severity to defaults', () => {
    const out = consistencyInternal.validate({
      issues: [
        { kind: 'made-up', severity: 'critical', title: 'X', detail: 'Y' },
        { kind: 'timeline', severity: 'error', title: 'T', detail: 'D', suggestion: 'S', characterId: 'alice' },
      ],
    })
    expect(out).toHaveLength(2)
    expect(out[0]).toMatchObject({ kind: 'other', severity: 'warn' })
    expect(out[1]).toMatchObject({ kind: 'timeline', severity: 'error', characterId: 'alice', suggestion: 'S' })
  })

  it('returns empty array when issues field is missing/invalid', () => {
    expect(consistencyInternal.validate({})).toEqual([])
    expect(consistencyInternal.validate({ issues: 'nope' })).toEqual([])
  })

  it('skips items without title/detail', () => {
    const out = consistencyInternal.validate({
      issues: [
        { kind: 'continuity' },
        { kind: 'continuity', severity: 'info', title: 'ok', detail: 'd' },
      ],
    })
    expect(out).toHaveLength(1)
  })
})

describe('roleplaySimulator', () => {
  it('buildLinePrompt includes speaker identity, goal and history snapshot', () => {
    const prompt = roleplayInternal.buildLinePrompt({
      speaker: characters[0],
      others: [characters[1]],
      worldMd: 'cyberpunk Tokyo',
      goal: '初次见面',
      history: [{ speakerId: 'bob', speakerName: '鲍勃', content: '你好' }],
    })
    expect(prompt).toContain('爱丽丝')
    expect(prompt).toContain('@alice')
    expect(prompt).toContain('初次见面')
    expect(prompt).toContain('鲍勃：你好')
    expect(prompt).toContain('cyberpunk Tokyo')
  })

  it('transcriptToAdvScript renders @id + content pairs', () => {
    const advScript = transcriptToAdvScript([
      { speakerId: 'alice', speakerName: '爱丽丝', content: '你好' },
      { speakerId: 'bob', speakerName: '鲍勃', content: '幸会' },
    ])
    expect(advScript).toBe('@alice\n你好\n\n@bob\n幸会')
  })
})

describe('agentRegistry', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('exposes all five tools with stable metadata', () => {
    const ids = Object.keys(AGENT_TOOL_META).sort()
    expect(ids).toEqual([
      'check-consistency',
      'generate-chapter-draft',
      'generate-outline',
      'simulate-roleplay',
      'suggest-plot',
    ])
    for (const meta of Object.values(AGENT_TOOL_META)) {
      expect(meta.id).toBeTruthy()
      expect(meta.name).toBeTruthy()
      expect(meta.description).toBeTruthy()
      expect(['planning', 'drafting', 'review']).toContain(meta.category)
    }
  })

  it('listAgentTools is grouped by category', () => {
    const tools = listAgentTools()
    const categories = tools.map(t => t.category)
    // category order should be non-decreasing after sort by category then id
    const sorted = categories.slice().sort()
    expect(categories).toEqual(sorted)
  })

  it('getAgentTool returns undefined for unknown ids', () => {
    expect(getAgentTool('nope')).toBeUndefined()
    expect(getAgentTool('generate-outline')).toBeDefined()
  })

  it('invokeAgentTool routes semantic input through the selected runtime', async () => {
    let captured: AgentRequest<unknown> | undefined
    const runtime: AgentRuntime = {
      start: async (request) => {
        captured = request
        return {
          taskId: 'task_registry_fixture',
          events: (async function* () {})(),
          result: Promise.resolve({
            taskId: 'task_registry_fixture',
            usage: {
              inputTokens: 1,
              outputTokens: 1,
              totalTokens: 2,
              providerCostMicroCny: 0,
              chargedMicroPoints: 0,
            },
          }),
        }
      },
      resume: async () => { throw new Error('not used') },
      getTask: async () => { throw new Error('not used') },
      cancel: async () => {},
    }
    const result = await invokeAgentTool(runtime, 'generate-outline', {
      clientRequestId: 'registry_fixture_001',
      input: { hint: '赛博朋克基调' },
      locale: 'zh-CN',
      project: {
        id: 'project_fixture',
        revision: 'revision_fixture',
        files: { 'adv/world.md': 'world' },
      },
    })
    expect(result.taskId).toBe('task_registry_fixture')
    expect(captured).toMatchObject({
      capability: 'generate-outline',
      input: { hint: '赛博朋克基调' },
    })
  })

  it('invokeAgentTool throws on unknown id', async () => {
    await expect(
      // @ts-expect-error testing runtime guard
      invokeAgentTool({} as AgentRuntime, 'made-up-tool', {}),
    ).rejects.toThrow(/Unknown agent tool/)
  })
})

describe('classifyError', () => {
  it('maps AiApiError auth → non-retryable auth', () => {
    const out = classifyError(new AiApiError('bad key', 'auth'))
    expect(out.type).toBe('auth')
    expect(out.retryable).toBe(false)
  })

  it('maps AiApiError rate_limit → retryable', () => {
    const out = classifyError(new AiApiError('429', 'rate_limit'))
    expect(out.type).toBe('rate_limit')
    expect(out.retryable).toBe(true)
  })

  it('maps AiApiError network → retryable', () => {
    const out = classifyError(new AiApiError('offline', 'network'))
    expect(out.type).toBe('network')
    expect(out.retryable).toBe(true)
  })

  it('maps AiApiError timeout → retryable', () => {
    const out = classifyError(new AiApiError('slow', 'timeout'))
    expect(out.type).toBe('timeout')
    expect(out.retryable).toBe(true)
  })

  it('maps AiApiError not_found → non-retryable', () => {
    const out = classifyError(new AiApiError('missing model', 'not_found'))
    expect(out.type).toBe('not_found')
    expect(out.retryable).toBe(false)
  })

  it('maps AiApiError api_error → unknown / retryable', () => {
    const out = classifyError(new AiApiError('500', 'api_error'))
    expect(out.type).toBe('unknown')
    expect(out.retryable).toBe(true)
  })

  it('maps AbortError → aborted / non-retryable', () => {
    const err = new Error('aborted')
    err.name = 'AbortError'
    const out = classifyError(err)
    expect(out.type).toBe('aborted')
    expect(out.retryable).toBe(false)
  })

  it('falls back to unknown for arbitrary errors', () => {
    const out = classifyError(new Error('boom'))
    expect(out.type).toBe('unknown')
    expect(out.retryable).toBe(true)
    expect(out.message).toBe('boom')
  })

  it('handles non-Error throwables', () => {
    const out = classifyError('string error')
    expect(out.type).toBe('unknown')
    expect(out.message).toBe('string error')
  })

  it('notConfiguredError() returns a non-retryable not_configured error', () => {
    const e = notConfiguredError()
    expect(e.type).toBe('not_configured')
    expect(e.retryable).toBe(false)
  })

  it('ok / fail helpers produce well-typed results', () => {
    const success = ok(42)
    expect(success.data).toBe(42)
    expect(success.error).toBeUndefined()

    const failure = fail({ type: 'network', message: 'x', retryable: true })
    expect(failure.data).toBeUndefined()
    expect(failure.error?.type).toBe('network')
  })
})

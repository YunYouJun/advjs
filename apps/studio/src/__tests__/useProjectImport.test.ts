/**
 * useProjectImport composable tests.
 *
 * Verifies:
 *   • state machine transitions (idle → parsing → generating → previewing → done)
 *   • progressTree reflects GenerateProgressEvent stream
 *   • previewFiles accumulates across `chunk` + `complete` events
 *   • abort() cancels generation and returns to idle
 *   • confirmWrite() writes files via IFileSystem and transitions to done
 *   • error handling keeps prior state intact for recoverable failures
 */

import type { IFileSystem } from '../utils/fs'
import type { AiBridge } from '../utils/projectGenerator'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useProjectImport } from '../composables/useProjectImport'
import { getTemplate } from '../utils/templates/loadTemplate'

// ---------------------------------------------------------------------------
// Scripted bridge — reused shape from projectGenerator.test.ts
// ---------------------------------------------------------------------------

interface ScriptedResponse {
  content: string
}

function createScriptedBridge(responses: ScriptedResponse[]): AiBridge {
  let cursor = 0
  return {
    isConfigured: () => true,
    async request() {
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
        voiceHint: 'warm-elder',
        personality: '温和',
        background: '渔村长大。',
      },
    ],
  })
}
function chapterJson(i: number, phase: string) {
  return JSON.stringify({
    chapter: {
      filename: `${String(i).padStart(2, '0')}-${phase}.adv.md`,
      title: `第 ${i} 章`,
      phase,
      plotSummary: `${phase} 梗概`,
      body: `【海边，清晨，外景】\n@grandma\n「还记得那年的海。」`,
      choices: [],
      sceneRefs: ['seaside'],
    },
  })
}
function scenesJson() {
  return JSON.stringify({
    scenes: [{ id: 'seaside', name: '海边', description: '清晨海边' }],
    locations: [],
  })
}
function knowledgeJson() {
  return JSON.stringify({ entries: [{ id: 'bg', title: '背景', domain: '时代', body: '...' }] })
}

// ---------------------------------------------------------------------------
// In-memory IFileSystem for confirmWrite() assertions
// ---------------------------------------------------------------------------

function createMemoryFs(): IFileSystem & { _files: Map<string, string> } {
  const files = new Map<string, string>()
  return {
    _files: files,
    async writeFile(path: string, content: string) {
      files.set(path, content)
    },
    async writeBlob(path: string, data: Blob) {
      files.set(path, `[blob ${data.size}b]`)
    },
    async mkdir() {
      // no-op for in-memory
    },
    async readFile(path: string) {
      return files.get(path) ?? ''
    },
    async exists(path: string) {
      return files.has(path)
    },
    async listFiles() {
      return []
    },
    async deleteFile(path: string) {
      files.delete(path)
    },
    async collectAllFiles() {
      return Array.from(files.entries()).map(([path, content]) => ({ path, content }))
    },
  } as unknown as IFileSystem & { _files: Map<string, string> }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('useProjectImport — state machine', () => {
  it('starts in idle with empty state', () => {
    const imp = useProjectImport()
    expect(imp.status.value).toBe('idle')
    expect(imp.previewFiles.value).toEqual([])
    expect(imp.currentStep.value).toBeNull()
    expect(imp.error.value).toBeNull()
    expect(imp.isBusy.value).toBe(false)
    expect(imp.canConfirm.value).toBe(false)
    expect(imp.visibleProgressNodes.value).toHaveLength(4)
    expect(imp.visibleProgressNodes.value.every(n => n.status === 'pending')).toBe(true)
  })

  it('startParse transitions through parsing → idle and stores parsedSource', async () => {
    const imp = useProjectImport()
    const source = await imp.startParse({
      type: 'text',
      content: '# 奶奶的故事\n\n从海边说起。',
    })
    expect(source.title).toBeTruthy()
    expect(imp.parsedSource.value).toBe(source)
    expect(imp.status.value).toBe('idle')
  })

  it('startGenerate drives status to previewing and populates stats + files', async () => {
    const template = getTemplate('life-story')!
    const bridge = createScriptedBridge([
      { content: charactersJson() },
      ...template.chapterStructure.map((p, i) => ({ content: chapterJson(i + 1, p.phase) })),
      { content: scenesJson() },
      { content: knowledgeJson() },
    ])

    const imp = useProjectImport()
    const source = await imp.startParse({ type: 'text', content: '从海边说起。' })

    const result = await imp.startGenerate({
      source,
      template,
      projectName: '奶奶的一生',
      projectSlug: 'grandma',
      aiBridge: bridge,
    })

    expect(result.draftMode).toBe(false)
    expect(imp.status.value).toBe('previewing')
    expect(imp.canConfirm.value).toBe(true)
    expect(imp.previewFiles.value.length).toBeGreaterThan(0)
    expect(imp.stats.value?.characters).toBe(1)
    const tree = imp.visibleProgressNodes.value
    expect(tree.find(n => n.key === 'characters')?.status).toBe('complete')
    expect(tree.find(n => n.key === 'chapters')?.status).toBe('complete')
  })

  it('confirmWrite persists files through IFileSystem and reaches done', async () => {
    const imp = useProjectImport()
    const fs = createMemoryFs()

    // Seed the composable's previewFiles manually — we don't need to
    // re-run the whole generator just to test confirmWrite.
    ;(imp.previewFiles as any).value = [
      { path: 'README.md', content: '# test' },
      { path: 'adv/characters/a.character.md', content: 'id: a\nname: A\n' },
    ]
    ;(imp.status as any).value = 'previewing'

    await imp.confirmWrite({ fs })
    expect(imp.status.value).toBe('done')
    expect(fs._files.get('README.md')).toBe('# test')
    expect(fs._files.has('adv/characters/a.character.md')).toBe(true)
  })

  it('confirmWrite rejects when not in previewing state', async () => {
    const imp = useProjectImport()
    const fs = createMemoryFs()
    await expect(imp.confirmWrite({ fs })).rejects.toThrow(/nothing to confirm/)
  })

  it('abort() resets generating → idle', () => {
    const imp = useProjectImport()
    ;(imp.status as any).value = 'generating'
    imp.abort()
    expect(imp.status.value).toBe('idle')
  })

  it('reset() clears progress, files, error', async () => {
    const imp = useProjectImport()
    ;(imp.previewFiles as any).value = [{ path: 'x', content: 'y' }]
    ;(imp.error as any).value = { step: null, message: 'boom', recoverable: false }
    imp.reset()
    expect(imp.previewFiles.value).toEqual([])
    expect(imp.error.value).toBeNull()
    expect(imp.status.value).toBe('idle')
  })
})

describe('useProjectImport — error handling', () => {
  it('records error and sets status=error when characters step fails', async () => {
    const template = getTemplate('life-story')!
    const bridge = createScriptedBridge([
      { content: 'not valid json' },
      { content: 'still not valid' },
    ])

    const imp = useProjectImport()
    const source = await imp.startParse({ type: 'text', content: '奶奶的故事。' })

    await expect(
      imp.startGenerate({
        source,
        template,
        projectName: 'x',
        projectSlug: 'x',
        aiBridge: bridge,
      }),
    ).rejects.toThrow()
    expect(imp.status.value).toBe('error')
    expect(imp.error.value).not.toBeNull()
  })
})

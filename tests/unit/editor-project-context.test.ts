import type { EditorProjectModel } from '../../editor/core/app/adapters/browser/project'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { shallowReactive } from 'vue'
import { compileEditorProject } from '../../editor/core/app/adapters/browser/project'
import { useProjectContextStore } from '../../editor/core/app/stores/useProjectContextStore'
import { collectProjectContext } from '../../editor/core/app/workspaces/context'

afterEach(() => vi.unstubAllGlobals())

async function createProject(world = 'Only the three protagonists have special abilities', root = 'story') {
  const prefix = `${root.split('/').filter(segment => segment && segment !== '.').join('/')}/`
  return await compileEditorProject({
    files: {
      'adv.config.json': JSON.stringify({ id: 'taoyuan', root }),
      [`${prefix}world.md`]: world,
      [`${prefix}outline.md`]: 'Build a workshop',
      [`${prefix}characters/liu-bei.character.md`]: '---\nid: liu-bei\nname: Liu Bei\n---\n\n## 背景\n\nCodex knowledge\n',
      [`${prefix}chapters/intro.adv.md`]: '> A lasting harvest\n',
      [`${prefix}scenes/taoyuan.md`]: '---\nid: taoyuan\nname: Peach Garden\n---\n',
      'docs/private-notes.md': 'unrelated author notes',
      '.env': 'NEVER_EXPORT=secret',
    },
  })
}

describe('saved editor author context', () => {
  it.each(['adv', 'story', './story/'])('uses the compiled %s root and source maps without README indexes', async (root) => {
    const model = await createProject(undefined, root)
    expect(model.compilation.diagnostics.filter(item => item.severity === 'error')).toEqual([])
    const context = collectProjectContext(model)
    const exported = context.sections.map(section => section.content).join('\n')

    expect(context.worldContent).toBe('Only the three protagonists have special abilities')
    expect(context.stats).toEqual({ chapters: 1, characters: 1, scenes: 1 })
    expect(context.charsReadme).toBe('')
    expect(exported).toContain('Codex knowledge')
    expect(exported).toContain('A lasting harvest')
    expect(exported).toContain('Peach Garden')
    expect(exported).not.toContain('unrelated author notes')
    expect(exported).not.toContain('NEVER_EXPORT')
  })

  it('follows late connection, saved changes, project replacement and closing', async () => {
    const workspace = shallowReactive<{ project?: EditorProjectModel }>({})
    vi.stubGlobal('useProjectStore', () => workspace)
    setActivePinia(createPinia())
    const context = useProjectContextStore()
    expect(context.isLoaded).toBe(false)
    expect(context.getMergedContext()).toBe('')

    workspace.project = await createProject()
    expect(context.isLoaded).toBe(true)
    expect(context.getMergedContext()).toContain('Only the three protagonists')
    expect(context.getMergedContext()).toContain('Codex knowledge')

    workspace.project = await createProject('Saved world revision')
    expect(context.getMergedContext()).toContain('Saved world revision')
    expect(context.getMergedContext()).not.toContain('Only the three protagonists')

    workspace.project = await compileEditorProject({ files: {
      'adv.config.json': '{"root":"adv"}',
      'adv/chapters/next.adv.md': '> Another project',
      'adv/glossary.md': 'New glossary',
    } })
    expect(context.stats.characters).toBe(0)
    expect(context.getMergedContext()).toContain('New glossary')
    expect(context.getMergedContext()).not.toContain('Codex knowledge')
    expect(context.worldContent).toBe('')

    workspace.project = undefined
    expect(context.isLoaded).toBe(false)
    expect(context.sections).toEqual([])
    expect(context.stats).toEqual({ chapters: 0, characters: 0, scenes: 0 })
  })
})

import { createPinia, disposePinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { restoreLayout } from '../../editor/core/app/extensions/layout-state'
import { useFileStore } from '../../editor/core/app/stores/useFileStore'
import { projectAssetPath, projectFileTree } from '../../editor/core/app/utils/project-files'

let pinia: ReturnType<typeof createPinia>
let monaco: { fileContent: string, language: string }
let project: { workspace: { readAsset: ReturnType<typeof vi.fn> }, writeProjectFiles: ReturnType<typeof vi.fn> }
const handle = (name: string, content = `# ${name}`) => ({ name, getFile: vi.fn(async () => ({ text: async () => content })) }) as unknown as FileSystemFileHandle
beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  monaco = reactive({ fileContent: '', language: 'plaintext' })
  project = reactive({ workspace: { readAsset: vi.fn(async () => new Blob(['image'])) }, writeProjectFiles: vi.fn(async () => {}) })
  vi.stubGlobal('useMonacoStore', () => monaco)
  vi.stubGlobal('useProjectStore', () => project)
  vi.stubGlobal('useGameStore', () => ({ gameConfig: {} }))
  vi.stubGlobal('useConsoleStore', () => ({ success: vi.fn(), warn: vi.fn() }))
  vi.stubGlobal('useAppStore', () => reactive({ activeInspector: undefined }))
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = vi.fn(() => 'blob:preview')
    static revokeObjectURL = vi.fn()
  })
})
afterEach(() => {
  disposePinia(pinia)
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('editor file workspace', () => {
  it('resolves public game URLs while preserving explicit project asset paths', () => {
    const paths = ['public/img/portrait.webp', 'img/portrait.webp', 'adv/assets/tachie.png']
    expect(projectAssetPath('/img/portrait.webp', paths)).toBe('public/img/portrait.webp')
    expect(projectAssetPath('img/portrait.webp', paths)).toBe('img/portrait.webp')
    expect(projectAssetPath('img/portrait.webp', ['public/img/portrait.webp'])).toBe('public/img/portrait.webp')
    expect(projectAssetPath('./adv/assets/tachie.png', paths)).toBe('adv/assets/tachie.png')
    expect(projectAssetPath('/adv/assets/tachie.png', paths)).toBe('adv/assets/tachie.png')
    expect(projectAssetPath('public/img/portrait.webp', paths)).toBe('public/img/portrait.webp')
    expect(projectAssetPath('/missing.webp', paths)).toBe('missing.webp')
  })

  it('preserves a dirty document across selection, requires save or discard to switch, and writes through the workspace', async () => {
    const file = useFileStore()
    await file.setOpenedFileHandle(handle('one.adv.md'), 'adv/one.adv.md')
    monaco.fileContent = '# draft'
    await file.setOpenedFileHandle(handle('one.adv.md'), 'adv/one.adv.md')
    expect(monaco.fileContent).toBe('# draft')
    await expect(file.setOpenedFileHandle(handle('two.md'), 'adv/two.md')).rejects.toThrow('Save or discard')
    expect(file.openedFilePath).toBe('adv/one.adv.md')
    await file.saveOpenedFile()
    expect(project.writeProjectFiles).toHaveBeenCalledWith([{ path: 'adv/one.adv.md', content: '# draft', expected: '# one.adv.md' }])
    await file.setOpenedFileHandle(handle('two.md'), 'adv/two.md')
    monaco.fileContent = 'another draft'
    file.discardOpenedFileChanges()
    expect(monaco.fileContent).toBe('# two.md')
    expect(file.isDirty).toBe(false)
  })

  it('ignores slow earlier reads and cancels a pending selection when the current file is selected again', async () => {
    const file = useFileStore()
    let finish!: (file: { text: () => Promise<string> }) => void
    const slow = { name: 'slow.md', getFile: () => new Promise(resolve => finish = resolve) } as FileSystemFileHandle
    const pending = file.setOpenedFileHandle(slow)
    await file.setOpenedFileHandle(handle('fast.md'))
    finish({ text: async () => 'stale' })
    await pending
    expect(file.fileName).toBe('fast.md')
    expect(monaco.fileContent).toBe('# fast.md')
    const next = file.setOpenedFileHandle(slow)
    await file.setOpenedFileHandle(handle('fast.md'))
    finish({ text: async () => 'stale again' })
    await next
    expect(file.fileName).toBe('fast.md')
    expect(file.loading).toBe(false)
  })

  it('reads binary previews through the workspace and releases them on replacement and project switch', async () => {
    const file = useFileStore()
    await file.setOpenedFileHandle(handle('chapter.adv.md'))
    const image = handle('portrait.png')
    await file.setOpenedFileHandle(image, 'adv/assets/portrait.png')
    expect(project.workspace.readAsset).toHaveBeenCalledWith('adv/assets/portrait.png')
    expect(image.getFile).not.toHaveBeenCalled()
    expect(file.fileKind).toBe('image')
    expect(file.previewUrl).toBe('blob:preview')
    expect(monaco.fileContent).toBe('# chapter.adv.md')
    expect(monaco.language).toBe('markdown')
    expect(file.isDirty).toBe(false)
    await file.setOpenedFileHandle(handle('story.md'))
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview')
    project.workspace = { readAsset: vi.fn() }
    expect(file.openedFileHandle).toBeUndefined()
    expect(file.fileName).toBe('')
  })

  it('keeps external conflict resolution available after the editor moves to the main region', async () => {
    const file = useFileStore()
    await file.setOpenedFileHandle(handle('story.md'), 'adv/story.md')
    monaco.fileContent = '# local'
    await file.handleExternalChange('adv/story.md', '# external')
    expect(monaco.fileContent).toBe('# local')
    expect(file.externalConflict?.content).toBe('# external')
    file.acceptExternalChange()
    expect(monaco.fileContent).toBe('# external')
    expect(file.isDirty).toBe(false)
  })
})

describe('project navigation migration', () => {
  it('moves the saved bottom project selection without changing other restored regions', () => {
    expect(restoreLayout({ version: 1, active: { bottom: 'advjs.core/project', main: 'advjs.core/game', inspector: 'advjs.context/context' } }).active).toEqual({ navigation: 'advjs.core/project', bottom: 'advjs.core/assets', main: 'advjs.core/game', inspector: 'advjs.context/context' })
  })

  it('keeps ancestors visible and expanded when filtering a deep project file', () => {
    const tree = projectFileTree(['adv.config.json', 'adv/chapters/intro.adv.md', 'adv/characters/hero.character.md'], new Set(), 'intro')
    expect(tree).toHaveLength(1)
    expect(tree[0]).toMatchObject({ id: 'adv', expanded: true, children: [{ id: 'adv/chapters', expanded: true, children: [{ id: 'adv/chapters/intro.adv.md' }] }] })
  })
})

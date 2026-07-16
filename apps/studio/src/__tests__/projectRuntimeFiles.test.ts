import type { IFileSystem } from '../utils/fs'
import { describe, expect, it } from 'vitest'
import { applyStudioGameSettings, discoverRuntimeChapterFiles, loadStudioGameSettings } from '../utils/projectRuntimeFiles'

function createFs(files: Record<string, string>): IFileSystem {
  return {
    backend: 'memory',
    exists: async path => Object.hasOwn(files, path),
    readFile: async (path) => {
      if (!Object.hasOwn(files, path))
        throw new Error(`File not found: ${path}`)
      return files[path]
    },
    listFiles: async (subdir, ext) => Object.keys(files)
      .filter((path) => {
        const relative = path.slice(subdir.length + 1)
        return path.startsWith(`${subdir}/`) && !relative.includes('/') && path.endsWith(ext)
      })
      .sort(),
    collectAllFiles: async (basePath = '') => Object.entries(files)
      .filter(([path]) => path.startsWith(basePath ? `${basePath}/` : ''))
      .map(([path, content]) => ({ path, content, lastModified: new Date(0) })),
  } as IFileSystem
}

describe('studio runtime project files', () => {
  it('discovers classic public Markdown chapters and game settings', async () => {
    const fs = createFs({
      'public/md/chapters/1/ignored.adv.md': 'nested directories are intentionally explicit',
      'public/md/chapters/intro.adv.md': '@观测者\n你好',
      'adv/settings/game.json': JSON.stringify({
        title: '仓鼠：星海回声',
        variables: { curiosity: 0 },
        requiredPlugins: { 'star-map': '1.0.0' },
      }),
    })

    expect(await discoverRuntimeChapterFiles(fs)).toEqual([
      'public/md/chapters/1/ignored.adv.md',
      'public/md/chapters/intro.adv.md',
    ])
    expect(await loadStudioGameSettings(fs)).toEqual({
      title: '仓鼠：星海回声',
      variables: { curiosity: 0 },
      requiredPlugins: { 'star-map': '1.0.0' },
    })
  })

  it('prefers the authoring chapter directory over mirrored classic files', async () => {
    const fs = createFs({
      'adv/chapters/01.adv.md': 'authoring',
      'public/md/chapters/01.adv.md': 'classic',
    })

    expect(await discoverRuntimeChapterFiles(fs)).toEqual([
      'adv/chapters/01.adv.md',
    ])
  })

  it('returns empty settings for a missing file', async () => {
    expect(await loadStudioGameSettings(createFs({}))).toEqual({})
  })

  it('rejects a non-object settings root', async () => {
    const fs = createFs({ 'adv/settings/game.json': '[]' })
    await expect(loadStudioGameSettings(fs)).rejects.toThrow('ADV_STUDIO_INVALID_GAME_SETTINGS')
  })

  it('applies author settings without replacing generated content arrays', () => {
    const chapters = [{ id: 'chapter-1', title: 'One', nodes: [] }]
    const merged = applyStudioGameSettings({
      title: 'Generated',
      description: '',
      chapters,
      characters: [],
      scenes: [],
    }, {
      title: 'Authored',
      variables: { curiosity: 0 },
    })

    expect(merged).toMatchObject({
      title: 'Authored',
      variables: { curiosity: 0 },
    })
    expect(merged.chapters).toBe(chapters)
  })
})

import type { WebContainer } from '@webcontainer/api'

import { describe, expect, it, vi } from 'vitest'

import { createHtmlDownloadFilename, useAdvWebContainer } from '../../packages/webcontainer/src/composable'

function createProcess(exitCode = 0) {
  return {
    exit: Promise.resolve(exitCode),
    output: {
      pipeTo: vi.fn().mockResolvedValue(undefined),
    },
  }
}

describe('webcontainer stage timing', () => {
  it('records install and build durations', async () => {
    const now = vi.fn()
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(2_345)
      .mockReturnValueOnce(3_000)
      .mockReturnValueOnce(3_901)
    const installProcess = createProcess()
    const buildProcess = createProcess()
    const spawn = vi.fn()
      .mockResolvedValueOnce(installProcess)
      .mockResolvedValueOnce(buildProcess)
    const { build, installDependencies, state, webContainerRef } = useAdvWebContainer({ now })

    webContainerRef.value = { spawn } as unknown as WebContainer

    await installDependencies()
    await build()

    expect(spawn).toHaveBeenNthCalledWith(1, 'pnpm', ['install'])
    expect(spawn).toHaveBeenNthCalledWith(2, 'pnpm', ['build'])
    expect(state.value.installDurationMs).toBe(1_345)
    expect(state.value.buildDurationMs).toBe(901)
  })
})

describe('webcontainer HTML download', () => {
  it.each([
    ['星海物语', '星海物语.html'],
    ['星海: 序章?', '星海- 序章-.html'],
    ['chapter\u0000one', 'chapter-one.html'],
    ['ending.html', 'ending.html'],
    [' ending.HTML ', 'ending.html'],
    ['  ...  ', 'index.html'],
    [undefined, 'index.html'],
  ])('creates a safe filename from %s', (title, expected) => {
    expect(createHtmlDownloadFilename(title)).toBe(expected)
  })

  it('downloads the built document using the game title', async () => {
    const readFile = vi.fn().mockResolvedValue('<!doctype html>')
    const { downloadIndexHtml, webContainerRef } = useAdvWebContainer()
    const createObjectURL = vi.fn().mockReturnValue('blob:advjs')
    const revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    webContainerRef.value = { fs: { readFile } } as unknown as WebContainer

    await downloadIndexHtml('星海: 序章?')

    const anchor = click.mock.instances[0]
    expect(readFile).toHaveBeenCalledWith('dist/index.html', 'utf-8')
    expect(anchor.download).toBe('星海- 序章-.html')
    expect(anchor.href).toBe('blob:advjs')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:advjs')

    vi.unstubAllGlobals()
    click.mockRestore()
  })
})

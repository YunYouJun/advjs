import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { createProjectMirror } from '../../apps/desktop/src/project-copy'

it('mirrors saved binary and text changes and deletions without generated data or secrets', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'advjs-mirror-'))
  const root = join(directory, 'author')
  const mirrorRoot = join(directory, 'preview')
  try {
    await mkdir(join(root, 'assets'), { recursive: true })
    await mkdir(join(root, 'node_modules'), { recursive: true })
    await writeFile(join(root, '.env.local'), 'PRIVATE=hidden')
    await writeFile(join(root, 'node_modules/ignored'), 'generated')
    await writeFile(join(root, 'chapter.adv.md'), 'first')
    await writeFile(join(root, 'assets/image'), new Uint8Array([0, 255, 32]))
    const mirror = createProjectMirror(root, mirrorRoot)
    await mirror.sync()
    expect([...await readFile(join(mirrorRoot, 'assets/image'))]).toEqual([0, 255, 32])
    await expect(readFile(join(mirrorRoot, '.env.local'))).rejects.toThrow()
    await expect(readFile(join(mirrorRoot, 'node_modules/ignored'))).rejects.toThrow()
    await writeFile(join(root, 'chapter.adv.md'), 'second')
    await rm(join(root, 'assets/image'))
    await mirror.sync()
    expect(await readFile(join(mirrorRoot, 'chapter.adv.md'), 'utf8')).toBe('second')
    await expect(readFile(join(mirrorRoot, 'assets/image'))).rejects.toThrow()
    expect(await readFile(join(root, 'chapter.adv.md'), 'utf8')).toBe('second')
  }
  finally { await rm(directory, { recursive: true, force: true }) }
})

it('rejects symbolic links outside the project and recursive link cycles', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'advjs-mirror-boundary-'))
  const root = join(directory, 'author')
  try {
    await mkdir(root)
    await writeFile(join(directory, 'secret'), 'external')
    await symlink(join(directory, 'secret'), join(root, 'escape'))
    const mirror = createProjectMirror(root, join(directory, 'preview'))
    await expect(mirror.sync()).rejects.toThrow('符号链接越界')
    await rm(join(root, 'escape'))
    await symlink(root, join(root, 'cycle'))
    await expect(mirror.sync()).rejects.toThrow('循环')
  }
  finally { await rm(directory, { recursive: true, force: true }) }
})

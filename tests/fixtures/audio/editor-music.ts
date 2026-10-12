import { Buffer } from 'node:buffer'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** Original deterministic audible PCM for file import. No supplier, song or model call. */
export async function createEditorMusicFixture() {
  const directory = await mkdtemp(join(tmpdir(), 'advjs-editor-music-'))
  const root = join(directory, 'project')
  const files = {
    'adv.config.json': JSON.stringify({ schemaVersion: 1, id: 'editor-music', format: 'flow', root: 'adv', entryChapterId: 'intro', theme: '@advjs/theme-default' }),
    'adv/settings/game.json': JSON.stringify({ title: '音乐文件回流验收', locale: 'zh-CN', characters: [], scenes: [] }),
    'adv/chapters/intro.chapter.json': JSON.stringify({ schemaVersion: 1, id: 'intro', title: '音乐章节', startNodeId: 'narration', nodes: [{ id: 'narration', type: 'narration', text: '音乐已从作者文件进入当前章节。', next: 'end' }, { id: 'end', type: 'end' }] }),
    'adv/assets.json': JSON.stringify({ schemaVersion: 2, id: 'editor-music-assets', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'public/media' } }, assets: [] }),
    'package.json': JSON.stringify({ name: 'editor-music-fixture', type: 'module', dependencies: { 'advjs': 'workspace:*', '@advjs/theme-default': 'workspace:*' } }),
  }
  for (const [path, content] of Object.entries(files)) {
    await mkdir(join(root, path, '..'), { recursive: true })
    await writeFile(join(root, path), content)
  }
  await mkdir(join(root, 'public/media'), { recursive: true })
  const count = 24000
  const bytes = Buffer.alloc(44 + count * 2)
  bytes.write('RIFF', 0)
  bytes.writeUInt32LE(bytes.length - 8, 4)
  bytes.write('WAVEfmt ', 8)
  bytes.writeUInt32LE(16, 16)
  bytes.writeUInt16LE(1, 20)
  bytes.writeUInt16LE(1, 22)
  bytes.writeUInt32LE(24000, 24)
  bytes.writeUInt32LE(48000, 28)
  bytes.writeUInt16LE(2, 32)
  bytes.writeUInt16LE(16, 34)
  bytes.write('data', 36)
  bytes.writeUInt32LE(count * 2, 40)
  for (let index = 0; index < count; index++)
    bytes.writeInt16LE(Math.round(9000 * Math.sin(index * 2 * Math.PI * 330 / count)), 44 + index * 2)
  const importPath = join(directory, 'original-music.wav')
  const candidatePath = join(directory, 'unused-original-candidate.wav')
  await writeFile(importPath, bytes)
  await writeFile(candidatePath, bytes)
  return { directory, root, importPath, candidatePath, bytes, sourcePaths: Object.keys(files) }
}

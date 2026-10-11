import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { unpackCloudStudioExport } from './handoff'

async function archive(extra?: [string, string]) {
  const zip = new JSZip()
  zip.file('adv.config.json', JSON.stringify({ schemaVersion: 1, root: 'adv', format: 'flow' }))
  zip.file('adv/chapters/intro.chapter.json', JSON.stringify({ schemaVersion: 1, id: 'intro', nodes: [{ id: 'end', type: 'end' }] }))
  zip.file('authoring/rights/synthetic.json', '{"source":"original synthetic acceptance voice"}')
  if (extra)
    zip.file(...extra)
  return zip.generateAsync({ type: 'uint8array' })
}

describe('actual native cloud ZIP handoff boundary', () => {
  it('retains exact native Flow and author rights bytes for a pinned public build', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'advjs-cloud-zip-test-'))
    try {
      const inventory = await unpackCloudStudioExport(await archive(), directory)
      expect(inventory.map(file => file.path)).toEqual(['adv.config.json', 'adv/chapters/intro.chapter.json', 'authoring/rights/synthetic.json'])
      expect(await readFile(join(directory, 'authoring/rights/synthetic.json'), 'utf8')).toBe('{"source":"original synthetic acceptance voice"}')
      expect(inventory.every(file => /^[a-f0-9]{64}$/u.test(file.sha256))).toBe(true)
    }
    finally { await rm(directory, { recursive: true, force: true }) }
  })
  it.each(['../outside.json', 'adv.config.ts', 'node_modules/plugin/package.json'])('rejects path escape or executable project sources before Node loads them: %s', async (path) => {
    const directory = await mkdtemp(join(tmpdir(), 'advjs-cloud-zip-test-'))
    try {
      await expect(unpackCloudStudioExport(await archive([path, 'forbidden']), directory)).rejects.toThrow('STUDIO_CLOUD_ZIP_PATH_INVALID')
    }
    finally { await rm(directory, { recursive: true, force: true }) }
  })
})

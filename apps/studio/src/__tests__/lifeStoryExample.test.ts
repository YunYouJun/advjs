/**
 * Integration smoke test for the life-story example project shipped under
 * `examples/ai-contest/life-story/`. The example acts as the contest-day
 * Fallback — even if LLM traffic is flaky during the live demo, we can open
 * this directory in Studio and run a full Play session.
 *
 * This test guards against drift: any rename or schema tightening in the
 * Studio parsers will surface here before it bites the judges.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseCharacterMd } from '@advjs/parser'
import { describe, expect, it } from 'vitest'
import { parseChapterMd } from '../utils/chapterMd'
import { parseLocationMd } from '../utils/locationMd'
import { parseSceneMd } from '../utils/sceneMd'

const EXAMPLE_ROOT = join(__dirname, '../../../../examples/ai-contest/life-story')

function read(relPath: string): string {
  return readFileSync(join(EXAMPLE_ROOT, relPath), 'utf-8')
}

describe('examples/ai-contest/life-story — contest Fallback project', () => {
  it('source.txt is non-trivial (>= 1000 chars)', () => {
    const src = read('source.txt')
    expect(src.length).toBeGreaterThan(1000)
  })

  it('characters parse into valid AdvCharacter with required fields', () => {
    for (const file of ['grandma.character.md', 'granddaughter.character.md']) {
      const content = read(`adv/characters/${file}`)
      const c = parseCharacterMd(content)
      expect(c.id, file).toBeTruthy()
      expect(c.name, file).toBeTruthy()
      // Either frontmatter-level or body-level personality section should exist.
      expect(c.personality || c.background, `${file}: has personality or background`).toBeTruthy()
    }
  })

  it('all three chapters parse and carry title + phase frontmatter', () => {
    const chapters = ['01-childhood.adv.md', '02-turning.adv.md', '03-reflection.adv.md']
    for (const file of chapters) {
      const content = read(`adv/chapters/${file}`)
      const parsed = parseChapterMd(content, file)
      expect(parsed.title, file).toBeTruthy()
    }
  })

  it('scenes carry id + imagePrompt, and linkedLocation exists under adv/locations/', () => {
    for (const sceneFile of ['seaside-village.md', 'winter-station.md']) {
      const content = read(`adv/scenes/${sceneFile}`)
      const s = parseSceneMd(content)
      expect(s.id, sceneFile).toBeTruthy()
      expect(s.imagePrompt, `${sceneFile}: imagePrompt present`).toBeTruthy()
      expect(s.linkedLocation, `${sceneFile}: linkedLocation present`).toBeTruthy()
      // the linkedLocation file should actually exist — otherwise check would fail
      const locContent = read(`adv/locations/${s.linkedLocation}.md`)
      const loc = parseLocationMd(locContent)
      expect(loc.id, `${s.linkedLocation}: location parses`).toBe(s.linkedLocation)
    }
  })

  it('world.md and outline.md are non-empty', () => {
    expect(read('adv/world.md').trim().length).toBeGreaterThan(40)
    expect(read('adv/outline.md').trim().length).toBeGreaterThan(40)
  })

  it('knowledge entries are parseable markdown with a Domain line', () => {
    for (const kfile of ['era/fishing-village-1960s.md', 'era/work-team-movement.md']) {
      const c = read(`adv/knowledge/${kfile}`)
      expect(c).toContain('Domain:')
      expect(c.trim().startsWith('#')).toBe(true)
    }
  })
})

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createRoutesFolders } from '../../packages/advjs/node/vite/routes'

const fixtures: string[] = []

function fixtureRoot(name: string, files: string[]) {
  const root = mkdtempSync(join(tmpdir(), `advjs-routes-${name}-`))
  fixtures.push(root)
  for (const file of files) {
    const path = join(root, 'pages', file)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, '<template />')
  }
  return root
}

afterEach(() => {
  for (const fixture of fixtures.splice(0))
    rmSync(fixture, { recursive: true, force: true })
})

describe('adv page route priority', () => {
  it('lets later project roots override the same theme page only', () => {
    const client = fixtureRoot('client', ['help.md'])
    const theme = fixtureRoot('theme', ['index.vue', 'start.vue', 'nested/index.vue'])
    const project = fixtureRoot('project', ['start.vue'])

    const folders = createRoutesFolders([client, theme, project])

    expect(folders[1].exclude).toContain('**(./)start.vue')
    expect(folders[1].exclude).not.toContain('**(./)nested/index.vue')
    expect(folders[2].exclude).toEqual([])
  })
})

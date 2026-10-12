import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
// The desktop script gate runs directly in Node on each release platform.
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'
import { buildProjectTemplates } from './templates.mjs'

test('bundles raw project templates without generated Nuxt configuration', async (context) => {
  const root = await mkdtemp(resolve(tmpdir(), 'advjs-template-build-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  await Promise.all([
    mkdir(resolve(root, 'apps/desktop'), { recursive: true }),
    mkdir(resolve(root, 'editor/core/app/templates'), { recursive: true }),
    mkdir(resolve(root, 'packages/advjs/template'), { recursive: true }),
  ])
  await writeFile(resolve(root, 'apps/desktop/tsconfig.json'), '{"compilerOptions":{"target":"ES2023","module":"ESNext"}}\n')
  await writeFile(resolve(root, 'editor/core/tsconfig.json'), '{"extends":"./.nuxt/tsconfig.json"}\n')
  await writeFile(resolve(root, 'packages/advjs/template/chapter.adv.md'), '# Intro\n\nA fresh project.\n')
  await writeFile(resolve(root, 'editor/core/app/templates/index.ts'), `
import content from '@advjs/template/chapter.adv.md?raw'
interface Template { id: string, content: string }
export const PROJECT_TEMPLATE_LIST: Template[] = [{ id: 'starter', content }]
`)

  assert.deepEqual(await buildProjectTemplates(root), [{ id: 'starter', content: '# Intro\n\nA fresh project.\n' }])
})

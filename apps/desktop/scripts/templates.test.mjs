import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'
import { buildProjectTemplates } from './templates.mjs'

const repository = resolve(import.meta.dirname, '../../..')

test('bundles every desktop project template without Nuxt-generated configuration', async (context) => {
  const root = await mkdtemp(resolve(tmpdir(), 'advjs-desktop-templates-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  for (const path of ['editor/core/app/templates', 'packages/advjs/template', 'demo/starter']) {
    await mkdir(resolve(root, path, '..'), { recursive: true })
    await cp(resolve(repository, path), resolve(root, path), {
      recursive: true,
      filter: source => !/(?:^|[/\\])(?:node_modules|dist|\.nuxt)(?:[/\\]|$)/u.test(source),
    })
  }
  for (const path of ['tsconfig.json', 'editor/core/tsconfig.json', 'apps/desktop/tsconfig.json']) {
    await mkdir(resolve(root, path, '..'), { recursive: true })
    await cp(resolve(repository, path), resolve(root, path))
  }
  await assert.rejects(stat(resolve(root, 'editor/core/.nuxt')), { code: 'ENOENT' })

  const templates = await buildProjectTemplates(root)

  assert.deepEqual(templates.map(template => template.meta.id), ['starter', 'rainy-letter', 'adv-md', 'blank', 'flow'])
  assert.ok(templates.every(template => template.files.some(file => file.isAdvConfig)))
  const starter = templates.find(template => template.meta.id === 'starter')
  const chapter = starter.files.find(file => file.name === 'adv/chapters/hello.adv.md')
  assert.equal(chapter.content, await readFile(resolve(root, 'demo/starter/public/md/chapters/hello.adv.md'), 'utf8'))
  const portrait = starter.files.find(file => file.name === 'public/img/characters/xiaoyun.webp')
  assert.equal(portrait.encoding, 'base64')
  assert.equal(portrait.content, (await readFile(resolve(root, 'demo/starter/public/img/characters/xiaoyun.webp'))).toString('base64'))
})

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

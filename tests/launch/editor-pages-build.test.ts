// @vitest-environment node

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { editorBuildContract } from '../../editor/core/build-contract'

const root = resolve(import.meta.dirname, '../..')

describe('editor Cloudflare Pages build contract', () => {
  it('matches the existing Git-integrated Pages project output directory', async () => {
    const rootPackage = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
    const editorPackage = JSON.parse(await readFile(resolve(root, 'editor/core/package.json'), 'utf8'))
    const workflowSource = await readFile(resolve(root, '.github/workflows/ci.yml'), 'utf8')
    const workflow = parse(workflowSource)
    const pagesJob = workflow.jobs['editor-pages-build']

    expect(rootPackage.packageManager).toBe('pnpm@11.20.0')
    expect(rootPackage.scripts['editor:build']).toBe('pnpm prepare:workspace editor && pnpm -C editor/core build')
    expect(editorBuildContract.packagePublicDirectory).toBe('dist')
    expect(editorPackage.advjsEditor.artifacts).toEqual(editorBuildContract)
    expect(pagesJob.name).toBe('editor-pages-build')
    expect(pagesJob.env).toEqual({ NODE_VERSION: 'lts/*', PNPM_VERSION: '11.20.0' })
    expect(pagesJob.steps.map((step: { run?: string }) => step.run).filter(Boolean)).toEqual(expect.arrayContaining([
      'pnpm editor:build',
      'test -f editor/core/dist/index.html',
    ]))
  })
})

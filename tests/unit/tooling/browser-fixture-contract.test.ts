// @vitest-environment node

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import browserConfig from '../../../playwright.config'

const root = resolve(import.meta.dirname, '../../..')

describe('browser integration prerequisites', () => {
  it('builds and serves native Flow before the catch-all browser suite', () => {
    const servers = Array.isArray(browserConfig.webServer) ? browserConfig.webServer : [browserConfig.webServer]
    const flow = servers.find(server => server?.url === 'http://127.0.0.1:3359')
    expect(flow?.command).toBe('pnpm -C demo/flow run build && pnpm -C demo/flow exec vite preview --host 127.0.0.1 --port 3359 --strictPort')
    expect(flow?.reuseExistingServer).toBe(false)
    const testSource = readFileSync(resolve(root, 'tests/e2e/native-flow-project.spec.ts'), 'utf8')
    expect(testSource).toContain('test.use({ baseURL: \'http://127.0.0.1:3359\' })')
  })

  it('installs FFmpeg and checks both executables before browser audio publication', () => {
    const ci = parse(readFileSync(resolve(root, '.github/workflows/ci.yml'), 'utf8'))
    const commands: string[] = ci.jobs.e2e.steps.flatMap((step: { run?: string }) => step.run ? [step.run] : [])
    const install = commands.findIndex(command => command.includes('apt-get install --yes --no-install-recommends ffmpeg'))
    const browser = commands.findIndex(command => command.startsWith('pnpm exec playwright test '))
    expect(install).toBeGreaterThanOrEqual(0)
    expect(install).toBeLessThan(browser)
    expect(commands[install]).toContain('ffmpeg -version')
    expect(commands[install]).toContain('ffprobe -version')
  })
})

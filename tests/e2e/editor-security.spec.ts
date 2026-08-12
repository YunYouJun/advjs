import type { ChildProcessByStdio } from 'node:child_process'
import type { Readable } from 'node:stream'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cp, mkdtemp, readdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { createServer as createHttpServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import { createEditorBridge } from '../../packages/advjs/node/editor'

interface CliEnvelope {
  command: string
  data: { event?: string, root?: string, url?: string } | null
  errors: Array<{ code: string, message: string }>
  ok: boolean
  schemaVersion: number
}

const repositoryRoot = resolve(import.meta.dirname, '../..')
const cliEntry = resolve(repositoryRoot, 'packages/advjs/node/cli/index.ts')
const tsxCli = fileURLToPath(import.meta.resolve('tsx/cli'))

async function projectSnapshot(root: string) {
  const entries: Array<{ path: string, sha256: string }> = []
  async function walk(directory: string, prefix = ''): Promise<void> {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((left, right) => left.name.localeCompare(right.name))) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name
      const target = join(directory, entry.name)
      if (entry.isDirectory())
        await walk(target, path)
      else if (entry.isFile())
        entries.push({ path, sha256: createHash('sha256').update(await readFile(target)).digest('hex') })
    }
  }
  await walk(root)
  return entries
}

function spawnCli(args: string[], cwd: string) {
  const environment = { ...process.env, FORCE_COLOR: '0', NODE_ENV: 'production', NO_COLOR: '1' }
  delete environment.VITEST
  delete environment.VITEST_MODE
  const child = spawn(process.execPath, [tsxCli, cliEntry, ...args], {
    cwd,
    env: environment,
    stdio: ['ignore', 'pipe', 'pipe'],
  }) as ChildProcessByStdio<null, Readable, Readable>
  const envelopes: CliEnvelope[] = []
  const waiters = new Set<() => void>()
  let stdout = ''
  let stderr = ''
  let buffer = ''
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (chunk: string) => {
    stdout += chunk
    buffer += chunk
    let newline = buffer.indexOf('\n')
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim()
      buffer = buffer.slice(newline + 1)
      if (line)
        envelopes.push(JSON.parse(line) as CliEnvelope)
      for (const wake of waiters)
        wake()
      newline = buffer.indexOf('\n')
    }
  })
  child.stderr.on('data', (chunk: string) => stderr += chunk)

  async function next(predicate: (envelope: CliEnvelope) => boolean, timeout = 15_000) {
    const existing = envelopes.find(predicate)
    if (existing)
      return existing
    return await new Promise<CliEnvelope>((resolveEnvelope, reject) => {
      let timer: ReturnType<typeof setTimeout>
      const check = () => {
        const envelope = envelopes.find(predicate)
        if (!envelope)
          return
        clearTimeout(timer)
        waiters.delete(check)
        resolveEnvelope(envelope)
      }
      waiters.add(check)
      timer = setTimeout(() => {
        waiters.delete(check)
        reject(new Error(`Timed out waiting for CLI envelope. stdout=${stdout} stderr=${stderr}`))
      }, timeout)
    })
  }

  const completed = new Promise<number>((resolveExit, reject) => {
    child.once('error', reject)
    child.once('close', code => resolveExit(code ?? 1))
  })
  return { child, completed, next, output: () => ({ stderr, stdout }) }
}

async function runCli(args: string[], cwd: string) {
  const cli = spawnCli(args, cwd)
  const exitCode = await cli.completed
  return {
    envelopes: cli.output().stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as CliEnvelope),
    exitCode,
    ...cli.output(),
  }
}

async function reservePort() {
  const server = createHttpServer()
  await new Promise<void>((resolveListen, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolveListen)
  })
  const address = server.address()
  const port = address && typeof address !== 'string' ? address.port : 0
  return { port, server }
}

async function closeServer(server: ReturnType<typeof createHttpServer>) {
  await new Promise<void>((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()))
}

test('enforces local bridge security and cleans up every CLI lifecycle', async ({ browserName, page }) => {
  test.skip(browserName !== 'chromium', 'The launch support matrix targets Chromium stable')
  test.setTimeout(90_000)

  const temporaryRoot = await mkdtemp(join(tmpdir(), 'advjs-editor-security-'))
  const projectRoot = join(temporaryRoot, 'project')
  const publicRoot = resolve(repositoryRoot, 'editor/core/dist')
  const outsideFile = join(temporaryRoot, 'outside.txt')
  const liveChildren = new Set<ReturnType<typeof spawnCli>>()
  await cp(resolve(repositoryRoot, 'tests/launch/fixtures/golden-project'), projectRoot, { recursive: true })
  await writeFile(outsideFile, 'outside', 'utf8')
  await symlink(outsideFile, join(projectRoot, 'outside-link.txt'))
  const before = await projectSnapshot(projectRoot)

  try {
    const bridge = await createEditorBridge({ host: '127.0.0.1', port: 0, projectRoot, publicRoot })
    const ready = await bridge.start()
    const origin = new URL(ready.url).origin
    const headers = { authorization: `Bearer ${bridge.token}` }

    const documentResponse = await page.request.get(ready.url)
    expect(documentResponse.headers()['content-security-policy']).toContain('default-src \'self\'')
    expect(documentResponse.headers()['x-frame-options']).toBe('DENY')
    expect(documentResponse.headers()['referrer-policy']).toBe('no-referrer')

    const fileUrl = `${origin}/__advjs/api/file?path=adv.config.json`
    expect((await page.request.get(fileUrl)).status()).toBe(401)
    expect((await page.request.get(fileUrl, { headers: { ...headers, origin: 'https://evil.example' } })).status()).toBe(403)
    expect((await page.request.get(`${origin}/__advjs/api/file?path=../outside.txt`, { headers })).status()).toBe(400)
    expect((await page.request.get(`${origin}/__advjs/api/file?path=outside-link.txt`, { headers })).status()).toBe(403)
    expect((await page.request.post(`${origin}/__advjs/api/commands/check%3Brm`, { headers })).status()).toBe(404)
    expect((await page.request.post(`${origin}/__advjs/api/commands/deploy`, { headers })).status()).toBe(404)

    const failedSave = await page.request.put(`${origin}/__advjs/api/file?path=missing/file.md`, {
      data: '# blocked',
      headers,
    })
    expect(failedSave.status()).toBe(403)
    expect(await failedSave.json()).toEqual({ error: expect.any(String) })
    await bridge.stop()
    expect(await projectSnapshot(projectRoot)).toEqual(before)

    const invalidProject = join(temporaryRoot, 'invalid-project')
    await cp(projectRoot, invalidProject, { recursive: true })
    await rm(join(invalidProject, 'outside-link.txt'))
    await writeFile(join(invalidProject, 'adv.config.json'), '{ invalid json', 'utf8')
    const invalidBridge = await createEditorBridge({ host: '127.0.0.1', port: 0, projectRoot: invalidProject, publicRoot })
    const invalidReady = await invalidBridge.start()
    const invalidResponse = await page.request.get(`${new URL(invalidReady.url).origin}/__advjs/api/project`, {
      headers: { authorization: `Bearer ${invalidBridge.token}` },
    })
    expect(invalidResponse.status()).toBe(200)
    expect(await invalidResponse.json()).toMatchObject({
      result: {
        diagnostics: expect.arrayContaining([
          expect.objectContaining({ code: 'ADV_PROJECT_INVALID_JSON', severity: 'error' }),
        ]),
      },
    })
    await invalidBridge.stop()

    const invalidRoot = await runCli(['editor', join(temporaryRoot, 'missing'), '--no-open', '--json'], temporaryRoot)
    expect(invalidRoot.exitCode).not.toBe(0)
    expect(invalidRoot.envelopes).toHaveLength(1)
    expect(invalidRoot.envelopes[0]).toMatchObject({ command: 'editor', ok: false, errors: [{ code: 'ADV_EDITOR' }] })

    const occupied = await reservePort()
    const occupiedResult = await runCli(['editor', projectRoot, '--no-open', '--port', String(occupied.port), '--json'], temporaryRoot)
    expect(occupiedResult.exitCode).not.toBe(0)
    expect(occupiedResult.envelopes).toHaveLength(1)
    expect(occupiedResult.envelopes[0]).toMatchObject({ ok: false, errors: [{ code: 'ADV_EDITOR' }] })
    await closeServer(occupied.server)

    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
      const reservation = await reservePort()
      const port = reservation.port
      await closeServer(reservation.server)
      const cli = spawnCli(['editor', projectRoot, '--no-open', '--port', String(port), '--json'], temporaryRoot)
      liveChildren.add(cli)
      const readyEnvelope = await cli.next(envelope => envelope.data?.event === 'ready')
      expect(readyEnvelope).toMatchObject({ ok: true, data: { root: await realpath(projectRoot) } })
      expect(cli.child.kill(signal)).toBe(true)
      expect(await cli.next(envelope => envelope.data?.event === 'stopped')).toMatchObject({ ok: true })
      expect(await cli.completed).toBe(0)
      liveChildren.delete(cli)

      const reusable = createHttpServer()
      await new Promise<void>((resolveListen, reject) => {
        reusable.once('error', reject)
        reusable.listen(port, '127.0.0.1', resolveListen)
      })
      await closeServer(reusable)
    }
    expect(await projectSnapshot(projectRoot)).toEqual(before)
  }
  finally {
    for (const cli of liveChildren)
      cli.child.kill('SIGKILL')
    await rm(temporaryRoot, { force: true, recursive: true })
  }
})

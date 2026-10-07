import type { ElectronApplication } from '@playwright/test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import process from 'node:process'
import { _electron, expect, test } from '@playwright/test'
import electron from 'electron'
import { runCommand } from '../../../scripts/release/run-command.mjs'
import { prepareDevelopmentExecutable } from '../scripts/dev.mjs'

const root = resolve(import.meta.dirname, '..')

test('development host shows the editor identity in macOS and keeps development paths', async () => {
  test.skip(!!process.env.ADVJS_DESKTOP_EXECUTABLE, 'Development identity is verified separately from packaged releases')
  const workspace = await mkdtemp(resolve(tmpdir(), 'advjs-dev-identity-'))
  const userData = resolve(workspace, 'host')
  const sharedPlist = resolve(electron, '../../Info.plist')
  const original = process.platform === 'darwin' ? await readFile(sharedPlist) : undefined
  let app: ElectronApplication | undefined
  try {
    await mkdir(userData)
    await writeFile(resolve(userData, 'editor-preferences.json'), JSON.stringify({ locale: 'en', onboarded: true }))
    const executablePath = await prepareDevelopmentExecutable()
    expect(await prepareDevelopmentExecutable()).toBe(executablePath)
    app = await _electron.launch({ executablePath, args: [root], cwd: workspace, env: { ...process.env, ADVJS_DESKTOP_TEST_DATA: userData } })
    const page = await app.firstWindow()
    await expect(page.locator('.ae-editor-splash')).toHaveCount(0)
    await expect(page.locator('.project-welcome.is-full-page')).toBeVisible()
    const identity = await app.evaluate(({ app, BrowserWindow }) => ({
      name: app.getName(),
      packaged: app.isPackaged,
      path: app.getAppPath(),
      userData: app.getPath('userData'),
      title: BrowserWindow.getAllWindows()[0]?.getTitle(),
    }))
    expect(identity).toEqual({ name: 'ADV.JS Editor Dev', packaged: false, path: root, userData, title: 'ADV.JS Editor' })
    if (process.platform === 'darwin') {
      const native = await runCommand('/usr/bin/lsappinfo', ['info', `#${app.process().pid}`])
      expect(native.stdout).toContain('"ADV.JS Editor Dev"')
      expect(native.stdout).toContain('org.advjs.editor.dev')
      expect(await readFile(sharedPlist)).toEqual(original)
      await runCommand('/usr/bin/codesign', ['--verify', '--deep', '--strict', resolve(executablePath, '../../..')])
    }
  }
  finally {
    await app?.close()
    await rm(workspace, { recursive: true, force: true })
  }
})

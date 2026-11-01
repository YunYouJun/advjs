import type { Browser, Locator, Page } from '@playwright/test'
import type { ViteDevServer } from 'vite'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'pathe'
import { AdvCommandError } from '../commands/errors'

export const gameUiScreenshotStates = ['title', 'dialogue', 'choice', 'backlog', 'save', 'long-dialogue', 'long-choice'] as const
export type GameUiScreenshotState = typeof gameUiScreenshotStates[number]

export interface GameUiViewport {
  name: string
  width: number
  height: number
}

export const defaultGameUiViewports: GameUiViewport[] = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'narrow', width: 390, height: 844 },
]

export interface GameUiScreenshotOptions {
  /** Project root; a dev server is started here unless `url` is given. */
  cwd: string
  /** An already running game preview. */
  url?: string
  /** Defaults to `.adv/theme-screenshots` in the project. */
  outDir?: string
  viewports?: GameUiViewport[]
  /** Host colour-scheme preference to emulate. */
  colorScheme?: 'light' | 'dark'
  locale?: string
  /** Also return JPEG copies as base64, for MCP clients. */
  inline?: boolean
  /** Maximum clicks spent looking for the first choice. */
  maxSteps?: number
}

export interface GameUiScreenshot {
  state: GameUiScreenshotState
  viewport: string
  file: string
  inline?: string
}

export interface GameUiScreenshotResult {
  url: string
  outDir: string
  report: string
  shots: GameUiScreenshot[]
  /** States that could not be reached, such as a story without choices. */
  missing: { state: GameUiScreenshotState, viewport: string, reason: string }[]
  consoleErrors: string[]
}

const longText = '这是一段用于检查换行的超长台词：雨夜的霓虹在积水里碎成千万片，侦探把领口竖起来，低声说出那个谁都不敢提起的名字——A deliberately long English sentence follows to test wrapping, hyphenation and line height across mixed scripts without clipping or overflow.'

/** Parse "1280x720" or "narrow=390x844" into a viewport. */
export function parseGameUiViewport(value: string): GameUiViewport {
  const match = /^(?:([\w-]+)=)?(\d{2,5})x(\d{2,5})$/u.exec(value.trim())
  if (!match)
    throw new AdvCommandError('ADV_USAGE', `Invalid viewport "${value}"; use WIDTHxHEIGHT or name=WIDTHxHEIGHT.`)
  const [, name, width, height] = match
  return { name: name ?? `${width}x${height}`, width: Number(width), height: Number(height) }
}

async function importPlaywright(): Promise<typeof import('@playwright/test')> {
  for (const specifier of ['playwright', '@playwright/test']) {
    try {
      return await import(/* @vite-ignore */ specifier)
    }
    catch {}
  }
  throw new AdvCommandError('ADV_USAGE', 'Theme screenshots need Playwright. Install it in the project with "npm i -D playwright" and run "npx playwright install chromium".')
}

/** The same Vite player the desktop app previews with; it also compiles Markdown chapters. */
async function startProjectServer(cwd: string): Promise<{ url: string, server: ViteDevServer }> {
  const { createProjectPreviewServer } = await import('../commands/preview')
  const preview = await createProjectPreviewServer({ userRoot: cwd }, {
    logLevel: 'error',
    clearScreen: false,
    server: { host: '127.0.0.1', port: 0, open: false, watch: null },
  })
  await preview.server.listen()
  const { port } = preview.server.httpServer!.address() as { port: number }
  return { url: `http://127.0.0.1:${port}`, server: preview.server }
}

async function visible(locator: Locator): Promise<boolean> {
  return await locator.first().isVisible().catch(() => false)
}

/** Advance like a player: Space, with a click on the text every few steps in case keys are rebound. */
async function advance(page: Page, step: number) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.())
  const target = page.locator('.adv-dialog-box .dialog-content, .adv-black').first()
  if (step % 4 === 3 && await visible(target))
    await target.click({ timeout: 2000 }).catch(() => {})
  else
    await page.keyboard.press('Space')
  await page.waitForTimeout(220)
}

/** Wait for fonts and drop hover and focus, so tooltips do not cover the frame. */
async function settle(page: Page) {
  await page.mouse.move(0, 0)
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.())
  await page.evaluate(() => document.fonts?.ready).catch(() => {})
  await page.waitForTimeout(450)
}

async function captureViewport(browser: Browser, url: string, viewport: GameUiViewport, options: GameUiScreenshotOptions, result: GameUiScreenshotResult) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    locale: options.locale ?? 'zh-CN',
    reducedMotion: 'reduce',
    colorScheme: options.colorScheme,
  })
  const page = await context.newPage()
  page.on('pageerror', error => result.consoleErrors.push(`[${viewport.name}] ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error')
      result.consoleErrors.push(`[${viewport.name}] ${message.text()}`)
  })
  const directory = join(result.outDir, viewport.name)
  mkdirSync(directory, { recursive: true })
  const shoot = async (state: GameUiScreenshotState) => {
    await settle(page)
    const file = join(directory, `${gameUiScreenshotStates.indexOf(state) + 1}-${state}.png`)
    await page.screenshot({ path: file })
    result.shots.push({
      state,
      viewport: viewport.name,
      file,
      ...(options.inline ? { inline: (await page.screenshot({ type: 'jpeg', quality: 72 })).toString('base64') } : {}),
    })
  }
  const miss = (state: GameUiScreenshotState, reason: string) => result.missing.push({ state, viewport: viewport.name, reason })

  try {
    const dialogue = page.locator('.adv-dialog-box .dialog-content').first()
    const choice = page.locator('.adv-option').first()
    const maxSteps = options.maxSteps ?? 80
    const startGame = async () => {
      // A full load, so a later pass does not inherit text the stress frames replaced.
      await page.goto('about:blank')
      await page.goto(`${url}/#/start`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
      await page.locator('[data-adv-ui="game"]').first().waitFor({ state: 'visible', timeout: 90_000 })
      await settle(page)
    }
    const play = async () => {
      const start = page.locator('[data-adv-ui="game"] .start-menu-item').first()
      if (await visible(start))
        await start.click()
      else
        await page.goto(`${url}/#/game`)
      await page.waitForURL(/#\/game/u, { timeout: 15_000 }).catch(() => {})
    }
    /** Advance until a dialogue line with text, stopping early at a choice. */
    const toDialogue = async () => {
      for (let step = 0; step < maxSteps; step++) {
        if (await visible(choice))
          return false
        if (await visible(dialogue) && (await dialogue.textContent())?.trim())
          return true
        await advance(page, step)
      }
      return false
    }
    const openModal = async (state: 'backlog' | 'save', trigger: Locator, reason: string) => {
      if (!(await visible(trigger)))
        return miss(state, reason)
      await trigger.click()
      const modal = page.locator('[data-adv-ui="game"] [role="dialog"]').first()
      if (!(await modal.waitFor({ state: 'visible', timeout: 5000 }).then(() => true, () => false)))
        return miss(state, `The ${state} dialog did not open.`)
      await shoot(state)
      await page.keyboard.press('Escape')
      await modal.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
    }
    // Replacing rendered text detaches it from Vue, so each stress frame ends a pass.
    const stress = (selector: string) => page.evaluate(({ selector, text }) => {
      const element = document.querySelector<HTMLElement>(selector)
      if (element)
        element.textContent = text
      return Boolean(element)
    }, { selector, text: longText })

    await startGame()
    await shoot('title')
    await play()
    if (await toDialogue())
      await shoot('dialogue')
    else
      miss('dialogue', 'No dialogue line appeared before the first choice.')

    for (let step = 0; step < maxSteps && !(await visible(choice)); step++)
      await advance(page, step)
    const reachedChoice = await visible(choice)
    if (reachedChoice)
      await shoot('choice')
    else
      miss('choice', `No choice menu within ${maxSteps} steps; the story may have no choices yet.`)

    await openModal('backlog', page.locator('.dialog-controls-playback .dialog-control').first(), 'The dialog control bar is hidden or overridden.')
    await openModal('save', page.locator('.dialog-controls button:has(.i-ri-save-line)').first(), 'No save control was found in the dialog control bar.')

    if (reachedChoice && await stress('.adv-option'))
      await shoot('long-choice')
    else
      miss('long-choice', 'No choice menu was on screen.')

    await startGame()
    await play()
    if (await toDialogue() && await stress('.adv-dialog-box .dialog-content'))
      await shoot('long-dialogue')
    else
      miss('long-dialogue', 'No dialogue line was on screen.')
  }
  finally {
    await context.close()
  }
}

/** Render the title, a dialogue line, a choice menu, the backlog, the save screen and long-text stress frames, and write PNGs. */
export async function captureGameUiScreenshots(options: GameUiScreenshotOptions): Promise<GameUiScreenshotResult> {
  const playwright = await importPlaywright()
  const outDir = resolve(options.cwd, options.outDir ?? '.adv/theme-screenshots')
  const started = options.url ? undefined : await startProjectServer(options.cwd)
  const url = (options.url ?? started!.url).replace(/\/+$/u, '')
  const result: GameUiScreenshotResult = { url, outDir, report: join(outDir, 'report.json'), shots: [], missing: [], consoleErrors: [] }
  let browser: Browser | undefined
  try {
    browser = await playwright.chromium.launch({ headless: true }).catch((error: unknown) => {
      throw new AdvCommandError('ADV_USAGE', `Chromium could not start (${error instanceof Error ? error.message.split('\n')[0] : String(error)}). Run "npx playwright install chromium".`)
    })
    for (const viewport of options.viewports ?? defaultGameUiViewports)
      await captureViewport(browser, url, viewport, options, result)
  }
  finally {
    await browser?.close()
    await started?.server.close()
  }
  mkdirSync(outDir, { recursive: true })
  writeFileSync(result.report, `${JSON.stringify({
    url,
    shots: result.shots.map(({ inline: _inline, ...shot }) => shot),
    missing: result.missing,
    consoleErrors: result.consoleErrors,
  }, null, 2)}\n`)
  return result
}

import type { Argv } from 'yargs'
import consola from 'consola'
import c from 'picocolors'
import { commonOptions } from './utils'

/**
 * advjs export xxx.mp4
 */
export function installExportCommand(cli: Argv) {
  cli.command(
    'export [entry]',
    'Export to Video',
    args => commonOptions(args),
    async ({ entry }) => {
      consola.info('Export to video', entry)

      const { chromium } = await import('@playwright/test')
      const browser = await chromium.launch({
        headless: true,
      })

      const targetUrl = 'https://love.demo.advjs.org/#/start'
      const scale = 2
      const videoSize = {
        width: 1920 * scale,
        height: 1080 * scale,
      }

      const context = await browser.newContext({
        viewport: videoSize,
        recordVideo: {
          dir: 'tmp/videos',
          size: videoSize,
        },
      })

      const page = await context.newPage()
      consola.info('Opening page', c.cyan(targetUrl))
      await page.goto(targetUrl)
      consola.start('Waiting for page to load...')
      await page.waitForLoadState('networkidle')
      consola.success('Page loaded')

      console.log()
      consola.start('Recording video...')

      await page.waitForTimeout(3000)

      consola.success('Recording video done')
      await browser.close()

      const path = await page.video()?.path()
      consola.success('Video saved to', c.dim(path))
    },
  )
}

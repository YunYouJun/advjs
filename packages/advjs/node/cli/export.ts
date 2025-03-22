import type { Argv } from 'yargs'
import { consola } from 'consola'
import { colors } from 'consola/utils'
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
      consola.info('Export to video:', colors.green(entry))

      const { chromium } = await import('@playwright/test')
      const browser = await chromium.launch({
        // headless: true,
      })

      const targetUrl = 'https://love.demo.advjs.org/#/start'
      const videoSize = {
        width: 1920,
        height: 1080,
      }

      const context = await browser.newContext({
        deviceScaleFactor: 2,
        viewport: {
          ...videoSize,
        },
        recordVideo: {
          dir: 'dist/videos',
          size: videoSize,
        },
      })

      const page = await context.newPage()
      consola.info('Opening page', colors.cyan(targetUrl))
      await page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
      })
      consola.success('Page domcontentloaded')
      await page.waitForTimeout(1000)

      console.log()
      consola.start('Recording video...')

      await page.waitForTimeout(3000)

      /**
       * screenshot
       */
      async function screenshot(index?: number) {
        await page.screenshot({ path: `dist/screenshots/${index}.png`, fullPage: true, omitBackground: true })
      }

      for (let i = 0; i < 200; i++) {
        if (i % 60 === 0) {
          consola.info('Screenshot index:', colors.dim(i))
        }
        await screenshot(i)
      }

      consola.success('Recording video done')
      await browser.close()

      const path = await page.video()?.path()
      consola.success('Video saved to', colors.dim(path || ''))
    },
  )
}

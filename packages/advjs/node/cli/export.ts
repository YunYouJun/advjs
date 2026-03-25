import type { Argv } from 'yargs'
import { consola } from 'consola'
import { colors } from 'consola/utils'
import { t } from './i18n'
import { commonOptions } from './utils'

/**
 * advjs export xxx.mp4
 */
export function installExportCommand(cli: Argv) {
  cli.command(
    'export',
    t('export.desc'),
    args => commonOptions(args),
    async () => {
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
      consola.info(t('export.opening_page'), colors.cyan(targetUrl))
      await page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
      })
      consola.success(t('export.page_loaded'))
      await page.waitForTimeout(1000)

      console.log()
      consola.start(t('export.recording'))

      await page.waitForTimeout(3000)

      /**
       * screenshot
       */
      async function screenshot(index?: number) {
        await page.screenshot({ path: `dist/screenshots/${index}.png`, fullPage: true, omitBackground: true })
      }

      for (let i = 0; i < 200; i++) {
        if (i % 60 === 0) {
          consola.info(t('export.screenshot_index'), colors.dim(i))
        }
        await screenshot(i)
      }

      consola.success(t('export.recording_done'))
      await browser.close()

      const path = await page.video()?.path()
      consola.success(t('export.video_saved'), colors.dim(path || ''))
    },
  )
}

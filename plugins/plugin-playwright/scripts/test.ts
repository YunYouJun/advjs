import { consola } from 'consola'
import { colors } from 'consola/utils'

export async function test() {
  const { chromium } = await import('@playwright/test')
  const browser = await chromium.launch({
    // headless: true,
    headless: false,
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
  })

  const page = await context.newPage()
  consola.info('Opening page', colors.cyan(targetUrl))
  await page.goto(targetUrl, {
    waitUntil: 'domcontentloaded',
  })
}

test()

import type { Project } from '@playwright/test'
import { devices } from '@playwright/test'

/** Browser/device emulation, never evidence of physical-device testing. */
export function audioBrowserMatrix(): Project[] {
  return [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'desktop-firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 900 } } },
    { name: 'desktop-webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 900 } } },
    { name: 'phone-chromium-emulated', use: { ...devices['Pixel 7'] } },
    { name: 'phone-webkit-emulated', use: { ...devices['iPhone 13'] } },
    { name: 'tablet-chromium-emulated', use: { ...devices['iPad Pro 11'], browserName: 'chromium' } },
    { name: 'tablet-webkit-emulated', use: { ...devices['iPad Pro 11'] } },
  ]
}

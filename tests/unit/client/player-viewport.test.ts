import { expect, it } from 'vitest'
import html from '../../../packages/client/index.html?raw'

it('allows browser zoom and exposes device safe-area insets', () => {
  const document = new DOMParser().parseFromString(html, 'text/html')
  const viewport = document.querySelector('meta[name="viewport"]')!.getAttribute('content')!
  expect(viewport).toContain('width=device-width')
  expect(viewport).toContain('viewport-fit=cover')
  expect(viewport).not.toMatch(/maximum-scale|user-scalable/)
})

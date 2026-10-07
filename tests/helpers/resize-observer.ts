import { vi } from 'vitest'

// jsdom has no layout observer. Real slider measurements and dragging are
// verified in Playwright; unit tests cover the public value/event contract.
export function mockResizeObserver() {
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  })
}

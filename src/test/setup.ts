import '@testing-library/jest-dom/vitest'
import {afterEach, beforeEach, vi} from 'vitest'
import {cleanup, resetAllStores} from './test-utils'

if (typeof globalThis.ResizeObserver === 'undefined') {
  class NoopResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = NoopResizeObserver as unknown as typeof ResizeObserver
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  resetAllStores()
  window.history.pushState({}, 'Test', '/')
  vi.useRealTimers()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

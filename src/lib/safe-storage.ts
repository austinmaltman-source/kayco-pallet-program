// localStorage is only a cache/offline fallback now (the Worker's D1 copy is
// the source of truth), so a full quota must mean "skip the cache write" -
// never an uncaught QuotaExceededError crashing a render (which is exactly
// what took the app down for Austin on 2026-08-18: a maxed-out origin made
// every store subscription throw).
let warned = false

export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch (error) {
    if (!warned) {
      warned = true
      console.warn(
        `[storage] cache write failed for "${key}" (quota?) - continuing without local cache`,
        error,
      )
    }
    return false
  }
}

export function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // nothing to do
  }
}

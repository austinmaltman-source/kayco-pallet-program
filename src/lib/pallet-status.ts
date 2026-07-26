import type { PalletStatus } from '../types'

export const STATUS_ORDER: PalletStatus[] = ['draft', 'ready', 'in_build', 'built']

function statusIndex(status: PalletStatus) {
  return STATUS_ORDER.indexOf(status)
}

// Forward moves are always legal. Backward moves are limited to one step so a
// mis-click can be corrected without rewriting the workflow (built → in_build
// is fine; built → draft is not).
export function isAllowedTransition(from: PalletStatus, to: PalletStatus) {
  const delta = statusIndex(to) - statusIndex(from)
  return delta > 0 || delta === -1
}

export function isBackwardTransition(from: PalletStatus, to: PalletStatus) {
  return statusIndex(to) < statusIndex(from)
}

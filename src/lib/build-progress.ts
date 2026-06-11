import type { DisplayProject } from '../types'

// How many of a pallet's requested quantity are still left to build.
// A pallet marked built is done even if the log undercounts.
export function remainingPalletsToBuild(
  pallet: Pick<DisplayProject, 'quantity' | 'buildLog' | 'status'>,
) {
  const quantity =
    typeof pallet.quantity === 'number' && pallet.quantity >= 1
      ? Math.floor(pallet.quantity)
      : 1
  if (pallet.status === 'built') return 0
  const built = (pallet.buildLog ?? []).reduce((sum, entry) => sum + entry.built, 0)
  return Math.max(0, quantity - built)
}

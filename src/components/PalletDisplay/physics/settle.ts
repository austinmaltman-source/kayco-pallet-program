import { useDisplayStore } from '../../../stores/display-store'

interface SettleUpdate {
  id: string
  position: [number, number, number]
  quaternion: [number, number, number, number]
}

// A drop can disturb several bodies that go back to sleep at slightly
// different times. Batch the write-backs so the undo history gets one entry
// per settle wave, not one per body.
const queue = new Map<string, SettleUpdate>()
let timer: ReturnType<typeof setTimeout> | null = null

export function queueSettledTransform(update: SettleUpdate) {
  queue.set(update.id, update)
  if (timer !== null) return
  timer = setTimeout(() => {
    const updates = [...queue.values()]
    queue.clear()
    timer = null
    useDisplayStore.getState().settlePlacements(updates)
  }, 250)
}

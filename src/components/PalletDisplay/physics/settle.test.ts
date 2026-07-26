import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {cancelPendingSettle, queueSettledTransform} from './settle'
import {useDisplayStore} from '../../../stores/display-store'
import {useRetailerStore} from '../../../stores/retailer-store'
import {makeRetailer} from '../../../test/test-utils'

function seedProjectWithPlacement() {
  useRetailerStore.getState().setRetailers([
    makeRetailer({id: 'ret-main', name: 'Main Retailer'}),
  ])
  const store = useDisplayStore.getState()
  store.createProject('Settle Wave', {
    palletType: 'full',
    season: 'none',
    retailerId: 'ret-main',
  })
  useDisplayStore.setState((state) => ({
    currentProject: state.currentProject && {
      ...state.currentProject,
      placements: [
        {
          id: 'p-1', slotId: '', width: 4, height: 8, depth: 3,
          color: '#000', label: 'Alpha', sku: 'A',
          position: [0, 7, 14] as [number, number, number],
          quaternion: [0, 0, 0, 1] as [number, number, number, number],
        },
      ],
    },
    history: state.currentProject ? [structuredClone({
      ...state.currentProject,
      placements: [],
    })] : [],
    historyIndex: 0,
  }))
}

describe('settle queue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    seedProjectWithPlacement()
  })

  afterEach(() => {
    cancelPendingSettle()
    vi.useRealTimers()
  })

  it('flushes queued transforms to the store after the debounce window', () => {
    queueSettledTransform({id: 'p-1', position: [5, 22, 10], quaternion: [0, 0, 0, 1]})
    vi.advanceTimersByTime(300)
    expect(useDisplayStore.getState().currentProject?.placements[0].position).toEqual([5, 22, 10])
  })

  it('cancelPendingSettle drops a pending wave', () => {
    queueSettledTransform({id: 'p-1', position: [5, 22, 10], quaternion: [0, 0, 0, 1]})
    cancelPendingSettle()
    vi.advanceTimersByTime(300)
    expect(useDisplayStore.getState().currentProject?.placements[0].position).toEqual([0, 7, 14])
  })

  it('undo cancels a pending settle wave so it cannot clobber the restored state', () => {
    // Simulate a drop: commit a move into history, then a settle wave queues.
    const store = useDisplayStore.getState()
    store.settlePlacements([{id: 'p-1', position: [3, 15, 8], quaternion: [0, 0, 0, 1]}])
    queueSettledTransform({id: 'p-1', position: [3.2, 15.1, 8.05], quaternion: [0, 0, 0, 1]})

    store.undo()
    vi.advanceTimersByTime(300)

    // The pre-undo wave must not re-apply the settled transform.
    expect(useDisplayStore.getState().currentProject?.placements).toHaveLength(0)
  })
})

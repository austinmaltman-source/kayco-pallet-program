import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __resetStateSyncForTests,
  deflateValue,
  fetchServerState,
  inflateValue,
  markSynced,
  schedulePush,
  selectApplicableEntries,
} from './state-sync'

function okJson(data: unknown) {
  return {
    ok: true,
    json: async () => data,
  } as Response
}

describe('state-sync', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    __resetStateSyncForTests()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('fetchServerState returns entries and flips online', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      okJson({ data: { 'palletforge-retailers': { value: '[]', updatedAt: 5 } } }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const entries = await fetchServerState()
    expect(entries?.get('palletforge-retailers')?.value).toBe('[]')
  })

  it('fetchServerState returns null on failure without throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))
    expect(await fetchServerState()).toBeNull()
  })

  it('schedulePush is a no-op while the server is offline', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    schedulePush('palletforge-retailers', '[1]')
    await vi.runAllTimersAsync()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('debounces pushes and skips payloads that already match the server', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okJson({ data: {} })) // fetchServerState
      .mockResolvedValue(okJson({ data: { updatedAt: 1 } })) // PUTs
    vi.stubGlobal('fetch', fetchMock)
    await fetchServerState()

    schedulePush('palletforge-retailers', '[1]')
    schedulePush('palletforge-retailers', '[1,2]')
    await vi.runAllTimersAsync()

    // One PUT (debounced), carrying the latest payload.
    const puts = fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT')
    expect(puts).toHaveLength(1)
    expect(JSON.parse(puts[0][1].body as string)).toEqual({ value: '[1,2]' })

    // Re-pushing the synced payload does nothing.
    schedulePush('palletforge-retailers', '[1,2]')
    await vi.runAllTimersAsync()
    expect(
      fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT'),
    ).toHaveLength(1)
  })

  it('deflate/inflate round-trips large payloads', async () => {
    const big = JSON.stringify(
      Array.from({ length: 2000 }, (_, i) => ({ id: `prod-${i}`, name: `Item ${i}` })),
    )
    const wire = await deflateValue(big)
    expect(wire.startsWith('gz:')).toBe(true)
    expect(wire.length).toBeLessThan(big.length / 5)
    expect(await inflateValue(wire)).toBe(big)
    // Uncompressed values pass through untouched.
    expect(await inflateValue('[1,2]')).toBe('[1,2]')
  })

  it('fetchServerState inflates compressed entries transparently', async () => {
    const wire = await deflateValue('["shared"]')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        okJson({ data: { 'palletforge-products': { value: wire, updatedAt: 9 } } }),
      ),
    )
    const entries = await fetchServerState()
    expect(entries?.get('palletforge-products')?.value).toBe('["shared"]')
  })

  it('selectApplicableEntries returns only changed known keys', () => {
    markSynced('palletforge-retailers', '[1]')
    const entries = new Map([
      ['palletforge-retailers', { value: '[1]', updatedAt: 1 }], // unchanged
      ['palletforge-seasons', { value: '[2]', updatedAt: 2 }], // changed
      ['not-a-real-key', { value: '[3]', updatedAt: 3 }], // unknown
    ])
    const applicable = selectApplicableEntries(entries)
    expect([...applicable.entries()]).toEqual([['palletforge-seasons', '[2]']])
  })
})

// Client half of the shared-state backend (see worker/index.ts).
//
// Model: localStorage stays the fast local cache and offline fallback; the
// Worker's D1 copy is the shared source of truth across devices and roles.
// On startup App.tsx hydrates from the server when reachable (falling back to
// localStorage), then every store write is mirrored to both. Last write wins
// per key. When the server is unreachable (e.g. `npm run dev` without
// `wrangler dev`, or the old Vercel deploy), the app behaves exactly as the
// localStorage-only version did.

export const SYNCED_KEYS = [
  'palletforge-products',
  'palletforge-retailers',
  'palletforge-seasons',
  'palletforge-salespeople',
  'palletforge-inventory',
  'palletforge-pallets',
  'palletforge-app-settings',
] as const

export type SyncedKey = (typeof SYNCED_KEYS)[number]

export interface ServerEntry {
  value: string
  updatedAt: number
}

const PUSH_DEBOUNCE_MS = 1200
// Payloads above this are gzipped before PUT (the full catalog is ~3MB of
// JSON, well over D1's 2MB row cap; it compresses to a few hundred KB).
const COMPRESS_THRESHOLD = 50_000
const GZ_PREFIX = 'gz:'

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function pipeBytes(
  bytes: Uint8Array,
  transform: { readable: ReadableStream<Uint8Array>; writable: WritableStream<Uint8Array> },
): Promise<Uint8Array> {
  const writer = transform.writable.getWriter()
  const writing = (async () => {
    await writer.write(bytes)
    await writer.close()
  })()
  const buffer = await new Response(transform.readable).arrayBuffer()
  await writing
  return new Uint8Array(buffer)
}

export async function deflateValue(value: string): Promise<string> {
  const compressed = await pipeBytes(
    new TextEncoder().encode(value),
    new CompressionStream('gzip'),
  )
  return GZ_PREFIX + bytesToBase64(compressed)
}

export async function inflateValue(value: string): Promise<string> {
  if (!value.startsWith(GZ_PREFIX)) return value
  const plain = await pipeBytes(
    base64ToBytes(value.slice(GZ_PREFIX.length)),
    new DecompressionStream('gzip'),
  )
  return new TextDecoder().decode(plain)
}

let serverOnline = false
// Last payload per key that is known to match the server (either applied
// from it or successfully pushed). Used to skip echo pushes and no-op applies.
const lastSynced = new Map<string, string>()
const pushTimers = new Map<string, ReturnType<typeof setTimeout>>()
const pendingValues = new Map<string, string>()

export function isServerOnline(): boolean {
  return serverOnline
}

// --- Sync status (for the UI indicator) ---------------------------------

export type SyncStatus = 'synced' | 'syncing' | 'offline'

const statusListeners = new Set<() => void>()

function notifyStatus() {
  for (const listener of statusListeners) listener()
}

export function getSyncStatus(): SyncStatus {
  if (!serverOnline) return 'offline'
  return pendingValues.size > 0 || pushTimers.size > 0 ? 'syncing' : 'synced'
}

export function subscribeSyncStatus(listener: () => void): () => void {
  statusListeners.add(listener)
  return () => statusListeners.delete(listener)
}

// True while a local write for `key` is still waiting to reach the server.
// Poll-applies skip such keys so a slow push is never stomped by stale
// server data.
export function hasPendingPush(key: string): boolean {
  return pendingValues.has(key) || pushTimers.has(key)
}

// Record that `value` for `key` matches the server without pushing (used when
// applying a server payload into a store, whose subscription then fires).
export function markSynced(key: SyncedKey, value: string): void {
  lastSynced.set(key, value)
}

export async function fetchServerState(
  timeoutMs = 3500,
): Promise<Map<string, ServerEntry> | null> {
  try {
    const res = await fetch('/api/state', {
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) throw new Error(`GET /api/state ${res.status}`)
    const body = (await res.json()) as {
      data?: Record<string, ServerEntry>
    }
    if (!body || typeof body.data !== 'object' || body.data === null) {
      throw new Error('Malformed /api/state response')
    }
    serverOnline = true
    notifyStatus()
    const entries = new Map<string, ServerEntry>()
    for (const [key, entry] of Object.entries(body.data)) {
      if (!entry || typeof entry.value !== 'string') continue
      // Callers always see plain JSON; compression is a transport detail.
      entries.set(key, { ...entry, value: await inflateValue(entry.value) })
    }
    return entries
  } catch {
    serverOnline = false
    notifyStatus()
    return null
  }
}

async function pushNow(key: SyncedKey): Promise<void> {
  const value = pendingValues.get(key)
  if (value === undefined) return
  pendingValues.delete(key)
  try {
    const wire =
      value.length > COMPRESS_THRESHOLD ? await deflateValue(value) : value
    const res = await fetch(`/api/state/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: wire }),
    })
    if (res.ok) {
      lastSynced.set(key, value)
      notifyStatus()
      return
    }
    if (res.status >= 400 && res.status < 500) {
      // The server is reachable but rejected this payload (too large,
      // unknown key). Retrying the same bytes would fail forever - drop it
      // and surface in the console; the localStorage copy is still safe.
      console.error(`[state-sync] PUT ${key} rejected: ${res.status}`)
      notifyStatus()
      return
    }
    throw new Error(`PUT ${key} ${res.status}`)
  } catch {
    // Network/server failure: keep the value queued so the next write (or
    // reconnect) retries; the localStorage copy is already safe.
    if (!pendingValues.has(key)) pendingValues.set(key, value)
    serverOnline = false
    notifyStatus()
  }
}

// Mirror a store write to the server, debounced per key. No-op while the
// server is offline or when the payload already matches the server copy.
export function schedulePush(key: SyncedKey, value: string): void {
  if (!serverOnline) return
  if (lastSynced.get(key) === value) return
  pendingValues.set(key, value)
  const existing = pushTimers.get(key)
  if (existing) clearTimeout(existing)
  pushTimers.set(
    key,
    setTimeout(() => {
      pushTimers.delete(key)
      void pushNow(key)
    }, PUSH_DEBOUNCE_MS),
  )
  notifyStatus()
}

// Decide which keys from a server snapshot should be applied locally: the
// payload must differ from what we already know matches the server.
export function selectApplicableEntries(
  entries: Map<string, ServerEntry>,
): Map<SyncedKey, string> {
  const result = new Map<SyncedKey, string>()
  for (const key of SYNCED_KEYS) {
    const entry = entries.get(key)
    if (!entry) continue
    if (lastSynced.get(key) === entry.value) continue
    // Never let stale server data overwrite a local edit still in flight.
    if (hasPendingPush(key)) continue
    result.set(key, entry.value)
  }
  return result
}

// Test hook: reset module state between tests.
export function __resetStateSyncForTests(): void {
  serverOnline = false
  lastSynced.clear()
  pendingValues.clear()
  for (const timer of pushTimers.values()) clearTimeout(timer)
  pushTimers.clear()
}

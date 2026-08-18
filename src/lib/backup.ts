// Full-app backup as a downloadable JSON file, and restore from one.
// Two jobs: an insurance copy of everything, and the migration path when the
// app moves origins (localStorage is per-origin - e.g. old Vercel URL ->
// palletforge.pages.dev).
import { SYNCED_KEYS, fetchServerState, pushKeyNow, type SyncedKey } from './state-sync'
import { safeSetItem } from './safe-storage'

const BACKUP_VERSION = 1

export interface BackupFile {
  app: 'palletforge'
  version: number
  exportedAt: string
  data: Partial<Record<SyncedKey, string>>
}

export function collectBackup(): BackupFile {
  const data: Partial<Record<SyncedKey, string>> = {}
  for (const key of SYNCED_KEYS) {
    const value = localStorage.getItem(key)
    if (value !== null) data[key] = value
  }
  return {
    app: 'palletforge',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  }
}

export function downloadBackup(): void {
  const backup = collectBackup()
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `palletforge-backup-${backup.exportedAt.slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(link.href)
}

// Validates and normalizes a parsed backup file. Returns the entries to
// apply, or throws with a human-readable reason.
export function parseBackup(raw: unknown): Map<SyncedKey, string> {
  if (!raw || typeof raw !== 'object') throw new Error('Not a backup file.')
  const file = raw as Partial<BackupFile>
  if (file.app !== 'palletforge' || typeof file.data !== 'object' || !file.data) {
    throw new Error('Not a Kayco Pallet Programs backup file.')
  }
  const entries = new Map<SyncedKey, string>()
  for (const key of SYNCED_KEYS) {
    const value = (file.data as Record<string, unknown>)[key]
    if (typeof value !== 'string') continue
    try {
      JSON.parse(value)
    } catch {
      throw new Error(`Backup entry "${key}" is corrupted.`)
    }
    entries.set(key, value)
  }
  if (entries.size === 0) throw new Error('Backup file contains no data.')
  return entries
}

// Writes the backup into localStorage and (when the shared server is
// reachable) pushes every key so the restore wins there too. The caller
// reloads the page afterwards so the app rehydrates from the restored state.
export async function restoreBackup(fileText: string): Promise<number> {
  const entries = parseBackup(JSON.parse(fileText))
  // Probe the server live: if it's reachable, the restore MUST win there too,
  // otherwise the next hydration would re-apply the server's old state on
  // top of the restore. Unreachable -> localStorage-only mode, local is fine.
  const server = await fetchServerState()
  for (const [key, value] of entries) {
    safeSetItem(key, value)
  }
  if (server) {
    for (const [key, value] of entries) {
      await pushKeyNow(key, value)
    }
  }
  return entries.size
}

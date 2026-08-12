import { useSyncExternalStore } from 'react'
import {
  getSyncStatus,
  subscribeSyncStatus,
  type SyncStatus,
} from '../../lib/state-sync'

const STATUS_CONFIG: Record<SyncStatus, { dot: string; label: string; title: string }> = {
  synced: {
    dot: 'bg-emerald-500',
    label: 'Shared',
    title: 'Connected - everyone sees this data',
  },
  syncing: {
    dot: 'bg-amber-400',
    label: 'Saving…',
    title: 'Sending your latest changes to the shared server',
  },
  offline: {
    dot: 'bg-[#555]',
    label: 'Local only',
    title:
      'Shared server unreachable - changes stay in this browser until it reconnects',
  },
}

// Chip showing whether data is flowing to the shared backend.
// variant "sidebar" fits the manager layout's dark sidebar footer;
// variant "bar" is compact for the other layouts' top bars (dark for the
// builder header).
export function SyncStatusChip({
  variant = 'sidebar',
  dark = false,
}: {
  variant?: 'sidebar' | 'bar'
  dark?: boolean
}) {
  const status = useSyncExternalStore(subscribeSyncStatus, getSyncStatus)
  const config = STATUS_CONFIG[status]
  if (variant === 'bar') {
    return (
      <span
        title={config.title}
        className={`flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium select-none ${
          dark ? 'text-white/50' : 'text-[#888]'
        }`}
      >
        <span className={`w-2 h-2 rounded-full ${config.dot}`} />
        {config.label}
      </span>
    )
  }
  return (
    <div
      title={config.title}
      className="flex items-center gap-3 px-3 py-2 text-[#666] select-none"
    >
      <span className={`w-[9px] h-[9px] ml-0.5 rounded-full ${config.dot}`} />
      <span className="text-[11px] font-medium">{config.label}</span>
    </div>
  )
}

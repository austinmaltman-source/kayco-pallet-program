import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Briefcase, HardHat, ShoppingCart, Compass, Download, Upload } from 'lucide-react'
import { useRoleStore, ROLE_LABELS, ROLE_DESCRIPTIONS } from '../stores/role-store'
import { downloadBackup, restoreBackup } from '../lib/backup'
import { useConfirm } from '../components/ConfirmDialog'
import type { Role } from '../types'

const TILE_ORDER: Role[] = ['salesman', 'builder', 'buyer', 'manager']

const TILE_ICON: Record<Role, typeof Briefcase> = {
  salesman: Briefcase,
  builder: HardHat,
  buyer: ShoppingCart,
  manager: Compass,
}

export function RoleLauncher() {
  const navigate = useNavigate()
  const setRole = useRoleStore((state) => state.setRole)
  const { confirm, dialog: confirmDialog } = useConfirm()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)

  const choose = (role: Role) => {
    setRole(role)
    navigate(`/${role}`)
  }

  const handleRestoreFile = async (file: File) => {
    const ok = await confirm({
      title: 'Restore from backup?',
      description:
        'This replaces the app data for everyone with the backup file contents. The current data is overwritten.',
      confirmLabel: 'Restore',
      destructive: true,
    })
    if (!ok) return
    setRestoring(true)
    setRestoreMessage(null)
    try {
      const count = await restoreBackup(await file.text())
      setRestoreMessage(`Restored ${count} data sets. Reloading…`)
      window.location.reload()
    } catch (error) {
      setRestoreMessage(
        error instanceof Error ? error.message : 'Restore failed.',
      )
      setRestoring(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white flex flex-col">
      <header className="px-12 pt-12">
        <h1 className="text-[28px] font-semibold tracking-display">Kayco Pallet Programs</h1>
        <p className="text-[13px] text-[#888] mt-2 max-w-xl">
          Pallet program planning for Kayco. Pick how you're using the app today —
          you can switch any time.
        </p>
      </header>

      <main className="flex-1 px-12 py-12 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[1100px] w-full mx-auto">
        {TILE_ORDER.map((role) => {
          const Icon = TILE_ICON[role]
          return (
            <button
              key={role}
              onClick={() => choose(role)}
              className="group relative text-left rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] hover:border-white/30 p-8 transition-all"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
                  <Icon size={20} className="text-white/70 group-hover:text-white transition-colors" />
                </div>
                <p className="text-[10px] uppercase tracking-wider text-[#666]">Open as</p>
              </div>
              <p className="text-[24px] font-semibold tracking-tight">{ROLE_LABELS[role]}</p>
              <p className="text-[13px] text-[#888] mt-2 leading-relaxed">
                {ROLE_DESCRIPTIONS[role]}
              </p>
              <p className="absolute right-7 bottom-7 text-[12px] text-[#555] group-hover:text-white transition-colors">
                Enter →
              </p>
            </button>
          )
        })}
      </main>

      <footer className="px-12 pb-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-[#555]">
        <span>
          Each role has its own workspace. The Manager workspace can see
          everything the other three do.
        </span>
        <span className="ml-auto flex items-center gap-4">
          {restoreMessage && <span className="text-[#999]">{restoreMessage}</span>}
          <button
            onClick={downloadBackup}
            className="inline-flex items-center gap-1.5 text-[#666] hover:text-white transition-colors"
          >
            <Download size={12} />
            Export backup
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={restoring}
            className="inline-flex items-center gap-1.5 text-[#666] hover:text-white transition-colors disabled:opacity-50"
          >
            <Upload size={12} />
            {restoring ? 'Restoring…' : 'Restore backup'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) void handleRestoreFile(file)
            }}
          />
        </span>
      </footer>
      {confirmDialog}
    </div>
  )
}

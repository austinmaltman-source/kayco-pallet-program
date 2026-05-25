import { ArrowLeft, Eye } from 'lucide-react'
import { useSmartBack } from '../../lib/use-smart-back'

export function ViewAsBanner({ label }: { label: string }) {
  const smartBack = useSmartBack()
  return (
    <div className="bg-[#171717] text-white">
      <div className="max-w-[1400px] mx-auto px-8 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-[12px]">
          <Eye className="w-3.5 h-3.5 text-white/60" />
          <span className="text-white/60">Viewing as</span>
          <span className="font-semibold">{label}</span>
          <span className="text-white/40 hidden sm:inline">
            · changes here apply to the live data
          </span>
        </div>
        <button
          onClick={() => smartBack('/manager')}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-white/80 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>
      </div>
    </div>
  )
}

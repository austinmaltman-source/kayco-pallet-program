import { useState, useRef, useEffect } from 'react'
import { Undo2, Redo2, ChevronDown } from 'lucide-react'
import { useDisplayStore } from '../../stores/display-store'
import { TrayFace } from '../../types'
import { safeSetItem } from '../../lib/safe-storage'

const faceLabels: Record<TrayFace, string> = {
  front: 'Front Wall',
  back: 'Back Wall',
  left: 'Left Wall',
  right: 'Right Wall',
}

export function TopToolbar() {
  const activeFace = useDisplayStore(s => s.activeFace)
  const setActiveFace = useDisplayStore(s => s.setActiveFace)
  const undo = useDisplayStore(s => s.undo)
  const redo = useDisplayStore(s => s.redo)
  const historyIndex = useDisplayStore(s => s.historyIndex)
  const historyLength = useDisplayStore(s => s.history.length)
  const currentProject = useDisplayStore(s => s.currentProject)

  const palletType = currentProject?.palletType ?? 'full'
  const isHalf = palletType === 'half'

  const [faceOpen, setFaceOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const canUndo = historyIndex > 0
  const canRedo = historyIndex < historyLength - 1

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setFaceOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSave = () => {
    const { currentProject, projects } = useDisplayStore.getState()
    const project = currentProject
    if (!project) return
    safeSetItem('palletforge-pallets', JSON.stringify(projects))
    safeSetItem('palletforge-active-pallet-id', project.id)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-40 flex justify-center px-8">
      <div className="mt-4 mx-auto max-w-fit px-5 py-2 bg-white/90 backdrop-blur-md shadow-card rounded-lg flex items-center gap-6">
        {/* View Controls */}
        <div className="flex items-center gap-4 text-[#999]">
          {/* Face Selector Dropdown — hidden for half pallets */}
          {isHalf ? (
            <span className="text-[12px] font-medium text-[#171717]">Front Face</span>
          ) : (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setFaceOpen(!faceOpen)}
                className="flex items-center gap-1.5 cursor-pointer hover:text-[#0a72ef] transition-colors"
              >
                <span className="text-[12px] font-medium text-[#171717]">
                  {faceLabels[activeFace]}
                </span>
                <ChevronDown size={13} className="text-[#999]" />
              </button>

              {faceOpen && (
                <div className="absolute top-full mt-2 left-0 bg-white shadow-elevated rounded-lg py-1 min-w-[140px] z-50">
                  {(Object.keys(faceLabels) as TrayFace[]).map(face => (
                    <button
                      key={face}
                      onClick={() => { setActiveFace(face); setFaceOpen(false) }}
                      className={`w-full text-left px-4 py-2 text-[12px] font-medium transition-colors ${
                        activeFace === face ? 'text-[#0a72ef] bg-[#0a72ef]/5' : 'text-[#555] hover:bg-[#fafafa]'
                      }`}
                    >
                      {faceLabels[face]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Undo / Redo */}
          <div className="flex items-center gap-2">
            <button
              onClick={undo} disabled={!canUndo}
              aria-label="Undo"
              className={`p-1 rounded transition-colors ${canUndo ? 'text-[#555] hover:text-[#0a72ef] hover:bg-[#0a72ef]/5' : 'text-[#ddd]'}`}
            >
              <Undo2 size={16} />
            </button>
            <button
              onClick={redo} disabled={!canRedo}
              aria-label="Redo"
              className={`p-1 rounded transition-colors ${canRedo ? 'text-[#555] hover:text-[#0a72ef] hover:bg-[#0a72ef]/5' : 'text-[#ddd]'}`}
            >
              <Redo2 size={16} />
            </button>
          </div>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          className="bg-[#171717] text-white text-[12px] font-medium px-5 py-1.5 rounded-md hover:bg-[#333] transition-colors active:scale-[0.97]"
        >
          {saved ? 'Saved!' : 'Save'}
        </button>
      </div>
    </div>
  )
}

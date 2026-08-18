import { useState } from 'react'
import { Settings, X, Plus, Palette } from 'lucide-react'
import { useDisplayStore } from '../stores/display-store'
import { BrandingPreview } from '../components/Branding/branding-preview'
import { ColorPickerField } from '../components/Branding/color-picker-field'
import { BRAND_COLORS } from '../lib/mock-data'
import type { Brand } from '../types'

const INITIAL_BRANDS: { name: string; color: string; key: Brand }[] = [
  { name: 'Tuscanini', color: BRAND_COLORS.tuscanini, key: 'tuscanini' },
  { name: 'Kedem', color: BRAND_COLORS.kedem, key: 'kedem' },
  { name: 'Gefen', color: BRAND_COLORS.gefen, key: 'gefen' },
  { name: 'Haddar', color: BRAND_COLORS.haddar, key: 'haddar' },
]

export function BrandingPage() {
  const project = useDisplayStore((s) => s.currentProject)
  const updateBranding = useDisplayStore((s) => s.updateBranding)
  const updateLipColor = useDisplayStore((s) => s.updateLipColor)
  const [saved, setSaved] = useState(false)

  const branding = project?.branding ?? {
    headerText: 'ROSH\nHASHANAH',
    headerTextColor: '#FFFFFF',
    headerBackgroundColor: '#00A3C7',
    lipText: 'ALL YOUR HOLIDAY NEEDS',
    lipTextColor: '#FFFFFF',
  }
  const lipColor = project?.lipColor ?? '#1E3A8A'

  const [snapshot] = useState(() => ({
    branding: { ...branding },
    lipColor,
  }))

  const [activeBrands, setActiveBrands] = useState(INITIAL_BRANDS)

  const removeBrand = (key: Brand) => {
    setActiveBrands((prev) => prev.filter((b) => b.key !== key))
  }

  const addBrand = () => {
    const allBrands: { name: string; color: string; key: Brand }[] = [
      { name: 'Tuscanini', color: BRAND_COLORS.tuscanini, key: 'tuscanini' },
      { name: 'Kedem', color: BRAND_COLORS.kedem, key: 'kedem' },
      { name: 'Gefen', color: BRAND_COLORS.gefen, key: 'gefen' },
      { name: 'Haddar', color: BRAND_COLORS.haddar, key: 'haddar' },
      { name: "Lieber's", color: BRAND_COLORS.liebers, key: 'liebers' },
      { name: 'Osem', color: BRAND_COLORS.osem, key: 'osem' },
    ]
    const missing = allBrands.filter((b) => !activeBrands.find((a) => a.key === b.key))
    if (missing.length > 0) {
      setActiveBrands((prev) => [...prev, missing[0]])
    }
  }

  const handleRevert = () => {
    updateBranding(snapshot.branding)
    updateLipColor(snapshot.lipColor)
  }

  const handleSave = () => {
    if (!project) return
    // legacy palletforge-project blob no longer persisted (quota)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="px-10 py-10 max-w-6xl mx-auto space-y-8">
      {/* Page header */}
      <div>
        <h2 className="text-[28px] font-semibold tracking-display text-[#171717]">
          Branding
        </h2>
        <p className="text-[14px] text-[#666] mt-1">
          Configure display branding and visual identity
        </p>
      </div>

      {/* Section 1: Live Preview */}
      <BrandingPreview branding={branding} lipColor={lipColor} />

      {/* Section 2: Panel Configuration */}
      <div className="bg-white shadow-card rounded-lg p-8 space-y-8">
        {/* Section header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-[#999]" />
            <h3 className="text-[15px] font-semibold text-[#171717] tracking-tight-sm">Panel Configuration</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRevert}
              className="px-4 py-2 text-[12px] font-medium text-[#555] shadow-border bg-white rounded-md hover:bg-[#fafafa] transition-colors"
            >
              Revert
            </button>
            <button
              onClick={handleSave}
              disabled={!project}
              className="px-4 py-2 text-[12px] font-medium text-white bg-[#171717] rounded-md hover:bg-[#333] transition-colors"
            >
              {saved ? 'Saved!' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* 3-column grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-6">
            <ColorPickerField
              label="Header Background"
              value={branding.headerBackgroundColor || '#00A3C7'}
              onChange={(color) => updateBranding({ headerBackgroundColor: color })}
            />
            <ColorPickerField
              label="Lip Color"
              value={lipColor}
              onChange={updateLipColor}
            />
          </div>
          <div className="space-y-6">
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-[#555]">Header Text</label>
              <textarea
                value={branding.headerText || ''}
                onChange={(e) => updateBranding({ headerText: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 text-[13px] shadow-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#0a72ef]/30 focus:shadow-none resize-none"
                placeholder="Enter header text..."
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-[#555]">Lip Text</label>
              <input
                type="text"
                value={branding.lipText || ''}
                onChange={(e) => updateBranding({ lipText: e.target.value })}
                className="w-full px-3 py-2 text-[13px] shadow-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#0a72ef]/30 focus:shadow-none"
                placeholder="Enter lip text..."
              />
            </div>
          </div>
          <div className="space-y-6">
            <ColorPickerField
              label="Header Text Color"
              value={branding.headerTextColor || '#FFFFFF'}
              onChange={(color) => updateBranding({ headerTextColor: color })}
            />
            <ColorPickerField
              label="Lip Text Color"
              value={branding.lipTextColor || '#FFFFFF'}
              onChange={(color) => updateBranding({ lipTextColor: color })}
            />
          </div>
        </div>

        {/* Active Brand Assets */}
        <div className="space-y-3 pt-6" style={{ boxShadow: '0 -1px 0 0 rgba(0,0,0,0.06)' }}>
          <label className="text-[12px] font-medium text-[#555]">Active Brand Assets</label>
          <div className="flex flex-wrap items-center gap-2">
            {activeBrands.map((brand) => (
              <div
                key={brand.key}
                className="flex items-center gap-2 pl-1.5 pr-2 py-1 shadow-border bg-white rounded-md"
              >
                <div
                  className="w-4 h-4 rounded-full shrink-0"
                  style={{ backgroundColor: brand.color }}
                />
                <span className="text-[12px] font-medium text-[#555]">{brand.name}</span>
                <button
                  onClick={() => removeBrand(brand.key)}
                  className="w-4 h-4 flex items-center justify-center text-[#ccc] hover:text-red-500 transition-colors"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
            <button
              onClick={addBrand}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-[#888] bg-white rounded-md hover:text-[#0a72ef] transition-colors"
              style={{ border: '1px dashed rgba(0,0,0,0.15)' }}
            >
              <Plus className="w-3 h-3" />
              Add Brand
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

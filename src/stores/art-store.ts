import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import halfHeader from '../assets/display-art/half-header.jpg'
import halfSide from '../assets/display-art/half-side.jpg'
import halfLip from '../assets/display-art/half-lip.jpg'
import fullHeader from '../assets/display-art/full-header.jpg'
import fullLip from '../assets/display-art/full-lip.jpg'

// The printed graphics on the display (header, side panels, shelf lips).
// Defaults are cut, perspective-corrected, from Austin's photos of the real
// Kayco Passover displays (Oct 16 2026). Every promo has its own art, so each
// slot can be replaced with an uploaded image; uploads stay in this browser.

export type ArtDisplay = 'half' | 'full'
export type ArtSlot = 'header' | 'side' | 'lip'

export const ART_SLOTS: Record<ArtDisplay, { slot: ArtSlot; label: string; hint: string }[]> = {
  half: [
    { slot: 'header', label: 'Header', hint: 'Wide board above the back panel' },
    { slot: 'side', label: 'Side panels', hint: 'Tall panels on the left and right' },
    { slot: 'lip', label: 'Shelf lips', hint: 'Printed strip on each shelf front' },
  ],
  full: [
    { slot: 'header', label: 'Header', hint: 'Pop-up sign on the top tray (each face)' },
    { slot: 'lip', label: 'Tray lips', hint: 'Printed strip around every tray (repeats)' },
  ],
}

export const DEFAULT_ART: Record<ArtDisplay, Partial<Record<ArtSlot, string>>> = {
  half: { header: halfHeader, side: halfSide, lip: halfLip },
  full: { header: fullHeader, lip: fullLip },
}

// Colours sampled from the same photos, for the unprinted cardboard faces.
export const ART_COLORS: Record<ArtDisplay, { panel: string; lip: string; header: string }> = {
  half: { panel: '#05b5d3', lip: '#05b5d3', header: '#05b5d3' },
  full: { panel: '#0066f4', lip: '#0066f4', header: '#fcf405' },
}

interface ArtState {
  custom: Record<ArtDisplay, Partial<Record<ArtSlot, string>>>
  setArt: (display: ArtDisplay, slot: ArtSlot, dataUrl: string | null) => void
  resetAll: (display: ArtDisplay) => void
}

export const useArtStore = create<ArtState>()(
  persist(
    (set) => ({
      custom: { half: {}, full: {} },
      setArt: (display, slot, dataUrl) =>
        set((s) => {
          const next = { ...s.custom[display] }
          if (dataUrl) next[slot] = dataUrl
          else delete next[slot]
          return { custom: { ...s.custom, [display]: next } }
        }),
      resetAll: (display) => set((s) => ({ custom: { ...s.custom, [display]: {} } })),
    }),
    { name: 'kayco-display-art-v1' },
  ),
)

export function artUrl(custom: ArtState['custom'], display: ArtDisplay, slot: ArtSlot) {
  return custom[display]?.[slot] ?? DEFAULT_ART[display][slot] ?? null
}

// Shrink an uploaded file to a sensible texture (longest side <= 1600px) and
// return it as a JPEG data URL small enough for local storage.
export function fileToArtDataUrl(file: File, maxSide = 1600): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.width * scale))
      canvas.height = Math.max(1, Math.round(img.height * scale))
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.86))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that image'))
    }
    img.src = url
  })
}

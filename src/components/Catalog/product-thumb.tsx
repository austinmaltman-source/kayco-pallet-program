import { useState } from 'react'

interface ProductThumbProps {
  imageUrl?: string
  name: string
  color?: string
  size?: number // px
  className?: string
}

// Product photo (Kayco API cut-out on white), or a brand-colored initial when
// there is no photo or it fails to load. Lazy so long lists stay fast.
export function ProductThumb({
  imageUrl,
  name,
  color = '#d4d4d4',
  size = 36,
  className = '',
}: ProductThumbProps) {
  const [failed, setFailed] = useState(false)
  const showImage = Boolean(imageUrl) && !failed

  return (
    <div
      className={`shrink-0 rounded-md bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.06)] overflow-hidden flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {showImage ? (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="w-full h-full object-contain p-0.5"
        />
      ) : (
        <span
          className="w-full h-full flex items-center justify-center text-[11px] font-semibold text-white"
          style={{ backgroundColor: color }}
          aria-hidden
        >
          {name.trim().replace(/^\d+\s+/, '').charAt(0).toUpperCase() || '?'}
        </span>
      )}
    </div>
  )
}

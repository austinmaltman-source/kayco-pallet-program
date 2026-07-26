import { useCallback, useState } from 'react'
import { useDisplayStore } from '../../stores/display-store'
import { TrayFace, CameraPreset } from '../../types'

const CAMERA_FOR_FACE: Record<TrayFace, CameraPreset> = {
  front: 'front',
  back: 'side',
  left: 'side',
  right: 'front',
}

const ROTATION_FOR_FACE: Record<TrayFace, number> = {
  front: -35,
  right: -125,
  back: -215,
  left: -305,
}

const FACES: TrayFace[] = ['front', 'right', 'back', 'left']

interface PalletNavigatorProps {
  className?: string
}

export function PalletNavigator({ className }: PalletNavigatorProps) {
  const activeFace = useDisplayStore(s => s.activeFace)
  const setActiveFace = useDisplayStore(s => s.setActiveFace)
  const setCameraPreset = useDisplayStore(s => s.setCameraPreset)
  const palletType = useDisplayStore(s => s.currentProject?.palletType ?? 'full')

  const isHalf = palletType === 'half'

  const [rotY, setRotY] = useState(ROTATION_FOR_FACE[activeFace])

  const handleFaceClick = useCallback(
    (face: TrayFace) => {
      if (isHalf && face !== 'front') return
      setActiveFace(face)
      setRotY(ROTATION_FOR_FACE[face])
      setCameraPreset(CAMERA_FOR_FACE[face])
    },
    [setActiveFace, setCameraPreset, isHalf]
  )

  const cubeSize = 52
  const half = cubeSize / 2
  // Half pallet cube is shallower
  const cubeDepth = isHalf ? cubeSize / 2 : cubeSize
  const halfDepth = cubeDepth / 2

  const faceStyle = (face: TrayFace, transform: string): React.CSSProperties => {
    const isActive = activeFace === face
    const isDisabled = isHalf && face !== 'front'
    return {
      width: face === 'left' || face === 'right' ? cubeDepth : cubeSize,
      height: cubeSize,
      position: 'absolute',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '3px',
      transition: 'background 0.3s, box-shadow 0.3s',
      cursor: isDisabled ? 'default' : 'pointer',
      opacity: isDisabled ? 0.3 : 1,
      transform,
      background: isActive
        ? 'linear-gradient(135deg, #0a72ef 0%, #0860c4 100%)'
        : isDisabled
        ? 'linear-gradient(135deg, #ddd 0%, #ccc 100%)'
        : 'linear-gradient(135deg, #f0f0f0 0%, #e5e5e5 100%)',
      boxShadow: isActive
        ? 'inset 0 0 0 1px rgba(10,114,239,0.3)'
        : '0px 0px 0px 1px rgba(0,0,0,0.06)',
    }
  }

  const labelClass = (face: TrayFace) => {
    const isDisabled = isHalf && face !== 'front'
    return `text-[11px] font-medium ${activeFace === face ? 'text-white' : isDisabled ? 'text-[#bbb]' : 'text-[#888]'}`
  }

  return (
    <div className={`flex flex-col items-center ${className ?? ''}`}>
      <div className="bg-white/70 backdrop-blur-md shadow-card rounded-lg p-3">
        <div className="text-[9px] font-medium uppercase tracking-wider text-[#999] mb-2 text-center">
          Navigator
        </div>

        {/* Isometric cube */}
        <div
          className="relative mx-auto"
          style={{
            width: cubeSize * 1.8,
            height: cubeSize * 1.6,
            perspective: '400px',
          }}
        >
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              transformStyle: 'preserve-3d',
              transform: `rotateX(-25deg) rotateY(${rotY}deg)`,
              transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            <button onClick={() => handleFaceClick('front')} style={faceStyle('front', `translateZ(${halfDepth}px)`)}>
              <span className={labelClass('front')}>Front</span>
            </button>
            <button onClick={() => handleFaceClick('back')} style={faceStyle('back', `translateZ(-${halfDepth}px) rotateY(180deg)`)}>
              <span className={labelClass('back')}>Back</span>
            </button>
            <button onClick={() => handleFaceClick('right')} style={faceStyle('right', `rotateY(90deg) translateZ(${half}px)`)}>
              <span className={labelClass('right')}>Right</span>
            </button>
            <button onClick={() => handleFaceClick('left')} style={faceStyle('left', `rotateY(-90deg) translateZ(${half}px)`)}>
              <span className={labelClass('left')}>Left</span>
            </button>

            {/* Top */}
            <div
              className="absolute"
              style={{
                width: cubeSize,
                height: cubeDepth,
                transform: `rotateX(90deg) translateZ(${half}px)`,
                background: 'linear-gradient(135deg, #f5f5f5 0%, #eee 100%)',
                boxShadow: '0px 0px 0px 1px rgba(0,0,0,0.06)',
                borderRadius: '3px',
              }}
            />
            {/* Bottom */}
            <div
              className="absolute"
              style={{
                width: cubeSize,
                height: cubeDepth,
                transform: `rotateX(-90deg) translateZ(${half}px)`,
                background: '#c4a882',
                boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)',
                borderRadius: '3px',
              }}
            />
          </div>
        </div>

        {/* Face buttons fallback */}
        <div className="flex items-center justify-center gap-1 mt-1.5">
          {(isHalf ? ['front'] as TrayFace[] : FACES).map(face => (
            <button
              key={face}
              onClick={() => handleFaceClick(face)}
              className={`px-2 py-1 rounded text-[9px] font-medium uppercase transition-all ${
                activeFace === face
                  ? 'bg-[#171717] text-white'
                  : 'text-[#999] hover:text-[#555] hover:bg-[#f5f5f5]'
              }`}
            >
              {face[0]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

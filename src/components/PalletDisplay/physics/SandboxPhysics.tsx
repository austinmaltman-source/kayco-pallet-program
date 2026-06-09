import React, { createContext, useContext } from 'react'
import { Physics } from '@react-three/rapier'

// Gravity in inches per second squared (9.81 m/s2 = 386.09 in/s2).
// The whole scene is modeled in inches, so the default of 9.81 would make
// items fall in slow motion.
export const GRAVITY_IN_PER_S2 = -386.09

// True when the Rapier WASM module failed to load and the scene should fall
// back to static (non-physical) rendering of placed items.
const PhysicsDisabledContext = createContext(false)

export function usePhysicsDisabled() {
  return useContext(PhysicsDisabledContext)
}

interface SandboxPhysicsProps {
  paused?: boolean
  children: React.ReactNode
}

class PhysicsErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('[physics] Rapier failed to initialize, rendering static scene', error)
  }

  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

// Physics world wrapper. If Rapier blows up (WASM load failure), the scene
// still renders: items appear at their persisted transforms, just without
// gravity or dragging.
export function SandboxPhysics({ paused = false, children }: SandboxPhysicsProps) {
  return (
    <PhysicsErrorBoundary
      fallback={
        <PhysicsDisabledContext.Provider value={true}>
          {children}
        </PhysicsDisabledContext.Provider>
      }
    >
      <Physics gravity={[0, GRAVITY_IN_PER_S2, 0]} paused={paused} colliders={false}>
        {children}
      </Physics>
    </PhysicsErrorBoundary>
  )
}

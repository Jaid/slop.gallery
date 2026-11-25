import type {ColliderDisplay} from '#src/lib/physics/colliderDisplay.ts'

import {useThree} from '@react-three/fiber'
import {useRapier} from '@react-three/rapier'
import hsl from 'okhsl'
import {useLayoutEffect} from 'react'

import overlay from '#src/lib/overlay/index.ts'
import {useColliderDisplay} from '#src/lib/physics/colliderDisplay.ts'

import ColliderEdges from './ColliderEdges.ts'

const layer = overlay.addLayer({
  id: 'colliders',
  color: hsl.integer(194.8, 100, 88.9),
  obstructedOpacityFactor: 0.25,
})

export default function ColliderOutlines() {
  const physics = useRapier()
  const scene = useThree(state => state.scene)
  useLayoutEffect(() => {
    let remove: (() => void) | undefined
    // Apply WebMCP changes synchronously, so even a capture before the next game frame sees the selection.
    const show = ({object}: ColliderDisplay) => {
      remove?.()
      remove = undefined
      if (object === false) {
        return
      }
      const edges = new ColliderEdges(physics, scene, object)
      remove = overlay.addLiveSegments(edges, {layer}).remove
    }
    show(useColliderDisplay.getState())
    const unsubscribe = useColliderDisplay.subscribe(show)
    return () => {
      unsubscribe()
      remove?.()
    }
  }, [physics, scene])
  return null
}

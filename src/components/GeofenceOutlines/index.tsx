import type {Geofence} from 'geofency'

import {useThree} from '@react-three/fiber'
import Branch from 'branch-component'
import {useMemo} from 'react'

import {useFenceDisplay} from '#src/lib/gallery/fenceDisplay.ts'
import {useGeofence} from '#src/lib/gallery/geofences.ts'
import world from '#src/worlds/current.ts'

import fenceEdges from './fenceEdges.ts'

export default function GeofenceOutlines() {
  const selection = useFenceDisplay(state => state.fence)
  if (selection === false) {
    return null
  }
  return <group name='geofence-outlines'>
    {Array.from(world.geofences, ([id, fence]) => <Branch key={id} if={selection === true || selection === id}><Outline id={id} fence={fence} /></Branch>)}
  </group>
}

function Outline({fence, id}: {
  fence: Geofence
  id: string
}) {
  const inside = useGeofence(id)
  const far = useThree(state => state.camera.far)
  const positions = useMemo(() => fenceEdges(fence, far), [fence, far])
  // Draw occupied fences last so shared edges stay red.
  return <lineSegments name={id} raycast={() => {}} renderOrder={inside ? 11 : 10}>
    <bufferGeometry><bufferAttribute args={[positions, 3]} attach='attributes-position' /></bufferGeometry>
    <lineBasicNodeMaterial color={inside ? 'red' : 'blue'} depthTest={false} depthWrite={false} toneMapped={false} transparent />
  </lineSegments>
}

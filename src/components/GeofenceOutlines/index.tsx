import type {Geofence} from 'geofency'

import {useThree} from '@react-three/fiber'
import Branch from 'branch-component'
import {useMemo} from 'react'

import {useFenceDisplay} from '#src/lib/gallery/fenceDisplay.ts'
import world from '#src/worlds/current.ts'

import fenceEdges from './fenceEdges.ts'

export default function GeofenceOutlines() {
  const selection = useFenceDisplay(state => state.fence)
  if (selection === false) {
    return null
  }
  return <group name='geofence-outlines'>
    {Array.from(world.geofences, ([id, fence], index) => <Branch key={id} if={selection === true || selection === id}><Outline id={id} color={`hsl(${Math.round(index * 137.5 + 175) % 360}, 90%, 65%)`} fence={fence} /></Branch>)}
  </group>
}

function Outline({color, fence, id}: {
  color: string
  fence: Geofence
  id: string
}) {
  const far = useThree(state => state.camera.far)
  const positions = useMemo(() => fenceEdges(fence, far), [fence, far])
  return <lineSegments name={id} raycast={() => {}} renderOrder={10}>
    <bufferGeometry><bufferAttribute args={[positions, 3]} attach='attributes-position' /></bufferGeometry>
    <lineBasicNodeMaterial color={color} depthTest={false} depthWrite={false} toneMapped={false} transparent />
  </lineSegments>
}

import type {Geofence} from 'geofency'

import {createPortal, useThree} from '@react-three/fiber'
import {useLayoutEffect, useMemo, useState} from 'react'
import {Scene} from 'three/webgpu'

import {selectFences, useFenceDisplay} from '#src/lib/gallery/fenceDisplay.ts'
import {useGeofence} from '#src/lib/gallery/geofences.ts'
import {registerGeofenceOverlay} from '#src/lib/rendering/geofenceOverlay.ts'
import world from '#src/worlds/current.ts'

import fenceEdges from './fenceEdges.ts'

export default function GeofenceOutlines({visible}: {visible: boolean}) {
  const selection = useFenceDisplay(state => state.fence)
  // A relational fence shows all the boxes it takes in, like the Lobby its parts’.
  const shown = useMemo(() => selectFences(world.geofences, selection).map(([id]): [string, Geofence] => [id, world.geofences.resolve(id)!]), [selection])
  if (!shown.length) {
    return null
  }
  return <Overlay shown={shown} visible={visible} />
}

function Overlay({shown, visible}: {
  shown: Array<[string, Geofence]>
  visible: boolean
}) {
  const camera = useThree(state => state.camera)
  const renderer = useThree(state => state.renderer)
  const [scene] = useState(() => new Scene)
  useLayoutEffect(() => (visible ? registerGeofenceOverlay(camera, renderer, scene) : undefined), [camera, renderer, scene, visible])
  return createPortal(<group name='geofence-outlines'>
    {shown.map(([id, fence]) => <Outline key={id} id={id} fence={fence} />)}
  </group>, scene)
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

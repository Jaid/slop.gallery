import type {OverlayDrawing} from '#src/lib/overlay/index.ts'
import type {Geofence} from 'geofency'

import {useThree} from '@react-three/fiber'
import {useLayoutEffect, useMemo, useRef} from 'react'

import {selectFences, useFenceDisplay} from '#src/lib/gallery/fenceDisplay.ts'
import {useGeofence} from '#src/lib/gallery/geofences.ts'
import overlay from '#src/lib/overlay/index.ts'
import world from '#src/worlds/current.ts'

import fenceEdges from './fenceEdges.ts'

export default function GeofenceOutlines() {
  const selection = useFenceDisplay(state => state.fence)
  // A relational fence shows all the boxes it takes in, like the Lobby its parts’.
  const shown = useMemo(() => selectFences(world.geofences, selection).map(([id]): [string, Geofence] => [id, world.geofences.resolve(id)!]), [selection])
  return shown.map(([id, fence]) => <Outline key={id} id={id} fence={fence} />)
}

function Outline({fence, id}: {
  fence: Geofence
  id: string
}) {
  const inside = useGeofence(id)
  const far = useThree(state => state.camera.far)
  const drawing = useRef<OverlayDrawing>(null)
  useLayoutEffect(() => {
    const edges = fenceEdges(fence, far)
    if (!edges.length) {
      return
    }
    const item = overlay.addSegments(edges, {name: id})
    drawing.current = item
    return () => {
      item.remove()
      drawing.current = null
    }
  }, [far, fence, id])
  // Crossing a fence recolors its batch without reuploading the geometry. Occupied fences win on shared edges.
  useLayoutEffect(() => {
    drawing.current?.setStyle({
      color: inside ? 'red' : 'blue',
      renderOrder: inside ? 11 : 10,
    })
  }, [far, fence, id, inside])
  return null
}

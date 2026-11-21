import {useFrame} from '@react-three/fiber'
import {Color, Vector3} from 'three/webgpu'

import {hearingFence, useAmbienceEmitters} from '#src/ambience_emitters/lib/ambienceEmitters.ts'
import {useGallery} from '#src/lib/gallery.ts'
import overlay from '#src/lib/overlay/index.ts'
import useMarkerBatch, {markerRadius} from '#src/lib/overlay/useMarkerBatch.ts'

const layer = overlay.addLayer({id: 'ambience-emitters'})
const tint = new Color
const position = new Vector3
const full = new Color('#ffffff')
const silent = new Color('#c8c8c8')
const camera = new Vector3

/** White at full strength, light gray when silent, and between them a heat gradient from blue (1%) to red (99%). */
export function strengthColor(strength: number, target: Color) {
  if (strength >= 1) {
    return target.copy(full)
  }
  if (strength <= 0) {
    return target.copy(silent)
  }
  return target.setHSL((1 - (strength - 0.01) / 0.98) * 2 / 3, 1, 0.5)
}

/**
 * `?show_ambience_emitters`: a dark-rimmed ball at every ambience emitter, seen through walls, colored by how strongly it reaches the camera right now and crossed out while none of the fences the player is in lets it sound.
 */
export default function AmbienceEmitterMarkers() {
  const emitters = useAmbienceEmitters(state => state.emitters)
  const markers = useMarkerBatch(layer, Math.ceil(emitters.length / 16) * 16)
  useFrame(state => {
    const batch = markers.current
    if (!batch?.parent) {
      return
    }
    const listener = state.camera.getWorldPosition(camera).toArray()
    const {room, whereabouts} = useGallery.getState()
    for (const [index, emitter] of emitters.entries()) {
      const fence = hearingFence(emitter, whereabouts)
      const strength = emitter.strengthAt(listener, fence ?? room)
      batch.setMarker(index, position.fromArray(emitter.position), markerRadius, strengthColor(strength, tint), fence === undefined)
    }
    batch.show(emitters.length)
  })
  return null
}

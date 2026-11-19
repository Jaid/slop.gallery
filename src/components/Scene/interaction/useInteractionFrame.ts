import type {Placement} from '#src/lib/gallery.ts'
import type {InteractionFrameRefs} from './types.ts'
import type {RootState} from '@react-three/fiber'

import {useFrame} from '@react-three/fiber'
import {useEffect, useRef} from 'react'

import {readIntroNarration} from '#src/lib/audio/intro.ts'
import {bodyPose, cameraPose, dragPose, narrate, useGallery} from '#src/lib/gallery.ts'
import {probeGeofences, startGeofences} from '#src/lib/gallery/geofences.ts'
import {importPreviewPlacement} from '#src/lib/gallery/ImageImporter.ts'
import {interactiveObjects} from '#src/lib/gallery/interactiveObjects.ts'
import {orbitables} from '#src/lib/gallery/orbitables.ts'
import {isPortraitLabelHit} from '#src/lib/gallery/portraitLabel.ts'
import portraitObjects from '#src/lib/gallery/portraitObjects.ts'
import interactionHint from '#src/lib/interactionHint.ts'
import world from '#src/worlds/current.ts'

import {propObjects} from '../GrabbableProp.tsx'
import {describeTarget} from './describeTarget.ts'

// The welcome narration only plays with `?intro_narration`.
const introNarration = readIntroNarration()
export default function useInteractionFrame(camera: RootState['camera'], renderer: RootState['renderer'], {
  cursor,
  direction,
  firstPose,
  ghost,
  introduced,
  placement,
  previousHeld,
  ray,
}: InteractionFrameRefs) {
  // The player starts in the fences its place lies in once the Player has put it there, which no frame probes before.
  const probing = useRef(false)
  useEffect(() => {
    startGeofences(bodyPose.place)
    probing.current = true
    return () => {
      probing.current = false
    }
  }, [])
  useFrame(() => {
    const s = useGallery.getState()
    if (introNarration && world.narratesIntroduction && s.locked && !introduced.current && firstPose.current && (camera.position.distanceTo(firstPose.current.position) > 0.12 || camera.quaternion.angleTo(firstPose.current.rotation) > 0.1)) {
      introduced.current = true
      narrate('__intro')
    }
    if (previousHeld.current !== s.held) {
      placement.current = null
      previousHeld.current = s.held
    }
    camera.getWorldDirection(direction.current)
    cameraPose.position = camera.position.toArray()
    cameraPose.direction = direction.current.toArray()
    if (probing.current) {
      probeGeofences(bodyPose.place, bodyPose.velocity)
    }
    cursor.current.set(0, 0)
    if (dragPose.active) {
      const bounds = renderer.domElement.getBoundingClientRect()
      cursor.current.set((dragPose.x - bounds.left) / bounds.width * 2 - 1, -((dragPose.y - bounds.top) / bounds.height) * 2 + 1)
    }
    ray.current.setFromCamera(cursor.current, camera)
    ray.current.far = 9
    if (!dragPose.active) {
      let closest = world.wallDistance(cameraPose.position, cameraPose.direction)
      let active: string | null = null
      let activeLabel: string | null = null
      for (const [id, object] of [...portraitObjects, ...propObjects, ...interactiveObjects, ...orbitables]) {
        if (id === s.held || !object.group.visible) {
          continue
        }
        const portrait = s.portraits.find(candidate => candidate.id === id)
        // Whatever orbits a fusion’s portal is out of reach.
        if (portrait?.reserved || portrait?.fusing || propObjects.get(id)?.seized()) {
          continue
        }
        const hits = ray.current.intersectObject(object.group, true)
        if (!(hits[0] && hits[0].distance < closest)) {
          continue
        }
        closest = hits[0].distance
        active = id
        activeLabel = s.locked && portrait?.hung && isPortraitLabelHit(hits[0].object, object.group) ? id : null
      }
      if (active !== s.active || activeLabel !== s.activeLabel) {
        useGallery.setState({
          active,
          activeLabel,
        })
      }
    } else if (s.activeLabel) {
      useGallery.setState({activeLabel: null})
    }
    updateHint()
    if (!ghost.current) {
      return
    }
    const portrait = s.portraits.find(candidate => candidate.id === s.held)
    if (!portrait && !dragPose.active) {
      ghost.current.visible = false
      placement.current = null
      return
    }
    const origin = ray.current.ray.origin.toArray()
    const rayDirection = ray.current.ray.direction.toArray()
    let candidate: Placement | null
    if (portrait) {
      candidate = world.placement.findPlacement(origin, rayDirection, portrait.width, portrait.height, s.portraits, portrait.id, portrait.labelAbove === true)
    } else {
      candidate = importPreviewPlacement(origin, rayDirection, s.room, s.portraits)
    }
    placement.current = candidate
    if (candidate?.valid !== s.placement?.valid || candidate?.fits !== s.placement?.fits || candidate?.inReach !== s.placement?.inReach || candidate?.reason !== s.placement?.reason || candidate?.wallId !== s.placement?.wallId || candidate?.labelAbove !== s.placement?.labelAbove || !candidate && s.placement) {
      useGallery.setState({placement: candidate})
    }
    ghost.current.visible = !!candidate
    if (candidate) {
      ghost.current.position.set(...candidate.position)
      ghost.current.rotation.set(0, candidate.rotation, 0)
    }
  })
}

/** Feeds the debounced HUD hint from the target resolved this frame. */
function updateHint() {
  const s = useGallery.getState()
  const now = performance.now() / 1000
  if (!s.locked || s.dragging || cameraPose.focused || s.held) {
    interactionHint.update(null, now, true)
    return
  }
  interactionHint.update(describeTarget(s.active, s.portraits), now)
}

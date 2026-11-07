import type {Placement} from '#src/lib/gallery.ts'
import type {FirstPose} from './interaction/types.ts'
import type {Group} from 'three/webgpu'

import {useThree} from '@react-three/fiber'
import Branch from 'branch-component'
import {useRef} from 'react'
import {Raycaster, Vector2, Vector3} from 'three/webgpu'

import OrbitViewing from '#component/OrbitViewing'
import PlacementPreview from '#component/PlacementPreview'
import {portraitFrame} from '#src/lib/frames/index.ts'
import {arrivalFrame, cameraPose, upcomingWorkId, useGallery} from '#src/lib/gallery.ts'
import {importPreviewSide} from '#src/lib/gallery/ImageImporter.ts'

import useInteractionDiagnostics from './interaction/useInteractionDiagnostics.ts'
import useInteractionEvents from './interaction/useInteractionEvents.ts'
import useInteractionFrame from './interaction/useInteractionFrame.ts'

export default function Interaction() {
  const {camera, renderer, controls} = useThree()
  const ghost = useRef<Group>(null)
  const ray = useRef(Object.assign(new Raycaster, {firstHitOnly: true}))
  const placement = useRef<Placement | null>(null)
  const direction = useRef(new Vector3)
  const cursor = useRef(new Vector2)
  const previousHeld = useRef<string | null>(null)
  const firstPose = useRef<FirstPose | null>(null)
  const introduced = useRef(false)
  const held = useGallery(s => s.held)
  const artwork = useGallery(s => s.portraits.find(portrait => portrait.id === s.held))
  const dragging = useGallery(s => s.dragging)
  // A dropped image wears its roll of the frames of the room it lands in, which changes along with the wall it would hang on.
  const arriving = useGallery(s => (s.dragging && s.placement ? arrivalFrame(s.placement.position, cameraPose.position, upcomingWorkId()) : undefined))
  // Its shape unknown yet, it shows as a square at the portrait area of the room owning that wall.
  const arrivingSide = useGallery(s => importPreviewSide(s.placement?.wallId, s.room))
  useInteractionEvents({
    camera,
    controls,
    renderer,
    placement,
    firstPose,
  })
  useInteractionDiagnostics(camera, renderer, placement)
  useInteractionFrame(camera, renderer, {
    cursor,
    direction,
    firstPose,
    ghost,
    introduced,
    placement,
    previousHeld,
    ray,
  })
  return <>
    <OrbitViewing />
    <group visible={false} ref={ghost}>
      <Branch some={[artwork, dragging]} not={held?.startsWith('prop-')}><PlacementPreview key={artwork?.id ?? 'import'} creator={artwork?.creator} frame={portraitFrame(artwork ? artwork.frame : arriving)} height={artwork?.height ?? arrivingSide} pending={artwork?.pending} source={artwork?.source} title={artwork?.title} width={artwork?.width ?? arrivingSide} /></Branch>
    </group>
  </>
}

import type {ApseOpening} from '#src/lib/gallery/bastion.ts'
import type {Material} from 'three/webgpu'

import {RigidBody, TrimeshCollider} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {colliderGeometry} from '#src/lib/gallery/architecture.ts'
import BarredOpeningGeometry from '#src/lib/gallery/BarredOpeningGeometry.ts'
import {apseOpeningPoint, apseOpenings, bastionClearance} from '#src/lib/gallery/bastion.ts'
import gateMouseHole from '#src/lib/gallery/gateMouseHole.ts'
import {mergeParts} from '#src/lib/geometry.ts'
import {wallCoordinates} from '#src/lib/placement/wallGeometry.ts'
import slopGallery from '#src/worlds/gallery/index.ts'

/** the apse’s walls by the arc they stand on, west to east */
const apseWalls = ['oculus-northwest', 'oculus-north', 'oculus-northeast'] as const
/** The apse’s barred gate and windows onto the Bastion: their iron bars and the stone that lines them through the gap between the apse’s wall and the Bastion’s. */
export default function ApseGrilles({stone}: {stone: Material}) {
  const {reveal, bars, collision} = useDisposable(useMemo(createGrilles, []))
  const iron = useDisposable(useMemo(() => new MeshStandardNodeMaterial({
    color: '#2a2724',
    metalness: 0.75,
    roughness: 0.5,
    envMapIntensity: 0.3,
  }), []))
  return <RigidBody colliders={false} name='oculus-apse-grilles' type='fixed'>
    {collision.map((args, i) => <TrimeshCollider key={i} args={args} />)}
    <mesh castShadow geometry={reveal} material={stone} name='oculus-apse-reveals' receiveShadow />
    <mesh castShadow geometry={bars} material={iron} name='oculus-apse-bars' receiveShadow />
  </RigidBody>
}

/** The bars and the reveal of one of the apse’s openings, splayed out to where it comes out on the Bastion’s side. */
export function apseGrille(opening: ApseOpening) {
  const wall = slopGallery.walls.find(value => value.id === apseWalls[opening.arc])!
  const hole = wall.holes!.find(value => value.name === opening.name)!
  const [x, z] = apseOpeningPoint({
    arc: opening.arc,
    angle: opening.back.angle,
  })
  return new BarredOpeningGeometry(wall, hole, {
    back: {
      ...hole,
      u: wallCoordinates(wall, [x, 0, z]),
      width: opening.back.width,
      // over the wall’s foot, on the platform
      height: opening.back.height,
      rise: opening.back.rise,
    },
    bands: opening.bands,
    depth: bastionClearance,
    hatch: opening.name === 'gate' ? gateMouseHole(hole) : undefined,
  })
}

function createGrilles() {
  const openings = apseOpenings.map(apseGrille)
  const reveal = mergeParts(openings.map(opening => opening.reveal))
  const bars = mergeParts(openings.map(opening => opening.bars))
  return {
    reveal,
    bars,
    collision: [reveal, bars].map(colliderGeometry),
    dispose() {
      reveal.dispose()
      bars.dispose()
    },
  }
}

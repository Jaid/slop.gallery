import type {ArenaSurfaces} from '#component/ArenaShell'
import type {Wall, WallOpening} from '#src/lib/placement/wallGeometry.ts'

import {CuboidCollider, RigidBody} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import hsl from 'okhsl'
import {useMemo} from 'react'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import CellDoorGeometry from '#src/lib/gallery/CellDoorGeometry.ts'
import PolishedBrassMaterial from '#src/lib/materials/PolishedBrassMaterial.ts'

/** how thick the door stands for the player to bump into, out of the wall’s center line */
const colliderDepth = 0.09

/** The Cell’s door, shut in the opening `hole` of `wall` while there is nothing beyond: black lacquered leaves upholstered in the Arena’s velvet, with brass nailheads, kick plates and ring pulls. Beyond it lies nothing, so it never opens. */
export default function CellDoor({hole, surfaces, wall}: {
  hole: WallOpening
  surfaces: ArenaSurfaces
  wall: Wall
}) {
  const geometry = useDisposable(useMemo(() => new CellDoorGeometry(hole), [hole]))
  const brass = useDisposable(useMemo(() => new PolishedBrassMaterial, []))
  // The trim’s black lacquer, rubbed to a satin finish: the gloss of the trim would mirror the chandelier’s flames across the leaves in a dazzling spot.
  const lacquer = useDisposable(useMemo(() => new MeshPhysicalNodeMaterial({
    clearcoat: 0.7,
    clearcoatRoughness: 0.38,
    color: hsl.integer(308, 6, 9),
    envMapIntensity: 0.6,
    metalness: 0,
    roughness: 0.5,
  }), []))
  // The wall leaves its opening open for the door’s own collider to close.
  return <group name='cell-door' position={wall.center} rotation={[0, wall.rotation, 0]}>
    <group position={[hole.u, 0, 0]}>
      <RigidBody colliders={false} type='fixed'>
        <CuboidCollider args={[hole.width / 2, hole.height / 2, colliderDepth / 2]} position={[0, hole.height / 2, colliderDepth / 2]} />
      </RigidBody>
      <mesh castShadow geometry={geometry.lacquer} material={lacquer} name='cell-door-lacquer' receiveShadow />
      <mesh castShadow geometry={geometry.velvet} material={surfaces.velvet} name='cell-door-velvet' receiveShadow />
      <mesh castShadow geometry={geometry.brass} material={brass} name='cell-door-brass' receiveShadow />
    </group>
  </group>
}

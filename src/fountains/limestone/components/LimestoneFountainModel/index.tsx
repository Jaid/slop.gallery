import type {FountainModelProps} from '#src/fountains/index.ts'

import {RigidBody} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {MeshStandardNodeMaterial} from 'three/webgpu'
import useGraphicsMode from 'use-graphics-mode'

import MeshSurfaceCollider from '#component/MeshSurfaceCollider'
import Orbitable from '#component/Orbitable'
import LimestoneFountainGeometry from '#src/fountains/limestone/LimestoneFountainGeometry.ts'
import LimestoneFountainMist from '#src/fountains/limestone/LimestoneFountainMist.ts'
import LimestoneFountainSpray from '#src/fountains/limestone/LimestoneFountainSpray.ts'
import LimestoneFountainStoneMaterial from '#src/fountains/limestone/LimestoneFountainStoneMaterial.ts'
import LimestoneFountainWaterMaterial from '#src/fountains/limestone/LimestoneFountainWaterMaterial.ts'
import waterEnvironment from '#src/fountains/limestone/sharedWaterEnvironment.ts'
import {colliderGeometry} from '#src/lib/gallery/architecture.ts'

/** A water-gilt bronze like the ornament of the Lobby’s vault: polished enough to catch the room’s light, with enough body not to mirror the dark water. */
const giltBronze = {
  color: '#d3a554',
  metalness: 0.62,
  roughness: 0.28,
} as const

/** The limestone fountain’s model: its carved stone with its collider, its gilt nozzles, finial and inlay, its pools, its falling water, its spray and its mist. */
export default function LimestoneFountainModel({id, position}: FountainModelProps) {
  const isHeavy = useGraphicsMode()
  const geometry = useDisposable(useMemo(() => new LimestoneFountainGeometry, []))
  const collision = useMemo(() => colliderGeometry(geometry.stone), [geometry])
  const stone = useDisposable(useMemo(() => new LimestoneFountainStoneMaterial, []))
  const gilt = useDisposable(useMemo(() => new MeshStandardNodeMaterial(giltBronze), []))
  const spray = useDisposable(useMemo(() => new LimestoneFountainSpray, []))
  const mist = useDisposable(useMemo(() => new LimestoneFountainMist, []))
  const pool = useDisposable(useMemo(() => new LimestoneFountainWaterMaterial(false, isHeavy, {environment: waterEnvironment}), [isHeavy]))
  const falling = useDisposable(useMemo(() => new LimestoneFountainWaterMaterial(true, isHeavy, {environment: waterEnvironment}), [isHeavy]))
  // Framed around the crown of the jet and the basin’s reach, circling at a bench’s distance at most.
  return <Orbitable
    id={id} center={[0, 2.5, 0]} name={id} orbit={{
      radius: 2.9,
      minDistance: 4.2,
      maxDistance: 11,
      floorY: position[1],
    }} position={position} title='Fountain'
  >
    <RigidBody colliders={false} type='fixed'>
      <MeshSurfaceCollider args={collision} />
      <mesh castShadow geometry={geometry.stone} material={stone} name='fountain-carved-stone' receiveShadow />
      <mesh castShadow geometry={geometry.gilt} material={gilt} name='fountain-gilt-bronze' receiveShadow />
    </RigidBody>
    {/*
      The pools, the falling water, the spray and the mist are all transparent and write no depth, and three.js sorts them by the middles of their bounds, which stand one above the other: they would swap places whenever the camera tips across level.
      So they draw in a fixed order, from what lies behind to what hangs in front: the pools, then the veils and the jets, then the drops flying round them, then the mist drifting over everything.
    */}
    <mesh geometry={geometry.pools} material={pool} name='fountain-pools' receiveShadow />
    <mesh geometry={geometry.water} material={falling} name='fountain-falling-water' renderOrder={1} />
    <primitive object={spray} renderOrder={2} />
    <primitive object={mist} renderOrder={3} />
  </Orbitable>
}

import {RigidBody} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import useGraphicsMode from 'use-graphics-mode'

import MeshSurfaceCollider from '#component/MeshSurfaceCollider'
import Orbitable from '#component/Orbitable'
import {useAmbienceEmitter} from '#src/lib/audio/ambience/ambienceEmitters.ts'
import FountainAmbience from '#src/lib/audio/ambience/Fountain.ts'
import {colliderGeometry} from '#src/lib/gallery/architecture.ts'
import fountain from '#src/lib/gallery/fountain/config.ts'
import FountainGeometry from '#src/lib/gallery/fountain/FountainGeometry.ts'
import FountainSpray from '#src/lib/gallery/fountain/FountainSpray.ts'
import FountainMarbleMaterial from '#src/lib/materials/FountainMarbleMaterial.ts'
import FountainWaterMaterial from '#src/lib/materials/FountainWaterMaterial.ts'
import gold from '#src/lib/materials/gold.ts'
import slopGallery from '#src/worlds/gallery/index.ts'

export default function Fountain() {
  const isHeavy = useGraphicsMode()
  useAmbienceEmitter(FountainAmbience, slopGallery.ambienceRooms('lobby', 'lobby-fountain'))
  const geometry = useDisposable(useMemo(() => new FountainGeometry, []))
  const collision = useMemo(() => colliderGeometry(geometry.stone), [geometry])
  const marble = useDisposable(useMemo(() => new FountainMarbleMaterial({reflections: isHeavy}), [isHeavy]))
  const spray = useDisposable(useMemo(() => new FountainSpray, []))
  const pool = useDisposable(useMemo(() => new FountainWaterMaterial(false, isHeavy), [isHeavy]))
  const falling = useDisposable(useMemo(() => new FountainWaterMaterial(true, isHeavy), [isHeavy]))
  // Framed around the finial and the plinth’s reach, circling at a bench’s distance at most.
  return <Orbitable
    id='lobby-fountain' center={[0, 1.6, 0]} name='lobby-fountain' orbit={{
      radius: 2.8,
      minDistance: 3.4,
      maxDistance: 8,
      floorY: fountain.position[1],
    }} position={fountain.position} title='Fountain'
  >
    <RigidBody colliders={false} type='fixed'>
      <MeshSurfaceCollider args={collision} />
      <mesh castShadow geometry={geometry.stone} material={marble} name='fountain-carved-marble' receiveShadow />
      {/* The shared gold lives for the page, like on the chandeliers; it is borrowed, not disposed here. */}
      <mesh castShadow geometry={geometry.gilt} material={gold} name='fountain-gilt-fittings' receiveShadow />
    </RigidBody>
    {/*
      The pools (transparent to three.js as soon as they transmit), the falling water and the spray all sort among the transparent parts, by the middles of their bounds, which stand one above the other: they would swap places whenever the camera tips across level.
      So they draw in a fixed order: the pools first, writing their depth, so the veils blend over them and vanish into them and the pools’ refraction only shows the marble under them, then the veils and the arcs, then the drops, most of which fly in front of the water, around it or off its frayed foot.
    */}
    <mesh geometry={geometry.pools} material={pool} name='fountain-pools' receiveShadow />
    <mesh geometry={geometry.water} material={falling} name='fountain-falling-water' renderOrder={1} />
    <primitive object={spray} renderOrder={2} />
  </Orbitable>
}

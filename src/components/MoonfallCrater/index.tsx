import {RigidBody} from '@react-three/rapier'
import Branch from 'branch-component'
import useDisposable from 'disposable-lifetime/react'
import {useEffect, useMemo} from 'react'
import {useGraphicsModeValue} from 'use-graphics-mode'

import MeshSurfaceCollider from '#component/MeshSurfaceCollider'
import {colliderGeometry} from '#src/lib/gallery/architecture.ts'
import {moonfallCrater} from '#src/lib/gallery/moonfall/config.ts'
import CraterGeometry from '#src/lib/gallery/moonfall/CraterGeometry.ts'
import {fencePosts, fenceShape} from '#src/lib/gallery/moonfall/fence.ts'
import StanchionRingGeometry from '#src/lib/gallery/railings/StanchionRingGeometry.ts'
import {useGallery} from '#src/lib/gallery/store.ts'
import {environmentSeed} from '#src/lib/gameSeed.ts'
import CraterMaterial from '#src/lib/materials/CraterMaterial.ts'
import {setFloorReflectionHeight} from '#src/lib/materials/FloorMaterial.ts'
import gold from '#src/lib/materials/gold.ts'
import SlateFloorMaterial from '#src/lib/materials/SlateFloorMaterial.ts'
import VelvetRopeMaterial from '#src/lib/materials/VelvetRopeMaterial.ts'
import {getGraphicsProfile} from '#src/lib/rendering/graphicsMode.ts'
import slopGallery from '#src/worlds/gallery/index.ts'
import {floorMirror} from '#src/worlds/gallery/relations.ts'

const slateHeight = slopGallery.room('moonfall').floorY

export default function MoonfallCrater() {
  const geometry = useDisposable(useMemo(() => new CraterGeometry, []))
  const fence = useDisposable(useMemo(() => {
    const posts = fencePosts(environmentSeed)
    return new StanchionRingGeometry(moonfallCrater.fenceRadius, posts, fenceShape(posts))
  }, []))
  const collision = [geometry.floor, geometry.terrain, geometry.rocks, ...fence.collision].map(colliderGeometry)
  const rock = useDisposable(useMemo(() => new CraterMaterial({rock: true}), []))
  const terrain = useDisposable(useMemo(() => new CraterMaterial, []))
  const velvet = useDisposable(useMemo(() => new VelvetRopeMaterial, []))
  const {floorReflections} = useGraphicsModeValue(getGraphicsProfile)
  // Honed slate in fast mode; polished in heavy mode, where it mirrors the room around the crater.
  const slate = useDisposable(useMemo(() => new SlateFloorMaterial({
    craterRadius: moonfallCrater.radius,
    reflections: floorReflections,
  }), [floorReflections]))
  const reflection = slate.reflectionTarget
  const room = useGallery(state => state.room)
  useEffect(() => {
    // The rooms that see the slate rather than the upper floors mirror its plane.
    setFloorReflectionHeight(floorMirror(room) === 'moonfall' ? slateHeight : 0)
  }, [room])
  useEffect(() => () => setFloorReflectionHeight(null), [])
  return <group name='moonfall-impact-crater'>
    <RigidBody colliders={false} type='fixed'>
      {collision.map((args, i) => <MeshSurfaceCollider key={i} args={args} />)}
      <mesh castShadow geometry={geometry.floor} material={slate} name='moonfall-slate-floor' receiveShadow>
        <Branch if={reflection}><group rotation={[-Math.PI / 2, 0, 0]}><primitive object={reflection!} /></group></Branch>
      </mesh>
      <mesh castShadow geometry={geometry.terrain} material={terrain} name='moonfall-crater-terrain' receiveShadow />
      <mesh castShadow geometry={geometry.rocks} material={rock} name='moonfall-impact-ejecta' receiveShadow />
      <mesh castShadow geometry={fence.posts} material={gold} name='moonfall-crater-stanchions' receiveShadow />
      <mesh castShadow geometry={fence.rope} material={velvet} name='moonfall-crater-rope' receiveShadow />
    </RigidBody>
    <mesh material={gold} name='moonfall-crater-trim' position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[moonfallCrater.radius, moonfallCrater.radius + 0.055, moonfallCrater.rimSegments]} />
    </mesh>
  </group>
}

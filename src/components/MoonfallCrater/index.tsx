import {RigidBody} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'

import MeshSurfaceCollider from '#component/MeshSurfaceCollider'
import {colliderGeometry} from '#src/lib/gallery/architecture.ts'
import {moonfallCrater} from '#src/lib/gallery/moonfall/config.ts'
import CraterGeometry from '#src/lib/gallery/moonfall/CraterGeometry.ts'
import {fencePosts, fenceShape} from '#src/lib/gallery/moonfall/fence.ts'
import {moonfallRope, moonfallSlate, moonfallTheme} from '#src/lib/gallery/moonfall/palette.ts'
import StanchionRingGeometry from '#src/lib/gallery/railings/StanchionRingGeometry.ts'
import {environmentSeed} from '#src/lib/gameSeed.ts'
import CraterMaterial from '#src/lib/materials/CraterMaterial.ts'
import gold from '#src/lib/materials/gold.ts'
import SlateFloorMaterial from '#src/lib/materials/SlateFloorMaterial.ts'
import VelvetRopeMaterial from '#src/lib/materials/VelvetRopeMaterial.ts'

export default function MoonfallCrater() {
  const geometry = useDisposable(useMemo(() => new CraterGeometry, []))
  const fence = useDisposable(useMemo(() => {
    const posts = fencePosts(environmentSeed)
    return new StanchionRingGeometry(moonfallCrater.fenceRadius, posts, fenceShape(posts))
  }, []))
  const collision = [geometry.floor, geometry.terrain, geometry.rocks, ...fence.collision].map(colliderGeometry)
  const rock = useDisposable(useMemo(() => new CraterMaterial({rock: true}), []))
  const terrain = useDisposable(useMemo(() => new CraterMaterial({lava: moonfallTheme.lava}), []))
  const velvet = useDisposable(useMemo(() => new VelvetRopeMaterial(moonfallRope(environmentSeed)), []))
  // Honed slate keeps the fractures and pyrite visible under the ceiling mirror.
  const slate = useDisposable(useMemo(() => new SlateFloorMaterial({
    craterRadius: moonfallCrater.radius,
    style: moonfallSlate(moonfallTheme),
  }), []))
  return <group name='moonfall-impact-crater'>
    <RigidBody colliders={false} type='fixed'>
      {collision.map((args, i) => <MeshSurfaceCollider key={i} args={args} />)}
      <mesh castShadow geometry={geometry.floor} material={slate} name='moonfall-slate-floor' receiveShadow />
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

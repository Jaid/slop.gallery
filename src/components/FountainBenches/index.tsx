import {CuboidCollider, RigidBody} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'

import MeshSurfaceCollider from '#component/MeshSurfaceCollider'
import {colliderGeometry} from '#src/lib/gallery/architecture.ts'
import {fountainBench, fountainBenches} from '#src/lib/gallery/fountainBenches.ts'
import SlattedBenchGeometry from '#src/lib/gallery/SlattedBenchGeometry.ts'
import metal from '#src/lib/materials/metal.ts'
import TeakMaterial from '#src/lib/materials/TeakMaterial.ts'

export default function FountainBenches() {
  const geometry = useDisposable(useMemo(() => new SlattedBenchGeometry, []))
  const collision = useMemo(() => colliderGeometry(geometry.metal), [geometry])
  const timber = useDisposable(useMemo(() => new TeakMaterial, []))
  const {width, height, depth} = fountainBench
  return <group name='lobby-fountain-benches'>
    {fountainBenches.map((pose, i) => <RigidBody key={i} colliders={false} type='fixed' {...pose}>
      <CuboidCollider args={[width / 2, 0.0425, depth / 2]} position={[0, height - 0.0425, 0]} />
      <MeshSurfaceCollider args={collision} />
      <mesh castShadow geometry={geometry.wood} material={timber} name='lobby-bench-teak-slats' receiveShadow />
      <mesh castShadow geometry={geometry.metal} material={metal} name='lobby-bench-brushed-frame' receiveShadow />
    </RigidBody>)}
  </group>
}

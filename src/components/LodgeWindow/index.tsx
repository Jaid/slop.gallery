import type {Material} from 'three/webgpu'

import {RigidBody} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import MeshSurfaceCollider from '#component/MeshSurfaceCollider'
import {colliderGeometry} from '#src/lib/gallery/architecture.ts'
import LodgeEastWindowGeometry from '#src/lib/gallery/LodgeEastWindowGeometry.ts'
import LodgeWindowGeometry from '#src/lib/gallery/LodgeWindowGeometry.ts'
import {lightIndoors} from '#src/lib/materials/lights/index.ts'

export default function LodgeWindow({glass, material, stone}: {
  glass: Material
  material: Material
  /** the Bastion’s stone, for the east window’s ends on that side */
  stone: Material
}) {
  const geometry = useDisposable(useMemo(() => new LodgeWindowGeometry, []))
  const eastGeometry = useDisposable(useMemo(() => new LodgeEastWindowGeometry, []))
  // The brass stop sits between the Lodge and the corridor, out of the sun’s reach.
  const brass = useDisposable(useMemo(() => lightIndoors(new MeshStandardNodeMaterial({
    color: '#ac8c58',
    metalness: 0.65,
    roughness: 0.4,
  })), []))
  const collision = [geometry.lining, geometry.glass, geometry.frame].map(colliderGeometry)
  const eastCollision = [eastGeometry.lining, eastGeometry.glass, eastGeometry.frame].map(colliderGeometry)
  return <group name='lodge-tunnel-window'>
    <RigidBody colliders={false} type='fixed'>
      {collision.map((args, i) => <MeshSurfaceCollider key={i} args={args} />)}
      <mesh castShadow geometry={geometry.lining} material={material} name='lodge-window-reveal' receiveShadow />
      <mesh geometry={geometry.glass} material={glass} name='lodge-window-tunnel-glass' />
      <mesh castShadow geometry={geometry.frame} material={brass} name='lodge-window-glazing-stop' receiveShadow />
    </RigidBody>
    <RigidBody colliders={false} name='lodge-east-window' type='fixed'>
      {eastCollision.map((args, i) => <MeshSurfaceCollider key={i} args={args} />)}
      {/* The reveal’s groups take the timber first and the Bastion’s stone second, for its ends on that side, see LodgeEastWindowGeometry. */}
      <mesh castShadow geometry={eastGeometry.lining} material={[material, stone]} name='lodge-east-window-reveal' receiveShadow />
      <mesh geometry={eastGeometry.glass} material={glass} name='lodge-east-window-glass' />
      <mesh castShadow geometry={eastGeometry.frame} material={brass} name='lodge-east-window-glazing-stop' receiveShadow />
    </RigidBody>
  </group>
}

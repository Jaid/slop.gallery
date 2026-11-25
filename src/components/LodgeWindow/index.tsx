import type {Material} from 'three/webgpu'

import {RigidBody} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import hsl from 'okhsl'
import {useMemo} from 'react'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import MeshSurfaceCollider from '#component/MeshSurfaceCollider'
import {colliderGeometry} from '#src/lib/gallery/architecture.ts'
import LodgeEastWindowGeometry from '#src/lib/gallery/LodgeEastWindowGeometry.ts'
import LodgeWindowGeometry from '#src/lib/gallery/LodgeWindowGeometry.ts'
import {lightIndoors} from '#src/lib/materials/lights/index.ts'

/** The brass that stops the Lodge windows’ glass, between the Lodge and the passages around it, out of the sun’s reach. */
const useBrass = () => useDisposable(useMemo(() => lightIndoors(new MeshStandardNodeMaterial({
  color: hsl.integer(79, 48, 60),
  metalness: 0.65,
  roughness: 0.4,
})), []))

/** The Lodge’s west window onto the Corridor: the reveal through both walls, its glass and the brass stop. */
export function LodgeTunnelWindow({glass, material}: {
  glass: Material
  material: Material
}) {
  const geometry = useDisposable(useMemo(() => new LodgeWindowGeometry, []))
  const brass = useBrass()
  const collision = useMemo(() => [geometry.lining, geometry.glass, geometry.frame].map(colliderGeometry), [geometry])
  return <RigidBody colliders={false} name='lodge-tunnel-window' type='fixed'>
    {collision.map((args, i) => <MeshSurfaceCollider key={i} args={args} />)}
    <mesh castShadow geometry={geometry.lining} material={material} name='lodge-window-reveal' receiveShadow />
    <mesh geometry={geometry.glass} material={glass} name='lodge-window-tunnel-glass' />
    <mesh castShadow geometry={geometry.frame} material={brass} name='lodge-window-glazing-stop' receiveShadow />
  </RigidBody>
}

/** The Lodge’s east window onto the Bastion: the reveal, timber on the Lodge’s side and `masonry` on the Bastion’s, its glass and the brass stop. */
export function LodgeEastWindow({glass, masonry, material}: {
  glass: Material
  masonry: Material
  material: Material
}) {
  const geometry = useDisposable(useMemo(() => new LodgeEastWindowGeometry, []))
  const brass = useBrass()
  const collision = useMemo(() => [geometry.lining, geometry.glass, geometry.frame].map(colliderGeometry), [geometry])
  return <RigidBody colliders={false} name='lodge-east-window' type='fixed'>
    {collision.map((args, i) => <MeshSurfaceCollider key={i} args={args} />)}
    <mesh castShadow geometry={geometry.lining} material={[material, masonry]} name='lodge-east-window-reveal' receiveShadow />
    <mesh geometry={geometry.glass} material={glass} name='lodge-east-window-glass' />
    <mesh castShadow geometry={geometry.frame} material={brass} name='lodge-east-window-glazing-stop' receiveShadow />
  </RigidBody>
}

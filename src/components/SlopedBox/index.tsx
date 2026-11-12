import type {Vec3} from '#src/lib/gallery/types.ts'
import type {Material} from 'three/webgpu'

import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'

import MeshSurfaceCollider from '#component/MeshSurfaceCollider'
import {colliderGeometry} from '#src/lib/gallery/architecture.ts'
import SlopedBoxGeometry from '#src/lib/gallery/SlopedBoxGeometry.ts'

/** A shared visible and physical slab; the parent supplies its fixed rigid body. */
export default function SlopedBox({size, position, slope, bottomSlope = slope, material, name, collision = true, skew = 0}: {
  bottomSlope?: number
  collision?: boolean
  material: Material
  name?: string
  position: Vec3
  size: Vec3
  skew?: number
  slope: number
}) {
  const [width, height, depth] = size
  const geometry = useDisposable(useMemo(() => new SlopedBoxGeometry(width, height, depth, slope, bottomSlope, skew), [width, height, depth, slope, bottomSlope, skew]))
  const collider = useMemo(() => colliderGeometry(geometry), [geometry])
  return <group position={position}>
    <mesh castShadow geometry={geometry} material={material} name={name} receiveShadow />
    {collision && <MeshSurfaceCollider args={collider} />}
  </group>
}

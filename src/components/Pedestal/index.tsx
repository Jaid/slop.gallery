import type {Vec3} from '#src/lib/gallery.ts'
import type {ReactNode} from 'react'

import {RigidBody, TrimeshCollider} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import hsl from 'okhsl'
import {useMemo} from 'react'

import PedestalGeometry, {pedestalHeight} from '#src/lib/gallery/PedestalGeometry.ts'
import LimestoneMaterial from '#src/lib/materials/LimestoneMaterial.ts'

export function usePedestal() {
  const geometry = useDisposable(useMemo(() => new PedestalGeometry, []))
  const material = useDisposable(useMemo(() => new LimestoneMaterial, []))
  return {
    geometry,
    material,
  }
}

export default function Pedestal({position, rotation = 0, children, geometry, material}: ReturnType<typeof usePedestal> & {
  /** what stands on its cap, fixed to it and turning with it, its y up from the cap */
  children?: ReactNode
  position: Vec3
  /** its turn about y */
  rotation?: number
}) {
  return <RigidBody colliders={false} position={position} rotation={[0, rotation, 0]} type='fixed'>
    {geometry.collision.map((args, i) => <TrimeshCollider key={i} args={args} />)}
    <mesh castShadow name='pedestal-stone' receiveShadow>
      <primitive attach='geometry' object={geometry.stone} />
      <primitive attach='material' object={material} />
    </mesh>
    <mesh castShadow name='pedestal-bronze' receiveShadow>
      <primitive attach='geometry' object={geometry.bronze} />
      <meshStandardNodeMaterial color={hsl.integer(78, 47, 49)} metalness={0.78} roughness={0.38} />
    </mesh>
    <mesh castShadow name='pedestal-reveals' receiveShadow>
      <primitive attach='geometry' object={geometry.reveals} />
      <meshStandardNodeMaterial color={hsl.integer(83, 17, 32)} roughness={0.85} />
    </mesh>
    <group position={[0, pedestalHeight, 0]}>{children}</group>
  </RigidBody>
}

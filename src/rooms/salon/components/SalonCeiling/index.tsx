import {RigidBody} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import useGraphicsMode from 'use-graphics-mode'

import MeshSurfaceCollider from '#component/MeshSurfaceCollider'
import SalonCeilingGeometry from '#src/lib/gallery/SalonCeilingGeometry.ts'
import BronzeMaterial from '#src/lib/materials/BronzeMaterial.ts'

import {paintedStucco, sheetGlass} from './materials.ts'

/** The Salon’s fluted plaster dish and its bronze-bound glass rosette, centered above the sculpture and ottoman. */
export default function SalonCeiling() {
  const isHeavy = useGraphicsMode()
  const geometry = useDisposable(useMemo(() => new SalonCeilingGeometry, []))
  const stucco = useDisposable(useMemo(paintedStucco, []))
  const bronze = useDisposable(useMemo(() => new BronzeMaterial, []))
  const glass = useDisposable(useMemo(() => sheetGlass(isHeavy), [isHeavy]))
  return <group name='salon-skylight'>
    <RigidBody colliders={false} type='fixed'>
      {geometry.colliders.map((args, i) => <MeshSurfaceCollider key={i} args={args} />)}
    </RigidBody>
    <mesh castShadow geometry={geometry.shell} material={stucco} name='salon-ceiling-stucco' receiveShadow />
    <mesh castShadow geometry={geometry.laylight.bronze} material={bronze} name='salon-skylight-tracery' receiveShadow />
    {/* The shadow map used by both the sun and the god rays sees the cames but not the transmitting panes. */}
    <mesh geometry={geometry.laylight.glass} material={glass} name='salon-skylight-glass' />
  </group>
}

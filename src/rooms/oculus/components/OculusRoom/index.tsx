import type {Material} from 'three/webgpu'

import {ConvexHullCollider, CuboidCollider, RigidBody} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {ExtrudeGeometry, Shape, Vector2} from 'three/webgpu'

import OculusGround from '#component/OculusGround'
import OculusRailings from '#component/OculusRailings'
import Box from '#src/components/Scene/primitives.tsx'
import lowerGallery, {oculusCeiling} from '#src/lib/gallery/lowerGallery.ts'
import {apseOutline} from '#src/lib/gallery/oculusApse.ts'
import oculusBalcony from '#src/lib/gallery/oculusBalcony.ts'

const {oculus} = lowerGallery
const {floorY} = oculus
const ceilingY = oculus.ceiling.topY - oculus.ceiling.thickness / 2
/** The Oculus with its tower, ramps, balcony and apse; the barred openings in the apse are the architecture’s, shared with the Bastion behind them. */
export default function OculusRoom({material}: {
  material: Material
}) {
  return <group name='oculus-room'>
    <OculusGround material={material} />
    <OculusRailings />
    <RigidBody colliders={false} type='fixed'>
      <CuboidCollider args={oculusBalcony.size.map(value => value / 2) as [number, number, number]} position={oculusBalcony.position} />
      <Box material={material} name='oculus-balcony' position={oculusBalcony.position} size={oculusBalcony.size} />
      <CuboidCollider args={[oculus.size[0] / 2, 0.12, oculus.size[1] / 2]} position={[oculus.center[0], floorY - 0.12, oculus.center[1]]} />
      <Box material={material} name='oculus-floor' position={[oculus.center[0], floorY - 0.12, oculus.center[1]]} size={[oculus.size[0], 0.24, oculus.size[1]]} />
      {oculusCeiling.map(({center: [x, z], size: [width, depth]}, i) => <group key={i}>
        <CuboidCollider args={[width / 2, oculus.ceiling.thickness / 2, depth / 2]} position={[oculus.center[0] + x, ceilingY, oculus.center[1] + z]} />
        <Box material={material} name='oculus-ceiling-rim' position={[oculus.center[0] + x, ceilingY, oculus.center[1] + z]} size={[width, oculus.ceiling.thickness, depth]} />
      </group>)}
    </RigidBody>
    <ApseCeiling material={material} />
  </group>
}

/** The ceiling over the apse, as thick as the rest of the ceiling, out to its round walls’ center lines. */
function createApseCeiling() {
  const slab = new ExtrudeGeometry(new Shape(apseOutline().map(([x, z]) => new Vector2(x, z))), {
    depth: oculus.ceiling.thickness,
    bevelEnabled: false,
  })
  // The stone grain keeps the scale of the ground’s.
  const uv = slab.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) / 8, uv.getY(i) / 8)
  }
  return slab.rotateX(Math.PI / 2).translate(0, oculus.ceiling.topY, 0)
}
function ApseCeiling({material}: {material: Material}) {
  const geometry = useDisposable(useMemo(createApseCeiling, []))
  return <RigidBody colliders={false} type='fixed'>
    <ConvexHullCollider args={[geometry.getAttribute('position').array]} />
    <mesh castShadow geometry={geometry} material={material} name='oculus-apse-ceiling' receiveShadow />
  </RigidBody>
}

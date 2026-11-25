import type {RapierRigidBody} from '@react-three/rapier'
import type {Object3D} from 'three/webgpu'

import {useFrame} from '@react-three/fiber'
import {BallCollider, ConvexHullCollider, CylinderCollider, RigidBody, useSphericalJoint} from '@react-three/rapier'
import Branch from 'branch-component'
import useDisposable from 'disposable-lifetime/react'
import hsl from 'okhsl'
import {useMemo, useRef} from 'react'

import ChandelierGeometry from '#src/lib/gallery/ChandelierGeometry.ts'
import CandleFlameMaterial from '#src/lib/materials/CandleFlameMaterial.ts'
import HammeredBrassMaterial from '#src/lib/materials/HammeredBrassMaterial.ts'
import {chandelierCanopyTop, chandelierLampY, chandelierPhysics, chandelierRod, chandelierStemCenter, chandelierStemHalfHeight} from '#src/lib/physics/chandelier.ts'
import {useLamp} from '#src/lib/rendering/lamps.ts'

/**
 * The Sienna’s swinging chandelier, hanging from the ceiling over its parent’s origin, which carries the lamp with the global id `lamp` along.
 * It swings under its canopy, which sits fixed right under the ceiling, or, hung from a rod with turnings along it instead, about the ball at the rod’s top, rod and all.
 */
export default function Chandelier({lamp: lampId, rod = 0}: {
  /** the global id of the room’s lamp the fixture carries, which hangs below its metalwork at rest, see `chandelierLampY` */
  lamp: string
  /** how long a brass rod the fixture hangs from, from the top of its canopy up to the middle of the ball it swings about, or 0 to swing under a canopy fixed to the ceiling */
  rod?: number
}) {
  const anchor = useRef<RapierRigidBody>(null!)
  const fixture = useRef<RapierRigidBody>(null!)
  const pivot: [number, number, number] = rod > 0 ? [0, chandelierCanopyTop + rod, 0] : chandelierPhysics.anchor
  useSphericalJoint(anchor, fixture, [[0, 0, 0], pivot])
  const brass = useDisposable(useMemo(() => new HammeredBrassMaterial, []))
  const flame = useDisposable(useMemo(() => new CandleFlameMaterial, []))
  const geometry = useDisposable(useMemo(() => new ChandelierGeometry({rod}), [rod]))
  const source = useRef<Object3D>(null)
  const lamp = useLamp(lampId)
  useFrame(() => {
    const light = lamp()
    if (light && source.current) {
      source.current.updateWorldMatrix(true, false)
      source.current.getWorldPosition(light.position)
    }
  })
  return <group name={lampId} position={[0, chandelierPhysics.height, 0]}>
    <RigidBody colliders={false} position={pivot} type='fixed' ref={anchor} />
    <Branch not={rod > 0}><mesh castShadow geometry={geometry.canopy} material={brass} name='chandelier-canopy' /></Branch>
    <RigidBody additionalSolverIterations={8} angularDamping={chandelierPhysics.angularDamping} canSleep={false} ccd colliders={false} linearDamping={chandelierPhysics.linearDamping} ref={fixture}>
      <BallCollider args={[0.21]} mass={chandelierPhysics.hubMass} />
      <BallCollider args={[0.12]} mass={chandelierPhysics.pendantMass} position={[0, -0.38, 0]} />
      <CylinderCollider args={[chandelierStemHalfHeight, 0.022]} mass={chandelierPhysics.stemMass} position={[0, chandelierStemCenter, 0]} />
      {/* Ending short of the ball, which tucks into whatever the rod hangs from. */}
      <Branch if={rod > 0.2}><CylinderCollider args={[(rod - 0.1) / 2, chandelierRod.radius]} mass={chandelierPhysics.rodMass} position={[0, chandelierCanopyTop + (rod - 0.1) / 2, 0]} /></Branch>
      {geometry.armColliders.map((vertices, i) => <ConvexHullCollider key={i} args={[vertices]} mass={chandelierPhysics.armMass} restitution={0.15} />)}
      {geometry.ringColliders.map((vertices, i) => <ConvexHullCollider key={`ring-${i}`} args={[vertices]} mass={chandelierPhysics.ringMass} restitution={0.15} />)}
      {geometry.knops.map(({radius, y}) => <BallCollider key={y} args={[radius]} mass={chandelierPhysics.knopMass} position={[0, y, 0]} />)}
      <mesh castShadow geometry={geometry.brass} name='chandelier-brass'><primitive attach='material' object={brass} /></mesh>
      <mesh castShadow geometry={geometry.candles} name='chandelier-candles'><meshStandardNodeMaterial color={hsl.integer(83, 57, 82)} roughness={0.65} /></mesh>
      <mesh geometry={geometry.flames} material={flame} name='chandelier-flames' renderOrder={1} />
      <mesh geometry={geometry.pendant} name='chandelier-pendant'><primitive attach='material' object={brass} /></mesh>
      {/* The lamp hangs below the metalwork, so the fixture cannot shadow its own source. */}
      <object3D position={[0, chandelierLampY - chandelierPhysics.height, 0]} ref={source} />
    </RigidBody>
  </group>
}

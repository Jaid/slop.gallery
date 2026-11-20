import type {SculptureModelProps} from '#src/sculptures/index.ts'

import {CapsuleCollider, RoundCuboidCollider} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'

import {hitch} from '../../config.ts'
import {HitchSculptureGeometry} from '../../geometry.ts'

/** A continuous trefoil knot of the socket’s stone, with a broad oval foot and a collider following every turn. */
export default function HitchSculptureModel({mass, material}: SculptureModelProps) {
  const geometry = useDisposable(useMemo(() => new HitchSculptureGeometry, []))
  const {height: footHeight, scaleZ, topRadius} = hitch.foot
  const footMass = mass * 0.3
  const loopMass = (mass - footMass) / geometry.knotColliders.length
  return <group>
    <RoundCuboidCollider args={[topRadius * 0.94, footHeight / 2 - 0.01, topRadius * scaleZ * 0.93, 0.07]} mass={footMass} position={[0, footHeight / 2, 0]} />
    {geometry.knotColliders.map((collider, index) => <CapsuleCollider key={index} args={[collider.halfLength, hitch.knot.tube]} mass={loopMass} position={collider.position} quaternion={collider.quaternion} />)}
    <mesh castShadow geometry={geometry.foot} material={material} name='sculpture-hitch-foot' receiveShadow />
    <mesh castShadow geometry={geometry.knot} material={material} name='sculpture-hitch-knot' receiveShadow />
  </group>
}

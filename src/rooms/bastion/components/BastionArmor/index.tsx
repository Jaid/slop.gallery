import type {CollisionEnterPayload, RapierRigidBody} from '@react-three/rapier'

import {CoefficientCombineRule, CuboidCollider, RigidBody, TrimeshCollider, useAfterPhysicsStep, useRapier} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useEffect, useMemo, useRef} from 'react'
import {DoubleSide} from 'three/webgpu'

import {propObjects} from '#src/components/Scene/GrabbableProp.tsx'
import {useGallery} from '#src/lib/gallery.ts'
import {lodgeSpurArmor} from '#src/lib/gallery/bastionNetwork.ts'
import {helmet} from '#src/lib/gallery/curios/index.ts'
import {suitOfArmor, suitOfArmorBoxes, suitOfArmorShoulders} from '#src/lib/gallery/suitOfArmor.ts'
import suitOfArmorGeometry from '#src/lib/gallery/suitOfArmorGeometry.ts'
import ForgedSteelMaterial from '#src/lib/materials/ForgedSteelMaterial.ts'
import {lightIndoors} from '#src/lib/materials/lights/index.ts'
import {studioEnvironment} from '#src/lib/materials/metal.ts'
import ArmorBeheading from '#src/lib/physics/ArmorBeheading.ts'
import {telemetry} from '#src/lib/telemetry/index.ts'

/** The helmet’s body while it lies about free, neither carried nor held by a fusion. */
const freeHelmet = () => {
  const handle = propObjects.get(helmet.propId)
  if (!handle || handle.seized() || useGallery.getState().held === helmet.propId) {
    return
  }
  return handle.body
}

/**
 * The empty suit of armor standing at the end of the Bastion’s blind branch beside the Lodge, looking back down it toward the link, the knight’s helmet resting on its shoulders, in the helmet’s steel.
 * It is a body of its own, top-heavy on its narrow feet: pushed, it tips over against the wall or onto the floor and, striking it, throws off its head.
 */
export default function BastionArmor() {
  const {world} = useRapier()
  const body = useRef<RapierRigidBody>(null)
  const beheading = useRef<ArmorBeheading | null>(null)
  const geometry = useDisposable(useMemo(suitOfArmorGeometry, []))
  const shoulders = useMemo(suitOfArmorShoulders, [])
  const steel = useDisposable(useMemo(() => {
    const material = lightIndoors(new ForgedSteelMaterial({
      environment: studioEnvironment,
      patina: 0.15,
    }))
    // Its plates are open where they lap over each other, and its neck is empty.
    material.side = DoubleSide
    return material
  }, []))
  useEffect(() => {
    if (body.current) {
      beheading.current = new ArmorBeheading(world, body.current, freeHelmet)
    }
    return () => {
      beheading.current = null
    }
  }, [world])
  const record = (knock: ReturnType<ArmorBeheading['struck']>) => {
    if (!knock || !telemetry) {
      return
    }
    const [x, , z] = knock.direction
    telemetry.event('armor.beheaded', {
      'direction.x': Math.round(x * 1000) / 1000,
      'direction.z': Math.round(z * 1000) / 1000,
    }, 'Knocked the helmet off the suit of armor')
  }
  const struck = ({other}: CollisionEnterPayload) => {
    // The helmet itself never knocks it off.
    if (other.rigidBody && other.rigidBody.handle === propObjects.get(helmet.propId)?.body.handle) {
      return
    }
    record(beheading.current?.struck())
  }
  useAfterPhysicsStep(() => {
    record(beheading.current?.update())
  })
  return <RigidBody ccd colliders={false} friction={suitOfArmor.friction} name='bastion-armor' position={lodgeSpurArmor} restitution={suitOfArmor.restitution} type='dynamic' ref={body} onCollisionEnter={struck}>
    {suitOfArmorBoxes.map(({friction, from, mass, name, to}) => <CuboidCollider
      key={name}
      args={[(to[0] - from[0]) / 2, (to[1] - from[1]) / 2, (to[2] - from[2]) / 2]}
      friction={friction ?? suitOfArmor.friction}
      frictionCombineRule={friction === undefined ? undefined : CoefficientCombineRule.Max}
      mass={mass}
      position={[(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2]}
      restitution={suitOfArmor.restitution}
    />)}
    {/* What the helmet rests on, weightless */}
    <TrimeshCollider args={shoulders} friction={suitOfArmor.friction} mass={0} restitution={suitOfArmor.restitution} />
    <mesh castShadow geometry={geometry} material={steel} name='bastion-armor-steel' receiveShadow />
  </RigidBody>
}

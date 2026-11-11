import {BallCollider, CuboidCollider, CylinderCollider, RigidBody} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {DoubleSide} from 'three/webgpu'

import {lodgeSpurArmor} from '#src/lib/gallery/bastionNetwork.ts'
import {suitOfArmor, suitOfArmorColliders} from '#src/lib/gallery/suitOfArmor.ts'
import suitOfArmorGeometry from '#src/lib/gallery/suitOfArmorGeometry.ts'
import ForgedSteelMaterial from '#src/lib/materials/ForgedSteelMaterial.ts'
import {lightIndoors} from '#src/lib/materials/lights/index.ts'
import {studioEnvironment} from '#src/lib/materials/metal.ts'

/**
 * The empty suit of armor standing at the end of the Bastion’s blind branch beside the Lodge, looking back down it
 * toward the link, the knight’s helmet resting on its shoulders, in the helmet’s steel.
 * A loose dynamic body on flat sabatons, heavy and low in the legs: it stands and sleeps where it stands, but a
 * player who keeps pushing it walks it past the edge of its feet, it topples into the wall or onto the floor,
 * and the helmet — a separate body only resting on its collar — comes off as it falls.
 */
export default function BastionArmor() {
  const geometry = useDisposable(useMemo(suitOfArmorGeometry, []))
  const steel = useDisposable(useMemo(() => {
    const material = lightIndoors(new ForgedSteelMaterial({
      environment: studioEnvironment,
      patina: 0.15,
    }))
    // Its plates are open where they lap over each other, and its neck is empty.
    material.side = DoubleSide
    return material
  }, []))
  return <RigidBody angularDamping={suitOfArmor.angularDamping} canSleep ccd colliders={false} friction={suitOfArmor.friction} linearDamping={suitOfArmor.linearDamping} name='bastion-armor' position={lodgeSpurArmor} restitution={suitOfArmor.restitution} type='dynamic'>
    {suitOfArmorColliders.map((collider, index) => {
      const key = index
      if (collider.kind === 'cylinder') {
        const [radius, height] = collider.size as readonly [number, number]
        return <CylinderCollider key={key} args={[height / 2, radius]} friction={suitOfArmor.friction} mass={collider.mass} position={collider.position} restitution={suitOfArmor.restitution} />
      }
      if (collider.kind === 'ball') {
        return <BallCollider key={key} args={[collider.size as number]} friction={suitOfArmor.friction} mass={collider.mass} position={collider.position} restitution={suitOfArmor.restitution} />
      }
      const [width, height, depth] = collider.size as readonly [number, number, number]
      return <CuboidCollider key={key} args={[width / 2, height / 2, depth / 2]} friction={suitOfArmor.friction} mass={collider.mass} position={collider.position} restitution={suitOfArmor.restitution} />
    })}
    <mesh castShadow geometry={geometry} material={steel} name='bastion-armor-steel' receiveShadow />
  </RigidBody>
}

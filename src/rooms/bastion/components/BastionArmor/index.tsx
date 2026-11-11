import {BallCollider, ConvexHullCollider, RigidBody} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {DoubleSide} from 'three/webgpu'

import {lodgeSpurArmor} from '#src/lib/gallery/bastionNetwork.ts'
import {suitOfArmorColliders} from '#src/lib/gallery/suitOfArmor.ts'
import suitOfArmorGeometry from '#src/lib/gallery/suitOfArmorGeometry.ts'
import ForgedSteelMaterial from '#src/lib/materials/ForgedSteelMaterial.ts'
import {lightIndoors} from '#src/lib/materials/lights/index.ts'
import {studioEnvironment} from '#src/lib/materials/metal.ts'
import {weldedSurfaceSkin} from '#src/lib/physics/weldedSurface.ts'

/** how heavy the empty suit is, in kilograms, without the helmet that only rests on it */
const mass = 38

/**
 * The empty suit of armor standing at the end of the Bastion’s blind branch beside the Lodge, looking back down it toward the link, the knight’s helmet resting loose on its shoulders.
 * It stands of its own weight, a dynamic body on two round sabatons: a shove rolls it over into the wall or the floor, and the helmet, which is not fixed to it, spills off.
 */
export default function BastionArmor() {
  const geometry = useDisposable(useMemo(suitOfArmorGeometry, []))
  const colliders = useMemo(suitOfArmorColliders, [])
  const steel = useDisposable(useMemo(() => {
    const material = lightIndoors(new ForgedSteelMaterial({
      environment: studioEnvironment,
      patina: 0.22,
    }))
    // Its plates are open where they lap over each other, and its neck is empty.
    material.side = DoubleSide
    return material
  }, []))
  const piece = mass / colliders.length
  return <RigidBody angularDamping={0.08} canSleep colliders={false} name='bastion-armor' position={lodgeSpurArmor} type='dynamic'>
    {colliders.map((collider, index) => 'ball' in collider ? <BallCollider key={index} args={[collider.ball[1]]} contactSkin={weldedSurfaceSkin} friction={0.35} mass={piece} position={collider.ball[0]} restitution={0.02} /> : <ConvexHullCollider key={index} args={[collider.hull]} contactSkin={weldedSurfaceSkin} friction={0.4} mass={piece} restitution={0.02} />)}
    <mesh castShadow geometry={geometry} material={steel} name='bastion-armor-steel' receiveShadow />
  </RigidBody>
}

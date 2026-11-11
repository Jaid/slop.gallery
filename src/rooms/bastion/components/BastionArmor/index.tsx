import {RigidBody, TrimeshCollider} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {DoubleSide} from 'three/webgpu'

import {colliderGeometry} from '#src/lib/gallery/architecture.ts'
import {lodgeSpurArmor} from '#src/lib/gallery/bastionNetwork.ts'
import {suitOfArmorCollision} from '#src/lib/gallery/suitOfArmor.ts'
import suitOfArmorGeometry from '#src/lib/gallery/suitOfArmorGeometry.ts'
import ForgedSteelMaterial from '#src/lib/materials/ForgedSteelMaterial.ts'
import {lightIndoors} from '#src/lib/materials/lights/index.ts'
import {studioEnvironment} from '#src/lib/materials/metal.ts'

/** The empty suit of armor standing at the end of the Bastion’s blind branch beside the Lodge, looking back down it toward the link, the knight’s helmet resting on its shoulders, in the helmet’s steel. */
export default function BastionArmor() {
  const geometry = useDisposable(useMemo(suitOfArmorGeometry, []))
  const collision = useMemo(() => {
    const surface = suitOfArmorCollision()
    try {
      return colliderGeometry(surface)
    } finally {
      surface.dispose()
    }
  }, [])
  const steel = useDisposable(useMemo(() => {
    const material = lightIndoors(new ForgedSteelMaterial({
      environment: studioEnvironment,
      patina: 0.15,
    }))
    // Its plates are open where they lap over each other, and its neck is empty.
    material.side = DoubleSide
    return material
  }, []))
  return <RigidBody ccd colliders={false} friction={0.8} position={lodgeSpurArmor} restitution={0.05}>
    {/* A surface rather than convex boxes keeps the helmet’s flat gorget stable while still letting both bodies move independently. */}
    <TrimeshCollider args={collision} density={450} />
    <group name='bastion-armor'><mesh castShadow geometry={geometry} material={steel} name='bastion-armor-steel' receiveShadow /></group>
  </RigidBody>
}

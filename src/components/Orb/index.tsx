import type {Vec3} from '#src/lib/gallery.ts'
import type {Orb as OrbKind} from '#src/orbs/index.ts'

import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'

import GrabbableProp from '#src/components/Scene/GrabbableProp.tsx'
import {orbStriker} from '#src/lib/audio/impactSounds.ts'
import {environmentSeed} from '#src/lib/gameSeed.ts'
import {orbRadius} from '#src/orbs/index.ts'

/** A glass ball, filled with its orb’s scene if it has one, which rolls when knocked and clinks against what it strikes, casts its orb’s mood over the world while held and is an ingredient of the fusion of a portrait it is thrown into, contributing whatever its orb contributes, and used up by its success, which leaves the orb’s remains, if any. */
export default function Orb({id, orb, position, withheld}: {
  /** its prop’s id, unique in the world, the orb’s own prop id by default */
  id?: string
  orb: OrbKind
  position: Vec3
  /** whether it enters the world held by a fusion’s portal, as the remains of an orb the fusion uses up */
  withheld?: boolean
}) {
  const material = useDisposable(useMemo(() => orb.createMaterial({radius: orbRadius}), [orb]))
  const ingredient = useMemo(() => orb.ingredient(environmentSeed), [orb])
  return <GrabbableProp id={id ?? orb.propId} colliders='ball' consumable ingredient={ingredient} mood={orb.mood} orb={orb} orbit={{radius: orbRadius * 1.3}} position={position} remains={orb.remains} striker={orbStriker} title={orb.title} type='dynamic' withheld={withheld}>
    <mesh castShadow material={material}><sphereGeometry args={[orbRadius, 96, 64]} /></mesh>
  </GrabbableProp>
}

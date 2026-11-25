import {CuboidCollider, CylinderCollider, RigidBody} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import hsl from 'okhsl'
import {useMemo} from 'react'
import {float, normalGeometry, positionGeometry} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import BenchSeat from '#component/BenchSeat'
import Box from '#src/components/Scene/primitives.tsx'
import {salonBench, salonBenchLegs} from '#src/lib/gallery/salon.ts'
import {salonVelvet} from '#src/lib/gallery/salonVelvet.ts'
import {environmentSeed} from '#src/lib/gameSeed.ts'
import VelvetMaterial from '#src/lib/materials/VelvetMaterial.ts'

/** how heavy each of the ottoman’s legs is, in kilograms, of its mass, which its block carries the rest of */
const legMass = 1

/** The Salon’s double-sided velvet ottoman, a body of its own that a push slides across the floor: its legs stand on the floor, and its walnut frame and the cushion on it are one block over them. */
export default function SalonOttoman() {
  const {apronHeight, cushionHeight, depth, legHeight, legRadius: [legTop, legFoot], mass, position, seatHeight, width} = salonBench
  const seatThickness = cushionHeight + 0.02
  const velvet = useDisposable(useMemo(() => {
    // Carry the nap from the flat seat over the rounded edges instead of stretching it down the sides.
    const drop = float(seatThickness / 2).sub(positionGeometry.y)
    const coordinates = positionGeometry.xz.add(normalGeometry.xz.mul(drop))
    return new VelvetMaterial(coordinates.mul(4), {
      seed: environmentSeed,
      style: salonVelvet(environmentSeed),
    })
  }, [seatThickness]))
  const walnut = useDisposable(useMemo(() => new MeshStandardNodeMaterial({
    color: hsl.integer(50, 48, 18),
    roughness: 0.45,
  }), []))
  return <RigidBody colliders={false} friction={0.6} name='salon-ottoman' position={position} type='dynamic'>
    <CuboidCollider args={[width / 2, (seatHeight - legHeight) / 2, depth / 2]} mass={mass - legMass * salonBenchLegs.length} position={[0, (seatHeight + legHeight) / 2, 0]} />
    {salonBenchLegs.map(([x, z]) => <CylinderCollider key={`${x}:${z}`} args={[legHeight / 2, (legTop + legFoot) / 2]} mass={legMass} position={[x, legHeight / 2, z]} />)}
    {salonBenchLegs.map(([x, z]) => <mesh key={`${x}:${z}`} castShadow material={walnut} position={[x, legHeight / 2, z]} receiveShadow><cylinderGeometry args={[legTop, legFoot, legHeight, 16]} /></mesh>)}
    <Box material={walnut} position={[0, legHeight + apronHeight / 2, 0]} size={[width - 0.06, apronHeight, depth - 0.06]} />
    <BenchSeat material={velvet} position={[0, legHeight + apronHeight + cushionHeight / 2, 0]} size={[width, seatThickness, depth]} />
  </RigidBody>
}

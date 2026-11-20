import {CapsuleCollider, CuboidCollider, CylinderCollider, RigidBody} from '@react-three/rapier'
import Branch from 'branch-component'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {Quaternion, Vector3} from 'three/webgpu'

import {fountainBenchColliders, fountainBenches, fountainBenchFrame} from '#src/lib/gallery/fountainBenches.ts'
import SlattedBenchGeometry from '#src/lib/gallery/SlattedBenchGeometry.ts'
import metal from '#src/lib/materials/metal.ts'
import TeakMaterial from '#src/lib/materials/TeakMaterial.ts'

const up = new Vector3(0, 1, 0)
const {frame, seat} = fountainBenchColliders()
/** each run of the frames’ tubes as a collider standing along y: its middle, half its length and the turn from up y onto it */
const runs = frame.map(({from, leg, mass, to}) => {
  const start = new Vector3(...from)
  const direction = new Vector3(...to)
  direction.sub(start)
  const length = direction.length()
  const turn = new Quaternion
  turn.setFromUnitVectors(up, direction.divideScalar(length))
  return {
    center: start.addScaledVector(direction, length / 2).toArray(),
    half: length / 2,
    leg,
    mass,
    turn: turn.toArray(),
  }
})

/** The four teak benches round the Lobby’s fountain, each a heavy body of its own that a push slides across the floor. */
export default function FountainBenches() {
  const geometry = useDisposable(useMemo(() => new SlattedBenchGeometry, []))
  const timber = useDisposable(useMemo(() => new TeakMaterial, []))
  return <group name='lobby-fountain-benches'>
    {fountainBenches.map(({name, position, rotation}) => <RigidBody key={name} colliders={false} friction={0.6} name={name} position={position} rotation={rotation} type='dynamic'>
      <CuboidCollider args={[seat.size[0] / 2, seat.size[1] / 2, seat.size[2] / 2]} mass={seat.mass} position={seat.center} />
      {/* The legs stand on flat feet; every other run is round at its ends, which fill the joints between them. */}
      {runs.map(({center, half, leg, mass, turn}, index) => <Branch key={index} if={leg} else={<CapsuleCollider args={[half, fountainBenchFrame.radius]} mass={mass} position={center} quaternion={turn} />}><CylinderCollider args={[half, fountainBenchFrame.radius]} mass={mass} position={center} quaternion={turn} /></Branch>)}
      <mesh castShadow geometry={geometry.wood} material={timber} name='lobby-bench-teak-slats' receiveShadow />
      <mesh castShadow geometry={geometry.metal} material={metal} name='lobby-bench-brushed-frame' receiveShadow />
    </RigidBody>)}
  </group>
}

import type {Material} from 'three/webgpu'

import {CuboidCollider, RigidBody} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'

import TimberFrame from '#component/TimberFrame'
import Box from '#src/components/Scene/primitives.tsx'
import StaticBatch from '#src/components/Scene/StaticBatch.tsx'
import {corridorRails, corridorRunner, corridorStairHead, corridorStairs} from '#src/lib/gallery/corridor.ts'
import TimberGeometry from '#src/lib/gallery/passages/TimberGeometry.ts'
import {lightIndoors} from '#src/lib/materials/lights/index.ts'
import StairRunnerMaterial from '#src/lib/materials/StairRunnerMaterial.ts'

/** The flight from the corridor up the diagonal to the landing at the Sienna’s vestibule, whose edge is laid as the flight’s head tread. Its materials must be lit by {@link lightIndoors}, like the treads. */
export default function CorridorStairs({timber, lining}: {
  lining: Material
  timber: Material
}) {
  // It runs between the open elbows of the passages at both of its ends.
  const frame = useDisposable(useMemo(() => TimberGeometry.stairs(corridorStairs, true), []))
  // The runner, rods and nosings are shaded into the treads, so every step stays a single box.
  const treads = useDisposable(useMemo(() => lightIndoors(new StairRunnerMaterial(corridorRunner)), []))
  return <StaticBatch name='corridor-wooden-stairs'>
    <RigidBody colliders={false} type='fixed'>
      {corridorStairs.blocks.map((block, i) => <group key={i} position={block.position} rotation={[0, block.yaw ?? 0, 0]}>
        <CuboidCollider args={[block.size[0] / 2, block.size[1] / 2, block.size[2] / 2]} />
        <Box material={treads} name='corridor-stair-tread' size={block.size} />
      </group>)}
      {/* The landing’s slab collides under its head. */}
      <group position={corridorStairHead.position} rotation={[0, corridorStairHead.yaw ?? 0, 0]}>
        <Box material={treads} name='corridor-stair-head' size={corridorStairHead.size} />
      </group>
      <TimberFrame geometry={frame} lining={lining} material={timber} />
      {corridorRails.map((beam, i) => <group key={i} position={beam.position} rotation={beam.rotation}>
        <CuboidCollider args={[beam.size[0] / 2, beam.size[1] / 2, beam.size[2] / 2]} />
        <Box material={timber} size={beam.size} />
      </group>)}
    </RigidBody>
  </StaticBatch>
}

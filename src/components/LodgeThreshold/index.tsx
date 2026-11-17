import type {Texture} from 'three/webgpu'

import {ConvexHullCollider, RigidBody} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import Box from '#src/components/Scene/primitives.tsx'
import {corridorPassage, lodgeThreshold, lodgeThresholdSaddle} from '#src/lib/gallery/corridor.ts'
import {lodgeFloorPlanks} from '#src/lib/gallery/lodge.ts'
import lodgeTimber from '#src/lib/gallery/lodgeTimber.ts'
import SaddleGeometry from '#src/lib/gallery/passages/SaddleGeometry.ts'
import {lightIndoors} from '#src/lib/materials/lights/index.ts'
import PlankMaterial from '#src/lib/materials/PlankMaterial.ts'

/** The Lodge’s plank floor, continued over its threshold in the corridor’s doorway, which ends in a raised saddle where it meets the corridor’s boards. */
export default function LodgeThreshold({wood}: {wood: Texture}) {
  const timber = useDisposable(useMemo(() => lightIndoors(new MeshStandardNodeMaterial(lodgeTimber(wood))), [wood]))
  const floor = useDisposable(useMemo(() => lightIndoors(new PlankMaterial(lodgeFloorPlanks)), []))
  const saddle = useDisposable(useMemo(() => SaddleGeometry.across(lodgeThresholdSaddle, corridorPassage.floorY), []))
  return <group name='lodge-threshold'>
    <Box material={floor} name='lodge-threshold' position={[lodgeThreshold.center[0], corridorPassage.floorY - 0.12, lodgeThreshold.center[1]]} size={[lodgeThreshold.size[0], 0.24, lodgeThreshold.size[1]]} />
    <RigidBody colliders={false} type='fixed'>
      <ConvexHullCollider args={[saddle.getAttribute('position').array]} />
      <mesh castShadow geometry={saddle} material={timber} name='lodge-threshold-saddle' receiveShadow />
    </RigidBody>
  </group>
}

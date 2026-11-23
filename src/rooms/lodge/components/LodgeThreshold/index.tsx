import type {Texture} from 'three/webgpu'

import {ConvexHullCollider, RigidBody} from '@react-three/rapier'
import Branch from 'branch-component'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {corridorPassage, lodgeThreshold, lodgeThresholdSaddle} from '#src/lib/gallery/corridor.ts'
import lodgeTimber from '#src/lib/gallery/lodgeTimber.ts'
import SaddleGeometry from '#src/lib/gallery/passages/SaddleGeometry.ts'
import useLodgeFloor from '#src/lib/gallery/useLodgeFloor.ts'
import {lightIndoors} from '#src/lib/materials/lights/index.ts'

/** how thick the threshold’s planks are */
const thickness = 0.24

/** The Lodge’s plank floor, continued over its threshold in the corridor’s doorway, which ends in a raised saddle where it meets the corridor’s boards. */
export default function LodgeThreshold({wood}: {wood: Texture}) {
  const timber = useDisposable(useMemo(() => lightIndoors(new MeshStandardNodeMaterial(lodgeTimber(wood))), [wood]))
  const floor = useLodgeFloor()
  const reflection = floor.reflectionTarget
  const saddle = useDisposable(useMemo(() => SaddleGeometry.across(lodgeThresholdSaddle, corridorPassage.floorY), []))
  return <group name='lodge-threshold'>
    <mesh castShadow material={floor} name='lodge-threshold' position={[lodgeThreshold.center[0], corridorPassage.floorY - thickness / 2, lodgeThreshold.center[1]]} receiveShadow>
      <boxGeometry args={[lodgeThreshold.size[0], thickness, lodgeThreshold.size[1]]} />
      <Branch if={reflection}><group position-y={thickness / 2} rotation-x={-Math.PI / 2}><primitive object={reflection!} /></group></Branch>
    </mesh>
    <RigidBody colliders={false} type='fixed'>
      <ConvexHullCollider args={[saddle.getAttribute('position').array]} />
      <mesh castShadow geometry={saddle} material={timber} name='lodge-threshold-saddle' receiveShadow />
    </RigidBody>
  </group>
}

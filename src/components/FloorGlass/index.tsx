import type {roomFloorPlan} from '#src/lib/gallery/floors.ts'
import type {Material} from 'three/webgpu'

import {CuboidCollider} from '@react-three/rapier'

import {floorGlassThickness} from '#src/lib/gallery/floors.ts'
import {refractingPaneRef} from '#src/lib/rendering/refractingPanes.ts'

/** Transparent things on the far side of the floor glass, like orbs below it, draw before it, so it bends them along with the room. */
const paneRef = refractingPaneRef([0, 1, 0])

type FloorGlazing = NonNullable<ReturnType<typeof roomFloorPlan>['glazing']>

export default function FloorGlass({glass, glazing, name}: {
  glass: Material
  glazing: FloorGlazing
  name: string
}) {
  return <group position={[glazing.center[0], -floorGlassThickness / 2, glazing.center[1]]}>
    <CuboidCollider args={[glazing.size[0] / 2, floorGlassThickness / 2, glazing.size[1] / 2]} />
    <mesh material={glass} name={`${name}-floor-glass`} ref={paneRef}>
      <boxGeometry args={[glazing.size[0], floorGlassThickness, glazing.size[1]]} />
    </mesh>
  </group>
}

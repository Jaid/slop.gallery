import type {FloorRoom} from '#src/lib/gallery/floors.ts'
import type {Material, Object3D, Texture} from 'three/webgpu'

import {CuboidCollider, RigidBody} from '@react-three/rapier'
import Branch from 'branch-component'
import hsl from 'okhsl'

import FloorGlass from '#component/FloorGlass'
import WoodFloor from '#component/WoodFloor'
import Box from '#src/components/Scene/primitives.tsx'
import StaticBatch from '#src/components/Scene/StaticBatch.tsx'
import {floorThickness, roomFloorPlan} from '#src/lib/gallery/floors.ts'
import {graphicsProfile} from '#src/lib/rendering/graphicsMode.ts'

const {mirrorReflections} = graphicsProfile

/** Materials that replace a room’s default stone slabs and brass inlays. */
export type RoomFloorMaterials = {
  /** the brass inlays; rooms without them leave it out */
  inlay?: Material
  /** the planar reflection target of a reflective slab material, laid at the floor’s surface */
  reflection?: Object3D
  slab: Material
}

export default function RoomFloor({glass, materials, room, stone, wood}: {
  glass: Material
  materials?: RoomFloorMaterials
  room: FloorRoom
  stone: Texture
  wood: Texture
}) {
  const plan = roomFloorPlan(room)
  const reflection = materials?.reflection
  const envMapIntensity = mirrorReflections ? 1 : 0
  const surfaces: Partial<Record<FloorRoom['id'], {
    color: number
    map?: Texture
  }>> = {
    vesper: {
      map: wood,
      color: hsl.integer(67, 34, 70),
    },
  }
  const surface = surfaces[room.id] ?? {
    map: stone,
    color: hsl.integer(88, 39, 94),
  }
  return <StaticBatch name={`${room.id}-floor`}>
    <RigidBody colliders={false} type='fixed'>
      {plan.slabs.map(({center: [x, z], size: [width, depth]}, i) => <group key={i}>
        <CuboidCollider args={[width / 2, floorThickness / 2, depth / 2]} position={[x, -floorThickness / 2, z]} />
        <Box name={`${room.id}-floor-slab`} position={[x, -floorThickness / 2, z]} size={[width, floorThickness, depth]} {...surface} envMapIntensity={envMapIntensity} material={materials?.slab} roughness={mirrorReflections ? 0.36 : 0.8} />
      </group>)}
      <Branch if={plan.glazing}><FloorGlass glass={glass} glazing={plan.glazing!} name={room.id} /></Branch>
    </RigidBody>
    <Branch if={reflection}><group rotation={[-Math.PI / 2, 0, 0]}><primitive object={reflection!} /></group></Branch>
    <Branch if={room.id === 'vesper'}><WoodFloor depth={room.size[1]} texture={wood} width={room.size[0]} /></Branch>
    <Branch not={room.id === 'banquet'}>
      {plan.seams.map(({center: [x, z], size: [width, depth]}, i) => <Box key={i} color={hsl.integer(89, 15, 66)} envMapIntensity={envMapIntensity} name={`${room.id}-floor-seam`} position={[x, 0.008, z]} size={[width, 0.008, depth]} />)}
      {plan.inlays.map(({center: [x, z], size: [width, depth]}, i) => <Box key={i} color={hsl.integer(82, 44, 56)} envMapIntensity={envMapIntensity} material={materials?.inlay} metalness={0.45} name={`${room.id}-floor-inlay`} position={[x, 0.015, z]} size={[width, 0.012, depth]} />)}
    </Branch>
  </StaticBatch>
}

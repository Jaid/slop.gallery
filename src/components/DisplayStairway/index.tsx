import type tunnelDisplays from '#src/lib/gallery/tunnelDisplays.ts'
import type {Vec3} from '#src/lib/gallery/types.ts'
import type {Material} from 'three/webgpu'

import {ConvexHullCollider, CuboidCollider, RigidBody} from '@react-three/rapier'

import FloorSlab from '#component/FloorSlab'
import Box from '#src/components/Scene/primitives.tsx'
import StaticBatch from '#src/components/Scene/StaticBatch.tsx'
import {tunnelFrame} from '#src/lib/gallery/exhibitionTunnel.ts'
import {slabHulls} from '#src/lib/gallery/floorPolygons.ts'
import {stairwayTint} from '#src/rooms/exhibition/lamps.ts'

type Stairway = (typeof tunnelDisplays)[number]['stairway']

/** The staff stairway from a door in the Oculus’ south wall at its balcony down along the tunnel’s diagonal to the landing before the cutout in a display’s south end wall, laid out in the diagonal’s frame; its walls are the architecture’s. */
export default function DisplayStairway({stairway, material}: {
  material: Material
  stairway: Stairway
}) {
  const {id, treads, slabs, roofs, lamps} = stairway
  const [originX, originZ] = tunnelFrame.origin
  return <StaticBatch name={`oculus-stairway-${id}`}>
    {/* StaticBatch hides the originals before automatic colliders would see them, so everything states its colliders. */}
    <RigidBody colliders={false} position={[originX, 0, originZ]} rotation={[0, tunnelFrame.yaw, 0]} type='fixed'>
      {treads.map(({position, size}, i) => <group key={i}>
        <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} position={position} />
        <Box material={material} name='display-stair-block' position={position} size={size} />
      </group>)}
      {slabs.map(({name, polygon, bottom, top}, i) => <group key={i}>
        {slabHulls(polygon, bottom, top).map((corners, j) => <ConvexHullCollider key={j} args={[corners]} />)}
        <FloorSlab bottom={bottom} depth={top - bottom} material={material} name={name} polygon={polygon} />
      </group>)}
      {roofs.map(({position, rotation, size}, i) => <group key={i} position={position} rotation={rotation}>
        <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} />
        <Box material={material} name='display-stairway-roof' size={size} />
      </group>)}
      {treads.filter(block => block.tread).map(({axis, position, size, top, direction}, i) => {
        // a strip along the tread’s edge at the riser up
        const along = axis === 0 ? 0 : 2
        const stripPosition: Vec3 = [position[0], top + 0.004, position[2]]
        stripPosition[along] -= direction * (size[along] / 2 - 0.035)
        const stripSize: Vec3 = [0.025, 0.008, 0.025]
        stripSize[2 - along] = size[2 - along] - 0.45
        return <mesh key={i} position={stripPosition}>
          <boxGeometry args={stripSize} />
          <meshBasicNodeMaterial color='#62958e' toneMapped={false} />
        </mesh>
      })}
      {lamps.map((position, i) => <group key={i} position={position}>
        <Box color='#242f32' position={[0, -0.04, 0]} size={[0.5, 0.1, 0.5]} />
        <mesh position={[0, -0.091, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.16, 24]} /><meshBasicNodeMaterial color={stairwayTint} toneMapped={false} />
        </mesh>
      </group>)}
    </RigidBody>
  </StaticBatch>
}

import type {FloorPolygon} from '#src/lib/gallery/floorPolygons.ts'
import type tunnelDisplays from '#src/lib/gallery/tunnelDisplays.ts'
import type {Vec3} from '#src/lib/gallery/types.ts'
import type {Material} from 'three/webgpu'

import {CuboidCollider, RigidBody} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'

import MeshSurfaceCollider from '#component/MeshSurfaceCollider'
import Box from '#src/components/Scene/primitives.tsx'
import StaticBatch from '#src/components/Scene/StaticBatch.tsx'
import {colliderGeometry} from '#src/lib/gallery/architecture.ts'
import {PolygonalSlabGeometry} from '#src/lib/gallery/ExhibitionTunnelGeometry.ts'
import {stairwayTint} from '#src/rooms/exhibition/lamps.ts'

type Stairway = (typeof tunnelDisplays)[number]['stairway']

/** The staff stairway from a door at the Oculus balcony’s end down to the landing before the cutout in a display’s south end wall. */
export default function DisplayStairway({stairway, material}: {
  material: Material
  stairway: Stairway
}) {
  const {id, treads, slabs, roofs, lamps} = stairway
  return <StaticBatch name={`oculus-stairway-${id}`}>
    {/* StaticBatch hides the originals before automatic colliders would see them, so everything states its colliders. */}
    <RigidBody colliders={false} type='fixed'>
      {treads.map(({position, size, yaw}, i) => <group key={i} position={position} rotation={[0, yaw ?? 0, 0]}>
        <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} />
        <Box material={material} name='display-stair-block' size={size} />
      </group>)}
      {slabs.filter(slab => slab.kind === 'box').map((slab, i) => <group key={`box-${i}`} position={slab.position} rotation={slab.rotation}>
        <CuboidCollider args={[slab.size[0] / 2, slab.size[1] / 2, slab.size[2] / 2]} />
        <Box material={material} name={slab.name} size={slab.size} />
      </group>)}
      {slabs.filter(slab => slab.kind === 'polygon').map((slab, i) => <PolygonSlab key={`poly-${i}`} bottom={slab.bottom} material={material} name={slab.name} polygon={slab.polygon} top={slab.top} />)}
      {roofs.map(({position, rotation, size}, i) => <group key={i} position={position} rotation={rotation}>
        <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} />
        <Box material={material} name='display-stairway-roof' size={size} />
      </group>)}
    </RigidBody>
    {treads.filter(block => block.tread).map(({axis, position, size, top, direction, yaw}, i) => {
      // a strip along the tread’s edge at the riser up
      const along = axis === undefined ? 0 : (axis === 0 ? 0 : 2)
      const localStrip: Vec3 = [0, top - position[1] + 0.004, 0]
      localStrip[along] = -direction * (size[along] / 2 - 0.035)
      const stripSize: Vec3 = [0.025, 0.008, 0.025]
      stripSize[2 - along] = size[2 - along] - 0.45
      return <group key={i} position={position} rotation={[0, yaw ?? 0, 0]}>
        <mesh position={localStrip}>
          <boxGeometry args={stripSize} />
          <meshBasicNodeMaterial color='#62958e' toneMapped={false} />
        </mesh>
      </group>
    })}
    {lamps.map((position, i) => <group key={i} position={position}>
      <Box color='#242f32' position={[0, -0.04, 0]} size={[0.5, 0.1, 0.5]} />
      <mesh position={[0, -0.091, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.16, 24]} /><meshBasicNodeMaterial color={stairwayTint} toneMapped={false} />
      </mesh>
    </group>)}
  </StaticBatch>
}

function PolygonSlab({bottom, material, name, polygon, top}: {
  bottom: number
  material: Material
  name: string
  polygon: FloorPolygon
  top: number
}) {
  const geometry = useDisposable(useMemo(() => new PolygonalSlabGeometry(polygon, bottom, top), [bottom, polygon, top]))
  const collider = useMemo(() => colliderGeometry(geometry), [geometry])
  return <>
    <mesh castShadow geometry={geometry} material={material} name={name} receiveShadow />
    <MeshSurfaceCollider args={collider} />
  </>
}

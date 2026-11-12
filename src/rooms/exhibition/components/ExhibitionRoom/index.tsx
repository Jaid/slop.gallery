import type {Material} from 'three/webgpu'

import {ConvexHullCollider, RigidBody} from '@react-three/rapier'

import FloorSlab from '#component/FloorSlab'
import SlopedBox from '#component/SlopedBox'
import TunnelDisplays from '#component/TunnelDisplays'
import {tunnelFrame, tunnelSlabs} from '#src/lib/gallery/exhibitionTunnel.ts'
import {slabHulls} from '#src/lib/gallery/floorPolygons.ts'
import ExhibitionPedestals from '#src/rooms/exhibition/components/ExhibitionPedestals/index.tsx'

/** The tunnel’s floor and ceiling, level at both ends and sloping along the diagonal between its elbows, with the displays on either side, their pedestals and their stairways. */
export default function ExhibitionRoom({material}: {material: Material}) {
  const [originX, originZ] = tunnelFrame.origin
  return <group name='exhibition-room'>
    <TunnelDisplays material={material} />
    <ExhibitionPedestals material={material} />
    <RigidBody colliders={false} type='fixed'>
      {tunnelSlabs.level.map(({name, polygon, bottom, top}, i) => <group key={i}>
        {slabHulls(polygon, bottom, top).map((corners, j) => <ConvexHullCollider key={j} args={[corners]} />)}
        <FloorSlab bottom={bottom} depth={top - bottom} material={material} name={name} polygon={polygon} />
      </group>)}
    </RigidBody>
    <RigidBody colliders={false} position={[originX, 0, originZ]} rotation={[0, tunnelFrame.yaw, 0]} type='fixed'>
      {tunnelSlabs.sloped.map(({name, position, size}) => <SlopedBox key={name} material={material} name={name} position={position} size={size} slope={tunnelSlabs.slope} />)}
    </RigidBody>
  </group>
}

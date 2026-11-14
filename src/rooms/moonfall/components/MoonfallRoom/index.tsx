import {CuboidCollider, RigidBody} from '@react-three/rapier'

import MoonfallCrater from '#component/MoonfallCrater'
import MoonfallOrbit from '#component/MoonfallOrbit'
import Box from '#src/components/Scene/primitives.tsx'
import moonfallWallLeds, {wallLedHousing} from '#src/lib/gallery/moonfall/fixtures.ts'
import slopGallery from '#src/worlds/gallery/index.ts'

const room = slopGallery.room('moonfall')

/** Moonfall’s crater, ceiling, wall lights and orbit. */
export default function MoonfallRoom() {
  const [width, depth] = room.size
  return <group name='moonfall-room' position={[room.center[0], room.floorY, room.center[1]]}>
    <MoonfallCrater />
    <RigidBody colliders={false} type='fixed'>
      <CuboidCollider args={[width / 2, 0.15, depth / 2]} position={[0, 5.9, 0]} />
      <Box color='#0b141d' envMapIntensity={0} name='moonfall-ceiling' position={[0, 5.78, 0]} size={[width, 0.18, depth]} />
    </RigidBody>
    {[-10, -6, -2, 2, 6, 10].map(x => <Box key={x} color='#16252d' envMapIntensity={0} position={[x, 5.5, 0]} size={[0.16, 0.4, depth]} />)}
    {[-1, 1].map(side => <group key={side}>
      <mesh position={[side * (width / 2 - 0.35), 0.012, 0]}><boxGeometry args={[0.025, 0.012, depth - 0.7]} /><meshBasicNodeMaterial color='#538e8a' toneMapped={false} /></mesh>
      <mesh position={[0, 0.012, side * (depth / 2 - 0.35)]}><boxGeometry args={[width - 0.7, 0.012, 0.025]} /><meshBasicNodeMaterial color='#538e8a' toneMapped={false} /></mesh>
    </group>)}
    {moonfallWallLeds.map(({id, position, rotation}) => <group key={id} name='moonfall-wall-led' position={position} rotation={[0, rotation, 0]}>
      <Box color='#101e25' envMapIntensity={0} position={[0, 0, 0]} size={[wallLedHousing.width, wallLedHousing.height, wallLedHousing.depth]} />
      <mesh position={[0, 0, 0.085]}><boxGeometry args={[0.065, 2.45, 0.025]} /><meshBasicNodeMaterial color='#83c5bd' toneMapped={false} /></mesh>
    </group>)}
    <MoonfallOrbit />
  </group>
}

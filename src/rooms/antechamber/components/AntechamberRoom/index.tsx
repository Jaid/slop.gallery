import {CuboidCollider, RigidBody} from '@react-three/rapier'

import AntechamberDome from '#component/AntechamberDome'
import RoomFloor from '#component/RoomFloor'
import slopGallery from '#src/worlds/gallery/index.ts'

import Annexes from './Annexes.tsx'

const room = slopGallery.room('antechamber')
const [width, depth] = room.size

/** Opens up into a windowed dome instead of a flat ceiling, so the sun reaches inside. */
export default function AntechamberRoom({glass, stone, wood}: Omit<Parameters<typeof RoomFloor>[0], 'room'>) {
  return <>
    <group name='antechamber-room' position={[room.center[0], 0, room.center[1]]}>
      <RigidBody colliders={false} type='fixed'>
        <CuboidCollider args={[width / 2, 0.15, depth / 2]} position={[0, room.height + 0.1, 0]} />
      </RigidBody>
      <AntechamberDome height={room.height} size={room.size} />
      <RoomFloor glass={glass} room={room} stone={stone} wood={wood} />
    </group>
    <Annexes stone={stone} />
  </>
}

import {CuboidCollider, RigidBody} from '@react-three/rapier'

import AntechamberDome from '#component/AntechamberDome'
import RoomFloor from '#component/RoomFloor'
import Box from '#src/components/Scene/primitives.tsx'
import {antechamberEastWing, antechamberHall, antechamberWestWing, antechamberWing, moonfallLandingSouth, moonfallPassage} from '#src/lib/gallery/antechamber.ts'
import {galleryStairs} from '#src/lib/gallery/staircase.ts'
import slopGallery from '#src/worlds/gallery/index.ts'

const room = slopGallery.room('antechamber')
const [width, depth] = antechamberHall.size
const [wingWidth, wingDepth] = antechamberWing.size
const ceilingY = antechamberWing.height - 0.09
const passageCenter = moonfallPassage.west + moonfallPassage.width / 2
const passageLength = moonfallLandingSouth - moonfallPassage.north

/** The hall opens into a windowed dome. The wings, the passage and the gallery landing have flat ceilings. */
export default function AntechamberRoom({glass, stone, wood}: Omit<Parameters<typeof RoomFloor>[0], 'room'>) {
  return <group name='antechamber-room' position={[room.center[0], 0, room.center[1]]}>
    <RigidBody colliders={false} type='fixed'>
      <CuboidCollider args={[width / 2, 0.15, depth / 2]} position={[0, room.height + 0.1, 0]} />
      {[{
        center: antechamberWestWing.center,
        size: [wingWidth, wingDepth],
      }, {
        center: antechamberEastWing.center,
        size: [wingWidth, wingDepth],
      }].map(({center: [x, z], size: [slabWidth, slabDepth]}) => <group key={`${x}`}>
        <CuboidCollider args={[slabWidth / 2, 0.09, slabDepth / 2]} position={[x, ceilingY, z - room.center[1]]} />
        <Box color='#e1dccc' name='antechamber-wing-ceiling' position={[x, ceilingY, z - room.center[1]]} roughness={0.7} size={[slabWidth, 0.18, slabDepth]} />
      </group>)}
      <CuboidCollider args={[moonfallPassage.width / 2, 0.09, passageLength / 2]} position={[passageCenter, ceilingY, (moonfallPassage.north + moonfallLandingSouth) / 2 - room.center[1]]} />
      <Box color='#e1dccc' name='antechamber-passage-ceiling' position={[passageCenter, ceilingY, (moonfallPassage.north + moonfallLandingSouth) / 2 - room.center[1]]} roughness={0.7} size={[moonfallPassage.width, 0.18, passageLength]} />
      <CuboidCollider args={[galleryStairs.width / 2, 0.09, galleryStairs.entryLanding / 2]} position={[galleryStairs.start[0] - galleryStairs.entryLanding / 2, galleryStairs.start[1] + ceilingY, galleryStairs.start[2] - room.center[1]]} />
      <Box color='#e1dccc' name='antechamber-gallery-ceiling' position={[galleryStairs.start[0] - galleryStairs.entryLanding / 2, galleryStairs.start[1] + ceilingY, galleryStairs.start[2] - room.center[1]]} roughness={0.7} size={[galleryStairs.entryLanding, 0.18, galleryStairs.width]} />
    </RigidBody>
    <AntechamberDome height={room.height} size={room.size} />
    <RoomFloor glass={glass} room={room} stone={stone} wood={wood} />
  </group>
}

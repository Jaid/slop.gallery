import {CuboidCollider, RigidBody} from '@react-three/rapier'

import MoonfallCrater from '#component/MoonfallCrater'
import MoonfallOrbit from '#component/MoonfallOrbit'
import Box from '#src/components/Scene/primitives.tsx'
import {subtractFloorOpening} from '#src/lib/gallery/floors.ts'
import {ceilingSlab} from '#src/lib/gallery/moonfall/config.ts'
import moonfallWallLeds, {wallLedHousing} from '#src/lib/gallery/moonfall/fixtures.ts'
import {moonfallTheme} from '#src/lib/gallery/moonfall/palette.ts'
import {moonfallStairwell} from '#src/lib/gallery/staircase.ts'
import slopGallery from '#src/worlds/gallery/index.ts'

import CeilingMirror from './CeilingMirror.tsx'

const room = slopGallery.room('moonfall')
/** the ceiling with the stairwell cut out, in room-local coordinates */
const ceilingSlabs = (width: number, depth: number) => subtractFloorOpening({
  center: [0, 0],
  size: [width, depth],
}, {
  center: [(moonfallStairwell.x + moonfallStairwell.x2) / 2 - room.center[0], (moonfallStairwell.z + moonfallStairwell.z2) / 2 - room.center[1]],
  size: [moonfallStairwell.x2 - moonfallStairwell.x, moonfallStairwell.z2 - moonfallStairwell.z],
})
const well = {
  x: (moonfallStairwell.x + moonfallStairwell.x2) / 2 - room.center[0],
  z: (moonfallStairwell.z + moonfallStairwell.z2) / 2 - room.center[1],
  width: moonfallStairwell.x2 - moonfallStairwell.x,
  depth: moonfallStairwell.z2 - moonfallStairwell.z,
}

/** Moonfall’s crater, ceiling, wall lights and orbit. */
export default function MoonfallRoom() {
  const [width, depth] = room.size
  return <group name='moonfall-room' position={[room.center[0], room.floorY, room.center[1]]}>
    <MoonfallCrater />
    <RigidBody colliders={false} type='fixed'>
      {ceilingSlabs(width, depth).map(({center: [x, z], size: [slabWidth, slabDepth]}, i) => <group key={i}>
        <CuboidCollider args={[slabWidth / 2, ceilingSlab.thickness / 2, slabDepth / 2]} position={[x, ceilingSlab.center, z]} />
        <Box color={moonfallTheme.ceiling} envMapIntensity={0} name='moonfall-ceiling' position={[x, ceilingSlab.center, z]} size={[slabWidth, ceilingSlab.thickness, slabDepth]} />
      </group>)}
    </RigidBody>
    <CeilingMirror size={room.size} slabs={ceilingSlabs(width, depth)} />
    {[-10, -6, -2, 2, 6, 10].flatMap(x => {
      const crosses = Math.abs(x - well.x) < well.width / 2
      const segments = crosses ? [
        {
          z: (-depth / 2 + (well.z - well.depth / 2)) / 2,
          depth: well.z - well.depth / 2 + depth / 2,
        },
        {
          z: (well.z + well.depth / 2 + depth / 2) / 2,
          depth: depth / 2 - (well.z + well.depth / 2),
        },
      ] : [{
        z: 0,
        depth,
      }]
      return segments.filter(segment => segment.depth > 0.05).map(segment => <Box key={`${x}-${segment.z}`} color={moonfallTheme.beam} envMapIntensity={0} position={[x, 7.25, segment.z]} size={[0.16, 0.4, segment.depth]} />)
    })}
    {[-1, 1].map(side => <group key={side}>
      <mesh position={[side * (width / 2 - 0.35), 0.012, 0]}><boxGeometry args={[0.025, 0.012, depth - 0.7]} /><meshBasicNodeMaterial color={moonfallTheme.floorLine} toneMapped={false} /></mesh>
      <mesh position={[0, 0.012, side * (depth / 2 - 0.35)]}><boxGeometry args={[width - 0.7, 0.012, 0.025]} /><meshBasicNodeMaterial color={moonfallTheme.floorLine} toneMapped={false} /></mesh>
    </group>)}
    {moonfallWallLeds.map(({id, position, rotation}) => <group key={id} name='moonfall-wall-led' position={position} rotation={[0, rotation, 0]}>
      <Box color={moonfallTheme.ledHousing} envMapIntensity={0} position={[0, 0, 0]} size={[wallLedHousing.width, wallLedHousing.height, wallLedHousing.depth]} />
      <mesh position={[0, 0, 0.085]}><boxGeometry args={[0.065, 2.45, 0.025]} /><meshBasicNodeMaterial color={moonfallTheme.ledStrip} toneMapped={false} /></mesh>
    </group>)}
    <MoonfallOrbit />
  </group>
}

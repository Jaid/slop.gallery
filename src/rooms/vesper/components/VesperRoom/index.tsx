import ColumnPedestal, {useColumnPedestal} from '#component/ColumnPedestal'
import Orb from '#component/Orb'
import OrbHolder, {useOrbHolder} from '#component/OrbHolder'
import RoomFloor from '#component/RoomFloor'
import {columnPedestalHeight} from '#src/lib/gallery/ColumnPedestalGeometry.ts'
import {orbSeat} from '#src/lib/gallery/OrbHolderGeometry.ts'
import {vesperOrbPedestals} from '#src/lib/gallery/vesper.ts'
import {vesperOrbs} from '#src/lib/gallery/vesperOrbs.ts'
import {environmentSeed} from '#src/lib/gameSeed.ts'
import VesperCeiling from '#src/rooms/vesper/components/VesperCeiling/index.tsx'
import slopGallery from '#src/worlds/gallery/index.ts'

const room = slopGallery.room('vesper')
/** what stands on the orb pedestals in this game’s environment, in their order */
const exhibits = vesperOrbs(environmentSeed)

/** Opens up into a coved ceiling crowned by twin glazed lanterns instead of a flat ceiling, so the sun reaches inside, over five orbs on column pedestals in a circle in its north half. */
export default function VesperRoom({glass, stone, wood}: Omit<Parameters<typeof RoomFloor>[0], 'room'>) {
  return <group name='vesper-room'>
    <group position={[room.center[0], 0, room.center[1]]}>
      <VesperCeiling size={room.size} />
      <RoomFloor glass={glass} room={room} stone={stone} wood={wood} />
    </group>
    <OrbPedestals />
  </group>
}

/** The Cell’s fluted limestone columns, each with an orb resting in a gunmetal holder on its cap. */
function OrbPedestals() {
  const pedestal = useColumnPedestal()
  const holder = useOrbHolder()
  return <group name='vesper-orbs'>
    {exhibits.map(({id, orb}, index) => {
      const {position: [x, y, z], rotation} = vesperOrbPedestals[index]
      return <group key={id}>
        <ColumnPedestal {...pedestal} position={[x, y, z]} rotation={rotation}><OrbHolder {...holder} /></ColumnPedestal>
        {/* Let down onto the holder’s lip from just over it. */}
        <Orb id={id} orb={orb} position={[x, y + columnPedestalHeight + orbSeat + 0.002, z]} />
      </group>
    })}
  </group>
}

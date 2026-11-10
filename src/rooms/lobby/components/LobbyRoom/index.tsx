import type {NodeMaterial} from 'three/webgpu'

import FountainBenches from '#component/FountainBenches'
import LobbyFloor from '#component/LobbyFloor'
import LobbyVault from '#component/LobbyVault'
import LobbyFountain from '#src/rooms/lobby/components/LobbyFountain/index.tsx'
import slopGallery from '#src/worlds/gallery/index.ts'

const room = slopGallery.room('lobby')

/** The Lobby has no flat ceiling: its coffered vault rises above the walls, lit by its chandeliers and the sun. */
export default function LobbyRoom({cladding, glass, stone, wood}: Omit<Parameters<typeof LobbyFloor>[0], 'room'> & {
  /** the travertine slabs of the walls, which the vault continues */
  cladding: NodeMaterial
}) {
  return <>
    <group name='lobby-room' position={[room.center[0], 0, room.center[1]]}>
      <LobbyFloor glass={glass} room={room} stone={stone} wood={wood} />
      <LobbyVault cladding={cladding} />
    </group>
    <LobbyFountain />
    <FountainBenches />
  </>
}

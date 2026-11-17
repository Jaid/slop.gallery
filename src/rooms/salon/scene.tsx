import type GalleryMaterials from '#src/worlds/gallery/GalleryMaterials.ts'

import Architecture from '#component/Architecture'
import LobbyWindow from '#component/LobbyWindow'
import {cutArchitectures, provideArchitecture} from '#src/lib/gallery/architecture.ts'
import {salonWindow} from '#src/lib/gallery/lobbyWindows.ts'
import walls from '#src/worlds/gallery/walls.ts'

import Room from './components/SalonRoom/index.tsx'

const roomWalls = walls.filter(wall => wall.room === 'salon')
// A separate cut recipe per room: only this room’s geometry is created when its scene loads, whether baked or evaluated at runtime.
provideArchitecture(cutArchitectures(roomWalls))

export default function SalonScene({materials}: {materials: GalleryMaterials}) {
  return <>
    <Architecture materials={materials} walls={roomWalls} />
    <Room glass={materials.glass('lobby')} stone={materials.stone} wood={materials.wood} />
    <LobbyWindow glass={materials.glass('lobbyWindow')} glazing={salonWindow} name='salon-window' />
  </>
}

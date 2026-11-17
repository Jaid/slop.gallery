import type GalleryMaterials from '#src/worlds/gallery/GalleryMaterials.ts'

import Architecture from '#component/Architecture'
import WallDecorations from '#component/WallDecorations'
import {cutArchitectures, provideArchitecture} from '#src/lib/gallery/architecture.ts'
import walls from '#src/worlds/gallery/walls.ts'

import Room from './components/LobbyRoom/index.tsx'

const roomWalls = walls.filter(wall => wall.room === 'lobby')
// A separate cut recipe per room: only this room’s geometry is created when its scene loads, whether baked or evaluated at runtime.
provideArchitecture(cutArchitectures(roomWalls))

export default function LobbyScene({materials}: {materials: GalleryMaterials}) {
  return <>
    <Architecture decorations={WallDecorations} materials={materials} walls={roomWalls} />
    <Room cladding={materials.lobbyWall} glass={materials.glass('lobby')} stone={materials.stone} wood={materials.wood} />
  </>
}

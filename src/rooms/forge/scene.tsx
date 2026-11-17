import type GalleryMaterials from '#src/worlds/gallery/GalleryMaterials.ts'

import Architecture from '#component/Architecture'
import Curio from '#component/Curio'
import LobbyWindow from '#component/LobbyWindow'
import {cutArchitectures, provideArchitecture} from '#src/lib/gallery/architecture.ts'
import PaintingSet from '#src/lib/gallery/curios/paintingSet/PaintingSet.ts'
import PaletteKnife from '#src/lib/gallery/curios/paletteKnife/PaletteKnife.ts'
import {forgeWindow} from '#src/lib/gallery/lobbyWindows.ts'
import walls from '#src/worlds/gallery/walls.ts'

import Room from './components/ForgeRoom/index.tsx'

const paintingSet = new PaintingSet
const paletteKnife = new PaletteKnife
const roomWalls = walls.filter(wall => wall.room === 'forge')
// A separate cut recipe per room: only this room’s geometry is created when its scene loads, whether baked or evaluated at runtime.
provideArchitecture(cutArchitectures(roomWalls))

export default function ForgeScene({materials}: {materials: GalleryMaterials}) {
  return <>
    <Architecture materials={materials} walls={roomWalls} />
    <Room glass={materials.glass('lobby')} masonry={materials.castleStone} stone={materials.stone} wood={materials.wood} />
    <LobbyWindow glass={materials.glass('lobbyWindow')} glazing={forgeWindow} name='forge-window' />
    <Curio curio={paintingSet} />
    <Curio curio={paletteKnife} />
  </>
}

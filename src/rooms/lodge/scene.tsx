import type GalleryMaterials from '#src/worlds/gallery/GalleryMaterials.ts'

import Architecture from '#component/Architecture'
import Curio from '#component/Curio'
import LodgeWindow from '#component/LodgeWindow'
import {cutArchitectures, provideArchitecture} from '#src/lib/gallery/architecture.ts'
import Hatchet from '#src/lib/gallery/curios/hatchet/Hatchet.ts'
import walls from '#src/worlds/gallery/walls.ts'

import Room from './components/LodgeRoom/index.tsx'
import LodgeThreshold from './components/LodgeThreshold/index.tsx'

const hatchet = new Hatchet
const roomWalls = walls.filter(wall => wall.room === 'lodge')
// A separate cut recipe per room: only this room’s geometry is created when its scene loads, whether baked or evaluated at runtime.
provideArchitecture(cutArchitectures(roomWalls))

export default function LodgeScene({materials}: {materials: GalleryMaterials}) {
  return <>
    <Architecture materials={materials} walls={roomWalls} />
    <Room materials={materials.lodge} />
    <LodgeWindow glass={materials.glass('cabin')} masonry={materials.castleStone} material={materials.windowReveal} />
    <LodgeThreshold wood={materials.wood} />
    <Curio curio={hatchet} />
  </>
}

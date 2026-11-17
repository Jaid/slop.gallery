import type GalleryMaterials from '#src/worlds/gallery/GalleryMaterials.ts'

import Architecture from '#component/Architecture'
import Curio from '#component/Curio'
import {cutArchitectures, provideArchitecture} from '#src/lib/gallery/architecture.ts'
import Pumpkin from '#src/lib/gallery/curios/pumpkin/Pumpkin.ts'
import walls from '#src/worlds/gallery/walls.ts'

import Room from './components/BanquetRoom/index.tsx'

const pumpkin = new Pumpkin
const roomWalls = walls.filter(wall => wall.room === 'banquet')
// A separate cut recipe per room: only this room’s geometry is created when its scene loads, whether baked or evaluated at runtime.
provideArchitecture(cutArchitectures(roomWalls))

export default function BanquetScene({materials}: {materials: GalleryMaterials}) {
  return <>
    <Architecture materials={materials} walls={roomWalls} />
    <Room glass={materials.glass('lobby')} stone={materials.stone} wood={materials.wood} />
    <Curio curio={pumpkin} />
  </>
}

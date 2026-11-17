import type GalleryMaterials from '#src/worlds/gallery/GalleryMaterials.ts'

import Architecture from '#component/Architecture'
import Curio from '#component/Curio'
import {cutArchitectures, provideArchitecture} from '#src/lib/gallery/architecture.ts'
import Helmet from '#src/lib/gallery/curios/helmet/Helmet.ts'
import walls from '#src/worlds/gallery/walls.ts'

import Room from './components/BastionRoom/index.tsx'

const helmet = new Helmet
const roomWalls = walls.filter(wall => wall.room === 'bastion')
// A separate cut recipe per room: only this room’s geometry is created when its scene loads, whether baked or evaluated at runtime.
provideArchitecture(cutArchitectures(roomWalls))

export default function BastionScene({materials}: {materials: GalleryMaterials}) {
  return <>
    <Architecture materials={materials} walls={roomWalls} />
    <Room material={materials.castleStone} wood={materials.wood} />
    <Curio curio={helmet} />
  </>
}

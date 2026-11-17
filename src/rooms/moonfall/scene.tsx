import type GalleryMaterials from '#src/worlds/gallery/GalleryMaterials.ts'

import Architecture from '#component/Architecture'
import GalleryStairs from '#component/GalleryStairs'
import {cutArchitectures, provideArchitecture} from '#src/lib/gallery/architecture.ts'
import walls from '#src/worlds/gallery/walls.ts'

import Room from './components/MoonfallRoom/index.tsx'

const roomWalls = walls.filter(wall => wall.room === 'moonfall')
// A separate cut recipe per room: only this room’s geometry is created when its scene loads, whether baked or evaluated at runtime.
provideArchitecture(cutArchitectures(roomWalls))

export default function MoonfallScene({materials}: {materials: GalleryMaterials}) {
  return <>
    <Architecture materials={materials} walls={roomWalls} />
    <Room />
    <GalleryStairs />
  </>
}

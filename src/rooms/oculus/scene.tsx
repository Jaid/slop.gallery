import type GalleryMaterials from '#src/worlds/gallery/GalleryMaterials.ts'

import Architecture from '#component/Architecture'
import {cutArchitectures, provideArchitecture} from '#src/lib/gallery/architecture.ts'
import walls from '#src/worlds/gallery/walls.ts'

import Room from './components/OculusRoom/index.tsx'

const roomWalls = walls.filter(wall => wall.room === 'oculus')
// A separate cut recipe per room: only this room’s geometry is created when its scene loads, whether baked or evaluated at runtime.
provideArchitecture(cutArchitectures(roomWalls))

export default function OculusScene({materials}: {materials: GalleryMaterials}) {
  return <>
    <Architecture materials={materials} walls={roomWalls} />
    <Room material={materials.oculus} stone={materials.castleStone} />
  </>
}

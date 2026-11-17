import type GalleryMaterials from '#src/worlds/gallery/GalleryMaterials.ts'
import type {GalleryRoomId} from '#src/worlds/gallery/index.ts'

import WallDecorations from '#component/WallDecorations'
import WallSurface from '#src/components/Scene/WallSurface.tsx'
import walls from '#src/worlds/gallery/walls.ts'

/** A room’s walls mount with its own models, cutting geometry on demand through the shared architecture cache. */
export default function GalleryWalls({room, materials}: {
  materials: GalleryMaterials
  room: GalleryRoomId
}) {
  return walls.filter(wall => wall.room === room).map(wall => <WallSurface key={wall.id} decorations={WallDecorations} glass={wall.holes?.some(hole => hole.glassThickness) ? materials.glass.tunnel : undefined} material={materials.wallMaterial(wall)} plaster={materials.plaster} surfaceMaterial={materials.surfaceMaterial(wall)} wall={wall} />)
}

import type {WallDecorationsProps} from '#src/components/Scene/WallSurface.tsx'
import type {Wall} from '#src/lib/placement/wallGeometry.ts'
import type GalleryMaterials from '#src/worlds/gallery/GalleryMaterials.ts'
import type {ComponentType} from 'react'

import WallSurface from '#src/components/Scene/WallSurface.tsx'

/** Only the walls of one admitted room. Its lazy scene module supplies its wall cuts before this renders. */
export default function Architecture({walls, materials, decorations}: {
  decorations?: ComponentType<WallDecorationsProps>
  materials: GalleryMaterials
  walls: ReadonlyArray<Wall>
}) {
  return walls.map(wall => <WallSurface key={wall.id} decorations={decorations} glass={wall.holes?.some(hole => hole.glassThickness) ? materials.glass('tunnel') : undefined} material={materials.wallMaterial(wall)} plaster={materials.plaster} surfaceMaterial={materials.surfaceMaterial(wall)} wall={wall} />)
}

import type {FloorRoom} from '#src/lib/gallery/floors.ts'
import type {Material, Texture} from 'three/webgpu'

import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'

import RoomFloor from '#component/RoomFloor'
import {banquetFloorOrigin, banquetFloorTile} from '#src/lib/gallery/banquet.ts'
import {CheckeredMarbleFloorMaterial} from '#src/lib/materials/marble/index.ts'
import {graphicsProfile} from '#src/lib/rendering/graphicsMode.ts'

const {mirrorReflections} = graphicsProfile

/** The Banquet’s floor: polished Calacatta and Portoro marble in a checkerboard, mirroring the room in heavy mode. */
export default function BanquetFloor(props: {
  glass: Material
  room: FloorRoom
  stone: Texture
  wood: Texture
}) {
  const slab = useDisposable(useMemo(() => new CheckeredMarbleFloorMaterial({
    loss: 0,
    grazingStrength: 0.2,
    origin: banquetFloorOrigin,
    tile: banquetFloorTile,
    reflections: mirrorReflections,
    strength: 0.4,
  }), []))
  const materials = useMemo(() => ({
    slab,
    reflection: slab.reflectionTarget ?? undefined,
  }), [slab])
  return <RoomFloor {...props} materials={materials} />
}

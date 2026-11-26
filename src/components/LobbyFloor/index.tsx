import type {FloorRoom} from '#src/lib/gallery/floors.ts'
import type {Material, Texture} from 'three/webgpu'

import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'

import RoomFloor from '#component/RoomFloor'
import {floorTile} from '#src/lib/gallery/floors.ts'
import PolishedBrassMaterial from '#src/lib/materials/PolishedBrassMaterial.ts'
import {TravertineFloorMaterial} from '#src/lib/materials/travertine/index.ts'
import {graphicsProfile} from '#src/lib/rendering/graphicsQuality.ts'

/** The Lobby’s floor: polished travertine tiles between the seams, framed by bright brass inlays; reflective in heavy mode. */
export default function LobbyFloor({room, ...props}: {
  glass: Material
  room: FloorRoom
  stone: Texture
  wood: Texture
}) {
  const {mirrorReflections} = graphicsProfile
  const slab = useDisposable(useMemo(() => new TravertineFloorMaterial({
    // The seams are laid every tile from the room’s north-west corner.
    origin: [room.center[0] - room.size[0] / 2, room.center[1] - room.size[1] / 2],
    tile: floorTile,
    reflections: mirrorReflections,
  }), [mirrorReflections, room]))
  const inlay = useDisposable(useMemo(() => new PolishedBrassMaterial, []))
  const materials = useMemo(() => ({
    slab,
    inlay,
    reflection: slab.reflectionTarget ?? undefined,
  }), [inlay, slab])
  return <RoomFloor {...props} materials={materials} room={room} />
}

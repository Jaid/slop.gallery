import type {WorldMaterials} from '#component/World'

import Branch from 'branch-component'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import useGraphicsMode, {useGraphicsModeValue} from 'use-graphics-mode'

import GalleryLighting from '#component/GalleryLighting'
import GalleryStairs from '#component/GalleryStairs'
import WallDecorations from '#component/WallDecorations'
import World from '#component/World'
import WallSurface from '#src/components/Scene/WallSurface.tsx'
import ArchitecturalGlassMaterials from '#src/lib/materials/ArchitecturalGlassMaterials.ts'
import {getGraphicsProfile} from '#src/lib/rendering/graphicsMode.ts'
import slopGallery from '#src/worlds/gallery/index.ts'
import walls from '#src/worlds/gallery/walls.ts'

import ArchitectureMaterials from './ArchitectureMaterials.ts'
import SurfaceTextures from './SurfaceTextures.ts'

const {reach} = slopGallery
/** the walls of the rooms in reach, see `World.reach`, each cut the first time it mounts; the others aren’t there, and their openings look out into the void */
const presentWalls = walls.filter(wall => reach.covers(wall.room))
/** whether Moonfall, which owns the stairway down from the Antechamber, is in reach */
const hasStairway = reach.covers('moonfall')

export default function Architecture() {
  const isHeavy = useGraphicsMode()
  const glass = useDisposable(useMemo(() => new ArchitecturalGlassMaterials(isHeavy), [isHeavy]))
  const shared = useDisposable(useMemo(() => new ArchitectureMaterials, []))
  const {surfaceAnisotropy} = useGraphicsModeValue(getGraphicsProfile)
  const textures = useDisposable(useMemo(() => new SurfaceTextures(surfaceAnisotropy), [surfaceAnisotropy]))
  // What the rooms share with the walls, made once a room in reach asks for it.
  const materials = useMemo((): WorldMaterials => ({
    get castleStone() {
      return shared.castleStone
    },
    get corridorWood() {
      return shared.corridorWood
    },
    glass,
    get joinery() {
      return shared.joinery
    },
    get lobbyWall() {
      return shared.lobbyWall
    },
    get lodge() {
      return shared.lodge
    },
    get oculus() {
      return shared.oculus
    },
    get stone() {
      return textures.stone
    },
    get windowReveal() {
      return shared.windowReveal
    },
    get wood() {
      return textures.wood
    },
  }), [glass, shared, textures])
  return <>
    <GalleryLighting />
    {presentWalls.map(wall => <WallSurface key={wall.id} decorations={WallDecorations} glass={wall.holes?.some(hole => hole.glassThickness) ? glass.tunnel : undefined} material={shared.trim(wall)} plaster={textures.plaster} surfaceMaterial={shared.surface(wall)} wall={wall} />)}
    <Branch if={hasStairway} then={GalleryStairs} />
    <World materials={materials} />
  </>
}

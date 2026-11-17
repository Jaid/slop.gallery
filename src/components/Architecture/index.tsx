import type {WorldMaterials} from '#component/World'

import Branch from 'branch-component'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import useGraphicsMode, {useGraphicsModeValue} from 'use-graphics-mode'

import GalleryLighting from '#component/GalleryLighting'
import GalleryStairs from '#component/GalleryStairs'
import WallDecorations from '#component/WallDecorations'
import World from '#component/World'
import {surfaceTexture} from '#src/components/Scene/materials.ts'
import WallSurface from '#src/components/Scene/WallSurface.tsx'
import {cutArchitectures, provideArchitecture} from '#src/lib/gallery/architecture.ts'
import {createArchitecturalGlassMaterials, disposeArchitecturalGlassMaterials} from '#src/lib/materials/ArchitecturalGlassMaterials.ts'
import {getGraphicsProfile} from '#src/lib/rendering/graphicsMode.ts'
import slopGallery from '#src/worlds/gallery/index.ts'
import walls from '#src/worlds/gallery/walls.ts'

import ArchitectureMaterials from './ArchitectureMaterials.ts'

// The gallery’s walls never change, so the build cuts their openings instead of every visit.
provideArchitecture(cutArchitectures(walls))
const {reach} = slopGallery
/** the walls of the rooms in reach, see `World.reach`; the others aren’t there, and their openings look out into the void */
const presentWalls = walls.filter(wall => reach.covers(wall.room))
/** whether Moonfall, which owns the stairway down from the Antechamber, is in reach */
const hasStairway = reach.covers('moonfall')

export default function Architecture() {
  const isHeavy = useGraphicsMode()
  const glass = useDisposable(useMemo(() => {
    const materials = createArchitecturalGlassMaterials(isHeavy)
    return {
      ...materials,
      dispose: () => disposeArchitecturalGlassMaterials(materials),
    }
  }, [isHeavy]))
  const shared = useDisposable(useMemo(() => new ArchitectureMaterials, []))
  const {surfaceAnisotropy} = useGraphicsModeValue(getGraphicsProfile)
  const stone = useDisposable(useMemo(() => surfaceTexture('stone', surfaceAnisotropy), [surfaceAnisotropy]))
  const plaster = useDisposable(useMemo(() => surfaceTexture('plaster', surfaceAnisotropy), [surfaceAnisotropy]))
  const wood = useDisposable(useMemo(() => surfaceTexture('wood', surfaceAnisotropy), [surfaceAnisotropy]))
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
    stone,
    get windowReveal() {
      return shared.windowReveal
    },
    wood,
  }), [glass, shared, stone, wood])
  return <>
    <GalleryLighting />
    {presentWalls.map(wall => <WallSurface key={wall.id} decorations={WallDecorations} glass={glass.tunnel} material={shared.trim(wall)} plaster={plaster} surfaceMaterial={shared.surface(wall)} wall={wall} />)}
    <Branch if={hasStairway} then={GalleryStairs} />
    <World materials={materials} />
  </>
}

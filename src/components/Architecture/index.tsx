import type {Wall} from '#src/lib/gallery.ts'

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
import {siennaWainscotFields} from '#src/lib/gallery/siennaWainscot.ts'
import ArchitecturalConcreteMaterial from '#src/lib/materials/ArchitecturalConcreteMaterial.ts'
import {createArchitecturalGlassMaterials, disposeArchitecturalGlassMaterials} from '#src/lib/materials/ArchitecturalGlassMaterials.ts'
import BanquetMaterials from '#src/lib/materials/BanquetMaterials.ts'
import CastleStoneMaterial from '#src/lib/materials/CastleStoneMaterial.ts'
import DamaskWallpaperMaterial from '#src/lib/materials/DamaskWallpaperMaterial.ts'
import FrescoMaterials from '#src/lib/materials/FrescoMaterials.ts'
import JoineryWoodMaterial from '#src/lib/materials/JoineryWoodMaterial.ts'
import {lightIndoors} from '#src/lib/materials/lights/index.ts'
import LodgeMaterials from '#src/lib/materials/LodgeMaterials.ts'
import LodgeWoodMaterial from '#src/lib/materials/LodgeWoodMaterial.ts'
import MarmorinoMaterial from '#src/lib/materials/MarmorinoMaterial.ts'
import {TravertineWallMaterial} from '#src/lib/materials/travertine/index.ts'
import VesperWallMaterial from '#src/lib/materials/VesperWallMaterial.ts'
import {getGraphicsProfile} from '#src/lib/rendering/graphicsMode.ts'
import slopGallery from '#src/worlds/gallery/index.ts'
import walls from '#src/worlds/gallery/walls.ts'

// The gallery’s walls never change, so the build cuts their openings instead of every visit.
provideArchitecture(cutArchitectures(walls))
const vesper = slopGallery.room('vesper')
// Five courses of 1.1 m reach the cornice; slabs are twice as long as they are high.
const lobbyCladding = {
  course: 1.1,
  length: 2.2,
}

export default function Architecture() {
  const isHeavy = useGraphicsMode()
  const glass = useDisposable(useMemo(() => {
    const materials = createArchitecturalGlassMaterials(isHeavy)
    return {
      ...materials,
      dispose: () => disposeArchitecturalGlassMaterials(materials),
    }
  }, [isHeavy]))
  // The Lodge, the Bastion with its western climb and the corridor run underground, beyond the reach of the sun.
  const castleStone = useDisposable(useMemo(() => lightIndoors(new CastleStoneMaterial), []))
  // The corridor and its stairs see nothing but their own lanterns.
  const corridorWood = useDisposable(useMemo(() => lightIndoors(new LodgeWoodMaterial), []))
  const windowReveal = useDisposable(useMemo(() => lightIndoors(new LodgeWoodMaterial), []))
  const lodgeMaterials = useDisposable(useMemo(() => new LodgeMaterials, []))
  const vesperWall = useDisposable(useMemo(() => new VesperWallMaterial({
    center: vesper.center,
    size: vesper.size,
  }), []))
  // The Lobby’s walls are clad in slabs; its baseboards, cornice, pilasters and reveals are carved from the same stone without joints.
  const lobbyWall = useDisposable(useMemo(() => new TravertineWallMaterial({cladding: lobbyCladding}), []))
  const lobbyTrim = useDisposable(useMemo(() => new TravertineWallMaterial, []))
  const {surfaceAnisotropy} = useGraphicsModeValue(getGraphicsProfile)
  const stone = useDisposable(useMemo(() => surfaceTexture('stone', surfaceAnisotropy), [surfaceAnisotropy]))
  const plaster = useDisposable(useMemo(() => surfaceTexture('plaster', surfaceAnisotropy), [surfaceAnisotropy]))
  const wood = useDisposable(useMemo(() => surfaceTexture('wood', surfaceAnisotropy), [surfaceAnisotropy]))
  // The Sienna is papered in damask above dark wood: its baseboards, reveals, cornice, wainscot and joists share one varnished timber.
  const damask = useDisposable(useMemo(() => new DamaskWallpaperMaterial, []))
  // The Antechamber is plastered in burnished marmorino.
  const marmorino = useDisposable(useMemo(() => new MarmorinoMaterial, []))
  const joineryX = useDisposable(useMemo(() => new JoineryWoodMaterial({grain: 'x'}), []))
  const joineryZ = useDisposable(useMemo(() => new JoineryWoodMaterial({
    grain: 'z',
    // The joists are left in their oiled, unvarnished state.
    roughness: 0.66,
  }), []))
  const joineryPanel = useDisposable(useMemo(() => new JoineryWoodMaterial(siennaWainscotFields), []))
  const joinery = useMemo(() => ({
    panel: joineryPanel,
    x: joineryX,
    z: joineryZ,
  }), [joineryPanel, joineryX, joineryZ])
  // The Banquet’s walls are painted with gilt boiserie, laid out around each wall’s doorways.
  const banquet = useDisposable(useMemo(() => new BanquetMaterials, []))
  // The Salon’s are frescoed in Pompeian red over a black socle, their panels laid out around each wall’s openings too.
  const salon = useDisposable(useMemo(() => new FrescoMaterials('salon'), []))
  // The Oculus and the Exhibition are cast in dark concrete, board-formed walls over troweled floors.
  const oculusMaterial = useDisposable(useMemo(() => new ArchitecturalConcreteMaterial, []))
  const wallMaterial = (wall: Wall) => {
    if (wall.room === 'oculus' || wall.room === 'exhibition') {
      return oculusMaterial
    }
    if (wall.room === 'bastion') {
      return castleStone
    }
    if (wall.room === 'lodge') {
      return lodgeMaterials.timber
    }
    if (wall.room === 'corridor') {
      return corridorWood
    }
    if (wall.room === 'lobby') {
      return lobbyTrim
    }
    if (wall.room === 'sienna') {
      return joineryX
    }
    return banquet.trim(wall)
  }
  const surfaceMaterial = (wall: Wall) => {
    if (wall.room === 'lodge') {
      return lodgeMaterials.logWall
    }
    if (wall.room === 'vesper') {
      return vesperWall
    }
    if (wall.room === 'lobby') {
      return lobbyWall
    }
    if (wall.room === 'sienna') {
      return damask
    }
    if (wall.room === 'antechamber') {
      return marmorino
    }
    if (wall.room === 'salon') {
      return salon.surface(wall)
    }
    return banquet.surface(wall)
  }
  return <>
    <GalleryLighting />
    {walls.map(wall => <WallSurface key={wall.id} decorations={WallDecorations} glass={glass.tunnel} material={wallMaterial(wall)} plaster={plaster} surfaceMaterial={surfaceMaterial(wall)} wall={wall} />)}
    <GalleryStairs />
    <World castleStone={castleStone} corridorWood={corridorWood} glass={glass} joinery={joinery} lobbyWall={lobbyWall} lodge={lodgeMaterials} oculus={oculusMaterial} stone={stone} windowReveal={windowReveal} wood={wood} />
  </>
}

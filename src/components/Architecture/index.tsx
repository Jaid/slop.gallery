import type {Wall} from '#src/lib/gallery.ts'

import Branch from 'branch-component'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import useGraphicsMode, {useGraphicsModeValue} from 'use-graphics-mode'

import ApseGrilles from '#component/ApseGrilles'
import GalleryLighting from '#component/GalleryLighting'
import GalleryStairs from '#component/GalleryStairs'
import LobbyWindow from '#component/LobbyWindow'
import LodgeThreshold from '#component/LodgeThreshold'
import LodgeWindow from '#component/LodgeWindow'
import WallDecorations from '#component/WallDecorations'
import World from '#component/World'
import {surfaceTexture} from '#src/components/Scene/materials.ts'
import WallSurface from '#src/components/Scene/WallSurface.tsx'
import {cutArchitectures, provideArchitecture} from '#src/lib/gallery/architecture.ts'
import {forgeWindow, salonWindow} from '#src/lib/gallery/lobbyWindows.ts'
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
import {reachedRooms} from '#src/lib/worldReach.ts'
import slopGallery from '#src/worlds/gallery/index.ts'
import {openings} from '#src/worlds/gallery/relations.ts'
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
  const reached = reachedRooms()
  // The walls of rooms out of reach stay unbuilt, apart from a wall an opening into a reached room passes through: it seals that room, its opening looking out on the void instead of leaving a gap in it.
  const boundary = reached ? new Set(openings.filter(opening => opening.rooms.some(room => reached.has(room))).flatMap(opening => opening.holes.map(([wallId]) => wallId))) : undefined
  const shownWalls = reached ? walls.filter(wall => reached.has(wall.room) || boundary!.has(wall.id)) : walls
  return <>
    <GalleryLighting />
    {shownWalls.map(wall => <WallSurface key={wall.id} decorations={WallDecorations} glass={glass.tunnel} material={wallMaterial(wall)} plaster={plaster} surfaceMaterial={surfaceMaterial(wall)} wall={wall} />)}
    {/* What fills the openings between two rooms belongs to neither room alone, like their far-side walls above, so either side within reach keeps it: the stairway between the Antechamber and Moonfall, the apse grilles between the Oculus and the Bastion, the cast glass between the Lobby and the Salon and the Forge, and the Lodge’s windows and threshold toward the corridor and the Bastion. Their rooms own them for culling as before. */}
    <Branch if={!reached || reached.has('antechamber') || reached.has('moonfall')} then={GalleryStairs} />
    <Branch if={!reached || reached.has('bastion') || reached.has('oculus')}><group userData={{room: 'oculus'}}><ApseGrilles stone={castleStone} /></group></Branch>
    <Branch if={!reached || reached.has('lobby') || reached.has('salon')}><group userData={{room: 'salon'}}><LobbyWindow glass={glass.lobbyWindow} glazing={salonWindow} name='salon-window' /></group></Branch>
    <Branch if={!reached || reached.has('forge') || reached.has('lobby')}><group userData={{room: 'forge'}}><LobbyWindow glass={glass.lobbyWindow} glazing={forgeWindow} name='forge-window' /></group></Branch>
    <Branch if={!reached || reached.has('bastion') || reached.has('corridor') || reached.has('lodge')}><group userData={{room: 'lodge'}}><LodgeWindow glass={glass.cabin} masonry={castleStone} material={windowReveal} /></group></Branch>
    <Branch if={!reached || reached.has('corridor') || reached.has('lodge')}><group userData={{room: 'lodge'}}><LodgeThreshold wood={wood} /></group></Branch>
    <World castleStone={castleStone} corridorWood={corridorWood} glass={glass} joinery={joinery} lobbyWall={lobbyWall} lodge={lodgeMaterials} oculus={oculusMaterial} stone={stone} wood={wood} />
  </>
}

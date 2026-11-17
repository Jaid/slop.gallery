import type {Wall} from '#src/lib/gallery.ts'

import {surfaceTexture} from '#src/components/Scene/materials.ts'
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
import slopGallery from '#src/worlds/gallery/index.ts'

type Disposable = {dispose: () => void}

/** The gallery’s shared surfaces, created on first use, never for an excluded room. Each graphics configuration owns and disposes its resources together. */
export default class GalleryMaterials {
  private readonly resources = new Map<string, Disposable>

  constructor(private readonly heavy: boolean, private readonly anisotropy: number) {}

  get banquet() {
    return this.resource('banquet', () => new BanquetMaterials)
  }

  get castleStone() {
    return this.resource('castleStone', () => lightIndoors(new CastleStoneMaterial))
  }

  get corridorWood() {
    return this.resource('corridorWood', () => lightIndoors(new LodgeWoodMaterial))
  }

  get damask() {
    return this.resource('damask', () => new DamaskWallpaperMaterial)
  }

  get glass() {
    return this.resource('glass', () => {
      const materials = createArchitecturalGlassMaterials(this.heavy)
      return {
        ...materials,
        dispose: () => disposeArchitecturalGlassMaterials(materials),
      }
    })
  }

  get joinery() {
    return {
      panel: this.joineryPanel,
      x: this.joineryX,
      z: this.joineryZ,
    }
  }

  get joineryPanel() {
    return this.resource('joineryPanel', () => new JoineryWoodMaterial(siennaWainscotFields))
  }

  get joineryX() {
    return this.resource('joineryX', () => new JoineryWoodMaterial({grain: 'x'}))
  }

  get joineryZ() {
    return this.resource('joineryZ', () => new JoineryWoodMaterial({
      grain: 'z',
      roughness: 0.66,
    }))
  }

  get lobbyTrim() {
    return this.resource('lobbyTrim', () => new TravertineWallMaterial)
  }

  get lobbyWall() {
    return this.resource('lobbyWall', () => new TravertineWallMaterial({cladding: {
      course: 1.1,
      length: 2.2,
    }}))
  }

  get lodge() {
    return this.resource('lodge', () => new LodgeMaterials)
  }

  get marmorino() {
    return this.resource('marmorino', () => new MarmorinoMaterial)
  }

  get oculus() {
    return this.resource('oculus', () => new ArchitecturalConcreteMaterial)
  }

  get plaster() {
    return this.resource('plaster', () => surfaceTexture('plaster', this.anisotropy))
  }

  get salon() {
    return this.resource('salon', () => new FrescoMaterials('salon'))
  }

  get stone() {
    return this.resource('stone', () => surfaceTexture('stone', this.anisotropy))
  }

  get vesperWall() {
    return this.resource('vesperWall', () => {
      const vesper = slopGallery.room('vesper')
      return new VesperWallMaterial({
        center: vesper.center,
        size: vesper.size,
      })
    })
  }

  get windowReveal() {
    return this.resource('windowReveal', () => lightIndoors(new LodgeWoodMaterial))
  }

  get wood() {
    return this.resource('wood', () => surfaceTexture('wood', this.anisotropy))
  }

  dispose() {
    for (const resource of this.resources.values()) {
      resource.dispose()
    }
    this.resources.clear()
  }

  surfaceMaterial(wall: Wall) {
    if (wall.room === 'lodge') {
      return this.lodge.logWall
    }
    if (wall.room === 'vesper') {
      return this.vesperWall
    }
    if (wall.room === 'lobby') {
      return this.lobbyWall
    }
    if (wall.room === 'sienna') {
      return this.damask
    }
    if (wall.room === 'antechamber') {
      return this.marmorino
    }
    if (wall.room === 'salon') {
      return this.salon.surface(wall)
    }
    return wall.room === 'banquet' ? this.banquet.surface(wall) : undefined
  }

  wallMaterial(wall: Wall) {
    if (wall.room === 'oculus' || wall.room === 'exhibition') {
      return this.oculus
    }
    if (wall.room === 'bastion') {
      return this.castleStone
    }
    if (wall.room === 'lodge') {
      return this.lodge.timber
    }
    if (wall.room === 'corridor') {
      return this.corridorWood
    }
    if (wall.room === 'lobby') {
      return this.lobbyTrim
    }
    if (wall.room === 'sienna') {
      return this.joineryX
    }
    return wall.room === 'banquet' ? this.banquet.trim(wall) : undefined
  }
  private resource<T extends Disposable>(key: string, create: () => T): T {
    let value = this.resources.get(key)
    if (!value) {
      value = create()
      this.resources.set(key, value)
    }
    return value as T
  }
}

import type {Wall} from '#src/lib/gallery.ts'
import type {Material, Texture} from 'three/webgpu'

import {surfaceTexture} from '#src/components/Scene/materials.ts'
import {siennaWainscotFields} from '#src/lib/gallery/siennaWainscot.ts'
import ArchitecturalConcreteMaterial from '#src/lib/materials/ArchitecturalConcreteMaterial.ts'
import {createArchitecturalGlassMaterial} from '#src/lib/materials/ArchitecturalGlassMaterials.ts'
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

type Resource = {dispose: () => void}

/** Resources shared by the admitted rooms. Getters construct only what a mounted room actually uses, once per graphics profile, and the owner disposes them together. */
export default class GalleryMaterials {
  private readonly resources = new Map<string, Resource>

  constructor(private readonly heavy: boolean, private readonly anisotropy: number) {}

  get banquet() {
    return this.take('banquet', () => new BanquetMaterials)
  }

  get castleStone() {
    return this.take('castleStone', () => lightIndoors(new CastleStoneMaterial))
  }

  get corridorWood() {
    return this.take('corridorWood', () => lightIndoors(new LodgeWoodMaterial))
  }

  get damask() {
    return this.take('damask', () => new DamaskWallpaperMaterial)
  }

  get joinery() {
    return {
      panel: this.joineryPanel,
      x: this.joineryX,
      z: this.joineryZ,
    }
  }

  get joineryPanel() {
    return this.take('joineryPanel', () => new JoineryWoodMaterial(siennaWainscotFields))
  }

  get joineryX() {
    return this.take('joineryX', () => new JoineryWoodMaterial({grain: 'x'}))
  }

  get joineryZ() {
    return this.take('joineryZ', () => new JoineryWoodMaterial({
      grain: 'z',
      roughness: 0.66,
    }))
  }

  get lobbyTrim() {
    return this.take('lobbyTrim', () => new TravertineWallMaterial)
  }

  get lobbyWall() {
    return this.take('lobbyWall', () => new TravertineWallMaterial({cladding: {
      course: 1.1,
      length: 2.2,
    }}))
  }

  get lodge() {
    return this.take('lodge', () => new LodgeMaterials)
  }

  get marmorino() {
    return this.take('marmorino', () => new MarmorinoMaterial)
  }

  get oculus() {
    return this.take('oculus', () => new ArchitecturalConcreteMaterial)
  }

  get plaster(): Texture {
    return this.take('plaster', () => surfaceTexture('plaster', this.anisotropy))
  }

  get salon() {
    return this.take('salon', () => new FrescoMaterials('salon'))
  }

  get stone(): Texture {
    return this.take('stone', () => surfaceTexture('stone', this.anisotropy))
  }

  get vesperWall() {
    return this.take('vesperWall', () => new VesperWallMaterial({
      center: slopGallery.room('vesper').center,
      size: slopGallery.room('vesper').size,
    }))
  }

  get windowReveal() {
    return this.take('windowReveal', () => lightIndoors(new LodgeWoodMaterial))
  }

  get wood(): Texture {
    return this.take('wood', () => surfaceTexture('wood', this.anisotropy))
  }

  dispose() {
    for (const resource of this.resources.values()) {
      resource.dispose()
    }
    this.resources.clear()
  }

  glass(kind: Parameters<typeof createArchitecturalGlassMaterial>[0]) {
    const key = !this.heavy && kind !== 'tunnel' ? 'lobby' : kind
    return this.take(`glass:${key}`, () => createArchitecturalGlassMaterial(key, this.heavy))
  }

  surfaceMaterial(wall: Wall): Material | undefined {
    switch (wall.room) {
      case 'lodge': { return this.lodge.logWall }
      case 'vesper': { return this.vesperWall }
      case 'lobby': { return this.lobbyWall }
      case 'sienna': { return this.damask }
      case 'antechamber': { return this.marmorino }
      case 'salon': { return this.salon.surface(wall) }
      case 'banquet': { return this.banquet.surface(wall) }
      default: { return undefined }
    }
  }

  wallMaterial(wall: Wall): Material | undefined {
    switch (wall.room) {
      case 'oculus':
      case 'exhibition': { return this.oculus }
      case 'bastion': { return this.castleStone }
      case 'lodge': { return this.lodge.timber }
      case 'corridor': { return this.corridorWood }
      case 'lobby': { return this.lobbyTrim }
      case 'sienna': { return this.joineryX }
      case 'banquet': { return this.banquet.trim(wall) }
      default: { return undefined }
    }
  }

  private take<T extends Resource>(key: string, create: () => T): T {
    let value = this.resources.get(key)
    if (!value) {
      value = create()
      this.resources.set(key, value)
    }
    return value as T
  }
}

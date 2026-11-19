import type {Wall} from '#src/lib/gallery.ts'
import type {Material, NodeMaterial} from 'three/webgpu'

import {wallFace} from '#src/lib/gallery/architectureDimensions.ts'
import {forgeBrickwork, forgeVestibule} from '#src/lib/gallery/forge.ts'
import {siennaWainscotFields} from '#src/lib/gallery/siennaWainscot.ts'
import ArchitecturalConcreteMaterial from '#src/lib/materials/ArchitecturalConcreteMaterial.ts'
import BanquetMaterials from '#src/lib/materials/BanquetMaterials.ts'
import MadeOnDemand from '#src/lib/materials/base/MadeOnDemand.ts'
import BrickMaterial from '#src/lib/materials/BrickMaterial.ts'
import CastleStoneMaterial from '#src/lib/materials/CastleStoneMaterial.ts'
import DamaskWallpaperMaterial from '#src/lib/materials/DamaskWallpaperMaterial.ts'
import DressedSandstoneMaterial from '#src/lib/materials/DressedSandstoneMaterial.ts'
import FrescoMaterials from '#src/lib/materials/FrescoMaterials.ts'
import JoineryWoodMaterial from '#src/lib/materials/JoineryWoodMaterial.ts'
import {lightIndoors} from '#src/lib/materials/lights/index.ts'
import LodgeMaterials from '#src/lib/materials/LodgeMaterials.ts'
import LodgeWoodMaterial from '#src/lib/materials/LodgeWoodMaterial.ts'
import MarmorinoMaterial from '#src/lib/materials/MarmorinoMaterial.ts'
import {TravertineWallMaterial} from '#src/lib/materials/travertine/index.ts'
import VesperWallMaterial from '#src/lib/materials/VesperWallMaterial.ts'
import slopGallery from '#src/worlds/gallery/index.ts'

const vesper = slopGallery.room('vesper')
const forgeVestibuleWall = slopGallery.walls.find(wall => wall.id === 'forge-vestibule')!
/** The angle round its center, from world x toward world z, at which a round wall’s ends meet: across from its middle, which lies in front of its center by its radius. */
const ringSeam = ({center: [x, , z], curveRadius = 1, rotation}: Wall) => {
  const [centerX, centerZ] = [x + curveRadius * Math.sin(rotation), z + curveRadius * Math.cos(rotation)]
  return Math.atan2(centerZ - z, centerX - x)
}
// Five courses of 1.1 m reach the cornice; slabs are twice as long as they are high.
const lobbyCladding = {
  course: 1.1,
  length: 2.2,
}

/**
 * The materials of the gallery’s walls and of the rooms that share them, which need nothing but themselves: each is made the first time a wall or a room asks for it, so the rooms out of the world’s reach never make theirs. Released together.
 */
export default class ArchitectureMaterials extends MadeOnDemand {
  /** the Banquet’s gilt boiserie, laid out around each wall’s doorways, for its walls’ surfaces and trim */
  get banquet() {
    return this.once('banquet', () => new BanquetMaterials)
  }

  /** the castle stone of the Lodge, the Bastion with its western climb and the corridor, which run underground, beyond the reach of the sun */
  get castleStone(): NodeMaterial {
    return this.once('castleStone', () => lightIndoors(new CastleStoneMaterial))
  }

  /** the board lining of the corridor and its stairs, which see nothing but their own lanterns */
  get corridorWood(): NodeMaterial {
    return this.once('corridorWood', () => lightIndoors(new LodgeWoodMaterial))
  }

  /** the Sienna’s damask, above its dark wood */
  get damask(): NodeMaterial {
    return this.once('damask', () => new DamaskWallpaperMaterial)
  }

  /** the Forge’s red brick in Flemish bond over a glazed dado, its flat walls’, and its gables’ under the roof */
  get forgeBrick(): NodeMaterial {
    return this.once('forgeBrick', () => new BrickMaterial({
      ...forgeBrickwork,
      mapping: {kind: 'planar'},
    }))
  }

  /** the Forge’s buff sandstone dressings: its baseboards, the casings round its openings and its string courses */
  get forgeDressings(): NodeMaterial {
    return this.once('forgeDressings', () => new DressedSandstoneMaterial)
  }

  /** the brick of the Forge’s round vestibule, its courses following the wall round from where its ends meet */
  get forgeVestibuleBrick(): NodeMaterial {
    return this.once('forgeVestibuleBrick', () => new BrickMaterial({
      ...forgeBrickwork,
      mapping: {
        kind: 'ring',
        center: forgeVestibule.center,
        radius: forgeVestibule.radius - wallFace,
        seam: ringSeam(forgeVestibuleWall),
      },
    }))
  }

  /**
   * The Sienna’s one varnished timber of its baseboards, reveals, cornice, wainscot and joists: with its grain along each mesh’s x axis, along its z axis for the joists, left in their oiled, unvarnished state, and the darker raised fields of the wainscot.
   */
  get joinery() {
    return this.once('joinery', () => {
      const materials = {
        panel: new JoineryWoodMaterial(siennaWainscotFields),
        x: new JoineryWoodMaterial({grain: 'x'}),
        z: new JoineryWoodMaterial({
          grain: 'z',
          roughness: 0.66,
        }),
      }
      return {
        ...materials,
        dispose() {
          for (const material of Object.values(materials)) {
            material.dispose()
          }
        },
      }
    })
  }

  /** the Lobby’s baseboards, cornice, pilasters and reveals, carved from the same stone as its slabs without joints */
  get lobbyTrim(): NodeMaterial {
    return this.once('lobbyTrim', () => new TravertineWallMaterial)
  }

  /** the Lobby’s travertine slabs, which its vault continues */
  get lobbyWall(): NodeMaterial {
    return this.once('lobbyWall', () => new TravertineWallMaterial({cladding: lobbyCladding}))
  }

  get lodge() {
    return this.once('lodge', () => new LodgeMaterials)
  }

  /** the Antechamber’s burnished marmorino */
  get marmorino(): NodeMaterial {
    return this.once('marmorino', () => new MarmorinoMaterial)
  }

  /** the dark concrete the Oculus and the Exhibition are cast in, board-formed walls over troweled floors */
  get oculus(): NodeMaterial {
    return this.once('oculus', () => new ArchitecturalConcreteMaterial)
  }

  /** the Salon’s walls, frescoed in Pompeian red over a black socle, their panels laid out around each wall’s openings */
  get salon() {
    return this.once('salon', () => new FrescoMaterials('salon'))
  }

  get vesperWall(): NodeMaterial {
    return this.once('vesperWall', () => new VesperWallMaterial({
      center: vesper.center,
      size: vesper.size,
    }))
  }

  /** the reveal of the Lodge’s windows */
  get windowReveal(): NodeMaterial {
    return this.once('windowReveal', () => lightIndoors(new LodgeWoodMaterial))
  }

  /** What lines the wall’s openings instead of its face’s material, or undefined where its face’s material lines them too. */
  reveal(wall: Wall): Material | undefined {
    return wall.room === 'forge' ? this.forgeDressings : undefined
  }

  /** What the wall’s face is surfaced with, or undefined for the plain plaster of the shared wall surfaces. */
  surface(wall: Wall): Material | undefined {
    switch (wall.room) {
      case 'lodge': {
        return this.lodge.logWall
      }
      case 'vesper': {
        return this.vesperWall
      }
      case 'lobby': {
        return this.lobbyWall
      }
      case 'sienna': {
        return this.damask
      }
      case 'antechamber': {
        return this.marmorino
      }
      case 'salon': {
        return this.salon.surface(wall)
      }
      case 'banquet': {
        return this.banquet.surface(wall)
      }
      case 'forge': {
        return wall.curveRadius ? this.forgeVestibuleBrick : this.forgeBrick
      }
      default: {
        return undefined
      }
    }
  }

  /** What the wall’s trim and reveals are made of, or undefined for the plain trim of the shared wall surfaces. */
  trim(wall: Wall): Material | undefined {
    switch (wall.room) {
      case 'oculus':
      case 'exhibition': {
        return this.oculus
      }
      case 'bastion': {
        return this.castleStone
      }
      case 'lodge': {
        return this.lodge.timber
      }
      case 'corridor': {
        return this.corridorWood
      }
      case 'lobby': {
        return this.lobbyTrim
      }
      case 'sienna': {
        return this.joinery.x
      }
      case 'banquet': {
        return this.banquet.trim(wall)
      }
      case 'forge': {
        return this.forgeDressings
      }
      default: {
        return undefined
      }
    }
  }
}

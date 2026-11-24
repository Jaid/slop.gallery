import type {Wall} from '#src/lib/gallery.ts'
import type {Material, NodeMaterial} from 'three/webgpu'

import {antechamberLanding} from '#src/lib/gallery/antechamber.ts'
import {siennaWainscotFields} from '#src/lib/gallery/siennaWainscot.ts'
import ArchitecturalConcreteMaterial from '#src/lib/materials/ArchitecturalConcreteMaterial.ts'
import BanquetMaterials from '#src/lib/materials/BanquetMaterials.ts'
import MadeOnDemand from '#src/lib/materials/base/MadeOnDemand.ts'
import CastleStoneMaterial from '#src/lib/materials/CastleStoneMaterial.ts'
import ClawdsWallpaperMaterial from '#src/lib/materials/ClawdsWallpaperMaterial.ts'
import DamaskWallpaperMaterial from '#src/lib/materials/DamaskWallpaperMaterial.ts'
import ForgeMaterials from '#src/lib/materials/forge/ForgeMaterials.ts'
import FrescoMaterials from '#src/lib/materials/FrescoMaterials.ts'
import JoineryWoodMaterial from '#src/lib/materials/JoineryWoodMaterial.ts'
import {lightIndoors} from '#src/lib/materials/lights/index.ts'
import LodgeMaterials from '#src/lib/materials/LodgeMaterials.ts'
import LodgeWoodMaterial from '#src/lib/materials/LodgeWoodMaterial.ts'
import MarmorinoMaterial from '#src/lib/materials/MarmorinoMaterial.ts'
import {TravertineWallMaterial} from '#src/lib/materials/travertine/index.ts'
import VesperWallMaterial from '#src/lib/materials/VesperWallMaterial.ts'
import {upstairsHallWalls} from '#src/rooms/antechamber/walls.ts'
import slopGallery from '#src/worlds/gallery/index.ts'

const vesper = slopGallery.room('vesper')
const antechamber = slopGallery.room('antechamber')
/** the walls already papered with the upstairs hall’s Clawds, by their world-wide ids */
const clawdsWalls = new Set(upstairsHallWalls.map(id => antechamber.room.globalId(id)))
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

  /** Clawds, the upstairs hall’s daisy stickers, its rows laid out from the floor of the landing they paper until that hall is built */
  get clawds(): NodeMaterial {
    return this.once('clawds', () => new ClawdsWallpaperMaterial({floorY: antechamberLanding.floorY}))
  }

  /** the board lining of the corridor and its stairs, which see nothing but their own lanterns */
  get corridorWood(): NodeMaterial {
    return this.once('corridorWood', () => lightIndoors(new LodgeWoodMaterial))
  }

  /** the Sienna’s damask, above its dark wood */
  get damask(): NodeMaterial {
    return this.once('damask', () => new DamaskWallpaperMaterial)
  }

  get forge() {
    return this.once('forge', () => new ForgeMaterials)
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
    // The Forge’s openings are lined with the enameled iron of their casings, as its vestibule’s arch is beyond them.
    return wall.room === 'forge' ? this.forge.frame : undefined
  }

  /** What the wall’s face is surfaced with, or undefined for the plain plaster of the shared wall surfaces. */
  surface(wall: Wall): Material | undefined {
    switch (wall.room) {
      case 'lodge': {
        return this.lodge.logWall
      }
      case 'forge': {
        return wall.curveRadius ? this.forge.roundWall : this.forge.wall
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
        return clawdsWalls.has(wall.id) ? this.clawds : this.marmorino
      }
      case 'salon': {
        return this.salon.surface(wall)
      }
      case 'banquet': {
        return this.banquet.surface(wall)
      }
      default: {
        return undefined
      }
    }
  }

  /** What the wall’s trim and reveals are made of, or undefined for the plain trim of the shared wall surfaces. */
  trim(wall: Wall): Material | undefined {
    switch (wall.room) {
      case 'forge': {
        return this.forge.frame
      }
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
      case 'antechamber': {
        // Clawds stands on the Cell’s walnut baseboard, as in the Studio.
        return clawdsWalls.has(wall.id) ? this.joinery.x : undefined
      }
      case 'banquet': {
        return this.banquet.trim(wall)
      }
      default: {
        return undefined
      }
    }
  }
}

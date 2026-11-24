import type {Wall} from '#src/lib/placement/wallGeometry.ts'
import type {FloorSize} from '../base/Room.ts'
import type {Material, Object3D} from 'three/webgpu'

import {environmentRandom, isDefaultSeed} from '#src/lib/environmentSeed.ts'

/** a finish of the Studio: what it reads as, and how to load what makes it, which loads its materials only once picked */
export type StudioFinish<Make> = {
  load: () => Promise<Make>
  /** the room it comes from and what it is, in a few words */
  title: string
}
/** the walls’ finish: what each wall’s face is surfaced with, what its baseboard is made of, or the plain trim of the shared wall surfaces for none, and what the ceiling is surfaced with, the walls’ own where it lays out on a ceiling too, or undefined for the plain plaster */
export type StudioWallFinish = Releasable & {
  ceiling: Material | undefined
  surface: (wall: Wall) => Material
  trim: (wall: Wall) => Material | undefined
}
/** what a walls’ finish is made for */
export type StudioWallOptions = {
  /** the middle of the floor plan, in world meters */
  center: readonly [x: number, z: number]
  size: FloorSize
  /** every wall of the room, in world meters */
  walls: ReadonlyArray<Wall>
}
/** the floor’s finish, with its mirror if it has one */
export type StudioFloorFinish = Releasable & {
  material: Material & {reflectionTarget?: Object3D | null}
}
/** what a floor’s finish is made for */
export type StudioFloorOptions = {
  /** how sharply textures show at grazing angles, the graphics profile’s */
  anisotropy: number
  /** the middle of the floor plan, in world meters */
  center: readonly [x: number, z: number]
  /** whether the floor mirrors the room, the graphics profile’s */
  reflections: boolean
  size: FloorSize
}
/** something made for the Studio, released with whatever else it made for it */
type Releasable = {dispose: () => void}

/** The finish of whatever was made, released together. */
const releasing = <Finish extends object>(finish: Finish, ...made: ReadonlyArray<Releasable | undefined>): Finish & Releasable => ({
  ...finish,
  dispose() {
    for (const resource of new Set(made)) {
      resource?.dispose()
    }
  },
})
/** Walls all surfaced alike, over one baseboard, under a ceiling surfaced like them. */
const wall = (surface: Material, trim?: Material): StudioWallFinish => releasing({
  ceiling: surface,
  surface: () => surface,
  trim: () => trim,
}, surface, trim)
const floor = (material: StudioFloorFinish['material']): StudioFloorFinish => releasing({material}, material)
/** how far off a crater’s fractures in a slate floor start, farther than any floor reaches */
const noCrater = 1e4
/** The north-western corner of the floor plan, where the floor’s tiles start whole. */
const northWest = ({center: [x, z], size: [width, depth]}: StudioFloorOptions) => [x - width / 2, z - depth / 2] as const

/**
 * The finishes of the Studio’s walls, each as some room of the game has them, by that room’s id, or by its own name for one whose room isn’t built yet: the Cell’s first, which the default environment keeps.
 * Each resolves to what makes them for the Studio’s walls, a material of their own for each wall where a room lays its walls out around their openings, like the Salon’s fresco.
 */
export const studioWalls = {
  cell: {
    title: 'Cell damask',
    // The Cell’s damask over its walnut baseboard.
    async load() {
      const [{default: DamaskWallpaperMaterial}, {default: JoineryWoodMaterial}] = await Promise.all([import('#src/lib/materials/DamaskWallpaperMaterial.ts'), import('#src/lib/materials/JoineryWoodMaterial.ts')])
      return () => wall(new DamaskWallpaperMaterial, new JoineryWoodMaterial({grain: 'x'}))
    },
  },
  lobby: {
    title: 'Lobby travertine',
    // The Lobby’s travertine slabs over a baseboard of the same stone.
    async load() {
      const {TravertineWallMaterial} = await import('#src/lib/materials/travertine/index.ts')
      return () => wall(new TravertineWallMaterial({
        cladding: {
          course: 1.1,
          length: 2.2,
        },
      }), new TravertineWallMaterial)
    },
  },
  antechamber: {
    title: 'Antechamber marmorino',
    // The Antechamber’s burnished marmorino over the plain trim.
    async load() {
      const {default: MarmorinoMaterial} = await import('#src/lib/materials/MarmorinoMaterial.ts')
      return () => wall(new MarmorinoMaterial)
    },
  },
  oculus: {
    title: 'Oculus concrete',
    // The Oculus’ board-formed concrete, its baseboard cast with it.
    async load() {
      const {default: ArchitecturalConcreteMaterial} = await import('#src/lib/materials/ArchitecturalConcreteMaterial.ts')
      return () => {
        const concrete = new ArchitecturalConcreteMaterial
        return wall(concrete, concrete)
      }
    },
  },
  forge: {
    title: 'Forge firebrick',
    // The Forge’s firebrick over a glazed dado, its baseboard in the enamel of its casings.
    async load() {
      const {default: ForgeMaterials} = await import('#src/lib/materials/forge/ForgeMaterials.ts')
      return (): StudioWallFinish => {
        const forge = new ForgeMaterials
        return releasing({
          ceiling: forge.wall,
          surface: () => forge.wall,
          trim: () => forge.frame,
        }, forge)
      }
    },
  },
  arena: {
    title: 'Arena velvet',
    // The Arena’s crushed velvet over its black lacquered baseboard.
    async load() {
      const [{default: VelvetWallMaterial}, {createArenaTrim}] = await Promise.all([import('#src/lib/materials/VelvetWallMaterial.ts'), import('#component/ArenaShell')])
      return () => wall(new VelvetWallMaterial, createArenaTrim())
    },
  },
  clawds: {
    title: 'Clawds stickers',
    // The upstairs hall’s Clawds, smiling daisy stickers on terracotta paper, over the Cell’s walnut baseboard.
    async load() {
      const [{default: ClawdsWallpaperMaterial}, {default: JoineryWoodMaterial}] = await Promise.all([import('#src/lib/materials/ClawdsWallpaperMaterial.ts'), import('#src/lib/materials/JoineryWoodMaterial.ts')])
      return () => wall(new ClawdsWallpaperMaterial, new JoineryWoodMaterial({grain: 'x'}))
    },
  },
  salon: {
    title: 'Salon fresco',
    // The Salon’s Pompeian red fresco over its black socle, its panels laid out along each wall.
    async load() {
      const [{default: FrescoWallMaterial}, {frescoLayout}] = await Promise.all([import('#src/lib/materials/FrescoWallMaterial.ts'), import('#src/lib/gallery/fresco.ts')])
      return ({walls}: StudioWallOptions): StudioWallFinish => {
        const frescoes = new Map(walls.map(face => [face.id, new FrescoWallMaterial({
          ...frescoLayout(face),
          curveRadius: face.curveRadius,
        })]))
        // Its panels lay out along each wall, which a ceiling has none of.
        return releasing({
          ceiling: undefined,
          surface: face => frescoes.get(face.id)!,
          trim: () => {},
        }, ...frescoes.values())
      }
    },
  },
  banquet: {
    title: 'Banquet boiserie',
    // The Banquet’s gilt boiserie, its panels laid out along each wall, over its marble baseboard.
    async load() {
      const [{BoiserieTrimMaterial, BoiserieWallMaterial}, {banquetBoiserie, banquetWallPanels}] = await Promise.all([import('#src/lib/materials/boiserie/index.ts'), import('#src/lib/gallery/banquet.ts')])
      return ({walls}: StudioWallOptions): StudioWallFinish => {
        const boiseries = new Map(walls.map((face, index) => {
          const {rails, upper} = banquetWallPanels(face)
          return [face.id, {
            surface: new BoiserieWallMaterial({
              moldingDepth: banquetBoiserie.moldingDepth,
              moldingHalfWidth: banquetBoiserie.moldingHalfWidth,
              panels: upper,
              rails,
              seed: index,
            }),
            trim: new BoiserieTrimMaterial({
              baseboardCapHeight: face.baseboardCapHeight,
              baseboardHeight: face.baseboardHeight,
              holes: face.holes,
              wallHeight: face.height,
            }),
          }] as const
        }))
        // Its panels lay out along each wall, which a ceiling has none of.
        return releasing({
          ceiling: undefined,
          surface: face => boiseries.get(face.id)!.surface,
          trim: face => boiseries.get(face.id)!.trim,
        }, ...boiseries.values().flatMap(({surface, trim}) => [surface, trim]))
      }
    },
  },
  vesper: {
    title: 'Vesper fans',
    // The Vesper’s gilded fans stenciled on blue, centered on every wall, over the plain trim.
    async load() {
      const {default: VesperWallMaterial} = await import('#src/lib/materials/VesperWallMaterial.ts')
      return ({center, size}: StudioWallOptions) => wall(new VesperWallMaterial({
        center,
        size,
      }))
    },
  },
  lodge: {
    title: 'Lodge logs',
    // The Lodge’s smoked log walls over its timber.
    async load() {
      const [{default: LogWallMaterial}, {default: LodgeTimberMaterial}] = await Promise.all([import('#src/lib/materials/LogWallMaterial.ts'), import('#src/lib/materials/LodgeTimberMaterial.ts')])
      return () => wall(new LogWallMaterial({floorY: 0}), new LodgeTimberMaterial)
    },
  },
  bastion: {
    title: 'Bastion castle stone',
    // The Bastion’s castle stone, its baseboard of the same stone.
    async load() {
      const {default: CastleStoneMaterial} = await import('#src/lib/materials/CastleStoneMaterial.ts')
      return () => {
        const stone = new CastleStoneMaterial
        return wall(stone, stone)
      }
    },
  },
  corridor: {
    title: 'Corridor boards',
    // The board lining of the Corridor, its baseboard of the same boards.
    async load() {
      const {default: LodgeWoodMaterial} = await import('#src/lib/materials/LodgeWoodMaterial.ts')
      return () => {
        const boards = new LodgeWoodMaterial
        return wall(boards, boards)
      }
    },
  },
} satisfies Record<string, StudioFinish<(options: StudioWallOptions) => StudioWallFinish>>

/**
 * The finishes of the Studio’s floor, each as some room of the game has it, by that room’s id: the Cell’s first, which the default environment keeps. Each resolves to what makes them for a floor plan.
 */
export const studioFloors = {
  cell: {
    title: 'Cell varnished wood',
    async load() {
      const {default: createVarnishedWood} = await import('#src/lib/materials/varnishedWood.ts')
      return ({anisotropy, reflections}: StudioFloorOptions): StudioFloorFinish => createVarnishedWood(anisotropy, reflections)
    },
  },
  arena: {
    title: 'Arena marble checker',
    // The Arena’s checkered marble, polished like the Cell’s round room.
    async load() {
      const {CheckeredMarbleFloorMaterial, cremaMarfil, neroMarquina} = await import('#src/lib/materials/marble/index.ts')
      return (options: StudioFloorOptions) => floor(new CheckeredMarbleFloorMaterial({
        dark: neroMarquina,
        directSpecular: 0.1,
        drift: true,
        grazingStrength: 0.2,
        light: cremaMarfil,
        loss: 0,
        origin: northWest(options),
        reflections: options.reflections,
        roughness: 0,
        seed: 3,
        strength: 0.4,
        tile: 0.5,
      }))
    },
  },
  lobby: {
    title: 'Lobby travertine',
    // The Lobby’s polished travertine tiles, without its brass inlays.
    async load() {
      const [{TravertineFloorMaterial}, {floorTile}] = await Promise.all([import('#src/lib/materials/travertine/index.ts'), import('#src/lib/gallery/floors.ts')])
      return (options: StudioFloorOptions) => floor(new TravertineFloorMaterial({
        origin: northWest(options),
        tile: floorTile,
        reflections: options.reflections,
      }))
    },
  },
  sienna: {
    title: 'Sienna boards',
    // The Sienna’s varnished boards.
    async load() {
      const {default: PlankFloorMaterial} = await import('#src/lib/materials/PlankFloorMaterial.ts')
      return ({reflections}: StudioFloorOptions) => floor(new PlankFloorMaterial(undefined, reflections))
    },
  },
  salon: {
    title: 'Salon terrazzo',
    // The Salon’s Venetian terrazzo within its black border.
    async load() {
      const [{blackTerrazzo, default: TerrazzoFloorMaterial, venetianTerrazzo}, {salonTerrazzo}] = await Promise.all([import('#src/lib/materials/TerrazzoFloorMaterial.ts'), import('#src/lib/gallery/salon.ts')])
      return ({center, reflections, size}: StudioFloorOptions) => floor(new TerrazzoFloorMaterial({
        center,
        size,
        field: venetianTerrazzo,
        border: blackTerrazzo,
        inset: salonTerrazzo.border,
        reflections,
        ...salonTerrazzo.polish,
      }))
    },
  },
  oculus: {
    title: 'Oculus concrete',
    // The Exhibition’s power-troweled concrete.
    async load() {
      const {default: ArchitecturalConcreteMaterial} = await import('#src/lib/materials/ArchitecturalConcreteMaterial.ts')
      return () => floor(new ArchitecturalConcreteMaterial)
    },
  },
  banquet: {
    title: 'Banquet marble checker',
    // The Banquet’s polished Calacatta and Portoro checkerboard.
    async load() {
      const [{CheckeredMarbleFloorMaterial}, {banquetFloorTile}] = await Promise.all([import('#src/lib/materials/marble/index.ts'), import('#src/lib/gallery/banquet.ts')])
      return (options: StudioFloorOptions) => floor(new CheckeredMarbleFloorMaterial({
        grazingStrength: 0.2,
        loss: 0,
        origin: northWest(options),
        reflections: options.reflections,
        strength: 0.4,
        tile: banquetFloorTile,
      }))
    },
  },
  lodge: {
    title: 'Lodge oiled planks',
    // The Lodge’s oiled boards, their faint, blurred mirror and all.
    async load() {
      const [{default: PlankFloorMaterial}, {lodgeFloorOil, lodgeFloorPlanks}] = await Promise.all([import('#src/lib/materials/PlankFloorMaterial.ts'), import('#src/lib/gallery/lodge.ts')])
      return ({reflections}: StudioFloorOptions) => floor(new PlankFloorMaterial(lodgeFloorPlanks, reflections, lodgeFloorOil))
    },
  },
  moonfall: {
    title: 'Moonfall slate',
    // Moonfall’s honed slate in the colors of this game’s Moonfall, without its crater’s fractures.
    async load() {
      const [{default: SlateFloorMaterial}, {moonfallSlate, moonfallTheme}] = await Promise.all([import('#src/lib/materials/SlateFloorMaterial.ts'), import('#src/lib/gallery/moonfall/palette.ts')])
      return () => floor(new SlateFloorMaterial({
        craterRadius: noCrater,
        style: moonfallSlate(moonfallTheme),
      }))
    },
  },
} satisfies Record<string, StudioFinish<(options: StudioFloorOptions) => StudioFloorFinish>>

export type StudioWallId = keyof typeof studioWalls
export type StudioFloorId = keyof typeof studioFloors

/** every finish of the walls by id, the Cell’s first */
export const studioWallIds = Object.keys(studioWalls) as Array<StudioWallId>
/** every finish of the floor by id, the Cell’s first */
export const studioFloorIds = Object.keys(studioFloors) as Array<StudioFloorId>

/** The finish of the Studio’s walls in the environment of `seed`: the Cell’s in the default environment, otherwise any of them, rolled apart from the floor’s. */
export function studioWallId(seed: number): StudioWallId {
  return isDefaultSeed(seed) ? studioWallIds[0] : environmentRandom(seed).makeChild(['studio', 'walls']).rollItem(studioWallIds)
}

/** The finish of the Studio’s floor in the environment of `seed`: the Cell’s in the default environment, otherwise any of them, rolled apart from the walls’. */
export function studioFloorId(seed: number): StudioFloorId {
  return isDefaultSeed(seed) ? studioFloorIds[0] : environmentRandom(seed).makeChild(['studio', 'floor']).rollItem(studioFloorIds)
}

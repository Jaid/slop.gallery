import type {FloorSize} from '../base/Room.ts'
import type {Material, Object3D} from 'three/webgpu'

import {environmentRandom, isDefaultSeed} from '#src/lib/environmentSeed.ts'

/** the walls’ finish: what their faces are surfaced with, and what their baseboards are made of, or the plain trim of the shared wall surfaces for none */
export type StudioWallFinish = Releasable & {
  surface: Material
  trim?: Material
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
    for (const resource of made) {
      resource?.dispose()
    }
  },
})
const wall = (surface: Material, trim?: Material): StudioWallFinish => releasing({
  surface,
  trim,
}, surface, trim === surface ? undefined : trim)
const floor = (material: StudioFloorFinish['material']): StudioFloorFinish => releasing({material}, material)
/** The north-western corner of the floor plan, where the floor’s tiles start whole. */
const northWest = ({center: [x, z], size: [width, depth]}: StudioFloorOptions) => [x - width / 2, z - depth / 2] as const

/**
 * The finishes of the Studio’s walls, each as some room of the game has them, by that room’s id: the Cell’s first, which the default environment keeps. Each loads its materials only once picked, and resolves to what makes them.
 */
export const studioWalls = {
  // The Cell’s damask over its walnut baseboard.
  async cell() {
    const [{default: DamaskWallpaperMaterial}, {default: JoineryWoodMaterial}] = await Promise.all([import('#src/lib/materials/DamaskWallpaperMaterial.ts'), import('#src/lib/materials/JoineryWoodMaterial.ts')])
    return () => wall(new DamaskWallpaperMaterial, new JoineryWoodMaterial({grain: 'x'}))
  },
  // The Lobby’s travertine slabs over a baseboard of the same stone.
  async lobby() {
    const {TravertineWallMaterial} = await import('#src/lib/materials/travertine/index.ts')
    return () => wall(new TravertineWallMaterial({
      cladding: {
        course: 1.1,
        length: 2.2,
      },
    }), new TravertineWallMaterial)
  },
  // The Antechamber’s burnished marmorino over the plain trim.
  async antechamber() {
    const {default: MarmorinoMaterial} = await import('#src/lib/materials/MarmorinoMaterial.ts')
    return () => wall(new MarmorinoMaterial)
  },
  // The Oculus’ board-formed concrete, its baseboard cast with it.
  async oculus() {
    const {default: ArchitecturalConcreteMaterial} = await import('#src/lib/materials/ArchitecturalConcreteMaterial.ts')
    return () => {
      const concrete = new ArchitecturalConcreteMaterial
      return wall(concrete, concrete)
    }
  },
  // The Forge’s firebrick over a glazed dado, its baseboard in the enamel of its casings.
  async forge() {
    const {default: ForgeMaterials} = await import('#src/lib/materials/forge/ForgeMaterials.ts')
    return (): StudioWallFinish => {
      const forge = new ForgeMaterials
      return releasing({
        surface: forge.wall,
        trim: forge.frame,
      }, forge)
    }
  },
  // The Arena’s crushed velvet over its black lacquered baseboard.
  async arena() {
    const [{default: VelvetWallMaterial}, {createArenaTrim}] = await Promise.all([import('#src/lib/materials/VelvetWallMaterial.ts'), import('#component/ArenaShell')])
    return () => wall(new VelvetWallMaterial, createArenaTrim())
  },
} satisfies Record<string, () => Promise<() => StudioWallFinish>>

/**
 * The finishes of the Studio’s floor, each as some room of the game has it, by that room’s id: the Cell’s first, which the default environment keeps. Each loads its materials only once picked, and resolves to what makes them for a floor plan.
 */
export const studioFloors = {
  // The Cell’s varnished wood.
  async cell() {
    const {default: createVarnishedWood} = await import('#src/lib/materials/varnishedWood.ts')
    return ({anisotropy, reflections}: StudioFloorOptions): StudioFloorFinish => createVarnishedWood(anisotropy, reflections)
  },
  // The Arena’s checkered marble, polished like the Cell’s round room.
  async arena() {
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
  // The Lobby’s polished travertine tiles, without its brass inlays.
  async lobby() {
    const [{TravertineFloorMaterial}, {floorTile}] = await Promise.all([import('#src/lib/materials/travertine/index.ts'), import('#src/lib/gallery/floors.ts')])
    return (options: StudioFloorOptions) => floor(new TravertineFloorMaterial({
      origin: northWest(options),
      tile: floorTile,
      reflections: options.reflections,
    }))
  },
  // The Sienna’s varnished boards.
  async sienna() {
    const {default: PlankFloorMaterial} = await import('#src/lib/materials/PlankFloorMaterial.ts')
    return ({reflections}: StudioFloorOptions) => floor(new PlankFloorMaterial(undefined, reflections))
  },
  // The Salon’s Venetian terrazzo within its black border.
  async salon() {
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
  // The Exhibition’s power-troweled concrete.
  async oculus() {
    const {default: ArchitecturalConcreteMaterial} = await import('#src/lib/materials/ArchitecturalConcreteMaterial.ts')
    return () => floor(new ArchitecturalConcreteMaterial)
  },
} satisfies Record<string, () => Promise<(options: StudioFloorOptions) => StudioFloorFinish>>

export type StudioWallId = keyof typeof studioWalls
export type StudioFloorId = keyof typeof studioFloors

const wallIds = Object.keys(studioWalls) as Array<StudioWallId>
const floorIds = Object.keys(studioFloors) as Array<StudioFloorId>

/** The finish of the Studio’s walls in the environment of `seed`: the Cell’s in the default environment, otherwise any of them, rolled apart from the floor’s. */
export function studioWallId(seed: number): StudioWallId {
  return isDefaultSeed(seed) ? wallIds[0] : environmentRandom(seed).makeChild(['studio', 'walls']).rollItem(wallIds)
}

/** The finish of the Studio’s floor in the environment of `seed`: the Cell’s in the default environment, otherwise any of them, rolled apart from the walls’. */
export function studioFloorId(seed: number): StudioFloorId {
  return isDefaultSeed(seed) ? floorIds[0] : environmentRandom(seed).makeChild(['studio', 'floor']).rollItem(floorIds)
}

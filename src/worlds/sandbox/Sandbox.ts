import type {Orb} from '#src/lib/gallery/orbs/index.ts'
import type {PortraitSlot, Vec3} from '#src/lib/gallery/types.ts'
import type {SkyboxId} from '#src/rooms/index.ts'
import type {TurntableRequest} from './turntable.ts'

import {lazy} from 'react'

import {orbs} from '#src/lib/gallery/orbs/index.ts'
import {FloorPlanPlacementSpace} from '#src/lib/placement/FloorPlanPlacementSpace.ts'
import {defaultPortraitArea, portraitRatios} from '#src/lib/placement/portraitSlots.ts'
import Cell from '#src/rooms/cell/Cell.ts'
import CellLayout from '#src/rooms/cell/CellLayout.ts'
import artworks from '#src/worlds/gallery/artworks.ts'

import World from '../base/World.ts'
import {worlds} from '../index.ts'
import {readItems} from './items.ts'
import nightSky from './night.ts'
import {readTurntable} from './turntable.ts'

const minimap = lazy(() => import('#component/SandboxMinimap'))
const scene = lazy(() => import('#src/rooms/cell/components/CellRoom/index.tsx'))
/** how far the player’s body keeps its middle from the walls */
const bodyRadius = 0.6
/** an item on one of the Cell’s pedestals */
export type SandboxItem = {
  /** its prop’s id, unique in the world: the orb’s own prop id for the first of its kind, numbered from 2 for every further one, like `prop-orb-spook-2` */
  id: string
  orb: Orb
}
/** the work floating and turning in front of the Cell’s east wall, see {@link readTurntable} */
export type SandboxTurntable = {
  /** the frame area in cm² */
  area: number
  /** how many times as wide as high it is, or undefined for its image’s own aspect */
  aspect: number | undefined
  /** the artwork’s id, or the image’s URL, which its roll of the Cell’s frames is drawn for */
  id: string
  /** the URL of its image */
  source: string
}
/** the Cell’s slot whose work the turntable takes the place of: the middle one on the east wall */
const turntableSlot = 'east_1'
/** everything `?item` can put on a pedestal, by its object id */
const placeable: ReadonlyMap<string, Orb> = new Map(orbs.map(orb => [orb.propId, orb]))
/** An item for each of the object ids, in their order, as many of a kind as its id is named, or an error naming the unknown ones. */
function resolveItems(ids: ReadonlyArray<string>): ReadonlyArray<SandboxItem> {
  const unknown = [...new Set(ids.filter(id => !placeable.has(id)))]
  if (unknown.length) {
    throw new Error(`Unknown Sandbox item URL selection: ${unknown.join(', ')}. Known items: ${placeable.keys().toArray().join(', ')}`)
  }
  const counts = new Map<string, number>
  return ids.map(id => {
    const count = (counts.get(id) ?? 0) + 1
    counts.set(id, count)
    return {
      id: count === 1 ? id : `${id}-${count}`,
      orb: placeable.get(id)!,
    }
  })
}
/** The turntable’s work: the artwork of the catalog with the requested id, the catalog’s first for none, or the image at the requested URL, or an error for anything else. */
function resolveTurntable({area = defaultPortraitArea, artwork, aspect}: TurntableRequest): SandboxTurntable {
  const work = artwork ? artworks.find(entry => entry.id === artwork) : artworks[0]
  if (work) {
    return {
      area,
      aspect: aspect ?? portraitRatios[work.ratio],
      id: work.id,
      source: work.source,
    }
  }
  if (!URL.canParse(artwork)) {
    throw new Error(`Unknown Sandbox turntable artwork: ${artwork}. Known artworks: ${artworks.map(entry => entry.id).join(', ')}, or the URL of an image`)
  }
  return {
    area,
    aspect,
    id: artwork,
    source: artwork,
  }
}

/** A world to try things in: a single room, the Cell, with a few of the gallery’s default works on its walls and nothing else but the items the URL puts on pedestals beyond its north wall and the work it may float and turn in front of the east wall. */
export default class Sandbox extends World<Cell> {
  // The gallery’s default works, of which the Cell’s slots take as many as fit, drawn by the seed.
  override readonly artworks = artworks
  override readonly defaultRoom = 'cell'
  override readonly id = 'sandbox'
  /** what stands on the Cell’s pedestals, one each, in their order: the items `?item` names */
  readonly items: ReadonlyArray<SandboxItem>
  override readonly Minimap = minimap
  // Artworks hang on any of the Cell’s walls, and lost ones return to the spawn.
  override readonly placement: FloorPlanPlacementSpace
  override readonly Scene = scene
  /** the work floating and turning in front of the Cell’s east wall in place of the wall’s middle work, the one `?turntable` asks for, or undefined for none */
  readonly turntable: SandboxTurntable | undefined

  /**
   * @param itemIds the object ids of the items on the Cell’s pedestals, a repeated one for each further item of its kind, those `?item` names by default
   * @param turntable the work to float and turn in front of the Cell’s east wall, the one `?turntable` asks for by default
   */
  constructor(itemIds: ReadonlyArray<string> = readItems(), turntable: TurntableRequest | undefined = readTurntable()) {
    const items = resolveItems(itemIds)
    super(worlds.sandbox, [[new Cell(new CellLayout(items.length)), [0, 0, 0]]])
    this.items = items
    this.turntable = turntable && resolveTurntable(turntable)
    const cell = this.room('cell')
    const [x, , z] = this.spawn.position
    this.placement = new FloorPlanPlacementSpace(this.walls, (pointX, pointZ) => cell.room.floorContains(cell.toLocal([pointX, 0, pointZ])), cell.room.layout.ridgeHeight, [x, 1, z])
  }

  /** Anywhere on the floor of the Cell or the round room beyond its north wall a body fits, from the floor up to the ceiling, which rises to a ridge over the Cell’s hall. */
  override contains(position: Vec3) {
    const cell = this.room('cell')
    const local = cell.toLocal(position)
    const [x, y, z] = local
    return y >= -0.2 && y < cell.room.layout.ceilingAt(x, z) && cell.room.floorContains(local, bodyRadius)
  }

  /** The Cell’s floor is level everywhere, so every floor mirrors in one plane. */
  override floorHeight(_position: Vec3) {
    return 0
  }

  /** Every portrait slot of the Cell but the one the turntable takes the place of, while it turns. */
  override portraitSlots() {
    const slots = super.portraitSlots()
    if (!this.turntable) {
      return slots
    }
    const {id} = this.turntableSlot()
    return slots.filter(slot => slot.id !== id)
  }

  /** `night` is the starry, moonlit sky over the Cell’s roof lights. */
  override skybox(id: SkyboxId) {
    return id === 'night' ? nightSky : null
  }

  /** The slot on the Cell’s east wall the turntable floats in front of, in place of its work. */
  turntableSlot(): PortraitSlot {
    const cell = this.room('cell')
    const id = cell.room.globalId(turntableSlot)
    return cell.slots().find(slot => slot.id === id)!
  }

  /** How far a ray from the origin travels until it meets a wall, a little farther than the wall itself, and on through the arches. */
  override wallDistance(origin: Vec3, direction: Vec3) {
    const hit = this.placement.findPlacement(origin, direction, 0, 0, [])
    return hit ? Math.hypot(...hit.position.map((value, index) => value - origin[index]) as Vec3) + 0.3 : Infinity
  }
}

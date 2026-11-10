import type {GalleryRoomId} from '../../../worlds/gallery/index.ts'
import type {DestructiblePlantKind} from '../destructiblePlants/catalog.ts'
import type {Vec3} from '../types.ts'
import type {PlantKind, PotKind} from './catalog.ts'

import {environmentRandom} from '../../environmentSeed.ts'
import destructiblePlants from '../destructiblePlants/catalog.ts'
import {plants} from './catalog.ts'

export type PottedPlantKind = DestructiblePlantKind | PlantKind
export type PotPlacement = {
  /** fixed ID of the spot, mixed with the environment seed to roll its plant */
  id: string
  position: Vec3
  pot: PotKind
  /** the room that owns the pot until a player carries it off */
  room: GalleryRoomId
}

export const pottedPlantKinds: Array<PottedPlantKind> = [...plants, ...destructiblePlants].map(plant => plant.id)

/** The plant growing in the pot placement `id` in the environment of `seed`. */
export function pottedPlantKind(seed: number, id: string) {
  return environmentRandom(seed).makeChild(['potted-plant', id]).rollItem(pottedPlantKinds)
}

export const potPlacements: Array<PotPlacement> = [
  {
    id: 'prop-banquet-southwest-plant',
    pot: 'ivory',
    room: 'banquet',
    // Keep even the widest canopy clear of both corner walls.
    position: [8.95, 0.001, 7.1],
  },
  {
    id: 'prop-banquet-northeast-plant',
    pot: 'ivory',
    room: 'banquet',
    position: [19.05, 0.001, -15.05],
  },
]

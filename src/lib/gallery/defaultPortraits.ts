import type {Artwork, Portrait, PortraitSlot} from './types.ts'

import optis from 'optis'
import readPermalink from 'read-permalink'

import world from '#src/worlds/current.ts'

import {environmentRandom} from '../environmentSeed.ts'
import {pickFrame} from '../frames/frameChoice.ts'

const portraitSets = ['classic'] as const

/** the set of default works new game states get, or `false` for none */
export type PortraitSet = typeof portraitSets[number] | false

const portraitSetSchema = optis({
  defaults: {
    portrait_set: 'classic',
  },
  normalizations: {
    portrait_set(value: unknown): PortraitSet {
      if (value === false || value === 'false') {
        return false
      }
      return portraitSets.find(portraitSet => portraitSet === value) ?? 'classic'
    },
  },
})

/** Read the `?portrait_set` of default works: `classic`, or `false` for none. Anything else is `classic`. */
export function readPortraitSet(input: URL | string = typeof location === 'undefined' ? '' : location.href): PortraitSet {
  return readPermalink(input, {schema: portraitSetSchema}).portrait_set
}

/** the default works new game states get, read once at startup */
export const portraitSet = readPortraitSet()

/**
 * The default works hung in the slots, each in a slot of its ratio, the free ones of higher priority first and among equal ones drawn by the environment `seed`. A work takes the size of its slot and its own roll of the slot’s frames, so the same work hangs larger or smaller, and in another frame, from one seed to the next.
 * Where a ratio has fewer slots than works, the seed also draws which of its works hang; the rest stay in the catalog. Works whose ratio has no slot at all are an error.
 */
export function hangDefaultWorks(slots: ReadonlyArray<PortraitSlot>, artworks: ReadonlyArray<Artwork>, seed: number): Array<Portrait> {
  const random = environmentRandom(seed)
  // Every slot and every work rolls its own place in line, so adding one leaves the order of the others alone.
  const slotOrder = new Map(slots.map(slot => [slot, random.makeChild(['portrait-slot', slot.id]).roll()]))
  const workOrder = new Map(artworks.map(artwork => [artwork, random.makeChild(['default-work', artwork.id]).roll()]))
  const free = slots.toSorted((a, b) => b.priority - a.priority || slotOrder.get(a)! - slotOrder.get(b)!)
  const capacity = Map.groupBy(free, slot => slot.ratio)
  // Per ratio, the works the seed draws first, as many as it has slots.
  const drawn = new Set(Map.groupBy(artworks, artwork => artwork.ratio).entries().flatMap(([ratio, works]) => {
    const count = capacity.get(ratio)?.length ?? 0
    if (count === 0) {
      throw new Error(`No ${ratio} portrait slot is left for ${works[0].id}.`)
    }
    return works.length <= count ? works : works.toSorted((a, b) => workOrder.get(a)! - workOrder.get(b)!).slice(0, count)
  }))
  return artworks.filter(artwork => drawn.has(artwork)).map(({ratio, ...artwork}) => {
    const index = free.findIndex(slot => slot.ratio === ratio)
    const [slot] = free.splice(index, 1)
    return {
      ...artwork,
      position: [...slot.position],
      rotation: slot.rotation,
      width: slot.width,
      height: slot.height,
      hung: true,
      wallId: slot.wallId,
      ...slot.labelAbove ? {labelAbove: true} : {},
      ...slot.frame ? {frame: pickFrame(seed, slot.frame, artwork.id)} : {},
    }
  })
}

/** The world’s default works for a new game state, or none with `?portrait_set=false`, hung in its portrait slots, see {@link hangDefaultWorks}. */
export default function defaultPortraits(seed: number): Array<Portrait> {
  if (!portraitSet) {
    return []
  }
  return hangDefaultWorks(world.portraitSlots(), world.artworks, seed)
}

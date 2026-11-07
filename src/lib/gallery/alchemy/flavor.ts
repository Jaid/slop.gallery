import type {Orb} from '../orbs/index.ts'
import type {Vec3} from '../types.ts'

import {hatchet, helmet, paintingSet, pumpkin} from '../curios/index.ts'
import {halloweenOrb, horrorOrb, paintOrb, spookOrb, transparentOrb} from '../orbs/index.ts'

/** the rooms an orb the alchemy machine shoots out passes through on its way down to the Bastion’s crater */
export const alchemyRooms: ReadonlySet<string> = new Set(['bastion', 'forge'])
/** the props that, lying in the Forge or carried into it, steer the flavor the alchemy machine gives a Transparent Orb to an orb of their own, by their ids: the pumpkin to the Halloween Orb, the hatchet to the Horror Orb, the helmet to the Spook Orb and the Painting Set to the Paint Orb */
export const flavorSteering: ReadonlyMap<string, Orb> = new Map<string, Orb>([
  [pumpkin.propId, halloweenOrb],
  [hatchet.propId, horrorOrb],
  [helmet.propId, spookOrb],
  [paintingSet.propId, paintOrb],
])

/** what the alchemy machine may make of a Transparent Orb while nothing in the Forge steers it: nothing but itself */
const unsteered: ReadonlyArray<Orb> = [transparentOrb]

type PropPosition = readonly [id: string, position: Vec3]

/** Whether any of the props, by their ids and where they are, is an orb in one of the {@link alchemyRooms}, by the room `roomAt` finds there. */
export function orbAround(props: Iterable<PropPosition>, roomAt: (position: Vec3) => string | undefined) {
  for (const [id, position] of props) {
    if (id.startsWith('prop-orb-') && alchemyRooms.has(roomAt(position) ?? '')) {
      return true
    }
  }
  return false
}

/** The flavors the alchemy machine may give a Transparent Orb, with the props where they are: those that the props in the Forge steer it to, by {@link flavorSteering}, or, with none of them there, none at all, so it comes out as the Transparent Orb it went in as. */
export function flavorCandidates(props: Iterable<PropPosition>, roomAt: (position: Vec3) => string | undefined): ReadonlyArray<Orb> {
  const steered = new Set<Orb>
  for (const [id, position] of props) {
    const orb = steeredOrb(id)
    if (orb && roomAt(position) === 'forge') {
      steered.add(orb)
    }
  }
  return steered.size ? [...steered] : unsteered
}

/** The flavor the alchemy machine gives a Transparent Orb, picked evenly from its {@link flavorCandidates} by `random`, a number from 0 up to 1. */
export function flavoredOrb(props: Iterable<PropPosition>, roomAt: (position: Vec3) => string | undefined, random: number) {
  const candidates = flavorCandidates(props, roomAt)
  return candidates[Math.min(Math.floor(random * candidates.length), candidates.length - 1)]
}

/** What the alchemy machine makes of an orb: a Transparent Orb takes a flavor if anything in the Forge steers it to one, see {@link flavoredOrb}, while a flavored one always comes out as itself. */
export function transmutedOrb(orb: Orb, props: Iterable<PropPosition>, roomAt: (position: Vec3) => string | undefined, random: number) {
  return orb === transparentOrb ? flavoredOrb(props, roomAt, random) : orb
}

/** the orb the prop steers the flavor to, if any: by its id, or the id of the first of its kind it is numbered after, like `prop-pumpkin-2` */
function steeredOrb(id: string) {
  const kind = /^(?<kind>.+?)(?:-\d+)?$/.exec(id)!.groups!.kind
  return flavorSteering.get(kind)
}

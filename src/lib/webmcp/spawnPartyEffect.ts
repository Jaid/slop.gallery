import type {Vec3} from '#src/lib/gallery/types.ts'

import {partyEffects} from '#src/party_effects/index.ts'
import {startParty} from '#src/party_effects/lib/parties.ts'

export type PartyEffectSpawnInput = {
  /** seconds until it bursts out, which it waits hidden while its pipelines compile; right away by default */
  delay?: number
  /** the id of the party effect, like `blood` */
  effect: string
  /** the floor’s height under it, in world meters; the floor the world has there by default */
  floor?: number
  /** where it bursts out of, in world meters */
  position: Vec3
  /** the way it faces, as a turn around y in radians: toward +z at 0, toward +x at a quarter turn; 0 by default */
  rotation?: number
}
export type PartyEffectSpawn = {
  /** seconds it goes on once it burst out */
  duration: number
  effect: string
  /** the floor’s height under it, in world meters */
  floor: number
  position: Vec3
  rotation: number
}

/** Plays the party effect `effect` at `position`, facing the way `rotation` turns it, from now on or after `delay` seconds; see the `spawn_party_effect` tool. */
export default function spawnPartyEffect({delay, effect, floor, position, rotation = 0}: PartyEffectSpawnInput): PartyEffectSpawn {
  if (!Object.hasOwn(partyEffects, effect)) {
    throw new Error(`There is no party effect “${effect}”. Party effects: ${Object.keys(partyEffects).join(', ')}.`)
  }
  const {show} = startParty(effect as keyof typeof partyEffects, {
    position,
    rotation,
    floor,
  }, {delay})
  return {
    effect,
    position,
    rotation,
    floor: show.site.floor,
    duration: show.effect.duration,
  }
}

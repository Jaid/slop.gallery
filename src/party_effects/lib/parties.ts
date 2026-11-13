import type {PartyEffectId} from '../index.ts'
import type PartyShow from './PartyShow.ts'
import type {PartyOptions, PartyPlacement} from './partySite.ts'

import {create} from 'zustand'

import {worldNow} from '#src/lib/frozenTime.ts'
import world from '#src/worlds/current.ts'

import {partyEffects} from '../index.ts'
import {partySite} from './partySite.ts'

/** a party effect playing in the world on its own, see {@link startParty} */
export type Party = {
  /** unique among the parties of the page */
  id: number
  show: PartyShow
  /** when it bursts out, by `performance.now()`, which the renderer and the virtual clock of the film script follow too */
  startsAt: number
}

let spawned = 0

/** the party effects spawned into the world that still play, which `PartyEffects` draws */
export const useParties = create<{parties: ReadonlyArray<Party>}>(() => ({parties: []}))

/**
 * Starts a party: the party effect with the id playing on its own, bursting out of the placement’s position, facing the way its rotation turns it, over the floor the world has there, until it is over.
 * Its sound plays while the sound is on, once the player’s first click made the sound engine. `spawnPartyEffect` of `#src/lib/gallery.ts` asks for one from anywhere.
 */
export function startParty(id: PartyEffectId, placement: PartyPlacement, {delay = 0}: PartyOptions = {}): Party {
  const party: Party = {
    id: ++spawned,
    show: partyEffects[id].stage(partySite(placement, world.floorHeight(placement.position))),
    startsAt: worldNow() + delay * 1000,
  }
  useParties.setState(({parties}) => ({parties: [...parties, party]}))
  return party
}

/** Takes the party out of the world, whether it is over or not; `PartyEffects` then frees what it drew with. */
export function endParty(party: Party) {
  useParties.setState(({parties}) => ({parties: parties.filter(candidate => candidate !== party)}))
}

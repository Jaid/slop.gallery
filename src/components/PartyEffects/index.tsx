import type {PartyEffectRequest} from '#src/lib/gallery.ts'
import type {Party} from '#src/party_effects/lib/parties.ts'

import {useFrame} from '@react-three/fiber'
import useDisposable from 'disposable-lifetime/react'
import {useEffect} from 'react'

import SoundEngine from '#src/lib/audio/SoundEngine.ts'
import {galleryEvents, spawnPartyEffect, useGallery} from '#src/lib/gallery.ts'
import worldClock from '#src/lib/worldClock.ts'
import {endParty, startParty, useParties} from '#src/party_effects/lib/parties.ts'

/** how long after a party is over it stays in the world, in seconds, so nothing of it is cut off */
const lingering = 1

/**
 * Every party effect playing in the world on its own, in whichever world is loaded, each until it is over: those `spawnPartyEffect` asks for from anywhere in the game.
 * It also offers spawning them to whoever drives the page from outside, as `slopGallery.spawnPartyEffect`.
 */
export default function PartyEffects() {
  const parties = useParties(state => state.parties)
  useEffect(() => {
    const spawn = (event: Event) => {
      const {effect, options, placement} = (event as CustomEvent<PartyEffectRequest>).detail
      startParty(effect, placement, options)
    }
    galleryEvents.addEventListener('party-effect', spawn)
    globalThis.slopGallery ??= {}
    const gallery = globalThis.slopGallery
    gallery.spawnPartyEffect = spawnPartyEffect
    return () => {
      galleryEvents.removeEventListener('party-effect', spawn)
      delete gallery.spawnPartyEffect
    }
  }, [])
  return parties.map(party => <SpawnedParty key={party.id} party={party} />)
}

/** One party, brought along by the world’s clock, which the renderer follows too, until a moment after it is over. */
function SpawnedParty({party}: {party: Party}) {
  const show = useDisposable(party.show)
  useFrame(() => {
    const since = (worldClock.now() - party.startsAt) / 1000
    const engine = SoundEngine.existing()
    show.update(since, engine && useGallery.getState().sound ? engine : undefined)
    if (show.over(since - lingering)) {
      endParty(party)
    }
  })
  return <primitive object={show.root} />
}

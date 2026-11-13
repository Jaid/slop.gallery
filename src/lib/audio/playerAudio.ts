import type {EgoState, EgoZoomTransition} from 'ego-player'

import {useGallery} from '#src/lib/gallery/store.ts'
import {isPauseFrozen} from '#src/lib/pauseMenu.ts'
import {getPlayerZoom, setPlayerZoom} from '#src/lib/rendering/playerView.ts'
import world from '#src/worlds/current.ts'

import SoundEngine from './SoundEngine.ts'

const surface = (state: EgoState) => {
  const {x, y, z} = state.position
  return world.groundSurface(useGallery.getState().room, [x, y, z])
}
const stop = () => SoundEngine.existing()?.stopPlayerSounds()

export function onPlayerStep(state: EgoState) {
  if (state.active && useGallery.getState().sound) {
    SoundEngine.existing()?.step(surface(state), Math.hypot(state.velocity.x, state.velocity.z), state.crouching)
  }
}

export function onPlayerLand(state: EgoState, impactSpeed: number) {
  if (state.active && useGallery.getState().sound) {
    SoundEngine.existing()?.land(surface(state), Math.hypot(state.velocity.x, state.velocity.z), state.crouching, impactSpeed)
  }
}

export function onPlayerZoomChange(amount: number) {
  setPlayerZoom(amount)
  const {sound, locked} = useGallery.getState()
  SoundEngine.existing()?.setZoom(sound && locked ? amount : 0)
}

export function onPlayerZoomTransition(transition: EgoZoomTransition) {
  const {sound, locked} = useGallery.getState()
  if (sound && locked) {
    SoundEngine.existing()?.zoomTransition(transition.from === 'extended' || transition.to === 'extended', transition.direction === 'retract', transition.duration)
  }
}

/** Both portrait and knot inspection publish inspecting on entry/release, not on every frame. */
export function attachPlayerAudio(events: Pick<EventTarget, 'addEventListener' | 'removeEventListener'> = globalThis) {
  events.addEventListener('blur', stop)
  let hasEnteredGame = useGallery.getState().locked
  const unsubscribe = useGallery.subscribe((state, previous) => {
    const sound = SoundEngine.existing()
    if (state.locked !== previous.locked) {
      if (!state.locked && previous.locked) {
        if (state.sound && !isPauseFrozen()) {
          sound?.playEffect('SFX-42')
        }
        hasEnteredGame = true
      } else if (state.locked && hasEnteredGame && state.sound) {
        sound?.playEffect('SFX-43')
      }
      if (state.locked) {
        hasEnteredGame = true
      }
    }
    if (state.sound !== previous.sound) {
      sound?.mute(!state.sound)
      sound?.setZoom(state.sound && state.locked ? getPlayerZoom() : 0)
    }
    if (!state.locked) {
      if (previous.locked) {
        stop()
      }
      return
    }
    if (state.sound && !!state.inspecting !== !!previous.inspecting) {
      sound?.viewTransition(!!state.inspecting)
    }
  })
  return () => {
    unsubscribe()
    events.removeEventListener('blur', stop)
    stop()
  }
}

import {useGallery} from '../gallery/store.ts'
import SoundEngine from './SoundEngine.ts'

declare global {
  interface Navigator {
    /** Autoplay Policy Detection (https://w3c.github.io/autoplay/), so far only in Firefox and in the virtual audio of capture-session’s films */
    getAutoplayPolicy?: (type: 'audiocontext' | 'mediaelement') => 'allowed' | 'allowed-muted' | 'disallowed'
  }
}

/** Whether the browser says an audio context may play before the player’s first click or key, like Firefox allowing autoplay or the virtual audio a film records. */
export function audioAutoplays() {
  return navigator.getAutoplayPolicy?.('audiocontext') === 'allowed'
}

/**
 * Lets the world sound from now on instead of waiting for the player’s first click to make the sound engine: makes it right away, muted as the player switched it, and resumes it once the browser lets it, at once where audio autoplays (see {@link audioAutoplays}) or else on the page’s first click or key. Returns the cleanup.
 * The intro does this to be heard from its orbiting camera, and every page does where audio autoplays.
 */
export default function hearAtOnce(target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'> = globalThis) {
  const engine = SoundEngine.get()
  engine.mute(!useGallery.getState().sound)
  const resume = () => {
    void engine.resume().catch(() => {})
  }
  const activate = () => {
    resume()
    target.removeEventListener('pointerdown', activate, true)
    target.removeEventListener('keydown', activate, true)
  }
  resume()
  target.addEventListener('pointerdown', activate, true)
  target.addEventListener('keydown', activate, true)
  return () => {
    target.removeEventListener('pointerdown', activate, true)
    target.removeEventListener('keydown', activate, true)
  }
}

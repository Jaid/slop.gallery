import type {Vec3} from '../gallery/types.ts'
import type {FootstepSurface} from './playerSoundEffects.ts'
import type {AudioOutput, Hearing, Playback, Voice} from 'procedural-audio'

import {clamp} from 'math'
import playVoices, {osc} from 'procedural-audio'

import worldTime from '../worldTime.ts'
import {audioVolume} from './audioParameter.ts'
import {footstepVoices, impactFootstepStrength, playerSoundEffects} from './playerSoundEffects.ts'
import {playSoundEffect} from './soundEffects.ts'
import TransformerChain from './transformers/TransformerChain.ts'

// Boost procedural effects by 12 dB without changing narration.
const effectsGain = 0.6 * 10 ** (12 / 20)
/** how far the world’s one-shots carry from where they sound, like an orb striking the floor */
const worldHearing: Hearing = {
  near: 2,
  far: 26,
}

export default class SoundEngine {
  private static instance: SoundEngine | undefined
  static existing() {
    return this.instance
  }
  static get() {
    if (!this.instance) {
      this.instance = new SoundEngine
      this.instance.setPaused(worldTime.paused)
    }
    return this.instance
  }
  readonly context = new AudioContext
  readonly master = this.context.createGain()
  /** where the effects and the narration meet, at the `?audio` volume */
  readonly output = this.context.createGain()
  /** what the moods showing transform the sounds of the world through on their way from {@link world} to the effects master, like the acoustics of the listener’s room */
  readonly transformers: TransformerChain
  /** where the sounds of the world play, like footsteps, switches and ambience: through the moods’ {@link transformers} into the effects master, unlike the interface’s sounds, which play on the master directly */
  readonly world: AudioOutput

  private contactIndex = 0
  private extendedZoom = false
  private lastLanding = Number.NEGATIVE_INFINITY
  private muted = false
  private paused = false
  private suspension: Promise<void> | undefined
  private viewMotion?: Playback
  private zoomAmount = 0
  private zoomBed?: Playback
  private zoomMotion?: Playback

  private constructor() {
    this.master.gain.value = effectsGain
    this.output.gain.value = audioVolume
    this.master.connect(this.output)
    this.output.connect(this.context.destination)
    const world = this.context.createGain()
    this.world = {
      context: this.context,
      master: world,
    }
    this.transformers = new TransformerChain(this.context, world, this.master)
  }

  land(surface: FootstepSurface, speed: number, crouching: boolean, impactSpeed: number) {
    if (this.muted || this.paused) {
      return
    }
    this.lastLanding = this.context.currentTime
    const index = this.contactIndex++
    playVoices(this.world, footstepVoices(surface, speed, {
      crouching,
      strength: impactFootstepStrength(impactSpeed),
      variation: Math.sin(index * 2.39996),
    }), {seed: `land:${index}`})
  }

  mute(muted: boolean) {
    if (this.muted === muted) {
      return
    }
    this.muted = muted
    this.master.gain.setTargetAtTime(muted ? 0 : effectsGain, this.context.currentTime, 0.08)
    if (muted) {
      this.stopPlayerSounds()
    }
  }

  /** Plays the catalog’s sound effect with the id, on the master like the interface’s sounds unless `output` is another, like {@link world}. */
  playEffect(id: string, output: AudioOutput = this) {
    if (!this.muted && !this.paused) {
      playSoundEffect(output, id)
    }
  }

  /** Plays a recipe in the world, heard from `position` if given, carrying as far as `hearing` says, or else right where the listener is. */
  playInWorld(voices: ReadonlyArray<Voice>, seed: string, position?: Vec3, hearing = worldHearing) {
    if (this.muted || this.paused || !voices.length) {
      return
    }
    playVoices(this.world, voices, {
      seed,
      position,
      hearing,
    })
  }

  async resume() {
    if (this.suspension) {
      await this.suspension
    }
    if (!this.paused && this.context.state === 'suspended') {
      await this.context.resume()
    }
  }

  /** Freeze the audio clock itself, preserving ambience, one-shots and automation at their current positions. Menu interactions cannot resume it early. */
  setPaused(paused: boolean) {
    if (paused === this.paused) {
      return
    }
    this.paused = paused
    if (paused) {
      this.suspension = this.context.suspend()
      void this.suspension.catch(error => console.warn('Could not pause world audio.', error))
    } else {
      // Wait for an in-flight suspend before resuming, including rapid pause/resume/pause sequences.
      void this.resume().catch(error => console.warn('Could not resume world audio.', error))
    }
  }

  /** A single sustained bed follows the eased zoom amount, never one new sound per frame. */
  setZoom(amount: number) {
    this.zoomAmount = this.muted || this.paused ? 0 : clamp(amount, 0, 1)
    if (this.zoomAmount === 0) {
      this.zoomBed?.stop(0.06)
      this.zoomBed = undefined
      this.zoomMotion?.stop()
      this.zoomMotion = undefined
      return
    }
    this.zoomBed ??= playVoices(this, playerSoundEffects.zoom.voices, {
      seed: playerSoundEffects.zoom.id,
      sustain: true,
      gain: 0,
    })
    this.updateZoomGain()
  }

  step(surface: FootstepSurface, speed: number, crouching: boolean) {
    if (this.muted || this.paused || speed < 0.1 || this.context.currentTime - this.lastLanding < 0.1) {
      return
    }
    // The stride callback owns cadence; no fixed cooldown may discard faster steps.
    const index = this.contactIndex++
    playVoices(this.world, footstepVoices(surface, speed, {
      crouching,
      variation: Math.sin(index * 2.39996),
    }), {seed: `step:${index}`})
  }

  stopPlayerSounds() {
    this.setZoom(0)
    this.viewMotion?.stop()
    this.viewMotion = undefined
  }

  /** A plain falling sine in the world, the sound of most interactions. */
  tone(frequency: number, duration = 0.3, volume = 0.055) {
    if (!this.muted && !this.paused) {
      playVoices(this.world, [osc(frequency, duration, volume, {endFrequency: frequency * 0.55})], {seed: 'tone'})
    }
  }

  viewTransition(entering: boolean) {
    this.viewMotion?.stop()
    this.viewMotion = undefined
    if (this.muted || this.paused) {
      return
    }
    const effect = entering ? playerSoundEffects.viewEnter : playerSoundEffects.viewLeave
    this.viewMotion = playVoices(this, effect.voices, {seed: effect.id})
  }

  zoomTransition(extended: boolean, retract: boolean, duration: number) {
    this.zoomMotion?.stop()
    this.zoomMotion = undefined
    this.extendedZoom = extended && !retract
    this.updateZoomGain()
    if (this.muted || this.paused || duration === 0) {
      return
    }
    let effect = retract ? playerSoundEffects.zoomRetract : playerSoundEffects.zoomForward
    if (extended) {
      effect = retract ? playerSoundEffects.extendedZoomRetract : playerSoundEffects.extendedZoomForward
    }
    this.zoomMotion = playVoices(this, effect.voices, {
      seed: effect.id,
      duration,
    })
  }

  private updateZoomGain() {
    this.zoomBed?.gain.setTargetAtTime(this.zoomAmount * (this.extendedZoom ? 1.35 : 1), this.context.currentTime, 0.025)
  }
}

// Do not create an AudioContext just because the menu changed. A context first created during a pause is suspended by get() as well.
const unsubscribe = worldTime.subscribe(() => SoundEngine.existing()?.setPaused(worldTime.paused))
if (import.meta.hot as ImportMeta['hot'] | undefined) {
  import.meta.hot.dispose(unsubscribe)
}

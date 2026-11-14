import type {Vec3} from '../gallery/types.ts'
import type {FootstepSurface} from './playerSoundEffects.ts'
import type {AudioOutput, Hearing, Playback, Voice} from 'procedural-audio'

import {clamp} from 'math'
import playVoices, {osc} from 'procedural-audio'

import worldClock from '../worldClock.ts'
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
    return this.instance ??= new SoundEngine
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
  /** whether the engine was let to sound, which it does again once a frozen world goes on */
  private sounding = false
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
    // Its clock is the context’s, which stands still with the world’s and goes on with it, so every sound stops where it is and plays on from there, in step with what the world shows.
    worldClock.subscribe(() => this.followWorld())
    this.followWorld()
  }

  land(surface: FootstepSurface, speed: number, crouching: boolean, impactSpeed: number) {
    if (this.muted) {
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
    const gain = muted ? 0 : effectsGain
    if (worldClock.frozen) {
      // No time passes for a fade, so the world’s sound goes on at the level it was switched to.
      this.master.gain.setValueAtTime(gain, this.context.currentTime)
    } else {
      this.master.gain.setTargetAtTime(gain, this.context.currentTime, 0.08)
    }
    if (muted) {
      this.stopPlayerSounds()
    }
  }

  /** Plays the catalog’s sound effect with the id, on the master like the interface’s sounds unless `output` is another, like {@link world}. */
  playEffect(id: string, output: AudioOutput = this) {
    if (!this.muted) {
      playSoundEffect(output, id)
    }
  }

  /** Plays a recipe in the world, heard from `position` if given, carrying as far as `hearing` says, or else right where the listener is. */
  playInWorld(voices: ReadonlyArray<Voice>, seed: string, position?: Vec3, hearing = worldHearing) {
    if (this.muted || !voices.length) {
      return
    }
    playVoices(this.world, voices, {
      seed,
      position,
      hearing,
    })
  }

  /** Lets the engine sound, which the browser only allows once the player clicked or pressed a key. While the world is frozen, it stays silent until the world goes on. */
  async resume() {
    this.sounding = true
    if (!worldClock.frozen && this.context.state === 'suspended') {
      await this.context.resume()
    }
  }

  /** A single sustained bed follows the eased zoom amount, never one new sound per frame. */
  setZoom(amount: number) {
    this.zoomAmount = this.muted ? 0 : clamp(amount, 0, 1)
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
    if (this.muted || speed < 0.1 || this.context.currentTime - this.lastLanding < 0.1) {
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
    if (!this.muted) {
      playVoices(this.world, [osc(frequency, duration, volume, {endFrequency: frequency * 0.55})], {seed: 'tone'})
    }
  }

  viewTransition(entering: boolean) {
    this.viewMotion?.stop()
    this.viewMotion = undefined
    if (this.muted) {
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
    if (this.muted || duration === 0) {
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

  /** Suspends the context while the world is frozen and resumes it as the world goes on, unless it never sounded before. */
  private followWorld() {
    if (worldClock.frozen) {
      // A context the browser let sound right away sounds again afterward too.
      this.sounding ||= this.context.state === 'running'
      void this.context.suspend().catch(() => {})
    } else if (this.sounding) {
      // Whatever state it reports: a suspension still underway only takes effect after this.
      void this.context.resume().catch(() => {})
    }
  }

  private updateZoomGain() {
    this.zoomBed?.gain.setTargetAtTime(this.zoomAmount * (this.extendedZoom ? 1.35 : 1), this.context.currentTime, 0.025)
  }
}

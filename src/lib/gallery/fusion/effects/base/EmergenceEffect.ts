import type Fusion from '#src/lib/gallery/fusion/Fusion.ts'
import type {PortalFrame} from '#src/lib/gallery/fusion/portalFrame.ts'
import type EffectSprites from './EffectSprites.ts'
import type {EffectShow} from './FusionEffect.ts'
import type {AudioOutput} from 'procedural-audio'

import {Group} from 'three/webgpu'

import FusionEffect from './FusionEffect.ts'

/** how late after the result flipped out the sound may still start, in seconds, for a portal that only notices then */
const lateness = 0.3

/** Something that bursts out of a fusion’s portal as the result flips out: sprites the GPU animates by the seconds since then, and a sound that plays once at that moment. */
export default abstract class EmergenceEffect extends FusionEffect {
  /** The sprites one portal shows, still hidden. */
  abstract createSprites(): EffectSprites

  show(fusion: Fusion): EffectShow {
    return new EmergenceShow(this, fusion)
  }

  /** Plays the sound of it bursting out of the portal of `frame`, from now on. */
  abstract sound(audio: AudioOutput, frame: PortalFrame): void
}

/** The sprites of an {@link EmergenceEffect} bursting out of one fusion’s portal, and its sound. */
class EmergenceShow implements EffectShow {
  readonly root = new Group
  private readonly effect: EmergenceEffect
  private readonly fusion: Fusion
  private sounded = false
  private readonly sprites: EffectSprites

  constructor(effect: EmergenceEffect, fusion: Fusion) {
    this.effect = effect
    this.fusion = fusion
    this.sprites = effect.createSprites()
    const {center, floor, normal, tangent} = fusion.frame
    const {uniforms} = this.sprites
    this.sprites.position.fromArray(center)
    uniforms.normal.value.fromArray(normal)
    uniforms.tangent.value.fromArray(tangent)
    uniforms.floor.value = floor - center[1]
    this.root.add(this.sprites)
  }

  dispose() {
    this.sprites.dispose()
  }

  update(elapsed: number, audio?: AudioOutput) {
    const {emergedAt, frame} = this.fusion
    const since = emergedAt === undefined ? -1 : elapsed - emergedAt
    this.sprites.uniforms.clock.value = since
    if (since < 0 || this.sounded) {
      return
    }
    this.sounded = true
    if (audio && since < lateness) {
      this.effect.sound(audio, frame)
    }
  }
}

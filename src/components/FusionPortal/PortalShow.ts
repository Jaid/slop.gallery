import type {ClimaxMoment} from '#src/lib/gallery/fusion/climax.ts'
import type {EffectShow} from '#src/lib/gallery/fusion/effects/index.ts'
import type {PortalEnvelope} from '#src/lib/gallery/fusion/envelope.ts'
import type Fusion from '#src/lib/gallery/fusion/Fusion.ts'
import type {PortalPalette} from '#src/lib/gallery/fusion/PortalCore.ts'
import type {Vec3} from '#src/lib/gallery/types.ts'
import type {Camera, Texture} from 'three/webgpu'

import {clamp} from 'math'
import {Color, Group, Mesh, PointLight, Vector3} from 'three/webgpu'

import playArcCrack from '#src/lib/audio/arcCrack.ts'
import FusionSound from '#src/lib/audio/FusionSound.ts'
import SoundEngine from '#src/lib/audio/SoundEngine.ts'
import {portraitFrame} from '#src/lib/frames/index.ts'
import {useGallery} from '#src/lib/gallery.ts'
import {climaxMoment, confluence, impact, reboundTrail, reboundWarp} from '#src/lib/gallery/fusion/climax.ts'
import {portalEnvelope} from '#src/lib/gallery/fusion/envelope.ts'
import {impactStrength, orbRippleRadius} from '#src/lib/gallery/fusion/impact/strike.ts'
import {decorateIntro, introTether, introTrail} from '#src/lib/gallery/fusion/intro.ts'
import {introOrbitRate, orbitAngle} from '#src/lib/gallery/fusion/orbit.ts'
import PortalVisuals, {emberPalette, paletteOf} from '#src/lib/gallery/fusion/PortalVisuals.ts'
import portraitObjects from '#src/lib/gallery/portraitObjects.ts'
import setGroupOrder from '#src/lib/rendering/groupOrder.ts'
import {resetImpact, screenImpact} from '#src/lib/rendering/screenImpact.ts'
import {holdArtworkTexture} from '#src/lib/useArtworkTexture.ts'

import Satellites from './Satellites.ts'

type Stage = 'brewing' | 'climax' | 'emerged' | 'fizzle'
type HeldImage = {
  release: () => void
  texture?: Texture<{
    height: number
    width: number
  }>
}

/** how far the portal’s light reaches, in meters */
const lightRange = 11
/** how much brighter the portal’s light shines than its envelope says, and up to how strong an envelope; it outshines the lamps around, so the shadows it casts read, but its flashes don’t blind */
const lightBoost = {
  factor: 3,
  upTo: 35,
}
const middle = new Vector3
const seen = new Vector3
/** how far around the portal the climax’s warp drags the room in, in meters, less than the intro’s, so its pull stays clear of the screen’s edges */
const reboundReach = 3.2
/**
 * where a fusion draws among the scene’s groups: after the whole world, so the view its warp, its lens and its ripple copy and bend already holds the world’s transparent parts, like the text of the labels, glass, flames and a thrown orb,
 * instead of those drawing over the bent view untouched
 */
const fusionGroupOrder = 1

/**
 * One fusion as the scene shows it: its portal, its light, its sound, the choreography of what orbits it and the effects its ingredients contributed, all following the fusion’s clock frame by frame.
 * Disposing it hands back whatever still orbits, stops its sound and lets go of the images it showed.
 */
export default class PortalShow {
  readonly root = new Group
  private readonly effects: ReadonlyArray<EffectShow>
  private readonly embers: PortalPalette
  private readonly fusion: Fusion
  private readonly images = new Map<Blob | string, HeldImage>
  /** whether the portal dealt the view a blow last frame */
  private impacting = false
  private last?: number
  private readonly light = new PointLight('#ffffff', 0, lightRange, 2)
  private readonly paint: PortalPalette = {
    core: new Color,
    rim: new Color,
    swirl: new Color,
  }
  private readonly palette: PortalPalette
  private phase = 0
  /** whether the recoil of a fusion the player broke off has sounded */
  private recoiled = false
  /** the frame the result will wear, shrunk to nothing, see {@link rehearseFrame} */
  private rehearsal?: Mesh
  private readonly satellites: Satellites
  private sound?: FusionSound
  private stage: Stage = 'brewing'
  /** the strike that opened it: where, how hard and whether its crack still has to sound */
  private readonly struck?: {
    point: Vec3
    silent: boolean
    strength: number
  }
  private turn = -1
  private readonly visuals = new PortalVisuals

  constructor(fusion: Fusion) {
    this.fusion = fusion
    this.satellites = new Satellites(fusion)
    this.palette = paletteOf(fusion.spec.color)
    this.embers = paletteOf()
    this.embers.core.set(emberPalette.core)
    this.embers.swirl.set(emberPalette.swirl)
    this.embers.rim.set(emberPalette.rim)
    this.visuals.place(fusion.frame.center)
    this.light.position.fromArray(fusion.frame.center)
    this.light.name = 'fusion-light'
    // The fusion’s mood darkens and cools the light around it, but its own glow shines on in the portal’s colors.
    this.light.userData.untinted = true
    // The work and what was thrown into it sweep huge shadows over the walls and floor as they orbit, whirl and spiral in, as long as it is among the shadow pool’s nearest lights.
    this.light.userData.shadow = true
    this.root.name = `fusion-${fusion.id}`
    this.effects = fusion.spec.effects.map(effect => effect.show(fusion))
    this.root.add(this.visuals.root, this.light, ...this.effects.map(effect => effect.root))
    setGroupOrder(this.root, fusionGroupOrder)
    const {impact: opening, partner, work} = fusion.spec
    if (opening) {
      const strength = impactStrength(opening.speed)
      const group = portraitObjects.get(work.id)?.group
      if (group) {
        this.visuals.ripple.place(group, portraitFrame(work.frame).front, opening.center, strength, partner.kind === 'item' && partner.orb ? orbRippleRadius : undefined)
      }
      this.struck = {
        point: opening.center,
        strength,
        silent: true,
      }
    }
  }

  dispose() {
    if (this.impacting) {
      resetImpact()
    }
    this.satellites.dispose()
    this.sound?.stop()
    for (const effect of this.effects) {
      effect.dispose()
    }
    for (const image of this.images.values()) {
      image.release()
    }
    this.images.clear()
    this.visuals.dispose()
    // The frame’s materials are shared by every work wearing it.
    this.rehearsal?.geometry.dispose()
  }

  /** Brings everything to `elapsed` seconds into the fusion, as `camera` sees it. */
  update(elapsed: number, camera?: Camera) {
    const {fusion, visuals} = this
    const {frame, outcome, timing} = fusion
    const delta = this.last === undefined ? 0 : clamp(elapsed - this.last, 0, 0.1)
    this.last = elapsed
    this.rehearsal ??= this.rehearseFrame()
    const envelope = portalEnvelope(elapsed, outcome, fusion.emergedAt, timing, {
      images: fusion.spec.images.length,
      ingredients: fusion.spec.latches.length,
    }, fusion.canceledAt)
    const moment = climaxMoment(elapsed, outcome, fusion.emergedAt, timing)
    this.confluence(moment, envelope)
    this.phase = (this.phase + envelope.spin * delta) % (Math.PI * 2000)
    // Colors die down to embers while it fizzles.
    this.paint.core.lerpColors(this.palette.core, this.embers.core, envelope.embers)
    this.paint.swirl.lerpColors(this.palette.swirl, this.embers.swirl, envelope.embers)
    this.paint.rim.lerpColors(this.palette.rim, this.embers.rim, envelope.embers)
    visuals.paint(this.paint)
    const {uniforms} = visuals.core
    // The confluence swells the disc, so the marbling reads.
    uniforms.radius.value = frame.radius * envelope.size * (1 + 0.4 * uniforms.marble.value)
    uniforms.energy.value = envelope.energy
    uniforms.lens.value = envelope.lens
    uniforms.flash.value = envelope.flash
    uniforms.pulse.value = envelope.pulse
    uniforms.pulseStrength.value = envelope.pulseStrength
    uniforms.phase.value = this.phase
    uniforms.clock.value = elapsed
    this.show(envelope.image)
    const sparks = visuals.sparks.uniforms
    sparks.radius.value = frame.radius
    sparks.clock.value = elapsed
    sparks.energy.value = envelope.size > 0.05 ? envelope.energy * (1 - envelope.embers) : 0
    sparks.burst.value = envelope.burst
    sparks.burstStrength.value = envelope.burstStrength
    decorateIntro(visuals, elapsed, timing, frame.normal)
    this.satellites.update(elapsed)
    middle.fromArray(frame.center)
    for (const [index, tether] of visuals.tethers.entries()) {
      const from = this.satellites.centers[index]
      const held = from && introTether(index, elapsed, timing)
      tether.uniforms.energy.value = held ? held.glow : 0
      if (!held) {
        continue
      }
      tether.uniforms.clock.value = elapsed
      tether.uniforms.flow.value = held.flow
      tether.uniforms.knot.value = held.knot
      tether.uniforms.slack.value = held.slack
      tether.uniforms.width.value = held.width
      tether.uniforms.to.value.copy(middle)
      tether.uniforms.from.value.lerpVectors(middle, from, held.reach)
    }
    const climax = this.climax()
    for (const [index, trail] of visuals.trails.entries()) {
      const head = this.satellites.centers[index]
      // The intro’s trail of fire, or the comet trail the climax winds into the portal.
      const intro = head && introTrail(index, elapsed, timing)
      const spiraling = head && !intro && climax ? reboundTrail(moment, orbitAngle(0, elapsed, climax) - orbitAngle(0, climax.at, climax)) : undefined
      const blazing = intro ? {
        ...intro,
        spiral: 0,
      } : spiraling && {
        ...spiraling,
        reach: 1,
      }
      trail.uniforms.energy.value = blazing ? blazing.energy : 0
      if (!head || !blazing) {
        continue
      }
      trail.follow(frame, head, blazing.reach)
      trail.uniforms.clock.value = elapsed
      trail.uniforms.length.value = blazing.length
      trail.uniforms.spiral.value = blazing.spiral
      trail.uniforms.width.value = blazing.width
    }
    this.rebound(moment)
    this.impact(moment, elapsed, camera)
    this.light.intensity = envelope.light + (lightBoost.factor - 1) * Math.min(envelope.light, lightBoost.upTo)
    this.strike(elapsed)
    this.light.color.copy(this.paint.swirl).lerp(this.paint.rim, envelope.flash / 2)
    if (!this.sound && this.stage === 'brewing') {
      this.sound = this.listen()
    }
    const orbit = elapsed < timing.intro ? introOrbitRate(elapsed, timing) : (orbitAngle(0, elapsed, this.climax()) - orbitAngle(0, elapsed - 0.01, this.climax())) / 0.01
    this.cue(elapsed, envelope.image && 'turn' in envelope.image ? envelope.image.turn : undefined)
    this.sound?.update({
      energy: envelope.energy,
      orbit,
      spin: envelope.spin,
    })
    const audio = this.audio()
    for (const effect of this.effects) {
      effect.update(elapsed, audio)
    }
  }

  /** where the portal sounds: on the sound engine, once the player’s first click made it, while the sound is on */
  private audio() {
    const engine = SoundEngine.existing()
    return engine && useGallery.getState().sound ? engine : undefined
  }

  private climax() {
    const {outcome, timing} = this.fusion
    return outcome?.kind === 'success' ? {
      at: outcome.at,
      duration: timing.climax,
    } : undefined
  }

  /** Marbled confluence: through the climax the disc marbles the images of two or more ingredients together while the result crystallizes out of them, instead of the last image sinking away before the result surfaces. */
  private confluence(moment: ClimaxMoment, envelope: PortalEnvelope) {
    const {core} = this.visuals
    const state = this.fusion.spec.images.length > 1 ? confluence(moment) : undefined
    if (!state) {
      core.uniforms.marble.value = 0
      return
    }
    let count = 0
    for (const source of this.fusion.spec.images.slice(0, core.ingredients.length)) {
      const loaded = this.image(source)
      if (!loaded) {
        continue
      }
      core.ingredients[count].value = loaded
      count++
    }
    core.uniforms.ingredientCount.value = Math.max(count, 1)
    core.uniforms.marble.value = count > 1 ? state.marble : 0
    core.uniforms.crystal.value = state.crystal
    envelope.image = {
      result: true,
      clarity: state.clarity,
    }
  }

  /** Plays the sound of whatever began since the last frame: a new image, the recoil of a fusion the player broke off, the climax, the result or the fizzle. */
  private cue(elapsed: number, turn: number | undefined) {
    const {fusion, sound} = this
    const {outcome, timing} = fusion
    if (fusion.canceledAt !== undefined && !this.recoiled) {
      this.recoiled = true
      sound?.recoil()
    }
    // The climax or the fizzle takes over from the moment the outcome is due, so no image starts surfacing with a bell of its own right as it begins.
    let stage: Stage = 'brewing'
    if (fusion.emergedAt !== undefined) {
      stage = 'emerged'
    } else if (outcome?.kind === 'success' && elapsed >= outcome.at) {
      stage = 'climax'
    } else if (outcome?.kind === 'failure' && elapsed >= outcome.at) {
      stage = 'fizzle'
    }
    if (stage !== this.stage) {
      this.stage = stage
      if (stage === 'climax') {
        sound?.climax(Math.max(0.1, outcome!.at + timing.climax - elapsed))
      } else if (stage === 'emerged') {
        sound?.emerge()
      } else if (stage === 'fizzle') {
        sound?.fizzle(timing.fizzle)
      }
    }
    if (stage === 'brewing' && turn !== undefined && turn !== this.turn) {
      this.turn = turn
      sound?.surface(turn)
    }
  }

  /** The image, held in the artworks’ shared cache until the portal closes, once it is decoded. */
  private image(source: Blob | string) {
    let image = this.images.get(source)
    if (!image) {
      const {texture, release} = holdArtworkTexture(source)
      const held: HeldImage = {release}
      void texture.then(loaded => {
        held.texture = loaded
      }, () => {})
      image = held
      this.images.set(source, image)
    }
    return image.texture
  }

  /** Impact frame: the blow the view takes through the climax and as the result flips out, as `camera` sees the portal. */
  private impact(moment: ClimaxMoment, elapsed: number, camera?: Camera) {
    const blow = camera && impact(moment, camera.getWorldPosition(seen).distanceTo(middle.fromArray(this.fusion.frame.center)))
    if (!blow) {
      if (this.impacting) {
        this.impacting = false
        resetImpact()
      }
      return
    }
    this.impacting = true
    seen.fromArray(this.fusion.frame.center).project(camera)
    // Behind the camera, the ring would run out from a mirrored point.
    const ahead = seen.z < 1
    screenImpact.center.value.set(seen.x * 0.5 + 0.5, 0.5 - seen.y * 0.5)
    screenImpact.aberration.value = blow.aberration
    screenImpact.bloom.value = blow.bloom
    screenImpact.cap.value = blow.cap
    screenImpact.punch.value = blow.punch
    screenImpact.ring.value = blow.ring
    screenImpact.ringStrength.value = ahead ? blow.ringStrength : 0
    screenImpact.shake.value.set((Math.sin(elapsed * 83) + Math.sin(elapsed * 47.3 + 1)) / 2, (Math.sin(elapsed * 71.7 + 2) + Math.sin(elapsed * 39.1 + 3)) / 2).multiplyScalar(blow.shake)
  }

  /** The portal’s sound, once the player’s first click made the sound engine and while the sound is on; it can only start while the portal still brews. */
  private listen() {
    const audio = this.audio()
    if (!audio) {
      return
    }
    const {fusion} = this
    const sound = new FusionSound(audio, fusion.frame.center)
    sound.open(fusion.timing, fusion.spec.latches, fusion.elapsed())
    return sound
  }

  /** Implosion and rebound: the warp drags the room in through the climax and blasts it out as the result flips out. */
  private rebound(moment: ClimaxMoment) {
    const state = reboundWarp(moment)
    if (!state) {
      return
    }
    const {warp} = this.visuals
    warp.visible = true
    const {uniforms} = warp
    uniforms.reach.value = reboundReach
    uniforms.chroma.value = state.chroma
    uniforms.darkness.value = state.darkness
    uniforms.front.value = state.front
    uniforms.pull.value = state.pull
    uniforms.ripple.value = state.ripple
    uniforms.twist.value = state.twist
  }

  /**
   * Draws the frame the result will wear in every pass from the portal’s first frame on, at a scale of 0, so it covers no pixel, and as `Portrait` draws it, so its pipelines compile in the background while the portal brews; otherwise the result would flip out as a bare image and only get its frame seconds later.
   * The director rolls the frame as the portal opens, before this first runs.
   */
  private rehearseFrame() {
    const {frame: portal, resultFrame, spec} = this.fusion
    const frame = portraitFrame(resultFrame)
    const mesh = new Mesh(frame.createGeometry(spec.work.width, spec.work.height), frame.materials)
    mesh.name = 'fusion-frame-rehearsal'
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    mesh.position.fromArray(portal.center)
    mesh.scale.setScalar(0)
    this.root.add(mesh)
    return mesh
  }

  /** Shows the image or the result the envelope asks for, once its image is decoded. */
  private show(image: ReturnType<typeof portalEnvelope>['image']) {
    const {core} = this.visuals
    const source = image && ('result' in image ? this.fusion.result : this.fusion.spec.images[image.index])
    const texture = source === undefined ? undefined : this.image(source)
    if (!image || !texture) {
      core.uniforms.clarity.value = 0
      return
    }
    if (core.image.value !== texture) {
      core.image.value = texture
      core.uniforms.aspect.value = texture.image.width / Math.max(1, texture.image.height)
    }
    core.uniforms.clarity.value = image.clarity
  }

  /** The strike that opened the fusion, `elapsed` seconds after it: its ripple, and its crack once, as soon as it can sound. */
  private strike(elapsed: number) {
    const {struck, visuals} = this
    visuals.ripple.update(struck ? elapsed : 10)
    if (!struck?.silent) {
      return
    }
    const engine = SoundEngine.existing()
    if (engine && useGallery.getState().sound) {
      struck.silent = false
      // Too late, it would sound apart from the strike.
      if (elapsed < 0.15) {
        playArcCrack(engine.world, struck.point, struck.strength)
      }
    }
  }
}

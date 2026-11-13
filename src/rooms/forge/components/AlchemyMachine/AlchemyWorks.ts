import type {PropHandle} from '#src/components/Scene/GrabbableProp.tsx'
import type {Vec3} from '#src/lib/gallery.ts'
import type {Orb} from '#src/orbs/index.ts'
import type CannonFx from './CannonFx.ts'
import type {Object3D} from 'three/webgpu'

import {shiftVoices} from 'procedural-audio'
import {uniform} from 'three/tsl'
import {Vector3} from 'three/webgpu'

import {propObjects, showPropAt} from '#src/components/Scene/GrabbableProp.tsx'
import {alchemyBrewVoices, alchemySwallowVoices, cannonVoices} from '#src/lib/audio/alchemySounds.ts'
import {isWorldClockPaused} from '#src/lib/frozenTime.ts'
import {bodyPose, playSound, useGallery} from '#src/lib/gallery.ts'
import {alchemyCannon, alchemySink, cannonLaunch, holderSpot, inSinkThroat, machineBody} from '#src/lib/gallery/alchemy/alchemyMachine.ts'
import {orbAround, transmutedOrb} from '#src/lib/gallery/alchemy/flavor.ts'
import {orbSeat} from '#src/lib/gallery/OrbHolderGeometry.ts'
import {environmentSeed} from '#src/lib/gameSeed.ts'
import {telemetry} from '#src/lib/telemetry/index.ts'
import {orbRadius, transparentOrb} from '#src/orbs/index.ts'
import slopGallery from '#src/worlds/gallery/index.ts'

import {charging} from './CannonFx.ts'

/** an orb the machine brings into the world: in its holder, or made inside it, held hidden in the cannon’s barrel until it shoots it out */
export type AlchemyOrb = {
  id: string
  orb: Orb
  position: Vec3
  withheld?: boolean
}
/** an orb the machine took in, until it shoots out what it made of it */
type Batch = {
  /** where the orb’s middle was when the machine took it in */
  from: Vec3
  /** the prop the machine took in */
  intake: string
  /** the prop it shoots out: the one it took in, or a new one in its stead */
  product: string
  /** how long it has been working on it, in seconds */
  since: number
}

/** how long an orb taken in takes to sink out of sight down the throat, in seconds, and how far it sinks */
const sinking = [0.3, 0.22] as const
/** how long the machine works on an orb from taking it in until it shoots it out, in seconds */
const brewing = 2.6
/** how long after a shot the cannon shoots again at the soonest, in seconds, so orbs never meet on the way */
const reload = 2
/** where an orb waits in the holder: let down onto its lip from just over it */
const holderSeat: Vec3 = [holderSpot[0], holderSpot[1] + orbSeat + 0.002, holderSpot[2]]
const sinkPosition: Vec3 = [alchemySink.center[0], alchemySink.throatY, alchemySink.center[2]]
const bodyPosition: Vec3 = [machineBody.center[0], machineBody.size[1] / 2, machineBody.center[1]]
const worldPosition = new Vector3
/** Every prop by its id and where it is: where it is shown, lying, rolling, held by a portal or inside the machine, or where the player is who carries it, whose room it is in even before it is shown there. */
function *propPositions(): Generator<readonly [string, Vec3]> {
  const {held} = useGallery.getState()
  for (const [id, prop] of propObjects) {
    yield [id, id === held ? bodyPose.center : prop.group.getWorldPosition(worldPosition).toArray()]
  }
}
const roomAt = (position: Vec3) => slopGallery.roomAt(position)?.id

/**
 * What the alchemy machine does, frame by frame: it takes in every orb that drops down its sink’s throat, out of the physics, lets it sink out of sight, works on it for a while and shoots out what it made of it through its cannon, one orb at a time, see {@link transmutedOrb}. A flavored orb comes out as itself; a Transparent Orb that takes a flavor is used up, and a new orb of that flavor comes out in its stead, made hidden in the barrel as soon as the machine takes in the old one.
 * It keeps a Transparent Orb in its holder: one when a game begins, and another whenever the player leaves the Bastion while no orb is left in the Forge or the Bastion, inside the machine included.
 * Every orb it brings into the world it hands to `add`, which mounts it.
 */
export default class AlchemyWorks {
  /** the orb the holder holds when a game begins */
  static readonly firstOrb: AlchemyOrb = {
    id: `${transparentOrb.propId}-holder-1`,
    orb: transparentOrb,
    position: holderSeat,
  }

  /** how brightly the window in the machine’s body glows: while it works on an orb and in a flash as the cannon shoots */
  readonly glow = uniform(0)
  private readonly batches: Array<Batch> = []
  /** seconds the machine has run, by the frames drawn */
  private clock = 0
  private readonly counts = {
    holder: 1,
    made: 0,
    sounds: 0,
  }

  private lastShot = -Infinity
  /** the orb the cannon gathers itself to shoot, and since when */
  private loaded: {
    product: string
    since: number
  } | undefined

  constructor(private readonly add: (orb: AlchemyOrb) => void, private readonly fx: CannonFx) {}

  /** Puts another Transparent Orb into the holder whenever the player leaves the Bastion while no orb is left in the Forge or the Bastion and nothing lies in the holder’s way; returns the unsubscription. */
  restock() {
    return useGallery.subscribe((state, previous) => {
      if (previous.room !== 'bastion' || state.room === 'bastion' || this.batches.length || this.loaded || orbAround(propPositions(), roomAt)) {
        return
      }
      for (const [, position] of propPositions()) {
        if (Math.hypot(...position.map((value, axis) => value - holderSeat[axis])) < orbRadius * 2) {
          return
        }
      }
      this.add({
        id: `${transparentOrb.propId}-holder-${++this.counts.holder}`,
        orb: transparentOrb,
        position: holderSeat,
      })
    })
  }

  /** Runs the machine on by `delta` seconds: takes in what dropped down the throat, sinks it out of sight, shoots out what is done, lets the window glow and the cannon’s `barrel` go off, see {@link CannonFx}. */
  update(delta: number, barrel: Object3D | null) {
    if (isWorldClockPaused()) {
      return
    }
    const step = Math.min(delta, 0.1)
    this.clock += step
    this.takeIn()
    this.sink(step)
    this.shoot()
    // The window glows up while the machine works on an orb and flashes as it shoots.
    const since = this.clock - this.lastShot
    const working = this.batches.length || this.loaded ? 0.55 + 0.25 * Math.sin(this.clock * 7.3) * Math.sin(this.clock * 2.9) : 0
    const flash = since < 0.5 ? 2.2 * (1 - since / 0.5) : 0
    this.glow.value += (Math.max(working, flash) - this.glow.value) * Math.min(1, step * 6)
    this.fx.update(this.clock, barrel)
  }

  /** Shoots out what the machine is done with first, once the cannon is ready again and the orb has turned up: the cannon gathers itself for a moment, then goes off. */
  private shoot() {
    if (this.loaded) {
      if (this.clock - this.loaded.since < charging) {
        return
      }
      const {product: id} = this.loaded
      this.loaded = undefined
      this.lastShot = this.clock
      const product = propObjects.get(id)
      if (product) {
        showPropAt(product, cannonLaunch.position)
        product.unleash(cannonLaunch.velocity, [0, 0, 0])
      }
      this.fx.fire(this.clock, id)
      playSound(cannonVoices(Math.random() * 2 - 1), `alchemy:shot:${++this.counts.sounds}`, alchemyCannon.muzzle)
      return
    }
    const next = this.batches.at(0)
    if (!next || next.since < brewing || this.clock - this.lastShot < reload || !propObjects.has(next.product)) {
      return
    }
    this.batches.shift()
    this.loaded = {
      product: next.product,
      since: this.clock,
    }
    this.fx.charge(this.clock)
  }

  /** Lets every orb just taken in sink down the throat, faster and faster, and hides it once it is out of sight, using it up if a new orb comes out in its stead. */
  private sink(step: number) {
    for (const batch of this.batches) {
      const was = batch.since
      batch.since += step
      const intake = propObjects.get(batch.intake)
      if (!intake || was >= sinking[0]) {
        continue
      }
      const share = Math.min(batch.since / sinking[0], 1)
      const [x, y, z] = batch.from
      showPropAt(intake, [x, y - sinking[1] * share * share, z])
      if (share < 1) {
        continue
      }
      intake.group.visible = false
      if (batch.product !== batch.intake) {
        useGallery.setState(({consumed}) => ({consumed: [...consumed, batch.intake]}))
      }
    }
  }

  /** Takes in the orb that dropped down the sink’s throat, out of the physics, and works out what it makes of it. */
  private take(id: string, prop: PropHandle, orb: Orb) {
    const {x, y, z} = prop.body.translation()
    const output = transmutedOrb(orb, propPositions(), roomAt, Math.random())
    const product = output === orb ? id : `${output.propId}-alchemy-${++this.counts.made}`
    telemetry?.event('alchemy.brewed', {
      'orb.from': orb.id,
      'orb.to': output.id,
      'orb.changed': output !== orb,
    }, output === orb ? `Alchemy kept ${orb.title} unchanged` : `Alchemy turned ${orb.title} into ${output.title}`)
    if (product !== id) {
      this.fx.prepare(product, output.partyEffect(environmentSeed))
      this.add({
        id: product,
        orb: output,
        position: cannonLaunch.position,
        withheld: true,
      })
    }
    this.batches.push({
      intake: id,
      product,
      from: [x, y, z],
      since: 0,
    })
    const variation = Math.random() * 2 - 1
    const sound = ++this.counts.sounds
    playSound(alchemySwallowVoices(variation), `alchemy:swallow:${sound}`, sinkPosition)
    playSound(shiftVoices(alchemyBrewVoices(brewing - sinking[0], variation), sinking[0]), `alchemy:brew:${sound}`, bodyPosition)
  }

  /** Takes in every orb that dropped down the sink’s throat, unless the player holds it or something else does. */
  private takeIn() {
    for (const [id, prop] of propObjects) {
      if (!prop.orb || prop.seized() || !prop.body.isEnabled() || this.batches.some(batch => batch.intake === id)) {
        continue
      }
      const {x, y, z} = prop.body.translation()
      if (inSinkThroat([x, y, z]) && prop.seize()) {
        this.take(id, prop, prop.orb)
      }
    }
  }
}

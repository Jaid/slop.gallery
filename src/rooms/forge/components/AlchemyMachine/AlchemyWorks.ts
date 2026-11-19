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
import {bodyPose, playSound, useGallery} from '#src/lib/gallery.ts'
import {alchemyCannon, alchemySink, cannonLaunch, machineBody} from '#src/lib/gallery/alchemy/alchemyMachine.ts'
import {orbAround, transmutedOrb} from '#src/lib/gallery/alchemy/flavor.ts'
import IntakePassage from '#src/lib/gallery/alchemy/IntakePassage.ts'
import {onRoomEnter} from '#src/lib/gallery/geofences.ts'
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

/** Time in seconds and distance in meters to draw an orb through the side inlet into the chest. */
const sinking = [0.3, 0.22] as const
/** how long the machine works on an orb from taking it in until it shoots it out, in seconds */
const brewing = 2.6
/** how long after a shot the cannon shoots again at the soonest, in seconds, so orbs never meet on the way */
const reload = 2
/** The iron chest lifts 2 cm off its feet and lands 140 ms after each shot. */
const chestHop = {
  height: 0.02,
  duration: 0.14,
} as const
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
 * It keeps a Transparent Orb in its holder: one when a game begins, and another whenever the player enters the Forge while no orb is left in the Forge or the Bastion, inside the machine included.
 * Every orb it brings into the world it hands to `add`, which mounts it.
 */
export default class AlchemyWorks {
  /** A free orb just above the holder’s lip, wherever the workbench is when it spawns. */
  static holderOrb(holder: Object3D, number: number): AlchemyOrb {
    return {
      id: `${transparentOrb.propId}-holder-${number}`,
      orb: transparentOrb,
      position: holder.localToWorld(new Vector3(0, orbSeat + 0.002, 0)).toArray(),
    }
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
  private readonly passage = new IntakePassage

  constructor(private readonly add: (orb: AlchemyOrb) => void, private readonly fx: CannonFx) {}

  /**
   * Puts another Transparent Orb into the holder whenever the player enters the Forge while no orb is left in the Forge or the Bastion and nothing lies in the holder’s way; returns the unsubscription.
   * The Forge begins at the west arch of its vestibule, from where the wall beside the arch into the room still hides the holder, so the orb is there before the player can see it.
   */
  restock(holder: Object3D) {
    return onRoomEnter('forge', () => {
      if (this.batches.length || this.loaded || orbAround(propPositions(), roomAt)) {
        return
      }
      const next = AlchemyWorks.holderOrb(holder, this.counts.holder + 1)
      for (const [, position] of propPositions()) {
        if (Math.hypot(...position.map((value, axis) => value - next.position[axis])) < orbRadius * 2) {
          return
        }
      }
      this.counts.holder++
      this.add(next)
    })
  }

  /** Follow each orb through the sink at physics rate so even fast drops register before they reach the chest. */
  takeIn() {
    for (const [id, prop] of propObjects) {
      if (prop.orb && this.passage.reachedChest(prop.body) && prop.seize()) {
        this.take(id, prop, prop.orb)
      }
    }
  }

  /** Advances the brew and its firing effects by `delta` seconds. Returns true on the frame of a shot so loose items get a single kick. */
  update(delta: number, barrel: Object3D | null, chest: Object3D | null) {
    const step = Math.min(delta, 0.1)
    this.clock += step
    this.sink(step)
    const fired = this.shoot()
    const since = this.clock - this.lastShot
    if (chest) {
      const t = since / chestHop.duration
      chest.position.y = t < 1 ? 4 * chestHop.height * t * (1 - t) : 0
    }
    const working = this.batches.length || this.loaded ? 0.55 + 0.25 * Math.sin(this.clock * 7.3) * Math.sin(this.clock * 2.9) : 0
    const flash = since < 0.5 ? 2.2 * (1 - since / 0.5) : 0
    this.glow.value += (Math.max(working, flash) - this.glow.value) * Math.min(1, step * 6)
    this.fx.update(this.clock, barrel)
    return fired
  }

  /** Shoots out what the machine is done with first, once the cannon is ready again and the orb has turned up: the cannon gathers itself for a moment, then goes off. */
  private shoot() {
    if (this.loaded) {
      if (this.clock - this.loaded.since < charging) {
        return false
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
      return true
    }
    const next = this.batches.at(0)
    if (!next || next.since < brewing || this.clock - this.lastShot < reload || !propObjects.has(next.product)) {
      return false
    }
    this.batches.shift()
    this.loaded = {
      product: next.product,
      since: this.clock,
    }
    this.fx.charge(this.clock)
    return false
  }

  /** Draws an orb through the side collar and hides it inside the chest, using it up if a new orb comes out in its stead. */
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
      showPropAt(intake, [x - sinking[1] * share * share, y, z])
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
}

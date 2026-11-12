import type {Vec3} from '#src/lib/gallery.ts'
import type {PartyEffectId, PartyShow, PartySite} from '#src/party_effects/index.ts'
import type {Object3D} from 'three/webgpu'

import {uniform} from 'three/tsl'
import {Group} from 'three/webgpu'

import SoundEngine from '#src/lib/audio/SoundEngine.ts'
import {useGallery} from '#src/lib/gallery.ts'
import {alchemyCannon} from '#src/lib/gallery/alchemy/alchemyMachine.ts'
import CannonBlast from '#src/lib/gallery/alchemy/CannonBlast.ts'
import {partyEffects} from '#src/party_effects/index.ts'

/** how long the cannon gathers itself before it goes off, in seconds, while a swell runs up its barrel */
export const charging = 0.24
/** how far the barrel kicks back along its axis when it shoots, in meters, and how quickly it eases back, in seconds */
const recoil = [0.06, 0.45] as const
/** how much the barrel’s swell widens it, at most */
const swelling = 0.32
/** how much the barrel squashes, gathering itself, and stretches as it goes off, at most; then it wobbles back, this many times a second, dying away in about a quarter second */
const squash = {
  gather: 0.12,
  stretch: 0.2,
  wobble: 4.5,
  damping: 7,
} as const
const {axis, breech, muzzle} = alchemyCannon
/** the cannon’s muzzle as the site of the orbs’ party effects, which burst out of it facing the way it shoots across the floor */
const muzzleSite: PartySite = (() => {
  const level = Math.hypot(axis[0], axis[2])
  const normal: Vec3 = [axis[0] / level, 0, axis[2] / level]
  return {
    center: muzzle,
    floor: 0,
    normal,
    tangent: [normal[2], 0, -normal[0]],
  }
})()

/** an orb’s party effect waiting in the cannon for its orb to be shot, and then bursting out of the muzzle */
type Burst = {
  /** when the orb was shot, by the machine’s clock */
  firedAt?: number
  show: PartyShow
}

/**
 * How the alchemy machine’s cannon goes off, like in a cartoon: it gathers itself, squashing, while a swell runs up its barrel, then stretches as it fires, kicks back and wobbles home, with a bang of smoke and sparks out of its muzzle. When the machine gave the orb a new flavor, the new orb’s party effect bursts out of the muzzle with it, the Halloween Orb’s bats, the Horror Orb’s blood, staring eyes or flesh tendrils, whichever the game rolled, the Spook Orb’s ghosts or the Paint Orb’s brush strokes.
 * Every effect waits hidden from when the machine takes in the orb, so it compiles while the machine works on it.
 */
export default class CannonFx {
  readonly blast = new CannonBlast
  /** what it draws, in the world */
  readonly root = new Group
  /** where along the barrel from its breech its swell is, in meters, and how much it widens it there */
  readonly swell = {
    at: uniform(0),
    size: uniform(0),
  }

  private readonly bursts = new Map<string, Burst>
  private chargedAt = -Infinity
  private firedAt = -Infinity

  constructor() {
    this.blast.position.set(...muzzle)
    this.root.add(this.blast)
  }

  /** Starts gathering for a shot at `clock`, the machine’s clock. */
  charge(clock: number) {
    this.chargedAt = clock
  }

  dispose() {
    this.blast.dispose()
    for (const {show} of this.bursts.values()) {
      show.dispose()
    }
  }

  /** Goes off at `clock`, shooting the orb `id`, whose effect bursts out with it if it has one waiting. */
  fire(clock: number, id: string) {
    this.firedAt = clock
    const burst = this.bursts.get(id)
    if (burst) {
      burst.firedAt = clock
    }
  }

  /** Stages the party effect of the orb `id`, which the cannon will shoot, at the muzzle, if the orb brings one. */
  prepare(id: string, effect: PartyEffectId | undefined) {
    if (!effect || this.bursts.has(id)) {
      return
    }
    const show = partyEffects[effect].stage(muzzleSite)
    this.root.add(show.root)
    this.bursts.set(id, {show})
  }

  /** Brings everything to `clock`, the machine’s clock: the barrel’s pose and shape, the blast and the effects bursting out. */
  update(clock: number, barrel: Object3D | null) {
    const gathering = Math.min(Math.max((clock - this.chargedAt) / charging, 0), 1)
    const since = clock - this.firedAt
    const fired = this.firedAt >= this.chargedAt
    // The swell runs up the barrel while it gathers itself and bursts out of the muzzle as it goes off.
    if (fired) {
      this.swell.at.value = alchemyCannon.length
      this.swell.size.value = since < 0.12 ? swelling * (1 - since / 0.12) : 0
    } else {
      const eased = gathering * gathering * (3 - 2 * gathering)
      this.swell.at.value = 0.08 + (alchemyCannon.length - 0.1) * eased
      this.swell.size.value = swelling * Math.sin(Math.PI * Math.min(gathering * 1.6, 1) / 2)
    }
    this.blast.uniforms.clock.value = since
    if (barrel) {
      // Squashing as it gathers itself, then stretching as it goes off and wobbling back
      const wobble = fired ? (since > 3 ? 0 : Math.exp(-since * squash.damping) * Math.cos(since * squash.wobble * Math.PI * 2) * squash.stretch) : -squash.gather * gathering * gathering
      barrel.scale.set(1 - wobble / 2, 1 + wobble, 1 - wobble / 2)
      const kick = since < 0.04 ? since / 0.04 : Math.exp(-(since - 0.04) / recoil[1] * 4)
      const back = since >= 0 && since < recoil[1] * 3 ? recoil[0] * kick : 0
      barrel.position.set(...breech.map((value, index) => value - axis[index] * back) as Vec3)
    }
    const engine = SoundEngine.existing()
    const audio = engine && useGallery.getState().sound ? engine : undefined
    for (const [id, {firedAt, show}] of this.bursts) {
      const out = firedAt === undefined ? -1 : clock - firedAt
      show.update(out, audio)
      // A moment longer than it lasts, so nothing of it is cut off.
      if (!show.over(out - 1)) {
        continue
      }
      show.root.removeFromParent()
      show.dispose()
      this.bursts.delete(id)
    }
  }
}

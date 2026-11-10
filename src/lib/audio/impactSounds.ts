import type {Vec3} from '../gallery/types.ts'
import type {FrameImpactSoundId} from './frameImpacts.ts'
import type {OrbImpactSurface} from './orbImpacts.ts'
import type {BodyContact} from 'rapier-body-contact'

import BodyContacts from 'rapier-body-contact'
import {Quaternion, Vector3} from 'three/webgpu'

import {useGallery} from '#src/lib/gallery/store.ts'
import world from '#src/worlds/current.ts'

import {frameContact, frameImpactVoices} from './frameImpacts.ts'
import {orbImpactVoices} from './orbImpacts.ts'
import SoundEngine from './SoundEngine.ts'

/** what a body sounds like striking something: a glass orb, or a framed work in a frame that sounds like `sound` */
export type Striker = {
  kind: 'frame'
  sound: FrameImpactSoundId
} | {
  kind: 'orb'
}

/** the striker of every orb */
export const orbStriker: Striker = {kind: 'orb'}

const turn = new Quaternion
const local = new Vector3
let strikes = 0
/** What an orb striking the striker `other`, or the world where it is not registered, at `position` strikes: another orb, a frame’s wood or the ground of the room there. */
function orbSurface(other: Striker | undefined, position: Vec3): OrbImpactSurface {
  if (other) {
    return other.kind === 'orb' ? 'orb' : 'hollow'
  }
  return world.roomAt(position)?.groundSurface(position) ?? 'generic'
}
/** Sounds a strike where it happened: an orb’s glass against whatever it hit, else a frame by the part of it that hit first. */
function sound({normal, other, point, rotation, speed, tag}: BodyContact<Striker>) {
  const engine = SoundEngine.existing()
  if (!engine || !useGallery.getState().sound) {
    return
  }
  const index = strikes++
  const variation = Math.sin(index * 2.39996)
  const position: Vec3 = [point.x, point.y, point.z]
  if (tag.kind === 'orb' || other?.kind === 'orb') {
    engine.playInWorld(orbImpactVoices(tag.kind === 'orb' ? orbSurface(other, position) : 'hollow', speed, variation), `orb:${index}`, position)
    return
  }
  local.copy(normal).applyQuaternion(turn.copy(rotation).invert())
  engine.playInWorld(frameImpactVoices(frameContact([local.x, local.y, local.z]), speed, tag.sound, variation), `frame:${index}`, position)
}

/** every body whose strikes sound, which `ImpactSounds` samples around each physics step */
export const impactSounds = new BodyContacts<Striker>({onContact: sound})

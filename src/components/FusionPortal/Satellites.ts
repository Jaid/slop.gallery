import type Fusion from '#src/lib/gallery/fusion/Fusion.ts'
import type {SatelliteOrbit, SatellitePose} from '#src/lib/gallery/fusion/orbit.ts'
import type {Vec3} from '#src/lib/gallery/types.ts'
import type {RapierRigidBody} from '@react-three/rapier'
import type {Object3D} from 'three/webgpu'

import {clamp} from 'math'
import {Box3, Matrix4, Quaternion, Vector3} from 'three/webgpu'

import {portraitFrame} from '#src/lib/frames/index.ts'
import {useGallery} from '#src/lib/gallery.ts'
import {handBack} from '#src/lib/gallery/fusion/handBack.ts'
import {emberRhythm} from '#src/lib/gallery/fusion/intro.ts'
import {fizzleRelease, satellitePose} from '#src/lib/gallery/fusion/orbit.ts'
import {satelliteSize} from '#src/lib/gallery/fusion/portalFrame.ts'
import portraitObjects from '#src/lib/gallery/portraitObjects.ts'

import {propObjects} from '../Scene/GrabbableProp.tsx'

/** something the portal holds and moves by the group inside its rigid body’s object, while its body is out of the physics */
type Held = {
  /** the group inside its rigid body’s object, which the fusion moves */
  group: Object3D
  id: string
  /** where it is this frame, in the world */
  pose: SatellitePose
  /** seconds into the fusion that it was handed back, after which it grows back to its size, from `releasedScale` */
  released?: number
  releasedScale: number
}
type Satellite = Held & {
  body: RapierRigidBody
  /** whether the fusion used it up, which leaves it to vanish with its prop */
  consumed?: boolean
  kind: 'portrait' | 'prop' | 'work'
  orbit: SatelliteOrbit
}

/** seconds a satellite takes to grow back to its size once it is handed back */
const regrowth = 0.4
/** the largest side an orbiting prop shrinks to, in meters */
const propSize = 0.6
/** seconds after the result that the portal spits a prop back out, a beat later, below the result while it flips up and away */
const spitDelay = 0.1
/** the angular velocity a prop spat out of the portal tumbles off with, in radians per second around the world axes */
const spitSpin: Vec3 = [4, 3, 2]
const holderInverse = new Matrix4
const matrix = new Matrix4
const scaleVector = new Vector3
const offset = new Vector3
const tangentVector = new Vector3
const box = new Box3
const easeOutBack = (t: number) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2
const poseOf = (object: Object3D) => {
  object.updateWorldMatrix(true, false)
  const position = new Vector3
  const quaternion = new Quaternion
  object.matrixWorld.decompose(position, quaternion, scaleVector)
  return {
    position,
    quaternion,
  }
}
/** a stable pseudo-random unit vector for the id, which a prop tumbles around */
const tumbleAxis = (id: string) => {
  let hash = 2_166_136_261
  for (const character of id) {
    hash = Math.imul(hash ^ character.codePointAt(0)!, 16_777_619) >>> 0
  }
  const turn = hash / 4_294_967_296 * Math.PI * 2
  const axis = new Vector3(Math.cos(turn), 0.8, Math.sin(turn))
  return axis.normalize()
}
/** Grows what the portal handed back to its size, from the scale it had then, overshooting a little. */
function regrow({group, released = 0, releasedScale}: Held, elapsed: number) {
  group.scale.setScalar(releasedScale + (1 - releasedScale) * easeOutBack(clamp((elapsed - released) / regrowth, 0, 1)))
}

/**
 * The work and what was thrown into it while they orbit a fusion’s portal. The fusion moves each by the group inside its rigid body’s object, whose body is out of the physics meanwhile, and hands it back when it is done with it.
 * The work returns to its wall when the fusion fails or is aborted and flips out of the portal as the result otherwise; a loose work thrown into it is spat out on failure and consumed on success; a prop is spat back out, unless a success consumes it, like an orb.
 * What a success leaves of a prop it consumes, like a themed orb’s clear glass, the portal holds hidden in its middle from the moment it enters the world, and spits it out after the result in the prop’s stead.
 */
export default class Satellites {
  /** where each satellite is in the world this frame, by its orbit’s index, for the tethers and the trails; empty once it is handed back */
  readonly centers: Array<Vector3 | undefined> = []
  private readonly fusion: Fusion
  private list?: Array<Satellite>
  /** what a success leaves of the prop it consumes, once it entered the world */
  private remains?: Held

  constructor(fusion: Fusion) {
    this.fusion = fusion
  }

  /** Hands back whatever is still held: the work snaps back to its wall, the rest drops where it is, and the remains of a consumed prop are spat out right away, unless the fusion leaves none. */
  dispose() {
    const {remains} = this
    if (remains) {
      if (remains.released === undefined && this.leavesRemains()) {
        this.spit(remains)
      }
      if (remains.released === undefined) {
        // It leaves the world with the fusion that didn’t use the prop up, unseen.
        remains.group.visible = false
      } else {
        remains.group.scale.setScalar(1)
      }
    }
    for (const satellite of this.list ?? []) {
      // Gone with its prop, invisible in the portal’s middle until then.
      if (satellite.consumed) {
        continue
      }
      if (satellite.released === undefined && satellite.kind !== 'work') {
        this.handBack(satellite, [0, 0, 0], [0, 0, 0])
      }
      if (satellite.kind === 'work' && satellite.released === undefined) {
        satellite.group.position.set(0, 0, 0)
        satellite.group.quaternion.identity()
      }
      satellite.group.scale.setScalar(1)
    }
    this.list = []
  }

  /** Moves every satellite to where it is `elapsed` seconds into the fusion and hands back those whose time has come. */
  update(elapsed: number) {
    const {fusion} = this
    const {frame, outcome, timing} = fusion
    this.list ??= this.seize()
    for (const satellite of this.list) {
      if (satellite.consumed) {
        continue
      }
      if (satellite.kind === 'portrait' && portraitObjects.get(satellite.id)?.group !== satellite.group) {
        // The result replaced it.
        satellite.released ??= elapsed
      }
      if (satellite.released !== undefined) {
        this.centers[satellite.orbit.index] = undefined
        regrow(satellite, elapsed)
        continue
      }
      satellitePose(frame, timing, satellite.orbit, elapsed, outcome, satellite.pose)
      if (fusion.canceledAt !== undefined && elapsed >= fusion.canceledAt) {
        this.jolt(satellite, elapsed - fusion.canceledAt)
      }
      if (outcome?.kind === 'failure' && satellite.kind !== 'work' && elapsed >= outcome.at + fizzleRelease * timing.fizzle) {
        // Spat out of the dying portal to its side, and up a little.
        this.place(satellite)
        const [nx, , nz] = frame.normal
        const [tx, , tz] = frame.tangent
        const side = Math.sign(offset.subVectors(satellite.pose.position, offset.fromArray(frame.center)).dot(tangentVector.fromArray(frame.tangent))) || 1
        this.handBack(satellite, [tx * side * 1.7 + nx * 0.3, 1.7, tz * side * 1.7 + nz * 0.3], [3, 2, -2.5], elapsed)
        continue
      }
      if (fusion.emergedAt !== undefined) {
        if (satellite.kind === 'work' && this.launched(satellite)) {
          // The result flips out: the physics has its body at the portal now, so the group returns to it and grows to its size.
          satellite.group.position.set(0, 0, 0)
          satellite.group.quaternion.identity()
          satellite.released = elapsed
          satellite.releasedScale = 0
          satellite.group.scale.setScalar(0)
          continue
        }
        if (satellite.kind === 'prop' && fusion.spec.partner.consumed) {
          // It spiraled into the portal for good and leaves the world, which the director has taken it out of.
          satellite.consumed = true
          this.centers[satellite.orbit.index] = undefined
          continue
        }
        if (satellite.kind === 'prop' && elapsed >= fusion.emergedAt + spitDelay) {
          this.spit(satellite, elapsed)
          continue
        }
      }
      this.place(satellite)
      this.centers[satellite.orbit.index] = satellite.pose.position
    }
    this.updateRemains(elapsed)
  }

  private handBack(satellite: Satellite, velocity: Vec3, spin: Vec3, elapsed?: number) {
    satellite.released = elapsed ?? Number.NEGATIVE_INFINITY
    satellite.releasedScale = satellite.group.scale.x
    if (satellite.kind === 'prop') {
      propObjects.get(satellite.id)?.unleash(velocity, spin)
      return
    }
    // A loose work removed meanwhile, like one the result replaced, has nothing left to hand back.
    if (portraitObjects.get(satellite.id)?.group === satellite.group) {
      handBack(satellite.body, satellite.group, velocity, spin)
    }
  }

  /** Knocks the satellite out from the portal and shakes it, `since` seconds after the player broke the fusion off, which dies down within a second. */
  private jolt({orbit, pose}: Satellite, since: number) {
    // out by up to 7 cm, an eighth of a second after
    const knock = 1.44 * since * Math.exp(-since * 8)
    const shake = 0.05 * Math.exp(-since * 5)
    offset.subVectors(pose.position, offset.fromArray(this.fusion.frame.center)).normalize()
    pose.position.addScaledVector(offset, knock).add(offset.set(Math.sin(since * 61 + orbit.index * 2), Math.sin(since * 53 + orbit.index), Math.sin(since * 67 + orbit.index * 3)).multiplyScalar(shake))
  }

  /** Whether the result’s body has left the work’s spot on the wall for the portal. */
  private launched(satellite: Satellite) {
    const holder = satellite.group.parent
    if (!holder || !satellite.orbit.home) {
      return true
    }
    holder.updateWorldMatrix(true, false)
    return offset.setFromMatrixPosition(holder.matrixWorld).distanceTo(satellite.orbit.home.position) > 0.3
  }

  /** Whether the fusion leaves the remains of the prop it consumes in the world: once its result is out, if the director kept them, as the success did use the prop up. */
  private leavesRemains() {
    const id = this.fusion.spec.partner.remains
    return this.fusion.emergedAt !== undefined && useGallery.getState().remains.some(remains => remains.id === id)
  }

  /** Moves the group to its pose in the world, through its rigid body’s object. */
  private place({group, pose}: Held) {
    matrix.compose(pose.position, pose.quaternion, scaleVector.setScalar(Math.max(pose.scale, 1e-4)))
    const holder = group.parent
    if (holder) {
      holder.updateWorldMatrix(true, false)
      matrix.premultiply(holderInverse.copy(holder.matrixWorld).invert())
    }
    matrix.decompose(group.position, group.quaternion, group.scale)
  }

  /** Takes hold of the work and what was thrown into it, as they are now. */
  private seize() {
    const {spec} = this.fusion
    const list: Array<Satellite> = []
    // The two circle opposite each other, side by side along the wall when the intro hands them to the orbit.
    const phase = -Math.PI / 2 - 0.7
    const portraits = useGallery.getState().portraits
    const {beats} = emberRhythm(spec.latches.length)
    const add = (kind: Satellite['kind'], id: string, body: RapierRigidBody, group: Object3D, scale: number, tumble?: Vector3) => {
      const start = poseOf(group)
      const index = kind === 'work' ? 0 : 1
      list.push({
        kind,
        id,
        body,
        group,
        orbit: {
          beat: beats[index],
          index,
          phase: kind === 'work' ? phase : phase + Math.PI,
          scale,
          start,
          home: kind === 'work' ? start : undefined,
          tumble,
        },
        pose: {
          position: new Vector3,
          quaternion: new Quaternion,
          scale: 1,
        },
        releasedScale: 1,
      })
    }
    const portraitScale = (id: string) => {
      const portrait = portraits.find(candidate => candidate.id === id)
      return portrait ? Math.min(1, satelliteSize / (Math.max(portrait.width, portrait.height) + portraitFrame(portrait.frame).reach * 2)) : 1
    }
    const work = portraitObjects.get(spec.work.id)
    if (work) {
      add('work', spec.work.id, work.body, work.group, portraitScale(spec.work.id))
    }
    const {partner} = spec
    if (partner.kind === 'portrait') {
      const portrait = portraitObjects.get(partner.id)
      if (portrait) {
        add('portrait', partner.id, portrait.body, portrait.group, portraitScale(partner.id))
      }
    } else {
      const prop = propObjects.get(partner.id)
      // The player may have caught it again already.
      if (prop?.seize()) {
        box.setFromObject(prop.group)
        const size = Math.max(...box.getSize(offset))
        add('prop', partner.id, prop.body, prop.group, Math.min(1, propSize / Math.max(size, 1e-3)), tumbleAxis(partner.id))
      }
    }
    return list
  }

  /** Spits what it holds out of the portal toward the room, a little to the side, below the result’s flight, `elapsed` seconds into the fusion, or right away. */
  private spit(held: Held, elapsed?: number) {
    const {center, normal: [nx, , nz], tangent: [tx, , tz]} = this.fusion.frame
    held.pose.position.fromArray(center).add(offset.set(nx * 0.45, -0.25, nz * 0.45))
    held.pose.scale = 0.05
    this.place(held)
    held.released = elapsed ?? Number.NEGATIVE_INFINITY
    held.releasedScale = held.group.scale.x
    propObjects.get(held.id)?.unleash([nx * 2.4 + tx * 0.9, 1.6, nz * 2.4 + tz * 0.9], spitSpin)
  }

  /**
   * Holds the remains of the prop a success consumes in the portal’s middle once they entered the world, held by the portal from the start, too small to cover a pixel but drawn, so their pipelines compile while the portal brews.
   * Once the result is out, they flip out in the prop’s stead, as a prop that wasn’t consumed would; a fusion that didn’t use the prop up never shows them, as the director takes them out of the world again.
   */
  private updateRemains(elapsed: number) {
    const {emergedAt, frame, spec} = this.fusion
    const id = spec.partner.remains
    if (!id) {
      return
    }
    if (!this.remains) {
      const prop = propObjects.get(id)
      if (!prop?.seized()) {
        return
      }
      this.remains = {
        id,
        group: prop.group,
        pose: {
          position: new Vector3(...frame.center),
          quaternion: new Quaternion,
          scale: 0,
        },
        releasedScale: 1,
      }
      this.place(this.remains)
      prop.group.visible = true
    }
    const {remains} = this
    if (remains.released !== undefined) {
      regrow(remains, elapsed)
      return
    }
    if (emergedAt !== undefined && elapsed >= emergedAt + spitDelay && this.leavesRemains()) {
      this.spit(remains, elapsed)
      return
    }
    this.place(remains)
  }
}

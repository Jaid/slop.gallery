import type {DustParticle, HangingPose, HangingStage} from './base/HangingAnimation.ts'
import type {HangingRequest} from './hangings.ts'
import type WallDust from './WallDust.ts'
import type {Object3D} from 'three/webgpu'

import {mulberry32} from 'math/random'
import {Matrix4, Quaternion, Vector3} from 'three/webgpu'

import {frameBack} from '#src/frames/base/PortraitFrame.ts'

import {wobble} from './motion.ts'

/** the dust of the loaded world, which every hanging blows its particles into, if it is mounted */
export const wallDust: {current: WallDust | null} = {current: null}

/** how far from where it hangs a work flies in from at most, in meters */
const throwReach = 1.8
/** how far in front of its wall a work flies in from at least, in meters */
const wallClearance = 0.3
const up = new Vector3(0, 1, 0)
const point = new Vector3
const direction = new Vector3

/**
 * One work arriving on its wall: plays its {@link HangingRequest}’s animation on the work’s frame and placard, frame by frame, and sends its dust flying as it comes loose.
 */
export default class HangingRun {
  readonly stage: HangingStage
  private elapsed = 0
  /** the height of the floor below the work, where its dust settles */
  private readonly floorHeight: number
  /** the work’s frame in the world where it hangs */
  private readonly frame = new Matrix4
  private readonly frameRotation = new Quaternion
  /** the particles of the hanging, in the order they come loose, and how many of them have */
  private readonly particles: Array<DustParticle>
  private readonly pose: HangingPose = {
    position: new Vector3,
    quaternion: new Quaternion,
    scale: new Vector3(1, 1, 1),
  }
  private released = 0

  /** The arrival `request` of a `width` × `height` work in a frame reaching `reach` past its edges and `front` in front of its middle, whose dust settles on the floor at `floor`. */
  constructor(readonly request: HangingRequest, {width, height, reach, front, floor}: {
    floor: number
    front: number
    height: number
    reach: number
    width: number
  }) {
    this.frameRotation.setFromAxisAngle(up, request.rotation)
    this.frame.compose(point.fromArray(request.position), this.frameRotation, direction.set(1, 1, 1))
    const from = new Vector3
    from.fromArray(request.from).applyMatrix4(this.frame.clone().invert())
    // It flies in along the line of sight from the player’s hands, from no farther than a throw away, and seen from along its wall, from far enough in front of it to turn toward the player.
    from.z = Math.max(from.z, 0.01)
    from.setLength(Math.min(from.length(), throwReach))
    from.z = Math.max(from.z, wallClearance)
    const random = mulberry32.create(request.seed)
    this.stage = {
      back: frameBack,
      from,
      front,
      halfHeight: height / 2 + reach,
      halfWidth: width / 2 + reach,
      random: () => mulberry32.sample(random),
      side: from.x < 0 ? -1 : 1,
    }
    this.floorHeight = floor
    this.particles = request.animation.dust(this.stage).toSorted((a, b) => a.delay - b.delay)
  }

  /** whether the work still moves */
  get running() {
    return this.elapsed < this.request.animation.duration
  }

  /** Puts the work’s frame and placard back where they hang, as at the end or when the work is taken off the wall before it settled. */
  settle(art: Object3D | null, placard: Object3D | null) {
    art?.position.set(0, 0, 0)
    art?.quaternion.identity()
    art?.scale.set(1, 1, 1)
    placard?.position.set(0, 0, 0)
    placard?.rotation.set(0, 0, 0)
  }

  /** Moves the hanging along by `delta` seconds, posing the work’s frame `art` and its `placard` and blowing dust into `dust`; returns whether it still runs, or else settles both. */
  update(delta: number, art: Object3D | null, placard: Object3D | null, dust = wallDust.current) {
    this.elapsed += delta
    const {animation} = this.request
    const time = Math.min(this.elapsed, animation.duration)
    const {pose} = this
    pose.position.set(0, 0, 0)
    pose.quaternion.identity()
    pose.scale.set(1, 1, 1)
    animation.pose(time, this.stage, pose)
    art?.position.copy(pose.position)
    art?.quaternion.copy(pose.quaternion)
    art?.scale.copy(pose.scale)
    // The blow jolts the placard: it hops and rocks a little.
    const struck = time - animation.impact
    if (placard && struck >= 0) {
      placard.position.y = 0.012 * animation.jolt * Math.abs(wobble(struck, 24, 8))
      placard.rotation.z = this.stage.side * 0.05 * animation.jolt * wobble(struck, 17, 5.5)
    }
    this.release(dust)
    if (!this.running) {
      this.settle(art, placard)
      return false
    }
    return true
  }

  /** Sends every particle that has come loose by now flying, born when it came loose. */
  private release(dust: WallDust | null) {
    const due: Array<DustParticle> = []
    while (this.released < this.particles.length && this.particles[this.released].delay <= this.elapsed) {
      due.push(this.particles[this.released++])
    }
    if (!dust || due.length === 0) {
      return
    }
    const now = dust.now
    dust.emit(due.map(particle => ({
      ...particle,
      birth: now - (this.elapsed - particle.delay),
      floor: this.floorHeight,
      origin: point.fromArray(particle.origin).applyMatrix4(this.frame).toArray(),
      velocity: direction.fromArray(particle.velocity).applyQuaternion(this.frameRotation).toArray(),
    })))
  }
}

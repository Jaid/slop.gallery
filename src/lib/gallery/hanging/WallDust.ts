import type {DustParticle} from './base/HangingAnimation.ts'

import hsl from 'okhsl'
import {attribute, cameraWorldMatrix, color, cos, exp, float, max, mix, mx_noise_float, positionGeometry, select, sin, smoothstep, uniform, uv, varying, vec2, vec3, vec4} from 'three/tsl'
import {DynamicDrawUsage, InstancedInterleavedBuffer, InstancedMesh, InterleavedBufferAttribute, MeshStandardNodeMaterial, PlaneGeometry} from 'three/webgpu'

import TransparentSpriteOutputsNode from '#src/lib/rendering/TransparentSpriteOutputsNode.ts'

/** a particle as it comes loose, in world meters */
type LooseDust = Omit<DustParticle, 'delay'> & {
  /** the dust clock’s seconds it comes loose at */
  birth: number
  /** the height of the floor it settles on */
  floor: number
}

/** how many particles can be in the air at once; the oldest make way for new ones */
const capacity = 4096
/** where each of a particle’s values lies in its stride of the particle buffer, all of them interleaved into one vertex buffer, as WebGPU allows only 8 */
const layout = {
  origin: [0, 3],
  velocity: [3, 3],
  // birth, life, size, spread
  timing: [6, 4],
  // drag, gravity, floor, opacity
  motion: [10, 4],
  seed: [14, 1],
} as const
const stride = 15

/**
 * Dust that works knock off their walls as they hang, all of them in one instanced draw, flown entirely on the GPU from where and how fast each came loose: slowed by the air, falling or rising and settling on the floor, every puff billowing out as it thins away.
 *
 * Every particle is a quad facing the camera, lit by the scene like a little ball, so dust darkens in shade and catches the lamps. Particles are written into a ring as they come loose, the oldest making way for new ones.
 */
export default class WallDust extends InstancedMesh<PlaneGeometry, MeshStandardNodeMaterial> {
  /** seconds since the dust was made, which every particle flies by */
  readonly clock = uniform(0)
  private readonly buffer = new InstancedInterleavedBuffer(new Float32Array(capacity * stride), stride)
  private next = 0
  /** the clock’s seconds the last particle settles at */
  private settled = Number.NEGATIVE_INFINITY

  constructor() {
    const geometry = new PlaneGeometry(1, 1)
    // The particles are lit through a normal of their own.
    geometry.deleteAttribute('normal')
    const material = new MeshStandardNodeMaterial({
      transparent: true,
      depthWrite: false,
      roughness: 1,
      metalness: 0,
    })
    material.name = 'wall-dust'
    // The soft puffs leave the geometry buffers of what is behind them alone, or the ambient occlusion would darken their quads to blots.
    material.mrtNode = new TransparentSpriteOutputsNode
    super(geometry, material, capacity)
    this.buffer.setUsage(DynamicDrawUsage)
    for (const [name, [offset, size]] of Object.entries(layout)) {
      geometry.setAttribute(`dust${name[0].toUpperCase()}${name.slice(1)}`, new InterleavedBufferAttribute(this.buffer, size, offset))
    }
    // Nothing has come loose yet: every slot died long ago.
    for (let i = 0; i < capacity; i++) {
      this.buffer.array[i * stride + layout.timing[0]] = -1e6
      this.buffer.array[i * stride + layout.timing[0] + 1] = 1
    }
    this.name = 'wall-dust'
    this.castShadow = false
    this.receiveShadow = true
    // The vertex shader places every particle, so the source quad’s bounds say nothing.
    this.frustumCulled = false
    this.raycast = () => {}
    const {clock} = this
    const origin = attribute<'vec3'>('dustOrigin', 'vec3')
    const velocity = attribute<'vec3'>('dustVelocity', 'vec3')
    const timingNode = attribute<'vec4'>('dustTiming', 'vec4')
    const motion = attribute<'vec4'>('dustMotion', 'vec4')
    const seed = attribute<'float'>('dustSeed', 'float')
    const age = clock.sub(timingNode.x)
    const life = timingNode.y
    const progress = age.div(life)
    const alive = progress.greaterThanEqual(0).and(progress.lessThan(1))
    const flown = age.clamp(0, life)
    // Air drag slows it exponentially toward drifting at gravity / drag: v(t) = v₀ e^(−kt) − g / k (1 − e^(−kt)).
    const drag = motion.x.max(0.001)
    const travel = float(1).sub(exp(flown.mul(drag).negate())).div(drag)
    const fall = flown.sub(travel).div(drag)
    // Eddies in the air carry the dust off its path, ever farther, so the cloud frays instead of keeping its shape.
    const eddy = vec3(sin(flown.mul(1.7).add(seed.mul(40))), sin(flown.mul(1.3).add(seed.mul(23))).mul(0.6), cos(flown.mul(1.9).add(seed.mul(31)))).mul(flown.mul(0.07))
    const flight = origin.add(velocity.mul(travel)).sub(vec3(0, motion.y.mul(fall), 0)).add(eddy)
    // Puffs billow out quickly at first, then ever slower.
    const size = select(alive, mix(timingNode.z, timingNode.w, progress.clamp(0, 1).pow(0.45)), float(0))
    const center = vec3(flight.x, max(flight.y, motion.z.add(size.mul(0.4))), flight.z)
    // Puffs turn slowly.
    const angle = seed.mul(Math.PI * 2).add(flown.mul(seed.sub(0.5).mul(1.4)))
    const corner = vec2(positionGeometry.x.mul(cos(angle)).sub(positionGeometry.y.mul(sin(angle))), positionGeometry.x.mul(sin(angle)).add(positionGeometry.y.mul(cos(angle))))
    const right = cameraWorldMatrix.mul(vec4(1, 0, 0, 0)).xyz
    const upward = cameraWorldMatrix.mul(vec4(0, 1, 0, 0)).xyz
    material.positionNode = right.mul(corner.x).add(upward.mul(corner.y)).mul(size).add(center)
    // The quad’s corners in the view’s own axes, from −1 to 1, shading it like a ball facing the camera.
    const facing = varying(corner.mul(2))
    material.normalNode = vec3(facing.mul(0.85), 1).normalize()
    const local = uv().sub(0.5).mul(2)
    const radius = local.length()
    // A puff is a soft, wispy cloud, densest in its middle, that fades out well inside its quad; it swells in quickly and thins away.
    const wisps = mx_noise_float(vec3(local.mul(1.2), seed.mul(37).add(flown.mul(0.25)))).mul(0.5).add(0.5)
    const puff = exp(radius.mul(radius).mul(-4.5)).mul(mix(0.45, 1.3, wisps)).mul(smoothstep(1, 0.8, radius)).mul(smoothstep(0, 0.05, progress)).mul(float(1).sub(progress.clamp(0, 1)).pow(1.4))
    material.colorNode = color(hsl.integer(84, 17, 80))
    material.opacityNode = puff.mul(motion.w)
  }

  /** whether any particle is still in the air */
  get airborne() {
    return this.clock.value < this.settled
  }

  /** the clock’s seconds now, which particles come loose by */
  get now() {
    return this.clock.value
  }

  /** Moves every particle along by `delta` seconds, showing them while any is in the air or, while `warming`, so the pipeline compiles. */
  advance(delta: number, warming = false) {
    this.clock.value += Math.min(delta, 0.1)
    this.visible = warming || this.airborne
  }

  override dispose() {
    this.geometry.dispose()
    this.material.dispose()
    super.dispose()
  }

  /** Sends the particles flying, each from its birth on. */
  emit(particles: Iterable<LooseDust>) {
    const {array} = this.buffer
    let any = false
    for (const particle of particles) {
      const i = this.next * stride
      this.next = (this.next + 1) % capacity
      array.set(particle.origin, i + layout.origin[0])
      array.set(particle.velocity, i + layout.velocity[0])
      array.set([particle.birth, particle.life, particle.size, particle.spread], i + layout.timing[0])
      array.set([particle.drag, particle.gravity, particle.floor, particle.opacity], i + layout.motion[0])
      array[i + layout.seed[0]] = Math.random()
      this.settled = Math.max(this.settled, particle.birth + particle.life)
      any = true
    }
    if (any) {
      this.buffer.needsUpdate = true
    }
  }
}

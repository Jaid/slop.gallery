import {attribute, cameraWorldMatrix, color, float, min, mix, time, uv, vec3, vec4} from 'three/tsl'
import {InstancedBufferAttribute, InstancedMesh, MeshBasicNodeMaterial, PlaneGeometry} from 'three/webgpu'

import TransparentSpriteOutputsNode from '../../rendering/TransparentSpriteOutputsNode.ts'
import fountain, {jetFlightTime, jetLanding, jetPoint, jetVelocity, sheetLanding} from './config.ts'

export type Droplet = {
  /** how fast the drop fades in and out, as a share of its life, large for mist */
  ease: number
  /** opacity of the drop, low for mist */
  opacity: number
  origin: [number, number, number]
  /** diameter in meters */
  size: number
  /** height of the surface the droplet falls back into */
  until: number
  velocity: [number, number, number]
}

const goldenAngle = Math.PI * (3 - Math.sqrt(5))
const goldenRatio = (Math.sqrt(5) - 1) / 2
/** deterministic, evenly spread pseudo-random fractions */
const sequence = (i: number, seed: number) => (i * goldenRatio + seed) % 1
const {gravity, pools, lips, veils, jet, basinNozzles, lilyJets, basinInnerApothem} = fountain
/** the pools a drop can fall into, from the top down, each with the radius of its water */
const landings = [
  [pools.upper, lips.upper.radius - 0.03],
  [pools.lower, lips.lower.radius - 0.03],
  [pools.basin, basinInnerApothem - 0.05],
] as const
const flightTime = (origin: [number, number, number], velocity: [number, number, number], until: number) => (velocity[1] + Math.sqrt(velocity[1] ** 2 + 2 * gravity * (origin[1] - until))) / gravity
/** The first pool below the drop’s origin that it lands inside of; a drop flying past a bowl’s lip falls on into the next one. */
export function dropLanding(origin: [number, number, number], velocity: [number, number, number]) {
  for (const [until, radius] of landings) {
    if (until > origin[1]) {
      continue
    }
    const age = flightTime(origin, velocity, until)
    if (Math.hypot(origin[0] + velocity[0] * age, origin[2] + velocity[2] * age) < radius) {
      return until
    }
  }
  return pools.basin
}

/**
 * The jet’s crown breaks into drops that rain back down; a fine mist drifts off its top. The arcs shed drops along their fall, and where veils, arcs and lily jets land, splashes hop off the pools.
 */
export function fountainDroplets(count = fountain.sprayCount) {
  const rise = jet.speed ** 2 / (2 * gravity)
  const crownSpeed = jet.speed * Math.sqrt(1 - jet.solid)
  const shares = {
    crown: Math.round(count * 0.3),
    mist: Math.round(count * 0.06),
    arcs: Math.round(count * 0.2),
    arcDrops: Math.round(count * 0.16),
    lower: Math.round(count * 0.12),
    upper: Math.round(count * 0.07),
    lilies: Math.round(count * 0.04),
  }
  const droplets: Array<Droplet> = []
  const drop = (origin: [number, number, number], velocity: [number, number, number], size: number, {ease = 0.12, opacity = 0.85} = {}) => {
    droplets.push({
      ease,
      opacity,
      origin,
      size,
      until: dropLanding(origin, velocity),
      velocity,
    })
  }
  /** a splash hopping off a pool at a landing spot */
  const splash = (i: number, radius: number, angle: number, until: number, scatter: number, hop: number, size: number) => {
    const a = sequence(i, 0.13)
    const b = sequence(i * 7, 0.51)
    const outward = (a - 0.4) * scatter
    const tangent = (b - 0.5) * scatter * 0.8
    const origin: [number, number, number] = [Math.cos(angle) * radius, until, -Math.sin(angle) * radius]
    const velocity: [number, number, number] = [Math.cos(angle) * outward + Math.sin(angle) * tangent, hop * (0.5 + a * 0.6), -Math.sin(angle) * outward + Math.cos(angle) * tangent]
    droplets.push({
      ease: 0.1,
      opacity: 0.8,
      origin,
      size: size * (0.7 + b * 0.6),
      until,
      velocity,
    })
  }
  const limit = (total: number, run: (i: number) => void) => {
    for (let i = 0; i < total && droplets.length < count; i++) {
      run(i)
    }
  }
  limit(shares.crown, i => {
    const angle = i * goldenAngle
    const a = sequence(i, 0.13)
    const b = sequence(i * 7, 0.51)
    // Drops leave the crown with the slowed water’s speed, in a cone that widens as the crown breaks up.
    const spread = 0.05 + a ** 1.5 * 0.9
    drop([0, jet.y + rise * jet.solid, 0], [Math.cos(angle) * spread, crownSpeed * (0.45 + b * 0.75), Math.sin(angle) * spread], 0.02 + b * 0.014)
  })
  limit(shares.mist, i => {
    const angle = i * goldenAngle
    const a = sequence(i, 0.29)
    const b = sequence(i * 5, 0.83)
    // Mist hangs around the apex and drifts down slowly, drawn large and faint.
    drop([Math.cos(angle) * a * 0.2, jet.y + rise * (0.9 + b * 0.15), Math.sin(angle) * a * 0.2], [Math.cos(angle) * 0.25, 0.4 + b * 0.5, Math.sin(angle) * 0.25], 0.16 + a * 0.12, {
      ease: 0.45,
      opacity: 0.1,
    })
  })
  const arcLanding = jetLanding(basinNozzles[0].jet)
  const arcLandingRadius = Math.hypot(arcLanding[0], arcLanding[2])
  const arcSpeed = Math.hypot(...jetVelocity(basinNozzles[0].jet, 0))
  limit(shares.arcs, i => {
    const nozzle = basinNozzles[i % basinNozzles.length]
    const a = sequence(i, 0.37)
    // Arcs hit the pool hard, so they throw their splashes onward along the stream.
    splash(i, arcLandingRadius + (a - 0.5) * 0.04, nozzle.angle, pools.lower, 0.9, 1.5, 0.02)
    const last = droplets.at(-1)!
    last.velocity[0] += nozzle.jet.heading[0] * arcSpeed * 0.12
    last.velocity[2] += nozzle.jet.heading[1] * arcSpeed * 0.12
    last.until = dropLanding(last.origin, last.velocity)
  })
  limit(shares.arcDrops, i => {
    const nozzle = basinNozzles[i % basinNozzles.length]
    const a = sequence(i, 0.61)
    const b = sequence(i * 11, 0.23)
    // Past its crest the stream frays, and drops leave it with its own velocity, a little scattered.
    const age = jetFlightTime(nozzle.jet) * (0.55 + a * 0.4)
    const velocity = jetVelocity(nozzle.jet, age)
    const scatter = (b - 0.5) * 0.3
    drop(jetPoint(nozzle.jet, age), [velocity[0] + nozzle.jet.heading[1] * scatter, velocity[1] + a * 0.2, velocity[2] - nozzle.jet.heading[0] * scatter], 0.012 + b * 0.008, {ease: 0.2})
  })
  limit(shares.lower, i => splash(i, sheetLanding(veils.lower) + (sequence(i * 3, 0.7) - 0.5) * 0.03, i * goldenAngle, pools.basin, 0.6, 1.1, 0.012))
  limit(shares.upper, i => splash(i, sheetLanding(veils.upper) + (sequence(i * 3, 0.7) - 0.5) * 0.02, i * goldenAngle, pools.lower, 0.45, 0.9, 0.01))
  const lilyLanding = jetLanding(lilyJets[0].jet)
  limit(shares.lilies, i => splash(i, Math.hypot(lilyLanding[0], lilyLanding[2]), lilyJets[i % lilyJets.length].angle, pools.upper, 0.3, 0.6, 0.008))
  // Whatever rounding left over joins the crown.
  limit(count - droplets.length, i => {
    const angle = (i + 7) * goldenAngle
    drop([0, jet.y + rise * jet.solid, 0], [Math.cos(angle) * 0.3, crownSpeed * 0.8, Math.sin(angle) * 0.3], 0.022)
  })
  return droplets
}

/**
 * Ballistic droplets animated entirely on the GPU, as soft camera-facing discs; no per-frame allocations or React updates.
 *
 * Each drop loops over its own flight with its own phase. It is lit by a simple sky gradient – bright on top – rather than the
 * scene’s lights, so the spray reads against the bright marble without costing a lit material per drop.
 */
export default class FountainSpray extends InstancedMesh<PlaneGeometry, MeshBasicNodeMaterial> {
  constructor(count = fountain.sprayCount) {
    const geometry = new PlaneGeometry(1, 1)
    const droplets = fountainDroplets(count)
    const origins = new Float32Array(count * 3)
    const velocities = new Float32Array(count * 3)
    // phase, lifetime, size, ease
    const motion = new Float32Array(count * 4)
    const opacities = new Float32Array(count)
    for (const [i, {origin, velocity, size, until, ease, opacity}] of droplets.entries()) {
      origins.set(origin, i * 3)
      velocities.set(velocity, i * 3)
      motion.set([sequence(i * 3, 0.37), flightTime(origin, velocity, until), size, ease], i * 4)
      opacities[i] = opacity
    }
    geometry.setAttribute('sprayOrigin', new InstancedBufferAttribute(origins, 3))
    geometry.setAttribute('sprayVelocity', new InstancedBufferAttribute(velocities, 3))
    geometry.setAttribute('sprayMotion', new InstancedBufferAttribute(motion, 4))
    geometry.setAttribute('sprayOpacity', new InstancedBufferAttribute(opacities, 1))
    const material = new MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      fog: false,
      alphaTest: 0.004,
    })
    material.name = 'Fountain spray'
    // The soft disc leaves the geometry buffers of what is behind it alone, or the ambient occlusion would darken the quad to a black blot.
    material.mrtNode = new TransparentSpriteOutputsNode
    const parameters = attribute<'vec4'>('sprayMotion', 'vec4')
    const phase = parameters.x
    const lifetime = parameters.y
    const size = parameters.z
    const ease = parameters.w
    const progress = time.div(lifetime).add(phase).fract()
    const age = progress.mul(lifetime)
    // Drops grow out of the water and shrink as they rejoin it, so none of them pops.
    const scale = min(progress.div(ease), float(1).sub(progress).div(ease)).clamp(0, 1).mul(size)
    // The quad faces the camera: its corners are laid along the camera’s right and up in world space, which the fountain’s own frame is only shifted from.
    const corner = attribute<'vec3'>('position', 'vec3')
    const right = cameraWorldMatrix.mul(vec4(1, 0, 0, 0)).xyz
    const upward = cameraWorldMatrix.mul(vec4(0, 1, 0, 0)).xyz
    material.positionNode = right.mul(corner.x).add(upward.mul(corner.y)).mul(scale)
      .add(attribute<'vec3'>('sprayOrigin', 'vec3'))
      .add(attribute<'vec3'>('sprayVelocity', 'vec3').mul(age))
      .add(vec3(0, -gravity / 2, 0).mul(age.pow(2)))
    const centered = uv().sub(0.5).mul(2)
    const distance = centered.length()
    // A soft disc with a brighter top, as lit from the sky, and a glint off center.
    const disc = float(1).sub(distance).smoothstep(0, 0.6)
    const glint = float(1).sub(centered.sub(vec3(-0.25, 0.3, 0).xy).length().mul(3)).clamp()
    material.colorNode = mix(color('#b9dcd6'), color('#ffffff'), centered.y.mul(0.5).add(0.5).mul(0.7).add(glint))
    material.opacityNode = disc.mul(attribute<'float'>('sprayOpacity', 'float'))
    super(geometry, material, count)
    this.name = 'fountain-spray'
    // Vertex animation exceeds the source quad’s bounds.
    this.frustumCulled = false
  }

  override dispose() {
    this.geometry.dispose()
    this.material.dispose()
    super.dispose()
  }
}

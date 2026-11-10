import {attribute, cross, float, min, mix, normalize, time, vec3} from 'three/tsl'
import {IcosahedronGeometry, InstancedBufferAttribute, InstancedMesh, MeshBasicNodeMaterial} from 'three/webgpu'

import TransparentSpriteOutputsNode from '#src/lib/rendering/TransparentSpriteOutputsNode.ts'

import fountain, {sheetLanding} from './config.ts'

type Droplet = {
  origin: [number, number, number]
  /** fraction of a full drop size */
  size: number
  /** height of the surface the droplet falls back into */
  until: number
  velocity: [number, number, number]
}

const goldenAngle = Math.PI * (3 - Math.sqrt(5))
const goldenRatio = (Math.sqrt(5) - 1) / 2
/** deterministic, evenly spread pseudo-random fractions */
const sequence = (i: number, seed: number) => (i * goldenRatio + seed) % 1

/** A ring where water lands in a pool, and how lively the splash is. */
type Landing = {
  /** how fast its droplets hop, in m/s */
  hop: number
  /** radius of the ring where the water lands */
  radius: number
  /** share of the spray that splashes here */
  share: number
  /** how far they are thrown away from the ring, in m/s */
  spread: number
  /** height of the pool */
  y: number
}

/**
 * The fountain’s droplets: the central jet’s crown breaking into drops, splashes where each veil lands in the pool below and splashes where the eight ring jets come down. Every drop is launched from the surface it falls back into, so none escapes the fountain.
 */
export function fountainDroplets(count = fountain.sprayCount) {
  const {gravity, jet, pools, veils, ringJet, ringJets} = fountain
  const rise = jet.speed ** 2 / (2 * gravity)
  const crownSpeed = jet.speed * Math.sqrt(1 - jet.solid)
  const landings: Array<Landing> = [
    {
      share: 0.18,
      radius: sheetLanding(veils.lower),
      y: pools.basin,
      hop: 0.75,
      spread: 0.22,
    },
    {
      share: 0.13,
      radius: sheetLanding(veils.middle),
      y: pools.lower,
      hop: 0.55,
      spread: 0.18,
    },
    {
      share: 0.09,
      radius: sheetLanding(veils.cup),
      y: pools.middle,
      hop: 0.45,
      spread: 0.15,
    },
  ]
  // Each of the ring jets lets go at its apex; its droplets fall back into the basin around where the jet started.
  const apexRadius = ringJet.radius + ringJet.outward * (ringJet.rise / gravity)
  const apex = ringJet.y + ringJet.rise ** 2 / (2 * gravity)
  const crown = Math.round(count * 0.28)
  const jets = Math.round(count * 0.32)
  const drops: Array<Droplet> = []
  for (let i = 0; i < count; i++) {
    const angle = i * goldenAngle
    const a = sequence(i, 0.13)
    const b = sequence(i * 7, 0.51)
    if (i < crown) {
      const spread = 0.03 + a * 0.26
      drops.push({
        origin: [0, jet.y + rise * jet.solid, 0],
        velocity: [Math.cos(angle) * spread, crownSpeed * (0.5 + b * 0.7), Math.sin(angle) * spread],
        size: 0.9 + b * 0.9,
        until: pools.cup,
      })
      continue
    }
    if (i < crown + jets) {
      const nozzle = Math.floor((i - crown) / jets * ringJets)
      const away = nozzle / ringJets * Math.PI * 2 + (a - 0.5) * 0.5
      const spread = 0.04 + b * 0.2
      drops.push({
        origin: [Math.cos(away) * (apexRadius + (a - 0.5) * 0.03), apex - b * 0.16, Math.sin(away) * (apexRadius + (a - 0.5) * 0.03)],
        velocity: [Math.cos(away) * spread, 0.15 + a * 0.55, Math.sin(away) * spread],
        size: 0.35 + b * 0.5,
        until: pools.basin,
      })
      continue
    }
    // Pick a landing ring by its share of the remaining droplets, in order.
    const budget = i - crown - jets
    let chosen = landings.at(-1)!
    let offset = 0
    for (const landing of landings) {
      const slots = Math.round((count - crown) * landing.share)
      if (budget < offset + slots) {
        chosen = landing
        break
      }
      offset += slots
    }
    const away = angle
    const at = chosen.radius + (b - 0.5) * 0.06
    const outward = chosen.spread * (0.2 + a * 0.8)
    const tangent = (b - 0.5) * chosen.spread
    drops.push({
      origin: [Math.cos(away) * at, chosen.y, Math.sin(away) * at],
      velocity: [Math.cos(away) * outward - Math.sin(away) * tangent, chosen.hop * (0.4 + a * 0.8), Math.sin(away) * outward + Math.cos(away) * tangent],
      size: 0.4 + b * 0.45,
      until: chosen.y,
    })
  }
  return drops
}

/**
 * Ballistic droplets animated entirely on the GPU; no per-frame allocations or React updates.
 *
 * Each drop is a tiny sphere stretched along its own velocity, so fast spray reads as a streak rather than a floating bead, and grows out of the water and shrinks back into it so none of them pops.
 */
export default class LimestoneFountainSpray extends InstancedMesh<IcosahedronGeometry, MeshBasicNodeMaterial> {
  constructor(count = fountain.sprayCount) {
    const geometry = new IcosahedronGeometry(0.0125, 0)
    const drops = fountainDroplets(count)
    const origins = new Float32Array(count * 3)
    const velocities = new Float32Array(count * 3)
    // phase, lifetime, size
    const motions = new Float32Array(count * 3)
    for (const [i, {origin, velocity, size, until}] of drops.entries()) {
      origins.set(origin, i * 3)
      velocities.set(velocity, i * 3)
      const up = velocity[1]
      motions.set([sequence(i * 3, 0.37), (up + Math.sqrt(up ** 2 + 2 * fountain.gravity * (origin[1] - until))) / fountain.gravity, size], i * 3)
    }
    geometry.setAttribute('sprayOrigin', new InstancedBufferAttribute(origins, 3))
    geometry.setAttribute('sprayVelocity', new InstancedBufferAttribute(velocities, 3))
    geometry.setAttribute('sprayMotion', new InstancedBufferAttribute(motions, 3))
    // Bright, unlit water droplets: lit shading would leave the ones in the fountain’s shadow as dark specks.
    const material = new MeshBasicNodeMaterial({
      color: '#f2fffc',
      depthWrite: false,
      opacity: 0.9,
      transparent: true,
    })
    material.name = 'Limestone fountain spray'
    // The drops leave the geometry buffers of what is behind them alone, or the ambient occlusion would darken the air around every one of them.
    material.mrtNode = new TransparentSpriteOutputsNode
    const source = attribute<'vec3'>('position', 'vec3')
    const motion = attribute<'vec3'>('sprayMotion', 'vec3')
    const lifetime = motion.y
    const progress = time.div(lifetime).add(motion.x).fract()
    const age = progress.mul(lifetime)
    // Drops grow out of the water and shrink as they rejoin it, so none of them pops.
    const scale = min(progress.mul(8), float(1).sub(progress).mul(8)).clamp(0, 1).mul(motion.z)
    const direction = normalize(attribute<'vec3'>('sprayVelocity', 'vec3'))
    // A frame around the direction of flight stretches each drop into a short streak.
    const helper = mix(vec3(0, 1, 0), vec3(1, 0, 0), direction.y.abs().min(1))
    const across = normalize(cross(direction, helper))
    const beside = cross(direction, across)
    const shape = across.mul(source.x).add(beside.mul(source.y)).add(direction.mul(source.z.mul(1.9)))
    material.positionNode = shape.mul(scale)
      .add(attribute<'vec3'>('sprayOrigin', 'vec3'))
      .add(attribute<'vec3'>('sprayVelocity', 'vec3').mul(age))
      .add(vec3(0, -fountain.gravity / 2, 0).mul(age.pow(2)))
    super(geometry, material, count)
    this.name = 'fountain-spray'
    // Vertex animation exceeds the source drop’s bounds.
    this.frustumCulled = false
  }

  override dispose() {
    this.geometry.dispose()
    this.material.dispose()
    super.dispose()
  }
}

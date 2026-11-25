import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, Fn, max, mix, mx_noise_float, positionViewDirection, select, sin, time, transformNormalToView, uv, varying, vec2, vec3} from 'three/tsl'

import {bumpNormal} from '../../candidates/deepseek/lib/bumpNormal.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {glints} from '../../lib/glints.ts'
import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const fibers = 96
const twists = 2 * fibers
/** A braided sleeve breathes a little, so the silhouette is not a perfect extrusion. */
const braidPosition = Fn(([tube]: [Node<'vec2'>]) => {
  const {position: p, normal} = knotFrame(tube)
  const ridge = sin(tube.x.mul(TAU * 8).add(tube.y.mul(TAU * 6)).add(0.7)).mul(0.0016)
    .add(sin(tube.x.mul(TAU * 15).sub(tube.y.mul(TAU * 11))).mul(0.0009))
  return p.add(normal.mul(ridge))
})

type Fiber = {
  band: Node<'float'>
  core: Node<'float'>
  detail: Node<'float'>
  height: Node<'float'>
  id: Node<'float'>
  random: Node<'vec3'>
  stripe: Node<'float'>
}

/** One half of the braid: a seamless helical family of round silk fibers. */
function fiberFamily(tube: Node<'vec2'>, direction: -1 | 1): Fiber {
  const phase = tube.y.mul(fibers).add(tube.x.mul(twists * direction))
  const stripe = phase.add(0.5).fract().sub(0.5).abs()
  const footprint = phase.fwidth().max(0.0005)
  const width = footprint.mul(0.85).add(0.14)
  const core = stripe.smoothstep(width.mul(0.54), width).oneMinus()
  const detail = core.mul(footprint.smoothstep(0.18, 0.5).oneMinus())
  const height = stripe.div(width).pow2().oneMinus().max(0).sqrt().mul(0.00072)
  const rawId = phase.add(0.5).floor()
  const id = rawId.mod(fibers).add(fibers).mod(fibers)
  const random = cellNoiseVec3(vec3(id, direction > 0 ? 1.7 : 8.3, 4.2))
  const fibreCoordinate = phase.div(fibers).fract()
  const bandCentre = direction > 0 ? 0.52 : 0.21
  const band = fibreCoordinate.sub(bandCentre).abs().smoothstep(0.048, 0.075).oneMinus()
  return {
    band,
    core,
    detail,
    height,
    id,
    random,
    stripe,
  }
}

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.85)
    this.name = knotData.id
    const tube = uv()
    this.positionNode = braidPosition(tube)
    const epsilon = 0.0004
    const du = braidPosition(tube.add(vec2(epsilon, 0))).sub(braidPosition(tube.sub(vec2(epsilon, 0))))
    const dv = braidPosition(tube.add(vec2(0, epsilon))).sub(braidPosition(tube.sub(vec2(0, epsilon))))
    const surfaceNormal = varying(transformNormalToView(du.cross(dv).normalize())).normalize()
    const {p, grazing, near} = viewerFrame()
    const silkA = fiberFamily(tube, 1)
    const silkB = fiberFamily(tube, -1)
    const baseTint = mix(color(hsl.integer(270, 35, 4.6)), color(hsl.integer(262, 59, 22)), mx_noise_float(p.mul(2.7).add(vec3(2.1, 6.4, 1.3))).mul(0.5).add(0.5).smoothstep(0.2, 0.8))
    const gap = mix(color(hsl.integer(262, 45, 3.3)), baseTint, 0.58)
// A black silk sleeve with a few gold, silver and iridescent blue threads in the weave.
    const bandA = silkA.band
    const goldA = silkA.random.x.smoothstep(0.74, 0.88).max(bandA.mul(0.9))
    const silverA = silkA.random.y.smoothstep(0.54, 0.72)
    const tintA = mix(color(hsl.integer(266, 48, 8)), color(hsl.integer(263, 63, 30)), silkA.random.z.smoothstep(0.1, 0.9))
    const colorA = mix(mix(tintA, color(hsl.integer(82, 73, 84)), goldA), color(hsl.integer(87, 100, 91)), silkA.band.mul(0.55)).add(color(hsl.integer(240, 26, 89)).mul(silverA.mul(0.32)))
    const goldB = silkB.random.x.smoothstep(0.84, 0.93)
    const silverB = silkB.random.y.smoothstep(0.5, 0.7)
    const tintB = mix(color(hsl.integer(265, 47, 7)), color(hsl.integer(303, 49, 21)), silkB.random.z.smoothstep(0.1, 0.9))
    const colorB = mix(mix(tintB, color(hsl.integer(72, 57, 67)), goldB.mul(0.8)), color(hsl.integer(266, 100, 94)), silkB.band.mul(0.4)).add(color(hsl.integer(201, 25, 78)).mul(silverB.mul(0.22)))
    const body = mix(mix(gap, colorA, silkA.detail), colorB, silkB.detail.mul(0.86))
    const macroBand = silkA.band.mul(0.5).add(silkB.band.mul(0.18))
    this.colorNode = mix(body, color(hsl.integer(82, 76, 72)), macroBand)
    const metal = max(max(goldA.mul(silkA.detail), goldB.mul(silkB.detail).mul(0.8)), max(silkA.band.mul(silkA.detail).mul(0.95), silkA.band.mul(0.5)))
    this.metalnessNode = metal
    this.roughnessNode = mix(float(0.34), float(0.14), metal).add(silkA.random.z.mul(0.06))
    this.ior = 1.52
    this.sheen = 0.65
    this.sheenNode = color(hsl.integer(274, 81, 55)).mul(0.7)
    this.sheenRoughness = 0.36
    this.iridescenceNode = float(0.18)
    this.iridescenceIOR = 1.38
    this.iridescenceThicknessNode = float(320)
// The fibers run through the tangent frame, so the two families get opposite anisotropic streaks.
    const anisoA = vec2(1, -2).normalize().mul(0.82)
    const anisoB = vec2(1, 2).normalize().mul(0.82)
    this.anisotropyNode = select(silkA.core.greaterThan(silkB.core), anisoA, anisoB)
// Raised round fibers plus a little loose fuzz; both vanish before they can alias.
    const fuzz = mx_noise_float(p.mul(132).add(vec3(3.4, 1.9, 6.8))).mul(near.mul(0.00022))
    const fiberHeight = max(silkA.height, silkB.height).add(fuzz)
    const detailStrength = silkA.detail.mul(0.95).add(0.14)
    const bump = bumpNormal(fiberHeight, surfaceNormal, detailStrength)
    this.normalNode = bump
    this.clearcoatNormalNode = bump
    const facing = surfaceNormal.dot(positionViewDirection).abs().clamp()
// Light packets climb the individual threads, each fiber running its own slow schedule.
    const packetFrequency = TAU * 3
    const pulsePhaseA = tube.x.mul(packetFrequency).sub(time.mul(1.05)).add(silkA.random.x.mul(TAU))
    const pulsePhaseB = tube.x.mul(packetFrequency).sub(time.mul(0.82)).add(silkB.random.y.mul(TAU))
    const packetA = sin(pulsePhaseA).max(0).pow(14).add(sin(pulsePhaseA.mul(2.3).add(1.7)).max(0).pow(24).mul(0.45))
    const packetB = sin(pulsePhaseB).max(0).pow(16).add(sin(pulsePhaseB.mul(1.7).add(4.1)).max(0).pow(24).mul(0.4))
    const activeA = silkA.random.y.smoothstep(0.2, 0.45).max(silkA.band)
    const activeB = silkB.random.y.smoothstep(0.3, 0.55).max(silkB.band.mul(0.8))
    const pulseA = packetA.mul(activeA).mul(silkA.detail)
    const pulseB = packetB.mul(activeB).mul(silkB.detail)
    const pulseColorA = mix(color(hsl.integer(77, 99, 86)), color(hsl.integer(214, 100, 87)), silkA.random.z)
    const threadPulse = sin(tube.x.mul(TAU * 4).sub(time.mul(1.35)).add(silkA.random.z.mul(TAU))).max(0).pow(14)
    const pulseColorB = mix(color(hsl.integer(209, 100, 88)), color(hsl.integer(309, 100, 74)), silkB.random.z)
    const haloA = silkA.stripe.smoothstep(0.46, 0.02).oneMinus().mul(pulseA).mul(0.28)
    const haloB = silkB.stripe.smoothstep(0.46, 0.02).oneMinus().mul(pulseB).mul(0.28)
    const slowWave = sin(tube.x.mul(TAU * 2).sub(time.mul(0.42))).max(0).pow(6).mul(0.32).mul(body.add(color(hsl.integer(263, 61, 24))).mul(0.55))
    const sparkle = glints(surfaceNormal, 90).mul(metal).mul(near).mul(0.9)
    this.emissiveNode = pulseColorA.mul(pulseA.add(haloA)).add(pulseColorB.mul(pulseB.add(haloB))).mul(near.mul(0.55).add(0.45)).mul(3)
      .add(color(hsl.integer(84, 100, 87.2)).mul(silkA.band.mul(silkA.detail).mul(threadPulse)).mul(1.5))
      .add(slowWave)
      .add(color(hsl.integer(265, 69, 16)).mul(facing.pow(4)).mul(0.14))
      .add(color(hsl.integer(88, 100, 95.5)).mul(sparkle))
      .add(color(hsl.integer(261, 59, 41)).mul(grazing.pow(3)).mul(0.08))
  }
}

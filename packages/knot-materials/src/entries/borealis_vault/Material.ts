import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, interleavedGradientNoise, mix, modelWorldMatrixInverse, mx_noise_float, normalLocal, refract, screenCoordinate, time, vec3, vec4} from 'three/tsl'

import {cellularPoints} from '../../lib/cellularPoints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {liquidNormal} from '../../lib/liquidNormal.ts'
import {starfield} from '../../lib/starfield.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Samples along the refracted view ray through the ice. */
const steps = 18
/** Height of one curtain tier in object units; the knot is about 0.6 tall, so three to four tiers hang in it. */
const tierHeight = 0.17
/**
 * Auroral emission as altitude rises through a curtain: the 557.7 nm oxygen green dominates low and bright,
 * the 630 nm oxygen red glows faintly at the crown, and nitrogen’s 428 nm violet fringes the hem where the fastest electrons strike.
 */
function auroraSpectrum(height: Node<'float'>) {
  const hem = height.smoothstep(0, 0.12).mul(height.smoothstep(0.12, 0.3).oneMinus())
  const green = height.smoothstep(0.02, 0.18).mul(height.smoothstep(0.45, 0.85).oneMinus())
  const crown = height.smoothstep(0.45, 0.78).mul(height.smoothstep(0.82, 0.97).oneMinus())
  return color(hsl.integer(282, 100, 49.3)).mul(hem).mul(0.9).add(color(hsl.integer(150.5, 100, 86.6)).mul(green).mul(1.15)).add(color(hsl.integer(19, 100, 59.8)).mul(crown).mul(0.55))
}
/** Black ice holding a polar sky: aurora curtains hang along a magnetic field inside the glass and ripple in a solar wind, folding over each other as you walk around them. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.7)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const n = normalLocal.normalize()
// The aurora is anchored to the gallery’s up, whatever the knot’s orientation.
    const up = modelWorldMatrixInverse.mul(vec4(0, 1, 0, 0)).xyz.normalize()
    const ray = refract(view.negate(), n, float(1 / 1.31)).normalize()
    const chord = facing.mul(0.24).add(0.02)
    const stepSize = chord.div(steps)
    const jitter = interleavedGradientNoise(screenCoordinate)
// Solar wind: a slow traveling surge brightens the curtains as it passes, every ~9 s.
    const surge = time.mul(0.11)
    let glow: Node<'vec3'> = vec3(0)
    for (let i = 0;i < steps;i++) {
      const q = p.add(ray.mul(stepSize.mul(jitter.add(i))))
      const height = q.dot(up)
// Curtains hang in tiers, each a band of sky with its own wavy hem, so several curtains drape at different heights.
      const horizontal = q.sub(up.mul(height))
      const hemWave = mx_noise_float(horizontal.mul(4.5).add(vec3(0, 0, time.mul(0.05)))).mul(0.045)
      const tierCoord = height.sub(hemWave).div(tierHeight)
      const tier = tierCoord.floor()
      const altitude = tierCoord.fract()
// Curtains are folded sheets: a meandering line in the horizontal plane, extruded upward along the field and different in every tier.
      const tierShift = vec3(tier.mul(3.7), tier.mul(1.3), tier.mul(-2.9))
      const fold = mx_noise_float(horizontal.mul(3.2).add(tierShift).add(vec3(time.mul(0.04), 0, time.mul(-0.03)))).mul(1.8)
      const ripple = mx_noise_float(horizontal.mul(11).add(tierShift).add(vec3(0, altitude.mul(0.6), time.mul(0.25)))).mul(0.4)
      const sheetField = horizontal.x.mul(2.1).add(horizontal.z.mul(1.4)).add(tier.mul(0.37)).mul(5).add(fold).add(ripple)
// Each fold is a thin bright sheet; the noise above moves it, so sheets fold, pleat and drift.
      const sheet = sheetField.sin().abs().oneMinus().pow(12)
// Rays: thin vertical striations along the field lines that flicker independently.
      const rays = mx_noise_float(horizontal.mul(70).add(tierShift).add(vec3(0, 0, time.mul(0.6)))).mul(0.5).add(0.5).pow(2).mul(1.4).add(0.3)
      const pulse = sheetField.mul(0.12).sub(surge.mul(6.28)).add(tier).sin().mul(0.5).add(0.5).pow(3).mul(1.2).add(0.45)
      glow = glow.add(auroraSpectrum(altitude).mul(sheet).mul(rays).mul(pulse))
    }
    glow = glow.div(steps).mul(5.5)
// Stars above the aurora, deep behind it and slightly refracted by the ice.
    const stars = starfield(ray, 32, 0.88).add(starfield(ray.add(7.7), 71, 0.92).mul(intimate.mul(0.7).add(0.3)))
// Air-bubbles and fine fractures frozen into the ice, seen up close.
    const bubbles = cellularPoints(p.sub(view.mul(0.025)).mul(120), 0.05, 0.18, 0.82).mul(intimate)
    const sky = mix(color(hsl.integer(261, 62, 3)), color(hsl.integer(262, 74, 10)), ray.dot(up).mul(0.5).add(0.5))
    this.colorNode = color(hsl.integer(256, 37, 3))
    this.metalness = 0
    this.roughness = 0.04
    this.clearcoat = 1
    this.clearcoatRoughness = 0.008
    this.normalNode = liquidNormal(near.mul(0.6), 0.3)
    this.emissiveNode = glow.mul(facing.mul(0.35).add(0.75)).add(stars.mul(1.6)).add(sky.mul(facing)).add(color(hsl.integer(250, 100, 90)).mul(bubbles).mul(0.35)).add(color(hsl.integer(181, 77, 52)).mul(grazing.pow(4)).mul(0.2))
  }
}

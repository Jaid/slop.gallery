import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, exp, float, mx_noise_float, normalLocal, pmremTexture, positionWorld, refract, time, vec3} from 'three/tsl'

import {cellularPoints} from '../../lib/cellularPoints.ts'
import {cosinePalette} from '../../lib/cosinePalette.ts'
import {knotCurve} from '../../lib/knotCurve.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Optical depth per unit of path length. Blue is absorbed hardest, which leaves the sap warm and gold. */
const absorption = vec3(0.4, 1.6, 4.6)
/** The tube's diameter in knot units, which sets the path length through it. */
const tubeDiameter = 0.26
/** Samples through the sap. Honey streaks and bubbles are evaluated at each one. */
const layers = 8
/** Knot parameters where the flame and the trapped insect sit inside the tube's core. */
const flameAngle = 1.25
const insectAngle = 4.05
/** Sealed resin around a burning candle and a trapped insect. The path through the tube is marched, so depth and parallax are real. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.4)
    this.name = knotData.id
    const {p, view, facing, rim} = viewerFrame()
// One sine cycle per 2 s. Every animated term below is a whole multiple of that frequency, so the loops close.
    const pulse = time.mul(Math.PI).sin()
// Light bends into the sap at the surface, then runs roughly straight through the tube.
    const incident = refract(view.negate(), normalLocal.normalize(), float(1 / 1.55)).normalize()
    const chord = float(tubeDiameter).div(facing.max(0.3))
    let optical: Node<'float'> = float(0)
    let glow: Node<'vec3'> = vec3(0)
    for (let i = 0;i < layers;i++) {
      const t = (i + 0.5) / layers
      const x = p.add(incident.mul(chord.mul(t)))
// Honey streaks: slow density bands that drift over the 2 s loop.
      const swirl = mx_noise_float(x.mul(vec3(2.2, 6.5, 2.2)).add(vec3(0, pulse.mul(0.2), 0))).mul(0.5).add(0.5)
      optical = optical.add(swirl.smoothstep(0.2, 0.8).mul(0.8).add(0.6).div(layers))
// Trapped air: bright specks that glint as their layer comes into view.
      const partial = exp(absorption.mul(chord).mul(-t))
      glow = glow.add(vec3(cellularPoints(x.mul(44), 0.05, 0.2, 0.6)).mul(partial).mul(1.4))
    }
// The candle flame, sitting inside the core. Its flicker is built from whole cycles of 2 s, so it loops.
    const flame = knotCurve(float(flameAngle))
    const alongFlame = flame.sub(p).dot(incident).clamp(0, chord)
    const missFlame = flame.sub(p.add(incident.mul(alongFlame))).length()
    const flicker = time.mul(Math.PI * 3).sin().mul(0.1).add(time.mul(Math.PI * 5).sin().mul(0.07)).add(0.85)
    const flameCore = missFlame.smoothstep(0.004, 0.03).oneMinus()
    const flameHalo = float(0.01).div(missFlame.pow2().add(0.01))
    const flameLight = color(hsl.integer(68, 99, 79.4)).mul(flameHalo.mul(0.5).add(flameCore.mul(2.5)))
    glow = glow.add(flameLight.mul(exp(absorption.mul(chord).mul(-0.5))).mul(flicker))
// The insect: a dark body in the core, ringed by a shimmer of thin-film wing color.
    const insect = knotCurve(float(insectAngle))
    const alongInsect = insect.sub(p).dot(incident).clamp(0, chord)
    const missInsect = insect.sub(p.add(incident.mul(alongInsect))).length()
    const body = missInsect.smoothstep(0.009, 0.014).oneMinus()
    const wings = missInsect.smoothstep(0.012, 0.03).mul(missInsect.smoothstep(0.03, 0.06).oneMinus())
    const wingColor = cosinePalette(missInsect.mul(16).add(pulse.mul(0.1)), [0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [1, 1, 1], [0, 0.33, 0.67])
    const transmittance = exp(absorption.mul(chord).mul(optical).negate()).mul(vec3(1).sub(vec3(body).mul(0.92)))
// What lies behind the sap, seen along the view ray. Roughness 0.03 keeps the softboxes crisp.
    const behind = pmremTexture(environment, positionWorld.sub(cameraPosition).normalize(), float(0.03))
    this.colorNode = color(hsl.integer(49, 74, 12))
    this.metalness = 0
    this.roughness = 0.035
    this.clearcoat = 1
    this.clearcoatRoughness = 0.015
    this.ior = 1.55
    this.emissiveNode = behind.mul(transmittance).mul(0.85)
      .add(glow)
      .add(wingColor.mul(wings).mul(transmittance).mul(0.35))
      .add(color(hsl.integer(59, 100, 75)).mul(rim).mul(0.12))
  }
}

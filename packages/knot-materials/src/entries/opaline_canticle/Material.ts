import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, mx_worley_noise_float, time, vec3} from 'three/tsl'

import {spectralRamp} from '../../candidates/deepseek/lib/spectralRamp.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {filament} from '../../lib/filament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Precious opal: a lattice of silica spheres that diffracts white light back to the eye. Every domain carries its own sphere diameter and lattice orientation, so the stone answers each viewing angle with a different band of the spectrum. The fire lives a little way inside the stone, drifts as you walk around it, and is ground by the fine domain grit into the splintered flashes of play-of-color. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment)
    this.name = knotData.id
    this.envMapIntensity = 0.9
    const {p, view, facing, grazing, near} = viewerFrame()
/** One diffracting layer: light gathered from `depth` behind the surface, split by the local lattice. */
    const playOfColor = (depth: number, scale: number, gain: Node<'float'> | number) => {
      const q = p.sub(view.mul(depth)).mul(scale)
      // Match optical identity to irregular crystal domains instead of cubic grid cells.
      const domain = mx_worley_noise_float(q, 1, 1)
      const identity = cellNoiseVec3(vec3(domain.mul(65_536), 7, 19))
      const lattice = identity.sub(0.5).mul(2).add(vec3(0.013, 0.017, 0.011)).normalize()
      const diameter = identity.z.mul(0.46).add(0.44).mul(time.mul(0.13).add(identity.x.mul(41)).sin().mul(0.05).add(1))
// A slow shiver keeps the fire from ever being perfectly still.
      const shimmer = time.mul(0.21).add(identity.x.mul(24)).sin().mul(0.022)
      const band = lattice.dot(view).abs().add(shimmer).mul(diameter).sub(0.03).mul(1.6)
      const footprint = q.fwidth().length().max(0.0001)
      const resolved = footprint.smoothstep(0.3, 1.3).oneMinus()
      const domainMask = cellularBoundary(q).smoothstep(0.025, footprint.add(0.14))
      const grit = mx_noise_float(q.mul(2.3)).mul(0.5).add(0.5)
      const brilliance = identity.y.smoothstep(0.3, 0.82).mul(0.86).add(0.14)
      return spectralRamp(band).mul(brilliance).mul(grit.smoothstep(0.18, 0.86).mul(0.55).add(0.45)).mul(domainMask).mul(resolved).mul(gain)
    }
    const patch = mx_noise_float(p.mul(2.1)).mul(0.5).add(0.5)
    const play = playOfColor(0.09, 2.7, 0.95).add(playOfColor(0.21, 4.3, 0.26)).add(playOfColor(0.03, 9.5, near.mul(0.45)))
// Large zones of black opal, seams of white potch, and the rare dome of bluish milk.
    const zone = mx_noise_float(p.mul(0.72).add(vec3(3.7, 9.1, 1.3))).mul(0.5).add(0.5)
    const blackOpal = zone.smoothstep(0.14, 0.42)
    const potch = zone.smoothstep(0.84, 1)
    const milk = mix(color(hsl.integer(85, 14, 8)), color(hsl.integer(82, 16, 15)), mx_noise_float(p.mul(5.5)).mul(0.5).add(0.5))
    const body = mix(mix(milk, color(hsl.integer(89, 25, 53)), potch.pow(3)), color(hsl.integer(297, 57, 2)), blackOpal)
// Fractures inside the stone: dark conchoidal cracks that only resolve up close.
    const fracture = filament(mx_noise_float(p.mul(9.5)).mul(0.6).add(mx_noise_float(p.mul(23)).mul(0.22)), 0.012)
// The flash of diffracted light leans toward grazing views, where light travels deepest into the stone.
    const flash = facing.pow(0.6).mul(0.2).add(grazing.pow(1.6).mul(0.62)).add(0.2)
    const fire = play.mul(patch.smoothstep(0.34, 0.64).mul(0.78).add(0.22)).mul(blackOpal.mul(0.9).add(0.5)).mul(flash)
    this.colorNode = body.add(play.mul(0.035))
    this.metalness = 0
    this.roughnessNode = float(0.055).add(mx_noise_float(p.mul(17)).mul(0.03)).add(fracture.mul(near).mul(0.3))
    this.clearcoat = 1
    this.clearcoatRoughnessNode = mx_noise_float(p.mul(11)).mul(0.02).add(0.03)
    this.ior = 1.45
    this.specularIntensity = 1
    this.normalNode = proceduralNormal(fracture.mul(near).mul(0.7).add(mx_noise_float(p.mul(46)).mul(near).mul(0.25)), 0.0009)
    this.emissiveNode = fire.mul(0.72)
      .add(milk.mul(grazing.pow(2.6)).mul(0.25))
      .add(color(hsl.integer(271, 100, 86)).mul(fracture).mul(near).mul(0.05))
  }
}

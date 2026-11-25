import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, normalView, uv, vec3} from 'three/tsl'

import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Urushi, built the long way. Cinnabar is ground into the lacquer and it is opaque, so the piece has no depth at all - but it is laid on thin over a curve, so the light crosses more of it at the silhouette than head on, and the vermilion burns up to an orange there while the belly of every stroke sinks to oxblood. The black underneath only shows where the film has cracked, and the gold dust laid into the wet coats catches the studio and travels as you walk. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.32)
    this.name = knotData.id
    const tube = uv()
    const {p, facing, grazing, near, intimate} = viewerFrame()
// The brush: thirty coats, each one laid along the length of the form and each a little different.
    const stroke = mx_fractal_noise_float(vec3(tube.x.mul(2.2), tube.y.mul(1.1), p.z.mul(3)), 3, 2.1, 0.55).mul(0.5).add(0.5).clamp(0, 1)
    const film = facing.pow(0.75).mul(0.75).add(stroke.mul(0.25))
// The chord through the film decides the pigment you see: oxblood head on, vermilion at the edge.
    const cinnabar = mix(color(hsl.integer(30, 94, 11)), color(hsl.integer(32, 99, 52)), film.pow(1.25))
// Craquelure: the film splitting along the grain, and the black ground showing through the split.
    const crack = opticalLine(cellularBoundary(p.mul(26)), 0.012).mul(near).mul(0.75).add(opticalLine(cellularBoundary(p.mul(58)), 0.007).mul(near).mul(0.4)).clamp()
// Maki-e: gold dust laid into the wet coats, still proud of the surface.
    const gold = glints(normalView, 150).mul(stroke).mul(near.mul(0.5).add(0.5))
    this.colorNode = mix(cinnabar, color(hsl.integer(9, 45, 5)), crack.mul(0.8))
      .add(color(hsl.integer(79, 88, 77)).mul(gold).mul(0.06))
    this.metalnessNode = crack.mul(0.1)
    this.roughnessNode = float(0.18).sub(gold.mul(0.05)).add(crack.mul(0.22)).add(stroke.mul(0.06))
    this.ior = 1.55
    this.clearcoat = 1
    this.clearcoatRoughnessNode = float(0.02).add(crack.mul(0.08))
// The polish is not quite perfect: a thousand small dents from the years of standing still.
    this.normalNode = proceduralNormal(crack.mul(0.0008).add(stroke.mul(0.0002)), 0.3)
    const sheen = mix(color(hsl.integer(38, 100, 63.1)), color(hsl.integer(72, 100, 79.1)), film)
    this.emissiveNode = sheen.mul(grazing.pow(3.2)).mul(0.16)
      .add(color(hsl.integer(89, 100, 92)).mul(gold).mul(0.5))
      .add(color(hsl.integer(52, 99, 71)).mul(crack.oneMinus()).mul(film).mul(intimate.mul(0.4).add(0.2)).mul(0.04))
  }
}

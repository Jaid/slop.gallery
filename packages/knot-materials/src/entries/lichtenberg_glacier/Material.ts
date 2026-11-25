import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection, vec3} from 'three/tsl'

import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import knotData from './data.ts'

/** A slab of cold acrylic holding a Lichtenberg figure in suspension. The bolt is the iso-line through a high-octave fractal noise field, sampled at the surface so the figure stays stable as you orbit; the drama lives in the trapped charge glowing faint electric blue at the centre of every branch and fading into deeper indigo at the tips. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.5)
    this.name = knotData.id
    this.envMapIntensity = 0.3
    const p = positionGeometry
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    const distance = positionView.length()
    const near = distance.smoothstep(1.25, 5.5).oneMinus()
    // ---- bolt field ----
    // A high-octave fractal noise thresholded to a sharp iso-line gives a
    // branching dendritic skeleton that mimics the path of dielectric
    // breakdown across an insulating slab.
    const skeleton = mx_fractal_noise_float(p.mul(5).add(vec3(2.1, 7.7, 13.5)), 5, 2.07, 0.5)
    const width = 0.04
    const bolt = float(1).sub(skeleton.abs().smoothstep(width, width * 0.15))
    // A higher-frequency fork noise gives the bolt small spurs.
    const fork = mx_fractal_noise_float(p.mul(11).add(vec3(11, 23, 41)), 3, 2.31, 0.5)
    const forkMask = fork.smoothstep(0, 0.4).oneMinus().mul(bolt)
    // ---- surface base ----
    // A very dark midnight blue slab so the lightning reads as bright as
    // possible. Slight structural grain breaks up the surface.
    const surfaceNoise = mx_noise_float(p.mul(8)).mul(0.5).add(0.5)
    const surfaceBase = color(hsl.integer(269, 69, 9.5)).mul(surfaceNoise.mul(0.3).add(0.7))
    this.colorNode = surfaceBase
    this.transmission = 0
    this.roughness = 0.45
    this.clearcoat = 0.25
    this.clearcoatRoughness = 0.2
    // ---- emissive ----
    const boltEmissive = color(hsl.integer(251, 100, 89.5)).mul(forkMask).mul(near.mul(0.6).add(0.5)).mul(2.5)
    const haloGlow = mix(color(hsl.integer(267, 50, 34)), color(hsl.integer(273, 53, 7.6)), facing).mul(grazing.pow(2)).mul(0.25)
    this.emissiveNode = boltEmissive.add(haloGlow)
  }
}

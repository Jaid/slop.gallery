import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_fractal_noise_vec3, mx_noise_float, normalLocal, positionGeometry, time, vec3} from 'three/tsl'

import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** The surface of a small, patient star. Continents of near-black basalt – domain-warped Voronoi plates with flat tops, raised in the vertex stage so the silhouette itself is scarred – cover most of the knot, and white fire only escapes through thin, jagged fissures. Temperature is computed, not painted: fissure depth, granule boundaries and slow hot-spots feed one ramp from soot through blood-red to white heat, while the limb flickers with a corona. Up close the plates are rough rock; across the room only the crack-network glows. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.2)
    this.name = knotData.id
    const {p, grazing, near} = viewerFrame()
    const drift = vec3(time.mul(0.012), time.mul(0.007), time.mul(0.005))
// Fractal domain warp plus a fine jitter, so the fracture network runs jagged instead of geometric.
    const warp = mx_fractal_noise_vec3(p.mul(5.5), 3, 2.1, 0.55)
    const boundary = cellularBoundary(p.add(warp.mul(0.055)).mul(8.5).add(drift)).add(mx_noise_float(p.mul(31)).mul(0.018))
    const granuleBoundary = cellularBoundary(p.add(warp.mul(0.03)).mul(25).sub(drift.mul(1.6)))
    const plate = boundary.smoothstep(0.008, 0.08)
    const granule = granuleBoundary.smoothstep(0.01, 0.1)
    const crack = plate.oneMinus()
    const hot = mx_fractal_noise_float(p.mul(3.4).add(drift), 3, 2.1, 0.55).mul(0.5).add(0.5).clamp()
    const temperature = crack.pow(1.3).mul(0.85).add(granule.oneMinus().mul(crack).mul(0.3)).add(hot.mul(0.28))
    let magma = mix(color(hsl.integer(41, 100, 5)), color(hsl.integer(31.7, 100, 41)), temperature.smoothstep(0.1, 0.4))
    magma = mix(magma, color(hsl.integer(45, 100, 65)), temperature.smoothstep(0.4, 0.66))
    magma = mix(magma, color(hsl.integer(79.5, 100, 80)), temperature.smoothstep(0.66, 0.85))
    magma = mix(magma, color(hsl.integer(94, 100, 94.7)), temperature.smoothstep(0.93, 1.08))
    const rock = mx_noise_float(p.mul(9)).mul(0.5).add(0.5)
    const crust = mix(color(hsl.integer(286, 7, 4)), color(hsl.integer(286, 5, 9)), rock.pow(2)).mul(granule.mul(0.2).add(0.85))
    const plateColor = boundary.smoothstep(0.008, 0.035)
    this.colorNode = mix(magma.mul(0.4), crust, plateColor)
    this.metalnessNode = float(0)
    this.roughnessNode = mix(float(0.35), float(1), plateColor)
// Flat plate tops, a sharp drop into the fissure, and fine rock grain when near.
    const height = plate.mul(0.8).add(mx_noise_float(p.mul(38)).mul(0.07).mul(plate).mul(near.mul(0.7).add(0.3))).add(mx_noise_float(p.mul(83)).mul(0.035).mul(plate)).add(mx_noise_float(p.mul(160)).mul(0.02).mul(plate).mul(near)).add(mx_noise_float(p.mul(11)).mul(0.06))
    this.normalNode = proceduralNormal(height, 0.5)
    this.positionNode = positionGeometry.add(normalLocal.mul(plate.mul(0.02).sub(crack.mul(0.01))))
    this.aoNode = mix(float(0.35), float(1), plate)
    const flicker = time.mul(Math.PI).add(hot.mul(TAU)).add(granuleBoundary.mul(3)).sin().mul(0.15).add(0.92)
    const corona = mx_noise_float(p.mul(6.5).add(vec3(time.mul(0.045), 0, 0))).mul(0.5).add(0.5)
    const crackSharp = boundary.smoothstep(0.004, 0.03).oneMinus()
    this.emissiveNode = magma.mul(crackSharp.mul(1.2).add(granule.oneMinus().mul(crackSharp).mul(0.5))).mul(flicker).mul(temperature.mul(1.1).add(0.45)).mul(near.mul(0.15).add(0.95))
      .add(color(hsl.integer(43.8, 100, 65.3)).mul(grazing.pow(4)).mul(corona.mul(0.75).add(0.35)).mul(0.15))
  }
}

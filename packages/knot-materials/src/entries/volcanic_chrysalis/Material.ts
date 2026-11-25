import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, mx_noise_vec3, mx_worley_noise_float, mx_worley_noise_vec3, normalLocal, positionGeometry, time, vec3} from 'three/tsl'

import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** 4. MAGMA CHRYSALIS Tectonic planetary knot where cooling vesicular basalt crust plates split apart. The basalt plates undergo geometric vertex displacement, sinking down into fiery rift canyons where turbulent incandescent convection magma pulses from 1800K to 6000K white-heat. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const {p, near} = viewerFrame()
    // Irregular Voronoi tectonic plates: F2 - F1 approaches zero at cell boundaries.
    // A low-frequency vector warp breaks the remaining cellular regularity without moving the cracks over time.
    const fractureWarp = mx_noise_vec3(p.mul(2.3).add(vec3(17.3, 3.1, 8.7))).mul(0.72)
    const fractureDistances = mx_worley_noise_vec3(p.mul(7.4).add(fractureWarp), 1, 0)
    const fractureBoundary = fractureDistances.y.sub(fractureDistances.x)
    const fissure = fractureBoundary.smoothstep(0.035, 0.16).oneMinus()
    const fissureCore = fractureBoundary.smoothstep(0.012, 0.055).oneMinus()
    // True vertex silhouette displacement: basalt plates lift up while magma chasms sink
    const crustLift = fissure.oneMinus().mul(0.018)
    this.positionNode = positionGeometry.add(normalLocal.mul(crustLift))
    // Multi-octave convective magma flow
    const flow = p.mul(11).add(vec3(time.mul(0.35), time.mul(-0.25), time.mul(0.18)))
    const turbulence = mx_noise_float(flow).mul(0.5).add(mx_noise_float(flow.mul(2.6)).mul(0.25))
    const heat = fissureCore.mul(1.5).add(fissure.mul(0.55)).add(turbulence.mul(0.4)).clamp()
    // Blackbody radiation spectrum (cooling crimson -> bright amber -> thermonuclear white)
    const magmaColor = mix(mix(color(hsl.integer(35, 100, 5.5)), color(hsl.integer(32, 100, 48)), heat.smoothstep(0.08, 0.45)), mix(color(hsl.integer(63, 100, 72.7)), color(hsl.integer(0, 0, 100)), heat.smoothstep(0.65, 1.15)), heat.smoothstep(0.45, 0.85))
    this.colorNode = mix(color(hsl.integer(70, 7, 5)), color(hsl.integer(51, 24, 7)), mx_noise_float(p.mul(22)).mul(0.5).add(0.5))
    this.metalness = 0.08
    this.roughnessNode = mix(float(0.92), float(0.18), fissure)
    this.normalNode = proceduralNormal(fissure.mul(1.8).add(mx_noise_float(p.mul(28)).mul(0.2)), 0.0035)
    // Cooling cinder embers: the nearest Worley feature supplies both a compact round core and a per-site random gate.
    const emberSample = p.mul(45)
    const emberDistance = mx_worley_noise_float(emberSample, 1, 0)
    const emberGate = mx_worley_noise_float(emberSample, 1, 1).smoothstep(0.965, 0.99)
    const emberCore = emberDistance.smoothstep(0.025, 0.12).oneMinus().mul(emberGate)
    const embers = emberCore.mul(color(hsl.integer(35.4, 100, 60.5))).mul(2.5)
    const magmaRadiance = magmaColor.mul(fissure).mul(heat.mul(4.5).add(1.2))
    this.emissiveNode = magmaRadiance.add(embers).mul(near.mul(0.6).add(0.5))
  }
}

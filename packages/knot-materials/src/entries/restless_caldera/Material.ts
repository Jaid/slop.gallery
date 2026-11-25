import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, normalLocal, positionGeometry, time, vec3} from 'three/tsl'

import {fbm} from '../../candidates/space_bunny/lib/fbm.ts'
import {ridgeBand} from '../../candidates/space_bunny/lib/ridgeBand.ts'
import {proceduralNormal} from '../../candidates/space_bunny/lib/surfaceGradient.ts'
import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Crust plates: the boundaries of the cooling surface, at two ages. The plates themselves drift, because the crust is being stretched by the convection still running underneath it. */
function crust(q: Node<'vec3'>, clock: Node<'float'>) {
  const plates = cellularBoundary(q.mul(3.4).add(vec3(clock.mul(0.05), clock.mul(0.02), 0)))
  const young = cellularBoundary(q.mul(9.1).add(vec3(4.4, 1.7, -3.3).add(vec3(clock.mul(0.11), 0, clock.mul(0.07)))))
  return {
    plates,
    seam: ridgeBand(plates, 0, 0.03),
    fracture: ridgeBand(young, 0, 0.028),
  }
}
/** Heat: what is left of the eruption, still radiating through the fissures. */
function heatField(q: Node<'vec3'>, clock: Node<'float'>) {
  const convection = fbm(q.mul(1.7).add(vec3(clock.mul(0.09), clock.mul(-0.06), 0)), 4)
  const pulse = fbm(q.mul(4.6).add(vec3(clock.mul(0.3), 0, clock.mul(0.2))))
// A slow surf: the whole mass breathes, so the glow never settles into a still image.
  const breath = fbm(q.mul(0.8).add(vec3(clock.mul(0.13), clock.mul(0.07), 0)))
  return {
    convection,
    pulse,
    breath,
  }
}
/** Blackbody-ish ramp from dull red to white-hot, in linear light. */
function incandescence(temperature: Node<'float'>) {
  const dull = color(hsl.integer(33, 100, 13))
  const ember = color(hsl.integer(33, 100, 36))
  const orange = color(hsl.integer(43, 98.7, 59))
  const gold = color(hsl.integer(70, 100, 77))
  const white = color(hsl.integer(88, 100, 95))
  const a = mix(dull, ember, temperature.clamp(0, 0.3).div(0.3))
  const b = mix(a, orange, temperature.sub(0.3).clamp(0, 0.3).div(0.3))
  const c = mix(b, gold, temperature.sub(0.6).clamp(0, 0.22).div(0.22))
  return mix(c, white, temperature.sub(0.82).clamp(0, 0.18).div(0.18))
}

/** Basaltic glass still deciding what to be. The crust froze fast, so it is opaque and near-mirror; the light underneath never got the message. Get close and the seams widen, the glow always runs hotter than the glass around it, and the whole mass breathes on a slow convection clock. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.22)
    this.name = knotData.id
    const {p, grazing, near, intimate} = viewerFrame()
    const {seam, fracture, plates} = crust(p, time)
    this.positionNode = positionGeometry.add(normalLocal.mul(seam.mul(-0.6).add(fracture.mul(-0.26)).add(plates.mul(0.05)).mul(knotData.displacement)))
    const {convection, pulse, breath} = heatField(p, time)
// Heat only survives where the crust actually broke. Convection modulates it; it does not create it.
    const openSeam = seam.pow(1.7)
    const heat = openSeam.add(fracture.mul(0.5)).mul(convection.mul(0.9).add(1.15)).mul(pulse.mul(0.3).add(0.85)).clamp(0, 1)
    const temperature = heat.pow(1.6)
    const hot = incandescence(temperature)
    const glass = mix(color(hsl.integer(297, 57, 2)), color(hsl.integer(316, 25, 6)), plates.mul(1.4).clamp(0, 1))
    this.colorNode = mix(glass, hot.mul(0.08), heat.pow(1.4).mul(0.5))
    this.metalness = 0
// The crust is volcanic glass: a hard, tight specular, not a polished mirror.
    this.roughnessNode = float(0.11).add(temperature.mul(0.16)).add(fracture.mul(0.3)).add(plates.mul(0.04))
    this.clearcoat = 0.7
    this.clearcoatRoughnessNode = float(0.06).add(pulse.mul(0.04))
// Vesicles frozen into the glass, and the ropy texture the crust kept while it was still moving.
    const vesicles = fbm(p.mul(120), 2).smoothstep(0.16, 0.26)
    const ropy = fbm(p.mul(7.5).add(convection.mul(2.2)))
    const surface = seam.mul(-0.4).add(fracture.mul(-0.3)).add(vesicles.mul(0.4).mul(near)).add(ropy.mul(0.05).add(pulse.mul(0.02)))
    this.normalNode = proceduralNormal(surface, 0.0016)
// Only the open fissures emit, and the ramp is steep enough that the core is the only thing that whitens.
    this.emissiveNode = incandescence(temperature.pow(0.55)).mul(openSeam.mul(1.35))
      .add(incandescence(temperature.pow(1.2)).mul(fracture).mul(0.45))
      .add(incandescence(temperature.pow(2)).mul(grazing.pow(2)).mul(0.18))
      .add(incandescence(temperature.mul(0.4)).mul(intimate.mul(0.3).add(0.45)).mul(openSeam).mul(0.3))
// The breath travels through the plates, not just the seams: the whole mass is still moving.
      .add(incandescence(heat.mul(0.62)).mul(breath.smoothstep(0.1, 0.32)).mul(heat.pow(2.4)).mul(0.9))
    this.envMapIntensity = 0.22
  }
}

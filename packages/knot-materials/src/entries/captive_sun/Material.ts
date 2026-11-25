import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, normalLocal, time, vec3} from 'three/tsl'

import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {filament} from '../../lib/filament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Two depths of solar granulation. The wide cells are the bright granules and the dark lanes between them; the fine cells only resolve for a close witness. Sampling both from object position keeps every granule nailed to the star while the caller breathes the sample point along a closed, looping drift. */
function granulation(position: Node<'vec3'>, drift: Node<'vec3'>) {
  const laneWide = cellularBoundary(position.mul(12.5).add(drift))
  const laneFine = cellularBoundary(position.mul(30).sub(drift.mul(1.7)))
  const granule = laneWide.smoothstep(0.012, 0.3)
  const fine = laneFine.smoothstep(0.008, 0.22)
  return {
    fine,
    granule,
    laneFine,
    laneWide,
  }
}
/** Blackbody ramp from cooling lane to white-hot granule heart. */
function blackbody(temperature: Node<'float'>) {
  const t = temperature.clamp()
  let shade = mix(color(hsl.integer(33, 100, 14)), color(hsl.integer(34, 100, 33.5)), t.smoothstep(0.05, 0.38))
  shade = mix(shade, color(hsl.integer(40.1, 100, 63)), t.smoothstep(0.34, 0.62))
  shade = mix(shade, color(hsl.integer(68, 100, 76)), t.smoothstep(0.58, 0.8))
  shade = mix(shade, color(hsl.integer(99, 100, 95)), t.smoothstep(0.78, 0.97))
  return shade
}

/** A star held at gallery scale. Granules boil in two depths – wide golden cells with cooling red lanes, and a fine grain that only a close witness earns – while magnetic spots sink and darken the fire. The limb obeys a star’s manners: it reddens and dims toward the edge, then tears into a flickering corona with red prominences crawling along the silhouette. Every drift walks a closed path, so the fire breathes forever without ever repeating a visible jump; drawing near does not change the star, it changes how much of its weather you are allowed to see. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.2)
    this.name = knotData.id
    const {p, facing, grazing, intimate} = viewerFrame()
    const loop = time.mul(Math.PI)
    const drift = vec3(loop.sin().mul(0.22), loop.mul(2).cos().mul(0.16), loop.mul(3).sin().mul(0.12))
    const gran = granulation(p, drift)
    const fineFootprint = p.mul(30).fwidth().length()
    const fineDetail = fineFootprint
      .smoothstep(0.35, 1.05)
      .oneMinus()
      .mul(intimate.mul(0.65).add(0.35))
    const weather = mx_fractal_noise_float(p.mul(2.7).add(drift.mul(0.35)), 4, 2.1, 0.52)
      .mul(0.5)
      .add(0.5)
      .clamp()
    const spotField = mx_fractal_noise_float(p.mul(1.55).add(vec3(7.3, 2.9, 11.7)), 3, 2.1, 0.5)
      .mul(0.5)
      .add(0.5)
      .clamp()
    const spot = spotField.smoothstep(0.63, 0.76)
    const penumbra = spotField.smoothstep(0.52, 0.68)
    const temperature = float(0.05)
      .add(gran.granule.pow(1.6).mul(0.68))
      .add(weather.sub(0.5).mul(0.3))
      .add(gran.fine.mul(0.16).mul(fineDetail))
      .sub(penumbra.mul(0.22))
      .sub(spot.mul(0.5))
      .clamp()
    // Sunspots are true depressions in the fire, rims sunk below the granules.
    this.positionNode = p
      .mul(float(1).add(loop.sin().mul(0.0032)))
      .add(normalLocal.mul(gran.granule.mul(0.0038).sub(spot.mul(0.0012))))
    const height = gran.granule.mul(0.0042).add(gran.fine.mul(0.0011).mul(fineDetail)).sub(spot.mul(0.0016))
    let body = blackbody(temperature)
    body = mix(body, color(hsl.integer(33, 100, 5)), spot.mul(0.45))
    body = mix(body, color(hsl.integer(31, 100, 28)), grazing.mul(0.42)).mul(facing.pow(0.55).mul(0.62).add(0.48))
    const streak = mx_noise_float(p.mul(6.5).add(drift.mul(0.8))).mul(0.5).add(0.5).clamp()
    const flare = loop.mul(2).add(p.y.mul(5)).sin().mul(0.5).add(0.5)
    const rim = grazing.pow(3)
    const corona = color(hsl.integer(72.3, 100, 78.4)).mul(rim.mul(streak.mul(1.4).add(0.7)).mul(flare.mul(0.5).add(0.8)).mul(2.4))
    const prominenceField = mx_noise_float(p.mul(3.4).add(vec3(3.1, 8.4, 1.7)).sub(drift.mul(0.5)))
    const prominence = filament(prominenceField, 0.018).mul(grazing.pow(2))
    this.colorNode = body
    this.metalness = 0
    this.roughness = 1
    this.normalNode = proceduralNormal(height, 1)
    const fire = body.mul(temperature.mul(1.35).add(0.38)).mul(gran.granule.mul(0.38).add(0.72))
    this.emissiveNode = fire
      .add(corona)
      .add(color(hsl.integer(31.7, 100, 61.3)).mul(prominence.mul(2.2)))
      .add(color(hsl.integer(85, 100, 88.5)).mul(temperature.pow(6).mul(1.1)))
  }
}

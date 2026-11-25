import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, time, vec3} from 'three/tsl'

import {fbm} from '../../candidates/space_bunny/lib/fbm.ts'
import {ridgeBand} from '../../candidates/space_bunny/lib/ridgeBand.ts'
import {proceduralNormal} from '../../candidates/space_bunny/lib/surfaceGradient.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A film's optical thickness drifts as liquid drains downhill under gravity: thick at the crown, thinning toward the lowest point, where it finally tears. The field is a live solution, not a texture, so the colours crawl and merge instead of scrolling. */
function filmThickness(q: Node<'vec3'>, clock: Node<'float'>, drainRate = 0.02) {
  const flow = fbm(q.mul(2.2).add(vec3(clock.mul(drainRate), clock.mul(drainRate * 0.6), 0)))
  const drift = fbm(q.mul(5.5).add(vec3(clock.mul(0.05), clock.mul(-0.03), clock.mul(0.02))), 4)
  const ripple = fbm(q.mul(17).add(flow.mul(3.4)))
  return {
    thickness: flow.mul(0.55).add(drift.mul(0.3)).add(ripple.mul(0.15)).mul(0.5).add(0.5),
    ripple,
    drift,
  }
}

/** A soap film has no pigment at all. Every colour here is light that took the long way out through two surfaces and lost a different amount of itself on the way. Tilt the piece and the entire spectrum slides across it; the black bands are where the film got so thin it stopped reflecting anything at all. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.5)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
// The film is two surfaces a wavelength apart, and the light between them is what the eye finally sees.
    const behind = p.sub(view.mul(0.02))
    const {thickness, ripple, drift} = filmThickness(behind, time)
// Optical path grows at grazing incidence, so the fringes crowd and shift exactly where they should.
    const path = thickness.mul(11).add(grazing.mul(3.4)).add(facing.mul(0.4))
    const fringe = spectralColor(path)
// Beyond the first destructive minimum the film goes black: that is the "black film", and it is real.
    const order = path.fract()
    const blackFilm = ridgeBand(order, 0, 0.055)
    const interference = fringe.mul(blackFilm.oneMinus().mul(0.85).add(0.15))
// Plateau borders: the thicker rims where two films meet and drain together.
    const border = fbm(p.mul(6.5).add(drift.mul(4)))
    const rim = ridgeBand(border, 0, 0.1)
    const iris = fbm(p.mul(26))
    this.colorNode = mix(color(hsl.integer(270, 12, 5)), interference.mul(1.25), blackFilm.oneMinus().mul(0.94).add(0.06))
    this.metalness = 0
    this.roughnessNode = float(0.015).add(rim.mul(0.35)).add(iris.mul(0.02))
    this.clearcoat = 1
    this.clearcoatRoughness = 0.01
    this.iridescenceNode = blackFilm.oneMinus()
    this.iridescenceIOR = 1.34
    this.iridescenceThicknessNode = path.mul(760)
    this.normalNode = proceduralNormal(ripple.mul(0.35).add(rim.mul(0.5)).add(iris.mul(0.05).mul(near)), 0.00035)
// Only the thinnest rims and the true black film emit, and only when the studio can reach them at all.
    this.emissiveNode = interference.mul(rim.mul(0.55).add(grazing.mul(0.1))).mul(intimate.mul(0.4).add(0.2))
      .add(color(hsl.integer(273, 100, 91.5)).mul(blackFilm).mul(grazing.pow(2)).mul(0.14))
      .add(spectralColor(path.mul(2.3)).mul(rim).mul(0.2))
  }
}

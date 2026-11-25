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

/** Growth rings: the oyster's slow accretion, warped by the soft tissue that laid it down. The mantle is still metabolising, so the ring spacing breathes — the shell is not finished being an animal. */
function growthRings(q: Node<'vec3'>, clock: Node<'float'>) {
  const warp = fbm(q.mul(1.4).add(vec3(0, clock.mul(0.05), 0)))
  const drift = fbm(q.mul(0.6).add(vec3(8.2, -3.4, 5.1).add(vec3(clock.mul(0.09), 0, clock.mul(-0.06)))), 2).mul(3.4)
  const pulse = fbm(q.mul(2.6).add(vec3(clock.mul(0.16), 0, clock.mul(0.11)))).mul(1.1)
  const radius = q.x.add(q.y.mul(0.3)).add(q.z.mul(0.2)).length().mul(9).add(warp.mul(2.2)).add(drift).add(pulse)
  return {
    rings: ridgeBand(radius.fract().sub(0.5), 0, 0.3),
    radius,
  }
}
/** A radial fracture that only opens where the shell was pulled off its bed. */
function shellFracture(q: Node<'vec3'>, drift: Node<'float'>, clock: Node<'float'>) {
  const crackField = fbm(q.mul(3.4).add(drift.mul(1.1)).add(vec3(clock.mul(0.05), 0, 0)))
  return {
    crack: ridgeBand(crackField, 0, 0.026),
    crackField,
  }
}

/** Mother-of-pearl. Aragonite platelets laid down one season at a time, each a stack of mirrors; the colour is never in the material, only in the light that survives two bounces inside it. Walking around the piece walks the interference across every layer, so the whole surface keeps changing its mind. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.75)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
// The interior seen through the platelets lags the surface: light entering a thicker stack exits displaced.
    const deep = p.sub(view.mul(0.13)).add(vec3(time.mul(0.03), 0, time.mul(-0.02)))
    const {radius} = growthRings(deep, time)
    const {crack, crackField} = shellFracture(p, fbm(p.mul(0.6), 2), time)
// Film thickness is constant across a platelet, but each growth band steps it, and tilt stretches the path.
    const film = radius.mul(1.9).add(crackField.mul(0.7)).add(time.mul(0.015))
    const luster = spectralColor(film)
    const luster2 = spectralColor(film.mul(1.31).add(0.29))
// The organic matrix behind the platelets: warm, dark, and mottled where the mantle tissue was uneven.
    const mottle = fbm(deep.mul(2.4)).mul(0.5).add(0.5)
    const body = mix(color(hsl.integer(52, 12, 4)), color(hsl.integer(56, 26, 12)), mottle)
    const platelet = mix(body, luster.mul(0.7).add(luster2.mul(0.2)), 0.44)
    this.colorNode = mix(platelet, color(hsl.integer(108, 27, 2)), crack.mul(0.85))
    this.metalness = 0
    this.roughnessNode = mix(float(0.05), float(0.26), crack).add(grazing.mul(0.06))
    this.clearcoat = 1
    this.clearcoatRoughnessNode = crack.mul(0.2).add(0.025)
    this.iridescenceNode = facing.oneMinus().mul(0.9)
    this.iridescenceIOR = 1.56
    this.iridescenceThicknessNode = radius.mul(880).add(240)
    this.normalNode = proceduralNormal(crack.mul(-0.5).add(fbm(p.mul(26), 2).mul(0.06).mul(near)), 0.0007)
// Only the seams between platelets and the grazing edge really emit; everything else is reflected.
    this.emissiveNode = luster.mul(crack.mul(0.45).add(grazing.mul(0.14))).mul(intimate.mul(0.22).add(0.08))
      .add(luster2.mul(grazing.pow(3)).mul(0.4))
      .add(color(hsl.integer(81, 100, 96)).mul(crack).mul(0.1))
    this.envMapIntensity = 0.75
  }
}

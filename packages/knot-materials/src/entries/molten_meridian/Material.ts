import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, normalLocal, positionGeometry, time, uv, vec3} from 'three/tsl'

import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** The color of rock remembering, in order, that it was once a star. */
function magmaColor(temperature: Node<'float'>) {
  const cold = color(hsl.integer(29, 76, 5))
  const ember = mix(cold, color(hsl.integer(32, 100, 25)), temperature.smoothstep(0.06, 0.36))
  const flame = mix(ember, color(hsl.integer(35.2, 100, 60.4)), temperature.smoothstep(0.34, 0.64))
  const gold = mix(flame, color(hsl.integer(71, 100, 77.3)), temperature.smoothstep(0.6, 0.86))
  return mix(gold, color(hsl.integer(93, 100, 95.9)), temperature.smoothstep(0.84, 1))
}

/** A cooling lava crust split into dark basalt plates. A second, hotter country glows in the seams below the crust: it parallaxes as you circle, breathes on a slow cycle, and sends a bright meridian of heat travelling around the knot. Lean in and the plates split again into finer, whiter cracks full of sparks. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.38)
    this.name = knotData.id
    const {p, view, rim, near, intimate} = viewerFrame()
    const tube = uv()
    // Basalt plates. This field is also the vertex displacement, so it must
    // stay free of screen-space derivatives: plates lift, seams sink.
    const plateBoundary = cellularBoundary(p.mul(5.2))
    const plateLift = plateBoundary.smoothstep(0.015, 0.42)
    const swell = mx_noise_float(p.mul(2.6)).mul(0.5).add(0.5)
    this.positionNode = positionGeometry.add(normalLocal.mul(plateLift.mul(0.011).add(swell.mul(0.003)).sub(0.0075)))
    // Crack systems at three depths. The deepest is sampled behind the crust
    // along the view ray, so the molten seams genuinely shift under the plates.
    const crustCore = plateBoundary.smoothstep(0.004, 0.045).oneMinus()
    const crustGlow = plateBoundary.smoothstep(0.008, 0.13).oneMinus()
    const deepBoundary = cellularBoundary(p.sub(view.mul(0.06)).mul(5.2))
    const deepGlow = deepBoundary.smoothstep(0.006, 0.1).oneMinus()
    const midCoord = p.mul(12.5).add(vec3(4.7, 9.1, 2.3))
    const midBoundary = cellularBoundary(midCoord)
    const midResolved = midCoord.fwidth().length().smoothstep(0.5, 1.35).oneMinus()
    const midCrack = midBoundary.smoothstep(0.004, 0.07).oneMinus().mul(midResolved).mul(plateLift)
    const fineCoord = p.mul(31).add(vec3(8.4, 1.9, 5.6))
    const fineBoundary = cellularBoundary(fineCoord)
    const fineResolved = fineCoord.fwidth().length().smoothstep(0.5, 1.3).oneMinus()
    const fineCrack = fineBoundary.smoothstep(0.003, 0.05).oneMinus().mul(fineResolved).mul(intimate).mul(plateLift)
    // Heat: a slow breathing field, plus one bright meridian that travels the
    // length of the knot and pools wherever the noise field is already warm.
    const flow = mx_noise_float(p.mul(2.1).add(vec3(time.mul(0.021), time.mul(-0.013), time.mul(0.017)))).mul(0.5).add(0.5)
    const meridianPhase = tube.x.mul(TAU * 2).sub(time.mul(0.55)).add(flow.mul(5))
    const meridian = meridianPhase.sin().mul(0.5).add(0.5).pow(6)
    const breath = time.mul(0.45).add(flow.mul(4.5)).sin().mul(0.5).add(0.5)
    const heat = flow.mul(0.5).add(meridian.mul(0.45)).add(breath.mul(0.3)).clamp()
    const crackEnergy = crustCore.mul(1.2).add(crustGlow.mul(0.55)).add(deepGlow.mul(0.65)).add(midCrack.mul(0.75)).add(fineCrack.mul(1.1)).clamp()
    const temperature = crackEnergy.mul(heat.mul(0.72).add(0.34)).mul(near.mul(0.3).add(0.85)).clamp()
    const magma = magmaColor(temperature)
    // Crust: ash-flecked basalt with occasional glassy obsidian patches that
    // catch the studio as dark mirrors between the glowing seams.
    const ash = mx_fractal_noise_float(p.mul(7.5), 3, 2, 0.5).mul(0.5).add(0.5)
    const glassy = mx_noise_float(p.mul(3.4).add(vec3(11.2, 3.8, 7.4))).mul(0.5).add(0.5).smoothstep(0.58, 0.85)
    const crust = mix(color(hsl.integer(19, 31, 3)), color(hsl.integer(48, 44, 9)), ash)
    const ashen = mix(crust, color(hsl.integer(67, 19, 33)), ash.smoothstep(0.66, 0.96).mul(0.38))
    const baked = mix(ashen, magma.mul(0.32), crustGlow.mul(0.2))
    this.colorNode = mix(baked, color(hsl.integer(0, 0, 3)), glassy.mul(plateLift).mul(0.55))
    this.metalness = 0.04
    this.roughnessNode = float(0.94).sub(glassy.mul(0.55)).sub(crustCore.mul(0.45)).sub(fineCrack.mul(0.2)).clamp(0.16, 0.95)
    this.clearcoatNode = glassy.mul(plateLift).mul(0.75)
    this.clearcoatRoughness = 0.24
    const height = plateLift.mul(0.9).add(ash.mul(0.22)).sub(midCrack.mul(0.35)).sub(fineCrack.mul(0.3)).add(mx_noise_float(p.mul(57)).mul(intimate).mul(0.12))
    const crustNormal = proceduralNormal(height, 0.0016)
    this.normalNode = crustNormal
    // Sparks live only in the seams and only up close; the grazing rim of a
    // seam smoulders even when its floor has cooled.
    const sparks = cellularPoints(p.mul(72), 0.02, 0.17, 0.6).mul(crustGlow.add(midCrack).clamp()).mul(intimate)
    const glint = glints(crustNormal, 150).mul(crustCore).mul(near)
    this.emissiveNode = magma
      .mul(crustCore.mul(2.7).add(crustGlow.mul(0.5)).add(deepGlow.mul(0.45)).add(midCrack.mul(0.95)).add(fineCrack.mul(1.5)))
      .mul(heat.mul(0.45).add(0.72))
      .add(color(hsl.integer(42, 99, 65)).mul(rim).mul(crustGlow).mul(0.5))
      .add(color(hsl.integer(92, 100, 94.7)).mul(sparks).mul(breath.mul(0.8).add(0.7)).mul(1.6))
      .add(color(hsl.integer(74, 100, 89)).mul(glint).mul(0.3))
  }
}

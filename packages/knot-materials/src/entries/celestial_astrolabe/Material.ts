import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, time, uv} from 'three/tsl'

import {cellularPoints} from '../../lib/cellularPoints.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** 1. CELESTIAL ASTROLABE Master-crafted Renaissance astronomical clockwork forged of gilded ormolu brass. Crevices harbor turquoise verdigris patina. Anisotropic radial brushing glides with the view. Close proximity unlocks microscopic graduation ticks, astrolabe reticles, and internal stellar fire. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const {p, facing, grazing, rim, near, intimate} = viewerFrame()
    const tube = uv()
    // Astrolabe graduations and celestial coordinate engravings
    const degreeRings = opticalLine(tube.x.mul(144).fract().sub(0.5), 0.05)
    const degreeFine = opticalLine(tube.x.mul(576).fract().sub(0.5), 0.04).mul(intimate)
    const meridianLines = opticalLine(tube.y.mul(24).fract().sub(0.5), 0.05)
    const reticle = opticalLine(tube.y.mul(4).add(tube.x.mul(48)).fract().sub(0.5), 0.04)
    // Verdigris oxidation in low recesses
    const patinaFractal = mx_fractal_noise_float(p.mul(4.8), 3, 2, 0.5)
    const patinaMask = patinaFractal.mul(0.65).add(grazing.mul(0.25)).smoothstep(0.35, 0.85)
    const patinaColor = mix(color(hsl.integer(176, 71, 25)), color(hsl.integer(170, 89, 69)), mx_noise_float(p.mul(11)).mul(0.5).add(0.5))
    // Gilded Ormolu Brass base with viewing angle warmth
    const brass = mix(color(hsl.integer(73, 77, 45)), color(hsl.integer(93, 100, 90)), facing.mul(0.4).add(0.6))
    const baseColor = mix(brass, patinaColor, patinaMask.mul(0.85))
    // Star cluster coordinates embedded within the dials
    const stars = cellularPoints(p.mul(38), 0.035, 0.2)
    const constellationWeb = opticalLine(mx_noise_float(p.mul(14)).mul(7).sin(), 0.045)
    this.colorNode = baseColor
    this.metalnessNode = patinaMask.oneMinus().mul(0.92)
    this.roughnessNode = mix(float(0.18), float(0.56), patinaMask)
    this.anisotropy = 0.85
    this.anisotropyNode = float(0.85)
    this.clearcoat = 0.45
    this.clearcoatRoughness = 0.08
    const engravedNormal = degreeRings.add(degreeFine).add(meridianLines).add(reticle).mul(0.35).sub(patinaMask.mul(0.25))
    this.normalNode = proceduralNormal(engravedNormal, 0.0018)
    const celestialGlow = color(hsl.integer(93, 100, 92)).mul(stars.mul(2.2).add(constellationWeb.mul(0.6)))
    const starlight = spectralColor(p.y.mul(6).add(time.mul(0.3))).mul(degreeFine).mul(0.8)
    this.emissiveNode = celestialGlow.add(starlight).mul(near.mul(0.7).add(0.4)).add(color(hsl.integer(168, 98.4, 80)).mul(patinaMask).mul(rim).mul(0.15))
  }
}

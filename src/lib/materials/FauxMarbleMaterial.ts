import hsl from 'okhsl'
import {color, float, max, mix, mx_fractal_noise_float, mx_noise_float, positionWorld, vec3} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {heightNormal, line} from './filters.ts'

export type FauxMarble = {
  /** how much of the ground the drifts cover, 0–1 */
  drifts: number
  /** the ground, clouded between these two */
  ground: readonly [number, number]
  /** shifts the pattern, so two marbles on one wall don’t vein alike */
  seed: number
  /** the broad, brush-laid drifts and the fine veins drawn over them */
  veins: readonly [number, number]
}

/** Nero portoro: black, with broad drifts of ochre gold and fine white veins. */
export const portoro: FauxMarble = {
  ground: [hsl.integer(264, 7, 7), hsl.integer(286, 4, 12)],
  veins: [hsl.integer(80, 67, 54), hsl.integer(86, 24, 82)],
  drifts: 0.55,
  seed: 3,
}
/** Giallo antico: warm yellow clouded with ochre, veined in red-brown. */
export const gialloAntico: FauxMarble = {
  ground: [hsl.integer(72, 72, 54), hsl.integer(79, 65, 67)],
  veins: [hsl.integer(44, 72, 34), hsl.integer(36, 75, 24)],
  drifts: 0.35,
  seed: 11,
}

/**
 * Marmo finto, marble painted on plaster or wood the way Pompeian painters did it: a clouded ground, broad drifts laid in diagonally with a loaded brush and feathered at their edges, long fine veins drawn over them with a liner, now thicker, now thinner and broken off here and there, and a waxed finish that is glossier where the brush left more medium.
 *
 * Laid out along walls in world space, x and z along them and y up, so the veins run on across neighboring panels and round corners, and no two walls vein alike.
 */
export default class FauxMarbleMaterial extends MeshPhysicalNodeMaterial {
  constructor({drifts, ground, seed, veins}: FauxMarble) {
    super({
      roughness: 0.4,
      clearcoat: 0.25,
      clearcoatRoughness: 0.3,
      envMapIntensity: 0.6,
    })
    this.name = 'Marmo finto'
    const p = vec3(positionWorld.x.add(positionWorld.z), positionWorld.y, 0).add(seed * 3.7)
    // Turbulence bends otherwise straight diagonal strata into drifts.
    const turbulence = mx_fractal_noise_float(p.mul(vec3(1.1, 2.6, 1.1)), 5)
    const strata = p.x.mul(0.9).add(p.y.mul(2.1)).mul(4.2).add(turbulence.mul(3.2))
    const drift = strata.sin().mul(0.5).add(0.5).smoothstep(1 - drifts * 0.4, 1).mul(mx_noise_float(p.mul(0.7).add(2)).mul(0.5).add(0.5).smoothstep(0.2, 0.6))
    const fineStrata = p.x.mul(-1.3).add(p.y.mul(1.7)).mul(9).add(mx_fractal_noise_float(p.mul(1.3).add(5), 3).mul(2.2))
    const pressure = mx_noise_float(p.mul(2.2).add(8)).mul(0.5).add(0.5)
    const fine = max(line(fineStrata.sin().div(9), 0.0012).mul(pressure.smoothstep(0.35, 0.75)), line(fineStrata.mul(0.5).add(1.3).sin().div(4.5), 0.0007).mul(pressure.smoothstep(0.6, 0.85)))
    const cloud = mx_fractal_noise_float(p.mul(2.6), 4).mul(0.5).add(0.5)
    // Brush strokes run along the wall, leaving more wax in some than in others.
    const strokes = mx_noise_float(p.mul(vec3(2.5, 38, 2.5))).mul(0.5).add(0.5)
    const paint = mix(mix(mix(color(ground[0]), color(ground[1]), cloud), color(veins[0]), drift.mul(0.8)), color(veins[1]), fine.mul(0.75))
    this.colorNode = paint.mul(strokes.mul(0.06).add(0.97))
    this.roughnessNode = float(0.34).add(strokes.mul(0.16))
    this.normalNode = heightNormal(strokes.mul(0.00006).add(drift.mul(0.00003)))
  }
}

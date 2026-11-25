import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_worley_noise_vec3, time, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Cooling basalt plates breathe around a narrow, stubborn river of fire. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.46)
    this.name = knotData.id
    const {p, grazing, near, intimate} = viewerFrame()
    const magmaField = mx_fractal_noise_float(p.mul(2.1).add(vec3(time.mul(0.007), time.mul(-0.005), 0)), 4, 2.1, 0.55)
    const plates = mx_worley_noise_vec3(p.mul(2.6).add(magmaField.mul(0.42)), 1, 0)
    const plateEdge = plates.y.sub(plates.x)
    const plateLine = plateEdge.abs().smoothstep(0.018, 0.06).oneMinus()
    const fissure = cellularBoundary(p.mul(3.9).add(magmaField.mul(0.55)))
    const fissureFoot = fissure.fwidth().max(0.001)
    const fissureResolved = fissureFoot.smoothstep(0.12, 0.55).oneMinus()
    const lava = fissure.abs().smoothstep(0.008, fissureFoot.mul(1.25).add(0.035)).oneMinus().mul(fissureResolved)
    const rock = mx_fractal_noise_float(p.mul(6.2), 3, 2.2, 0.5).mul(0.5).add(0.5)
    const basalt = mix(color(hsl.integer(273, 17, 5)), color(hsl.integer(44, 15, 25)), rock.pow(1.6))
    const hot = mix(color(hsl.integer(31, 98, 28.7)), color(hsl.integer(81, 100, 82.9)), lava.mul(0.78).add(fissure.abs().mul(0.22)))
    const pulse = time.mul(0.7).add(p.x.mul(1.5)).sub(p.z.mul(0.8)).sin().mul(0.5).add(0.5).pow(8)
    const height = plateLine.mul(0.16).add(rock.mul(0.05)).add(lava.mul(-0.1))
    const rockNormal = proceduralNormal(height, 0.0055)
    const ember = lava.mul(pulse.mul(0.5).add(0.5))
    const sparkField = p.mul(28).add(time.mul(0.35))
    const sparkCell = cellNoiseVec3(sparkField.floor())
    const sparkDistance = sparkField.fract().sub(sparkCell.mul(0.5).add(0.25)).length()
    const sparks = sparkDistance.smoothstep(0.06, 0.17).oneMinus().mul(sparkCell.x.smoothstep(0.85, 0.96)).mul(near)
    const heatGlint = glints(rockNormal, 62).mul(near).mul(0.12)
    this.colorNode = basalt.add(hot.mul(ember.mul(0.68))).add(color(hsl.integer(82, 100, 86)).mul(heatGlint.mul(0.3)))
    this.metalness = 0.08
    this.roughnessNode = float(0.84).sub(lava.mul(0.32)).add(plateLine.mul(0.05)).clamp(0.3, 0.95)
    this.clearcoat = 0.05
    this.normalNode = rockNormal
    this.emissiveNode = color(hsl.integer(35.5, 99, 57.5)).mul(ember.mul(0.82)).add(color(hsl.integer(89, 100, 91.4)).mul(sparks.mul(0.3))).add(color(hsl.integer(54, 100, 71.1)).mul(grazing.mul(ember).mul(intimate).mul(0.1)))
  }
}

import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, time, uv, vec3} from 'three/tsl'

import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A cooled lava heart. Charred, ash-crusted stone is split by two generations of cracks; inside them the melt breathes on wandering heat currents, and a slow pulse travels the length of the knot once per exhibition loop. Step closer and the stoked cracks flare whiter, fine branch cracks and floating sparks resolve; step back and only the great fissures smoulder. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.7)
    this.name = knotData.id
    const {p, grazing, near, intimate} = viewerFrame()
    const tube = uv()
    const rock = mx_fractal_noise_float(p.mul(3.2).add(5.1), 4, 2.1, 0.5).mul(0.5).add(0.5)
    const ashMask = rock.smoothstep(0.58, 0.78)
    const glossMask = mx_fractal_noise_float(p.mul(5.3).add(23.7), 3, 2, 0.5).mul(0.5).add(0.5).smoothstep(0.55, 0.8)
// Crack masks from Voronoi borders; width adapts to the pixel footprint so fissures never alias.
    const crackMask = (scale: number, baseWidth: number) => {
      const border = cellularBoundary(p.mul(scale))
      return border.div(border.fwidth().mul(1.4).add(baseWidth)).clamp(0, 1).oneMinus()
    }
    const mainCrack = crackMask(3.3, 0.045)
    const branchCrack = crackMask(8.6, 0.02).mul(intimate.mul(0.8).add(0.25)).mul(rock.smoothstep(0.3, 0.55))
// Heat wanders on a loop-closed current and pulses along the knot's length.
    const drift = vec3(time.mul(Math.PI).cos(), time.mul(Math.PI).sin(), 0).mul(0.22)
    const heatFlow = mx_fractal_noise_float(p.mul(1.5).add(drift).add(9.4), 3, 2, 0.5).mul(0.5).add(0.5)
    const pulse = tube.x.mul(Math.PI * 6).sub(time.mul(Math.PI * 2)).sin().mul(0.5).add(0.5)
    const heat = heatFlow.mul(0.65).add(pulse.mul(0.35)).mul(near.mul(0.55).add(0.75)).clamp(0, 1)
    const ember = mix(color(hsl.integer(33, 100, 53.4)), color(hsl.integer(72.3, 100, 78.4)), heat)
    const molten = mix(ember, color(hsl.integer(95, 100, 95.5)), mainCrack.pow(2).mul(heat))
    const halo = crackMask(3.3, 0.3)
    const sparks = cellularPoints(p.mul(13), 0.03, 0.18, 0.74)
    const twinkle = time.mul(Math.PI * 2).add(rock.mul(24)).sin().mul(0.5).add(0.5)
    const stone = mix(color(hsl.integer(49, 7, 6)), color(hsl.integer(57, 23, 15)), rock)
    const ashen = mix(stone, color(hsl.integer(67, 14, 54.5)), ashMask.mul(0.85))
    this.colorNode = ashen.mul(mainCrack.mul(-0.55).add(1))
    this.metalness = 0.04
    this.roughnessNode = mix(float(0.92), float(0.3), glossMask).add(ashMask.mul(0.05)).sub(mainCrack.mul(0.25)).clamp(0.2, 1)
    this.clearcoatNode = glossMask.mul(0.55)
    this.clearcoatRoughness = 0.22
    this.normalNode = proceduralNormal(rock.mul(0.7).add(mx_fractal_noise_float(p.mul(11), 2, 2, 0.5).mul(0.3)).sub(mainCrack.mul(0.65)), 0.0018)
    this.emissiveNode = color(hsl.integer(33, 100, 21)).mul(halo.pow(2)).mul(heat.mul(0.8).add(0.2)).mul(0.9)
      .add(molten.mul(mainCrack).mul(heat.mul(1.7).add(0.55)).mul(2.1))
      .add(color(hsl.integer(47.5, 100, 68)).mul(branchCrack).mul(heat.mul(1.2).add(0.3)).mul(1.1))
      .add(color(hsl.integer(81, 100, 86)).mul(sparks).mul(twinkle).mul(intimate).mul(1.6))
      .add(color(hsl.integer(35.2, 100, 60.4)).mul(grazing.pow(4)).mul(heatFlow).mul(0.12))
  }
}

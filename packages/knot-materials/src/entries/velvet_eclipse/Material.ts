import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {bitangentLocal, color, float, mix, mx_noise_float, normalViewGeometry, tangentLocal, tangentView, time, uv, vec2, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A velvet pile traps nearly all head-on light. The long fibers only return a bruised color when their combed direction happens to turn into the eye, and a tiny normal tilt prevents a rubbery read. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.42)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const tube = uv()
    const napNoise = mx_noise_float(p.mul(4.1).add(vec3(time.mul(0.012), 0, 0))).mul(0.5).add(0.5)
    const combPhase = tube.x.mul(TAU * 5).add(tube.y.mul(TAU * 3)).add(napNoise.mul(2.7)).add(time.mul(0.07))
    const comb = combPhase.sin().mul(0.5).add(0.5)
    const fiberAngle = tube.x.mul(TAU * 2).sin().mul(0.42).add(tube.y.mul(TAU * 3).cos().mul(0.24)).add(napNoise.sub(0.5).mul(0.8))
    const tangent = vec3(tangentLocal).normalize()
    const bitangent = vec3(bitangentLocal as unknown as Node<'vec3'>).normalize()
    const fiberDirection = tangent.mul(fiberAngle.cos()).add(bitangent.mul(fiberAngle.sin())).normalize()
    const brushed = view.dot(fiberDirection).abs().pow(2.5)
    const fuzzCoordinate = p.mul(58)
    const fuzzVisibility = fuzzCoordinate.fwidth().length().smoothstep(0.42, 1.6).oneMinus()
    const fuzz = mx_noise_float(fuzzCoordinate).mul(0.5).add(0.5).mul(fuzzVisibility).mul(near)
    const napLight = brushed.mul(comb.mul(0.42).add(0.58)).mul(facing.mul(0.18).add(0.82))
    const dusk = mix(color(hsl.integer(264, 100, 0)), color(hsl.integer(317, 61, 4.4)), napNoise.mul(0.24).add(0.025))
    const bloom = mix(color(hsl.integer(315, 63, 7.5)), color(hsl.integer(344, 50, 29)), comb.mul(0.45).add(brushed.mul(0.32)).clamp())
    const silhouetteSheen = grazing.pow(1.35).mul(comb.mul(0.23).add(0.1))
    this.colorNode = mix(dusk, bloom, napLight.mul(0.2).add(silhouetteSheen.mul(0.52)).add(fuzz.mul(intimate).mul(0.02)).clamp())
    this.metalness = 0
    this.roughnessNode = float(0.81).sub(brushed.mul(0.13)).sub(silhouetteSheen.mul(0.12)).add(fuzz.mul(intimate).mul(0.04)).clamp(0.56, 0.9)
    this.sheen = 1
    this.sheenNode = color(hsl.integer(343, 51, 60)).mul(napLight.mul(0.95).add(grazing.pow(1.35).mul(0.56)).clamp())
    this.sheenColor.set(hsl.integer(343, 51, 60))
    this.sheenRoughness = 0.62
    this.anisotropy = 0.32
    this.anisotropyNode = vec2(0.32, 0)
    this.clearcoat = 0
    const normalFuzz = proceduralNormal(fuzz.mul(0.72).add(comb.mul(0.05)), 0.00068)
    const pileTangent = vec3(tangentView).normalize()
    this.normalNode = normalFuzz.add(pileTangent.mul(comb.sub(0.5).mul(0.11))).normalize()
    this.clearcoatNormalNode = normalViewGeometry
  }
}

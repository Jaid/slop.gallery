import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, Fn, mix, mx_noise_float, mx_noise_vec3, mx_worley_noise_vec3, negateOnBackSide, time, transformNormalToView, uv, varying, vec2, vec3} from 'three/tsl'

import {detailNormal} from '../../candidates/muse_wonder/lib/detailNormal.ts'
import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const warpField = (position: Node<'vec3'>) => mx_noise_vec3(position.mul(1.7).add(vec3(3.1, 7.7, 1.3))).mul(0.34).add(mx_noise_vec3(position.mul(6.3).add(vec3(9.4, 1.8, 5.6))).mul(0.13))
const displacedPlate = Fn(([tube]: [Node<'vec2'>]) => {
  const {position, normal} = knotFrame(tube)
  const worley = mx_worley_noise_vec3(position.mul(5.2).add(warpField(position)), 1, 0)
  const gap = worley.y.sub(worley.x)
  const plate = gap.smoothstep(0.008, 0.09)
  const height = plate.mul(0.012).sub(gap.smoothstep(0.004, 0.032).oneMinus().mul(0.005))
  return position.add(normal.mul(height))
})
/** Basalt plates cooling over a living melt. Warped Voronoi plates are truly displaced proud of the tube with the cracks recessed between them, so at a grazing angle the crust lips hide the fire; face them and a slow surge that travels twice around the knot sets the cracks alight, while finer fissures and craggy micro-relief only resolve up close. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.6)
    this.name = knotData.id
    const {p, facing, grazing, near} = viewerFrame()
    const tube = uv()
    this.positionNode = displacedPlate(tube)
    const epsilon = 0.0001
    const du = displacedPlate(tube.add(vec2(epsilon, 0))).sub(displacedPlate(tube.sub(vec2(epsilon, 0))))
    const dv = displacedPlate(tube.add(vec2(0, epsilon))).sub(displacedPlate(tube.sub(vec2(0, epsilon))))
    const displacedNormal = varying(transformNormalToView(du.cross(dv).normalize())).normalize()
    const warp = warpField(p)
    const worley = mx_worley_noise_vec3(p.mul(5.2).add(warp), 1, 0)
    const gap = worley.y.sub(worley.x)
    const crackEdge = gap.fwidth().max(0.0005).mul(1.4).add(0.024)
    const crack = gap.smoothstep(0.004, crackEdge).oneMinus()
    const plate = gap.smoothstep(0.008, 0.09)
    const fissureField = cellularBoundary(p.mul(13.5).add(warp.mul(2)).add(vec3(7.1, 3.7, 11.3)))
    const fissure = fissureField.smoothstep(0.003, fissureField.fwidth().max(0.0005).mul(1.3).add(0.02)).oneMinus().mul(plate).mul(near.mul(0.85).add(0.15))
    const halo = gap.smoothstep(0.015, 0.17).oneMinus()
    const churn = mx_noise_float(p.mul(2.6).add(vec3(time.mul(0.021), time.mul(-0.013), 3.7))).mul(0.5).add(0.5)
    const churnFine = mx_noise_float(p.mul(9).sub(vec3(0, time.mul(0.03), 0))).mul(0.5).add(0.5)
    const surge = tube.x.mul(TAU * 2).sub(time.mul(0.6)).add(churn.mul(1.2)).cos().mul(0.5).add(0.5).pow(7)
    const coreTemp = churn.mul(0.3).add(surge.mul(0.38)).add(crack.mul(0.35)).add(0.1).clamp()
    let ember = mix(color(hsl.integer(34, 100, 9)), color(hsl.integer(31.5, 100, 46)), coreTemp.smoothstep(0.05, 0.42))
    ember = mix(ember, color(hsl.integer(49, 100, 67.9)), coreTemp.smoothstep(0.42, 0.68))
    ember = mix(ember, color(hsl.integer(82, 100, 83)), coreTemp.smoothstep(0.68, 0.86))
    ember = mix(ember, color(hsl.integer(95, 100, 95.5)), coreTemp.smoothstep(0.86, 0.98).mul(0.75))
    const ash = mx_noise_float(p.mul(7.5)).mul(0.5).add(0.5)
    const char = mx_noise_float(p.mul(23).add(vec3(4.4, 1.2, 8.8))).mul(0.5).add(0.5)
    let crust = mix(color(hsl.integer(18, 7, 5)), color(hsl.integer(48, 19, 15)), ash)
    crust = mix(crust, color(hsl.integer(65, 18, 33)), char.mul(plate).mul(0.42))
    crust = mix(crust, color(hsl.integer(46, 100, 3.6)), crack.mul(0.75))
    this.colorNode = crust
    const microHeight = char.mul(0.12).add(churnFine.mul(near).mul(0.07)).add(mx_noise_float(p.mul(55)).mul(near).mul(0.06)).sub(fissure.mul(0.2))
    this.normalNode = detailNormal(displacedNormal, microHeight, 0.09)
    this.clearcoatNormalNode = negateOnBackSide(displacedNormal)
    this.metalness = 0
    this.roughnessNode = mix(char.mul(0.2).add(0.74), float(0.85), crack.max(fissure.mul(0.7)))
    this.clearcoat = 0.05
    this.clearcoatRoughness = 0.5
    this.aoNode = mix(float(0.48), float(1), plate)
    const glow = churn.mul(0.45).add(surge.mul(1.1)).add(0.55)
    this.emissiveNode = ember.mul(crack.mul(glow).add(fissure.mul(glow.mul(0.5))).add(halo.mul(0.13))).mul(facing.mul(0.48).add(0.52)).add(color(hsl.integer(31.6, 100, 58)).mul(grazing.pow(3)).mul(halo).mul(0.08))
  }
}

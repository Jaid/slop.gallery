import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_atan2, positionViewDirection, tangentView, time, uv, vec2, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

function line(field: Node<'float'>, width: number) {
  const footprint = field.fwidth().max(0.0001)
  return field.abs().smoothstep(width, footprint.mul(1.15).add(width)).oneMinus()
}
/** Black cherry velvet embroidered with a procession of eclipsed, many-rayed suns. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.78)
    this.name = knotData.id
    const tube = uv()
    const {facing, grazing, near, intimate} = viewerFrame()
    const row = tube.y.mul(2).floor()
    const tiled = vec2(tube.x.mul(18).add(row.mul(0.5)), tube.y.mul(2))
    const local = tiled.fract().sub(0.5)
    const identityCell = vec2(tube.x.mul(18).floor(), row)
    const random = cellNoiseVec3(vec3(wrapCell(identityCell, vec2(18, 2)), 17.4))
    const angle = mx_atan2(local.y, local.x.add(0.00001)) as unknown as Node<'float'>
    const radius = local.length()
    const rotation = random.x.mul(TAU)
    const rayWave = angle.mul(18).add(rotation).cos().mul(0.5).add(0.5).pow(5)
    const secondRay = angle.mul(36).sub(rotation.mul(0.7)).cos().mul(0.5).add(0.5).pow(9)
    const coronaRadius = rayWave.mul(0.065).add(secondRay.mul(0.025)).add(0.365)
    const outerSun = radius.smoothstep(coronaRadius, coronaRadius.add(radius.fwidth().mul(1.2))).oneMinus()
    const innerVoid = radius.smoothstep(0.185, 0.202).oneMinus()
    const corona = outerSun.mul(innerVoid.oneMinus())
    const haloRing = line(radius.sub(0.245), 0.012)
    const orbit = line(radius.sub(0.41), 0.008).mul(rayWave.mul(0.65).add(0.35))
    const moonOffset = vec2(time.mul(0.085).add(random.y.mul(5)).sin().mul(0.045), time.mul(0.067).add(random.z.mul(7)).cos().mul(0.026))
    const moonRadius = local.sub(moonOffset).length()
    const eclipse = moonRadius.smoothstep(0.165, 0.187).oneMinus()
    const gold = corona.max(haloRing).max(orbit).mul(eclipse.oneMinus()).clamp()
    const umbra = innerVoid.max(eclipse.mul(outerSun)).clamp()
// Two subpixel-safe weave directions settle into smooth velvet from across the room.
    const warp = opticalBands(tube.x.mul(TAU * 720).add(tube.y.mul(TAU * 3).sin().mul(0.8)))
    const weft = opticalBands(tube.y.mul(TAU * 510).add(tube.x.mul(TAU * 3).sin().mul(0.65)))
    const weave = warp.mul(weft).mul(near.mul(0.72).add(0.18))
    const fiberAngle = positionViewDirection.dot(tangentView.normalize()).abs()
    const velvetLift = grazing.pow(1.35).mul(fiberAngle.mul(0.55).add(0.45))
    const cloth = mix(color(hsl.integer(332, 52, 3)), color(hsl.integer(7, 84, 17)), velvetLift.mul(0.7).add(weave.mul(0.09)).clamp())
    const antiqueGold = mix(color(hsl.integer(43, 91, 32)), color(hsl.integer(81, 100, 87.5)), random.z.mul(0.45).add(facing.mul(0.55)))
    let surface: Node<'vec3'> = mix(cloth, antiqueGold, gold)
    surface = mix(surface, color(hsl.integer(303, 100, 1)), umbra.mul(0.94))
    this.colorNode = surface
    this.metalnessNode = gold.mul(0.94)
    this.roughnessNode = mix(float(0.94), float(0.2), gold).sub(weave.mul(0.05)).clamp(0.14, 1)
    this.sheen = 1
    this.sheenColor.set(hsl.integer(9, 89, 46))
    this.sheenRoughness = 0.72
    this.clearcoatNode = gold.mul(0.34)
    this.clearcoatRoughness = 0.12
    this.anisotropy = 0.75
    this.anisotropyNode = vec2(gold.mul(0.72).add(weave.mul(0.2)), 0)
    const embroideryRelief = gold.mul(0.007).add(haloRing.mul(0.003)).sub(umbra.mul(0.0007)).add(warp.sub(0.5).mul(0.00016).mul(near))
    this.normalNode = proceduralNormal(embroideryRelief, 1)
    const orbitingFire = angle.mul(5).sub(time.mul(0.9)).add(rotation).cos().mul(0.5).add(0.5).pow(18)
    const coronaBreath = time.mul(0.52).add(random.x.mul(TAU)).sin().mul(0.14).add(0.86)
    this.emissiveNode = antiqueGold.mul(corona).mul(orbitingFire.mul(1.5).add(0.08)).mul(intimate.mul(0.65).add(0.35)).add(color(hsl.integer(17, 97, 48.4)).mul(haloRing).mul(grazing.pow(2)).mul(coronaBreath).mul(0.16))
  }
}

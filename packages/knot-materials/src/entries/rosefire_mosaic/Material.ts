import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_atan2, mx_noise_float, normalViewGeometry, time, uv, vec2, vec3} from 'three/tsl'

import {tubeRay} from '../../lib/atelier.ts'
import {beads} from '../../lib/beads.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

function solderLine(field: Node<'float'>, width: number) {
  const footprint = field.fwidth().max(0.0001)
  return field.abs().smoothstep(width, footprint.mul(1.25).add(width)).oneMinus()
}
/** Repeating rose windows made from saturated antique glass, raised lead and a parallax flame. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.78)
    this.name = knotData.id
    const tube = uv()
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const row = tube.y.mul(2).floor()
    const tiled = vec2(tube.x.mul(14).add(row.mul(0.5)), tube.y.mul(2))
    const local = tiled.fract().sub(0.5)
    const identityCell = vec2(tube.x.mul(14).floor(), row)
    const wrapped = wrapCell(identityCell, vec2(14, 2))
    const radius = local.length()
    const angle = mx_atan2(local.y, local.x.add(0.0001)) as unknown as Node<'float'>
    const inside = radius.smoothstep(0.455, 0.475).oneMinus()
    const sector = angle.add(Math.PI).div(TAU / 10).floor()
    const radialBand = radius.mul(3).floor()
    const identity = cellNoiseVec3(vec3(wrapped.x.mul(17).add(sector), wrapped.y.mul(23).add(radialBand), sector.mul(7).add(radialBand.mul(13))))
    const spokes = solderLine(angle.mul(10).sin().mul(radius), 0.012).mul(radius.smoothstep(0.09, 0.44))
    const innerRing = solderLine(radius.sub(0.12), 0.012)
    const middleRing = solderLine(radius.sub(0.325), 0.014)
    const outerRing = solderLine(radius.sub(0.465), 0.017)
    const petalBoundary = solderLine(radius.sub(angle.mul(10).cos().mul(0.065).add(0.255)), 0.012)
    const roseLead = spokes.max(innerRing).max(middleRing).max(outerRing).max(petalBoundary).mul(radius.smoothstep(0.49, 0.5).oneMinus())
// Outside each rose, diagonal lead joins neighboring medallions into one continuous window.
    const diagonal = solderLine(local.x.abs().add(local.y.abs()).sub(0.83), 0.014)
    const lead = roseLead.max(diagonal).clamp()
    const ruby = mix(color(hsl.integer(18, 95, 24)), color(hsl.integer(18, 93, 56)), identity.x)
    const sapphire = mix(color(hsl.integer(265, 95, 17)), color(hsl.integer(258.6, 91, 48)), identity.y)
    const amber = mix(color(hsl.integer(37, 98, 38)), color(hsl.integer(84.2, 100, 83)), identity.z)
    const emerald = mix(color(hsl.integer(173, 95, 26)), color(hsl.integer(160, 93, 65)), identity.x.mul(identity.y))
    const cool = mix(ruby, sapphire, identity.y.smoothstep(0.32, 0.68))
    const warm = mix(amber, emerald, identity.x.smoothstep(0.38, 0.72))
    let glassColor = mix(cool, warm, identity.z.smoothstep(0.35, 0.7))
    const cornerTint = cellNoiseVec3(vec3(wrapped, 77.3))
    glassColor = mix(mix(color(hsl.integer(265, 88, 21.5)), color(hsl.integer(7, 88, 29)), cornerTint.x), glassColor, inside)
    const ray = tubeRay()
    const firePoint = tube.sub(ray.mul(0.026))
    const fireNoise = mx_noise_float(p.sub(view.mul(0.04)).mul(11).add(vec3(0, time.mul(0.13), 0))).mul(0.5).add(0.5)
    const flamePhase = firePoint.x.mul(TAU * 5).add(firePoint.y.mul(TAU * 2)).sub(time.mul(0.74)).add(fireNoise.mul(3.2))
    const flame = flamePhase.sin().mul(0.5).add(0.5).pow(5).mul(fireNoise.smoothstep(0.32, 0.82))
    const bubbles = beads(p.sub(view.mul(0.075)).mul(66), 12.5)
    const bubbleMask = bubbles.mask.mul(intimate).mul(lead.oneMinus())
    const litGlass = glassColor.mul(flame.mul(0.38).add(0.82)).add(color(hsl.integer(80, 100, 88.6)).mul(flame).mul(0.08))
    this.colorNode = mix(litGlass, color(hsl.integer(261, 15, 9)), lead).add(color(hsl.integer(161, 24, 90.5)).mul(bubbleMask).mul(0.16))
    this.metalnessNode = lead.mul(0.9)
    this.roughnessNode = mix(float(0.075), float(0.3), lead).add(bubbleMask.mul(0.06))
    this.transmission = 0.34
    this.transmissionNode = lead.oneMinus().mul(0.34)
    this.thicknessNode = lead.oneMinus().mul(0.22).add(0.035)
    this.ior = 1.52
    this.dispersion = 0.09
    this.attenuationColor.set(hsl.integer(31, 48, 79))
    this.attenuationDistance = 0.9
    this.clearcoat = 1
    this.clearcoatRoughness = 0.025
    this.iridescenceNode = lead.oneMinus().mul(grazing.pow(2)).mul(0.22)
    this.iridescenceThicknessNode = identity.z.mul(180).add(150)
    const relief = lead.mul(0.007).add(bubbles.cap.mul(bubbleMask).mul(0.0025)).add(fireNoise.mul(0.0002))
    this.normalNode = proceduralNormal(relief, 1)
    this.clearcoatNormalNode = this.normalNode
    const solderSpark = glints(normalViewGeometry, 135).mul(lead).mul(near).mul(0.8)
    const glassGlow = glassColor.mul(flame.mul(0.78).add(0.3)).mul(lead.oneMinus())
    this.emissiveNode = glassGlow.add(color(hsl.integer(90, 100, 95.6)).mul(solderSpark)).add(color(hsl.integer(270, 100, 62)).mul(grazing.pow(4)).mul(0.055)).add(color(hsl.integer(0, 0, 100)).mul(bubbleMask).mul(facing.pow(5)).mul(0.38))
  }
}

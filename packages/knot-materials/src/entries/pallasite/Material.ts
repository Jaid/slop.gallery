import type {Node, Texture} from 'three/webgpu'

import {color, float, mix, mx_noise_float, mx_noise_vec3, mx_worley_noise_vec3, normalViewGeometry, time, uv, vec3} from 'three/tsl'

import {detailNormal} from '../../candidates/deepseek/lib/detailNormal.ts'
import {ramp} from '../../candidates/deepseek/lib/ramp.ts'
import {tubeMetric} from '../../candidates/deepseek/lib/tubeMetric.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const ridgeLine = (field: Node<'float'>, width: number) => field.abs().div(field.fwidth().mul(1.3).add(width)).oneMinus().clamp()
/**
 * A polished pallasite: a nickel-iron matrix etched into Widmanstätten lamellae,
 * studded with peridot olivine crystals whose fractured interiors catch a green
 * afterglow. Fine Neumann bands and troilite flecks reward a closer look.
 */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.3)
    this.name = knotData.id
    const {facing, grazing, near, intimate} = viewerFrame()
    const metric = tubeMetric(uv())
    const flow = mx_noise_vec3(vec3(metric.mul(2.2), time.mul(0.012))).mul(0.07)
    const q = vec3(metric.add(flow.xy).mul(9.2), 4.1)
    const cells = mx_worley_noise_vec3(q, 1, 0)
    const rnd = cellNoiseVec3(q.floor())
    const rnd2 = cellNoiseVec3(q.floor().add(vec3(5.2, 1.9, 7.7)))
    const crystalGate = rnd.x.smoothstep(0.08, 0.26)
    const warpedDistance = cells.x.add(mx_noise_float(vec3(metric.mul(24), 3.8)).mul(0.035)).max(0)
    const crystal = ramp(warpedDistance, 0.52, 0.34).mul(crystalGate)
    const rim = ramp(warpedDistance.sub(0.49).abs(), 0.055, 0.008).mul(crystalGate)
// Widmanstätten: three long families of lamellae, warped by the fall.
    const etchNoise = mx_noise_float(vec3(metric.mul(3.1), 9.4)).mul(0.7)
    const lamA = metric.x.mul(0.91).add(metric.y.mul(0.42)).mul(89).add(etchNoise.mul(5)).sin()
    const lamB = metric.x.mul(0.5).sub(metric.y.mul(0.87)).mul(77).add(etchNoise.mul(4.1)).sin()
    const lamC = metric.y.mul(101).add(etchNoise.mul(3.7)).sin()
    const lamellae = ramp(lamA.abs().min(lamB.abs()).min(lamC.abs()), 0.09, 0.012)
    const neumann = ridgeLine(mx_noise_float(vec3(metric.x.mul(330), metric.y.mul(180), time.mul(0.01))), 0.01).mul(intimate.mul(0.55).add(0.05))
// Peridot: yellow-green windows with internal fractures and a pale, glassy rim.
    const fracture = ridgeLine(mx_noise_float(vec3(metric.mul(55).add(rnd.xy.mul(12)), 2.3)), 0.007).mul(crystal)
    const crystalDeep = mix(color('#081504'), color('#4e7a10'), rnd.y.mul(0.72).add(0.18))
    const crystalLight = mix(crystalDeep, color('#79a51c'), rnd2.x.mul(0.5).add(facing.mul(0.14)))
    const crystalColor = mix(crystalDeep, crystalLight, crystal.mul(0.66).add(rnd2.x.mul(0.18))).mul(fracture.mul(0.3).oneMinus())
    const inclusion = mx_noise_float(vec3(metric.mul(155), 6.1)).mul(0.5).add(0.5).smoothstep(0.72, 0.9).mul(crystal)
// Metal: cool iron, a dark etch, a bright polished lip around each stone.
    const iron = mix(color('#485055'), color('#aab3b9'), mx_noise_float(vec3(metric.mul(6.2), 2.2)).mul(0.5).add(0.45))
    const etchedIron = iron.mul(lamellae.mul(0.58).oneMinus()).mul(neumann.mul(0.18).oneMinus())
    const troilite = mx_noise_float(vec3(metric.mul(39), time.mul(0.03))).abs().smoothstep(0.72, 0.9).oneMinus()
    const bronze = color('#9b6826').mul(troilite.mul(0.38))
    const metalColor = mix(etchedIron, color('#d7dde0'), rim.mul(0.35)).add(bronze)
    const surface = mix(metalColor, crystalColor, crystal)
    this.colorNode = surface
    this.metalnessNode = mix(float(1), float(0.02), crystal)
    this.roughnessNode = mix(float(0.13).add(lamellae.mul(0.12)).add(neumann.mul(0.05)), float(0.11).add(fracture.mul(0.03)), crystal)
    this.specularIntensityNode = mix(float(0.5), float(0.22), crystal)
    this.clearcoatNode = crystal.mul(0.15)
    this.clearcoatRoughness = 0.09
    const metalHeight = lamellae.mul(0.00035).add(neumann.mul(0.00005))
    const crystalHeight = crystal.mul(0.0011).add(fracture.mul(0.00022)).add(inclusion.mul(0.00015))
    this.normalNode = detailNormal(normalViewGeometry, metalHeight.add(crystalHeight), 1)
    this.aoNode = crystal.mul(0.12).add(crystal.oneMinus().mul(0.05)).add(0.83)
    const greenRim = color('#a6e85a').mul(rim).mul(grazing.pow(2.1)).mul(0.32)
    const innerLight = crystalColor.mul(crystal).mul(facing.mul(0.2).add(0.1))
    const scintilla = mx_noise_float(vec3(metric.mul(120), time.mul(0.6).add(3.2))).abs().smoothstep(0.68, 0.94).oneMinus().mul(crystal).mul(near.mul(0.7).add(0.15))
    const starGlint = color('#e9ffd0').mul(scintilla).mul(0.65)
    const metalGlint = color('#ffffff').mul(lamellae).mul(grazing.pow(3)).mul(0.08)
    this.emissiveNode = innerLight.add(greenRim).add(starGlint).add(metalGlint)
    this.envMapIntensity = 1.1
  }
}

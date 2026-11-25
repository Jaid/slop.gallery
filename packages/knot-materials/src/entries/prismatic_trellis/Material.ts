import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, time, uv, vec2, vec3} from 'three/tsl'

import {fill, stroke} from '../../candidates/gpt_sol/lib/exhibition/coverage.ts'
import {facetNormal, wavelength} from '../../candidates/gpt_sol/lib/exhibition/optics.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import data from './data.ts'

/** Individually cut tesserae with four triangular facets, rounded rims and gold grout. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.1)
    this.name = data.id
    const tube = uv()
    const {grazing, near, facing} = viewerFrame()
    const count = vec2(48, 6)
    const q = tube.mul(count)
    const random = cellNoiseVec3(vec3(wrapCell(q.floor(), count), 108.3)).toVar()
    const local = q.fract().sub(0.5)
    const foot = q.fwidth().length().max(0.00001)
    const edgeDistance = local.x.abs().max(local.y.abs())
    const tile = fill(edgeDistance.sub(0.455), foot).toVar()
    const bevel = edgeDistance.smoothstep(0.35, 0.452).mul(tile).toVar()
    const sector = local.x.abs().sub(local.y.abs()).smoothstep(foot.negate(), foot).toVar()
    const rocking = time.mul(0.27).add(random.z.mul(6.28)).sin().mul(0.035)
    const slopeSize = random.x.mul(0.15).add(0.15).add(rocking)
    const slope = vec2(local.x.sign().mul(sector), local.y.sign().mul(sector.oneMinus())).mul(slopeSize).mul(bevel.mul(-2.7).add(1)).mul(tile).toVar()
    const ruby = mix(color(hsl.integer(1, 71, 29)), color(hsl.integer(8, 72, 57.5)), random.y)
    const jade = mix(color(hsl.integer(187, 94, 43)), color(hsl.integer(160, 71, 77)), random.y)
    const amber = mix(color(hsl.integer(55, 80, 42)), color(hsl.integer(83, 81, 81.5)), random.y)
    const lapis = mix(color(hsl.integer(275, 75, 24)), color(hsl.integer(275, 68, 56)), random.y)
    const cool = mix(jade, lapis, random.x.smoothstep(0.2, 0.45))
    const warm = mix(amber, ruby, random.x.smoothstep(0.72, 0.95))
    const gem = mix(cool, warm, random.x.smoothstep(0.46, 0.58)).toVar()
    const cutLine = stroke(local.x.abs().sub(local.y.abs()), 0.007, foot)
    const inset = stroke(local.x.abs().add(local.y.abs()).sub(0.43), 0.009, foot)
    const gold = color(hsl.integer(85, 58, 65))
    const spectralFlash = wavelength(facing.mul(210).add(random.z.mul(115)).add(395)).mul(grazing.pow(1.7)).toVar()
    const jewel = gem.mul(bevel.mul(-0.28).add(1)).add(spectralFlash.mul(0.12))
    this.colorNode = mix(gold, jewel, tile).mul(cutLine.mul(-0.12).add(1)).add(gold.mul(inset).mul(0.14))
    this.metalnessNode = mix(float(0.88), float(0.58).add(random.z.mul(0.22)), tile)
    this.roughnessNode = float(0.18).add(bevel.mul(0.08)).add(cutLine.mul(0.07)).add(tile.oneMinus().mul(0.14))
    this.normalNode = facetNormal(slope)
    this.clearcoatNode = tile.mul(0.95)
    this.clearcoatRoughness = 0.055
    this.clearcoatNormalNode = facetNormal(slope.mul(0.78))
    this.iridescenceNode = random.y.smoothstep(0.6, 0.9).mul(tile).mul(0.35)
    this.iridescenceThicknessNode = random.x.mul(200).add(300)
    this.aoNode = mix(float(0.55), float(1), tile)
    this.emissiveNode = spectralFlash.mul(inset).mul(near).mul(0.13)
  }
}

import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalLocal, tangentLocal, uv, vec2, vec3} from 'three/tsl'

import {chatoyance, studioLamps} from '../../candidates/mimo/lib/chatoyance.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {filament} from '../../lib/filament.ts'
import {glints} from '../../lib/glints.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

/** Five-harness satin: the warp floats over four of five crossings, which is what gives the cloth its long lustrous floats. Counts stay multiples of five so the weave survives the UV wrap. */
function satinWeave(u: Node<'float'>, v: Node<'float'>, along: number, around: number) {
  const i = u.mul(along)
  const j = v.mul(around)
  const cell = wrapCell(vec2(i.floor(), j.floor()), vec2(along, around))
  const localI = i.fract().sub(0.5)
  const localJ = j.fract().sub(0.5)
  const ridgeWarp = localJ.abs().mul(2).oneMinus().max(0)
  const ridgeWeft = localI.abs().mul(2).oneMinus().max(0)
  const harness = cell.x.add(cell.y.mul(2)).mod(5)
  const warpFloat = harness.smoothstep(3.4, 3.9).oneMinus()
  const top = warpFloat.mul(ridgeWarp).add(warpFloat.oneMinus().mul(ridgeWeft))
  const slub = cellNoiseVec3(vec3(cell.x, cell.y, 1.7))
  return {
    height: top.add(ridgeWarp.mul(ridgeWeft).mul(0.35)).mul(0.006),
    ridge: top,
    slub,
    warpFloat,
  }
}

export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.55)
    this.name = knotData.id
    const {p, view, grazing, near, intimate} = viewerFrame()
    const tube = uv()
    const weave = satinWeave(tube.x, tube.y, 570, 70)
// Two counter-wound gold cords, couched into the satin as a diamond net.
    const cordA = tube.y.mul(6).sub(tube.x.mul(52))
    const cordB = tube.y.mul(6).add(tube.x.mul(52)).add(0.5)
    const gold = filament(cordA.mul(TAU).sin(), 0.34).add(filament(cordB.mul(TAU).sin(), 0.34)).clamp()
    const slub = weave.slub.x.mul(0.08).add(0.96)
    const height = weave.height.add(gold.mul(0.004)).add(mx_noise_float(p.mul(40)).mul(0.0006))
    const surface = proceduralNormal(height, 1.1)
    this.normalNode = surface
    const {glow, hot} = chatoyance(normalLocal, view, tangentLocal, studioLamps, 26)
    const moon = mix(color(hsl.integer(292, 37, 24)), color(hsl.integer(292, 27, 46)), weave.ridge.mul(slub))
    const shadow = color(hsl.integer(293, 52, 9))
    this.colorNode = mix(mix(shadow, moon, weave.ridge.mul(0.75).add(0.25)), color(hsl.integer(81, 86, 65)), gold)
    this.metalnessNode = gold
    this.roughnessNode = mix(float(0.38), float(0.2), weave.ridge).sub(gold.mul(0.12))
// The satin roll: a wide tide of luster that travels across the cloth with the viewer.
    this.sheen = 1
    this.sheenColor.set(hsl.integer(294, 47, 57))
    this.sheenRoughness = 0.3
    this.anisotropy = 0.85
    this.anisotropyRotation = 0
    this.clearcoatNode = gold.mul(0.8).add(0.1)
    this.clearcoatRoughness = 0.1
    this.aoNode = weave.ridge.mul(0.3).add(0.62)
    this.envMapIntensity = 0.7
    const glint = glints(surface, 60).mul(gold)
    this.emissiveNode = color(hsl.integer(293, 100, 86)).mul(hot).mul(weave.ridge).mul(0.45).add(color(hsl.integer(290, 65, 57)).mul(glow).mul(0.12)).add(color(hsl.integer(90, 100, 93)).mul(glint).mul(0.7)).add(color(hsl.integer(91, 100, 97)).mul(hot).mul(near.mul(intimate)).mul(0.3)).add(color(hsl.integer(294, 59, 68)).mul(grazing.pow(2.5)).mul(0.12))
  }
}

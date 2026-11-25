import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, color, float, mix, mx_noise_float, positionGeometry, uv, vec2, vec3} from 'three/tsl'

import {glitter} from '../../candidates/deepseek/lib/glitter.ts'
import {loopTurn} from '../../candidates/deepseek/lib/loopClock.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Distance from the center to the edge of a regular polygon, so stars can be intersected from it. */
const polygonRadius = (angle: Node<'float'>, sides: number, radius: Node<'float'>) => {
  const step = TAU / sides
  return angle.sub(Math.PI / sides).mod(step).sub(step / 2).cos().reciprocal().mul(radius).mul(Math.cos(Math.PI / sides))
}
/** An indigo silk brocade wound around the knot: neps of a 2/2 twill in the ground, gold thread forming eight pointed stars, ribbons and beaded borders, and a shuttle that keeps travelling the length of the cloth, leaving the gold glowing behind it and a bright line just ahead. Thread relief, silk sheen and anisotropy all live in the fabric's own coordinates, so the cloth reads as woven rather than painted, and the weave softly dissolves into flat color once the threads fall below a pixel. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.62)
    this.name = knotData.id
    const {grazing, intimate, near} = viewerFrame()
    const fabric = uv()
    const s = fabric.x.mul(760)
    const t = fabric.y.mul(112)
    const across = s.fract().sub(0.5)
    const down = t.fract().sub(0.5)
    const weftOnTop = s.floor().add(t.floor().mul(2)).mod(4).lessThan(2).select(float(1), float(0))
    const warpRidge = across.abs().mul(-2).add(1).max(0).sqrt()
    const weftRidge = down.abs().mul(-2).add(1).max(0).sqrt()
    const threadRelief = mix(weftRidge.oneMinus(), warpRidge, weftOnTop).oneMinus()
    const motifU = fabric.x.mul(21)
    const motifV = fabric.y.mul(3)
    const cellU = motifU.floor()
    const cellV = motifV.floor()
    const inU = motifU.fract().sub(0.5)
    const inV = motifV.fract().sub(0.5)
    const cellRnd = cellNoiseVec3(vec3(cellU, cellV, 0.37))
    const angle = atan(inV, inU)
    const radius = vec2(inU, inV).length().add(cellRnd.x.sub(0.5).mul(0.04))
    const corners = cellRnd.y.mul(0.06).add(0.3)
    const star = polygonRadius(angle, 4, corners).min(polygonRadius(angle.add(Math.PI / 4), 4, corners.mul(0.58)))
    const outline = radius.sub(star).abs().smoothstep(0.005, 0.02).oneMinus()
    const heart = radius.sub(star.mul(0.66)).smoothstep(0.015, 0.05).oneMinus().mul(cellRnd.z.smoothstep(0.32, 0.6))
    const ribbon = inV.abs().smoothstep(0.03, 0.058).oneMinus()
    const beads = angle.mul(3).cos().abs().mul(0.6).add(0.4)
    const beadRow = inV.abs().sub(0.235).abs().smoothstep(0.015, 0.06).oneMinus().mul(beads.pow(4))
    const border = inV.abs().sub(0.44).abs().smoothstep(0.01, 0.04).oneMinus()
    const brocade = outline.max(heart).max(ribbon.mul(0.92)).max(beadRow.mul(0.75)).max(border).clamp()
    const threadFilter = s.fwidth().max(t.fwidth())
    const woven = threadFilter.smoothstep(0.3, 0.85).oneMinus()
    const fibers = mx_noise_float(vec3(across.mul(24), down.mul(3), t.mul(0.06))).mul(0.5).add(0.5)
    const fibreDetail = fibers.mul(intimate.mul(0.8).add(0.2)).mul(woven)
    const fuzz = glitter(positionGeometry, 0.0021, 40, 0.9)
    // Fuzz is made of isolated fibres, not reflective boxes covering whole lattice cells.
    const fuzzCoord = positionGeometry.div(0.0021)
    const fuzzCenter = cellNoiseVec3(fuzzCoord.floor()).mul(0.5).add(0.25)
    const fuzzRadius = fuzzCoord.fwidth().length().add(0.18).min(0.24)
    const fuzzCoverage = fuzzCoord.fract().sub(fuzzCenter).length().smoothstep(0.06, fuzzRadius).oneMinus()
    const fuzzMask = fuzz.sparkle.mul(fuzzCoverage).mul(intimate)
    const cloth = mx_noise_float(vec3(fabric.x.mul(34), fabric.y.mul(9), 0)).mul(0.5).add(0.5)
    const silkGround = mix(color(hsl.integer(291, 56, 7)), color(hsl.integer(291, 61, 15)), cloth.mul(0.6).add(0.2))
    const silkWeave = mix(silkGround, silkGround.mul(1.6), weftOnTop.mul(woven))
    const accent = cellRnd.z.smoothstep(0.34, 0.66)
    const silk = mix(silkWeave, mix(color(hsl.integer(267, 78, 25)), color(hsl.integer(29, 84, 35)), accent), heart.mul(0.85))
    const gold = mix(color(hsl.integer(76, 77, 59)), color(hsl.integer(84, 73, 84)), cellRnd.x.mul(0.45).add(fibreDetail.mul(0.3)))
    this.colorNode = mix(silk, gold, brocade.mul(0.94)).add(color(hsl.integer(293, 56, 31)).mul(fibreDetail.mul(0.16)))
    this.sheenNode = mix(float(0.14), float(0.45), brocade)
    this.sheenColor.set(hsl.integer(290, 100, 73))
    this.sheenRoughness = 0.28
    this.metalnessNode = brocade.mul(woven)
    this.roughnessNode = mix(float(0.55).sub(intimate.mul(0.08)), float(0.2), brocade).add(fibreDetail.mul(0.08)).clamp(0.12, 0.68)
    this.anisotropyNode = vec2(weftOnTop.oneMinus(), weftOnTop).mul(woven.mul(mix(float(0.35), float(0.62), brocade)))
    this.iridescence = 0.22
    this.iridescenceThicknessNode = cellRnd.x.mul(300).add(280)
    const reliefHeight = mix(threadRelief, brocade.mul(0.6).add(0.1), 0.45).add(fibreDetail.mul(0.12))
    this.normalNode = proceduralNormal(reliefHeight, 0.0009).add(fuzz.lean.mul(fuzzCoverage).mul(0.08)).normalize()
    const shuttle = loopTurn
    const wovenTail = shuttle.sub(fabric.x).fract()
    const approaching = fabric.x.sub(shuttle).fract()
    const shuttleGlow = wovenTail.mul(wovenTail).mul(-24).exp().mul(0.5).add(approaching.mul(approaching).mul(-2600).exp().mul(0.9))
    this.emissiveNode = gold.mul(brocade).mul(shuttleGlow).mul(near.mul(0.3).add(0.7))
      .add(color(hsl.integer(298, 100, 84)).mul(fuzzMask).mul(0.3))
      .add(color(hsl.integer(286, 68, 40)).mul(brocade.mul(grazing.pow(3)).mul(0.05)))
      .add(color(hsl.integer(295, 100, 79)).mul(shuttleGlow).mul(mx_noise_float(vec3(fabric.x.mul(90), fabric.y.mul(24), 0))).mul(0.5).add(0.5).mul(0.05))
  }
}

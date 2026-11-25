import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, color, float, mix, mx_fractal_noise_float, negateOnBackSide, normalLocal, positionView, positionViewDirection, select, time, transformNormalToView, uv, vec2, vec3} from 'three/tsl'

import {ramp} from '../../candidates/claude_sonnet/lib/ramp.ts'
import {filteredRoughness} from '../../candidates/claude_sonnet/lib/specularFilter.ts'
import {knotFrame} from '../../candidates/claude_sonnet/lib/tubeBasis.ts'
import {voronoi} from '../../candidates/claude_sonnet/lib/voronoiNearestPair.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

// 360 × 40 tesserae (about 2 cm each) grouped into 18 × 2 roundels of 20 × 20 tesserae.
const tesserae: [number, number] = [360, 40]
const roundelSize = 20
const smalti = (hex: number) => color(hex).rgb
const gold = smalti(hsl.integer(79, 87, 72.6))
const paleGold = smalti(hsl.integer(85, 100, 88.5))
const lapis = smalti(hsl.integer(266, 94, 24.5))
const ruby = smalti(hsl.integer(25, 96.6, 37))
const emerald = smalti(hsl.integer(155, 98, 43))
const turquoise = smalti(hsl.integer(192, 95, 59))
const pearl = smalti(hsl.integer(87, 43, 92))
/** Colors of one roundel evaluated at the center of a tessera, so every tile is a single flat color. */
const roundel = (center: Node<'vec2'>, luck: Node<'float'>) => {
  const pattern = center.div(roundelSize)
  const local = pattern.fract().sub(0.5)
  const r = local.length()
  const angle = atan(local.y, local.x.add(0.00001))
  const petal = angle.mul(8).cos().mul(0.5).add(0.5)
  const bead = angle.mul(16).cos().greaterThan(0)
  const corner = local.abs().sub(0.5).length()
  const goldBand = r.greaterThan(0.06).and(r.lessThan(0.115)).or(r.greaterThan(0.215).and(r.lessThan(0.265))).or(r.greaterThan(0.335).and(r.lessThan(0.375)))
  const cornerGold = corner.greaterThan(0.075).and(corner.lessThan(0.12))
  // field: lapis with a scatter of turquoise and pearl tesserae
  let tone: Node<'vec3'> = select(luck.lessThan(0.06), turquoise, select(luck.greaterThan(0.965), pearl, lapis))
  tone = select(corner.lessThan(0.17), select(corner.lessThan(0.075), ruby, select(corner.lessThan(0.12), gold, turquoise)), tone)
  // roundel, from the rim inward
  tone = select(r.lessThan(0.375), select(r.lessThan(0.335), select(r.lessThan(0.265 + 0.06), mix(turquoise, emerald, petal.greaterThan(0.45).select(1, 0)), tone), gold), tone)
  tone = select(r.lessThan(0.265), select(r.lessThan(0.215), select(r.lessThan(0.165), select(r.lessThan(0.115), select(r.lessThan(0.06), ruby, gold), select(bead, pearl, lapis)), ruby), gold), tone)
  return {
    tone,
    gold: goldBand.or(cornerGold),
  }
}

/** A Byzantine vault of hand-set glass and gold. Every tessera is tilted differently, so the surface glitters and a candle that follows the viewer wakes them one by one. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.25)
    this.name = knotData.id
    const {p, facing, objectDistance} = viewerFrame()
    const tube = uv()
    const basis = knotFrame(tube)
    // irregular tesserae with grout between them
    const q = tube.mul(vec2(...tesserae))
    const cells = voronoi(q, tesserae, 11, 0.5)
    const seam = cells.f2.sub(cells.f1)
    const pixel = seam.fwidth().max(0.0005)
    const groutWidth = float(0.11)
    const grout = ramp(seam, groutWidth.add(pixel), groutWidth.sub(pixel).max(0))
    const edge = ramp(seam, 0.5, 0.1)
    const id = cellNoiseVec3(vec3(cells.cell, 5.3))
    const id2 = cellNoiseVec3(vec3(cells.cell, 21.9))
    const lost = id2.z.greaterThan(0.975)
    // the design is read at the center of each tessera
    const pattern = roundel(q.add(cells.toPoint), id.z)
    const isGold = pattern.gold
    const goldTone = mix(gold, paleGold, id.x.mul(0.55)).mul(id2.x.mul(0.2).add(0.88))
    const glassTone = pattern.tone.mul(id2.y.mul(0.28).add(0.86))
    // facets: tilt set by hand (gold is angled more boldly), a domed crown and a bevel at the edges
    const tiltAmount = select(isGold, float(0.5), float(0.2))
    const tilt = basis.along.mul(id.x.sub(0.5)).add(basis.around.mul(id.y.sub(0.5))).mul(tiltAmount)
    const crown = basis.along.mul(cells.toPoint.x).add(basis.around.mul(cells.toPoint.y)).mul(-0.34)
    const bevel = basis.along.mul(cells.toPoint.x).add(basis.around.mul(cells.toPoint.y)).mul(edge.mul(-0.9))
    const surface = normalLocal.normalize()
    const facet = surface.add(tilt).add(crown).add(bevel).normalize()
    const normal = negateOnBackSide(transformNormalToView(facet))
    // two candles ride with the viewer; their flames never stop moving
    const flameA = time.mul(9.1).add(time.mul(2.9).sin().mul(2)).sin().mul(0.16).add(time.mul(21).sin().mul(0.07)).add(0.9)
    const flameB = time.mul(7.3).add(1.7).add(time.mul(3.7).cos().mul(2)).sin().mul(0.18).add(time.mul(17).add(2).sin().mul(0.06)).add(0.88)
    const candleA = vec3(time.mul(1.3).sin().mul(0.05).add(0.32), time.mul(1.7).add(1).sin().mul(0.04).add(0.24), -0.25)
    const candleB = vec3(time.mul(1.1).add(2).sin().mul(0.05).sub(0.55), time.mul(1.5).sin().mul(0.04).sub(0.12), -0.15)
    const glint = (candle: Node<'vec3'>) => {
      const toCandle = candle.sub(positionView)
      const half = toCandle.normalize().add(positionViewDirection).normalize()
      const falloff = float(1.6).div(toCandle.dot(toCandle).max(0.2))
      return normal.dot(half).max(0).pow(380).mul(falloff)
    }
    const candles = glint(candleA).mul(flameA).mul(color(hsl.integer(78, 100, 89)).rgb).add(glint(candleB).mul(flameB).mul(color(hsl.integer(63, 100, 79.6)).rgb).mul(0.7))
    // age: soot in the crevices, a few lost tesserae showing the plaster bed
    const age = mx_fractal_noise_float(p.mul(14), 3, 2.1, 0.5).mul(0.5).add(0.5)
    const plaster = mix(color(hsl.integer(71, 17, 16)).rgb, color(hsl.integer(73, 20, 34)).rgb, age)
    const tile = mix(glassTone, goldTone, select(isGold, float(1), float(0))).mul(age.mul(0.25).add(0.8))
    const bed = grout.max(select(lost, float(1), float(0)))
    const near = ramp(objectDistance, 3.6, 1.2)
    this.colorNode = mix(tile, plaster, bed)
    this.metalnessNode = select(isGold, float(1), float(0)).mul(bed.oneMinus())
    this.roughnessNode = filteredRoughness(mix(select(isGold, float(0.2), float(0.09)), float(0.9), bed), normal)
    this.clearcoat = 0.55
    this.clearcoatRoughnessNode = filteredRoughness(0.04, normal)
    this.normalNode = normal
    this.clearcoatNormalNode = normal
    this.aoNode = mix(float(1), float(0.4), bed)
    this.emissiveNode = glassTone.mul(select(isGold, float(0), float(1))).mul(bed.oneMinus()).mul(0.16).mul(facing.mul(0.5).add(0.6))
      .add(candles.mul(bed.oneMinus()).mul(near.mul(0.6).add(0.9)).mul(select(isGold, float(9), float(2.4))))
  }
}

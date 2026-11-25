import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, mx_worley_noise_vec3, normalViewGeometry, time, uv, vec2, vec3} from 'three/tsl'

import {detailNormal} from '../../candidates/deepseek/lib/detailNormal.ts'
import {ramp} from '../../candidates/deepseek/lib/ramp.ts'
import {tubeCells, tubeTurns} from '../../candidates/deepseek/lib/tubeMetric.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

const along = 44
const around = 6
const rotate = (v: Node<'vec2'>, a: Node<'float'>) => vec2(v.x.mul(a.cos()).add(v.y.mul(a.sin())), v.y.mul(a.cos()).sub(v.x.mul(a.sin())))
/**
 * A Byzantine mosaic wrapped around the knot: hand-cut gold-leaf and smalti
 * tesserae, a lapis firmament with gold stars and processional borders. Every
 * tile has its own tilt, so walking around sends a wave of catchlights across
 * the surface; close up, grout, leaf crackle and glass bubbles appear.
 */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.35)
    this.name = knotData.id
    const {facing, grazing, near} = viewerFrame()
    const tube = uv()
    const metric = tubeCells(tube, along, around)
    const row = metric.y.floor()
    const shifted = vec2(metric.x.add(row.mod(2).mul(0.5)), metric.y)
    const cellRaw = shifted.floor()
    const cell = wrapCell(cellRaw, vec2(along, around))
    const localRaw = vec2(shifted.x.fract(), shifted.y.fract()).sub(0.5)
    const rnd = cellNoiseVec3(vec3(cell, 3.7))
    const rnd2 = cellNoiseVec3(vec3(cell, 11.2))
    const angle = rnd.z.sub(0.5).mul(0.16)
    const local = rotate(localRaw, angle)
    const size = vec2(rnd.x.mul(0.14).add(0.84), rnd.y.mul(0.14).add(0.84))
    const half = size.mul(0.5)
    const tileDist = local.x.abs().div(half.x).max(local.y.abs().div(half.y))
    const tile = ramp(tileDist, 0.99, 0.9)
    const bevel = ramp(tileDist, 0.82, 0.94)
    const footprint = metric.fwidth().length().max(0.0001)
    const resolved = footprint.smoothstep(0.11, 0.42).oneMinus()
// The gold program: star fields in a lapis sky, framed by processional borders.
    const u = tubeTurns(tube)
    const v = metric.y.div(around).fract()
    const starA = u.mul(TAU * 6).sin().mul(v.mul(TAU * 1).cos())
    const starB = u.add(0.17).mul(TAU * 11).sin().mul(v.add(0.3).mul(TAU * 2).cos())
    const star = starA.mul(0.6).add(starB.mul(0.4)).smoothstep(0.5, 0.86)
    const borderV = ramp(v.min(v.oneMinus()), 0.075, 0.025)
    const borderU = ramp(u.mul(TAU * 8).sin().abs(), 0.06, 0)
    const border = borderV.max(borderU.mul(0.65))
    const goldMask = star.mul(0.8).add(border).clamp(0, 1)
    const accent = mx_noise_float(vec3(metric.mul(0.6), 4.4)).mul(0.5).add(0.5)
    const glassPick = rnd2.x.add(accent.mul(0.6)).fract()
// Gold leaf has a warm/cool grain and a fine crackle; glass smalti has bubbles and a deep edge.
    const leafNoise = mx_noise_float(vec3(metric.mul(38), 7.1)).mul(0.5).add(0.5)
    const crackleField = mx_noise_float(vec3(metric.mul(85), time.mul(0.02).add(2.7)))
    const crackle = crackleField.abs().smoothstep(0.012, 0.05).oneMinus().mul(resolved)
    const goldTint = mix(color(hsl.integer(67, 88, 65)), color(hsl.integer(94, 100, 90.2)), rnd2.y)
    const gold = goldTint.mul(leafNoise.add(crackle.mul(0.25)).mul(0.35).add(0.78)).mul(rnd2.z.mul(0.42).add(0.76))
    const lapis = mix(color(hsl.integer(265, 92, 24.5)), color(hsl.integer(264, 84, 48.4)), rnd2.y.mul(0.5).add(0.32))
    const emerald = mix(color(hsl.integer(171, 96, 30)), color(hsl.integer(163, 91, 60)), rnd2.z)
    const ruby = mix(color(hsl.integer(12, 88, 23)), color(hsl.integer(16, 89, 49)), rnd2.y)
    const glass = mix(lapis, mix(emerald, ruby, glassPick.smoothstep(0.4, 0.7)), glassPick).mul(rnd2.z.mul(0.25).add(0.9))
    const tileColor = mix(glass, gold, goldMask)
    const bubbleCells = mx_worley_noise_vec3(vec3(metric.mul(180), 6.3), 1, 0)
    const bubbles = ramp(bubbleCells.x, 0.06, 0).mul(tile).mul(goldMask.oneMinus()).mul(resolved)
    const grout = color(hsl.integer(62, 35, 20))
    const surface = mix(mix(grout, tileColor, tile), color(hsl.integer(230, 100, 95)), bubbles.mul(0.13))
    const tileTilt = local.x.mul(rnd.x.sub(0.5)).add(local.y.mul(rnd.y.sub(0.5))).mul(0.012)
    const tileHeight = tile.mul(0.0025).add(tileTilt.mul(tile)).add(bevel.mul(0.0008)).sub(tileDist.mul(0.0012)).add(crackle.mul(goldMask).mul(0.00008)).add(bubbles.mul(0.00006))
    const tileNormal = detailNormal(normalViewGeometry, tileHeight, 1)
    const glint = glints(tileNormal, 1250).mul(tile).mul(goldMask.mul(0.75).add(0.12)).mul(near.mul(0.65).add(0.2))
// A slow candle shimmer crosses the gold leaf, independent of the viewer.
    const candle = u.mul(TAU * 3).add(time.mul(0.3)).sin().mul(0.5).add(0.5).pow(3)
    const goldGlow = gold.mul(candle).mul(goldMask).mul(0.06)
    this.colorNode = surface
    this.metalnessNode = mix(float(0.02), float(0.9), goldMask.mul(tile))
    this.roughnessNode = mix(float(0.055).add(rnd2.z.mul(0.035)), float(0.14).add(leafNoise.mul(0.08)), goldMask.mul(tile)).add(tile.oneMinus().mul(0.55))
    this.normalNode = tileNormal
    this.aoNode = tile.mul(0.45).add(0.55)
    this.iridescence = 0.18
    this.iridescenceIOR = 1.42
    this.iridescenceThicknessNode = facing.mul(160).add(260)
    this.clearcoat = 0.38
    this.clearcoatRoughness = 0.08
    this.emissiveNode = color(hsl.integer(93, 100, 95.4)).mul(glint).mul(0.8).add(goldGlow).add(color(hsl.integer(238, 99, 94)).mul(bubbles).mul(0.12)).add(color(hsl.integer(85, 100, 88)).mul(grazing.pow(3)).mul(0.07))
    this.envMapIntensity = 1.35
  }
}

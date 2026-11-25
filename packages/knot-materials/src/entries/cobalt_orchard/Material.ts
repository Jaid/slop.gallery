import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, color, float, mix, mx_noise_float, time, uv, vec3} from 'three/tsl'

import {coverage, periodicSurface, resolved, surfaceTile} from '../../candidates/gpt_sol/lib/gallerySurface.ts'
import {inkFill} from '../../lib/atelier.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import data from './data.ts'

/** Underglaze botanical engraving, not a glowing texture: ink, porcelain and gold have separate BRDFs. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.72)
    this.name = data.id
    const tube = uv()
    const {intimate, grazing, near} = viewerFrame()
    const tile = surfaceTile(tube, 24, 3)
    const seed = cellNoiseVec3(vec3(tile.cell, 5)).toVar()
    const a = seed.x.mul(TAU)
    const v = tile.local
    const q = vec3(v.x.mul(a.cos()).sub(v.y.mul(a.sin())), v.x.mul(a.sin()).add(v.y.mul(a.cos())), 0).xy.toVar()
    const r = q.length().max(0.00001).toVar()
    const theta = atan(q.y, q.x)
    const breath = time.mul(0.18).add(seed.y.mul(TAU)).sin().mul(0.014)
    const petalRadius = theta.mul(6).cos().mul(0.074).add(0.245).add(breath)
    const flower = inkFill(r.sub(petalRadius), tile.footprint).toVar()
    const border = coverage(r.sub(petalRadius), 0.006, tile.footprint)
    const heart = inkFill(r.sub(0.057), tile.footprint)
    const veinPhase = theta.mul(12).add(r.mul(36)).add(seed.z.mul(2))
    const vein = coverage(veinPhase.sin(), 0.08, veinPhase.fwidth()).mul(flower).mul(r.smoothstep(0.07, 0.16)).mul(resolved(veinPhase))
    const inkWash = mx_noise_float(periodicSurface(tube, 83, 11)).mul(0.5).add(0.5).toVar()
    const bloomWash = r.div(petalRadius).clamp().pow(1.4)
    const blue = mix(color(hsl.integer(257, 91, 22)), color(hsl.integer(246, 31, 73)), bloomWash.mul(0.55).add(inkWash.mul(0.14)))
    // Curving tendrils and leaf pairs stay inside each stamp’s support, including the UV seams.
    const stemField = q.x.sub(q.y.mul(8).sin().mul(0.055))
    const stem = coverage(stemField, 0.0038, tile.footprint).mul(q.y.abs().smoothstep(0.34, 0.46).oneMinus()).mul(flower.oneMinus())
    const leaf = q.sub(vec3(q.y.sign().mul(0.1), q.y.sign().mul(0.355), 0).xy).div(vec3(0.095, 0.043, 1).xy).length()
    const leaves = inkFill(leaf.sub(1), tile.footprint.mul(16)).mul(flower.oneMinus())
    const glazeNoise = mx_noise_float(periodicSurface(tube, 135, 19)).toVar()
    const porcelain = mix(color(hsl.integer(92, 43, 91)), color(hsl.integer(90, 100, 98)), glazeNoise.mul(0.25).add(0.5))
    const ink = flower.max(stem).max(leaves.mul(0.8)).toVar()
    const blueBody = mix(porcelain, blue, ink)
    // Gold stipples are subpixel-compensated instead of becoming sparkling noise at a distance.
    const dots = surfaceTile(tube, 432, 54)
    const dotSeed = cellNoiseVec3(vec3(dots.cell, 13))
    const stipple = inkFill(dots.local.length().sub(0.095), dots.footprint).mul(dotSeed.x.smoothstep(0.65, 0.8)).mul(heart)
    const gilding = border.mul(0.65).add(heart.mul(0.8)).add(stipple.mul(intimate)).clamp().toVar()
    this.colorNode = mix(blueBody.mul(vein.mul(0.5).oneMinus()), color(hsl.integer(86, 72, 74)), gilding)
    this.metalnessNode = gilding.mul(0.92)
    this.roughnessNode = mix(float(0.25), float(0.19), gilding).add(inkWash.mul(0.035))
    this.clearcoat = 1
    this.clearcoatRoughness = 0.12
    this.ior = 1.48
    const height = border.mul(0.0007).add(heart.mul(0.0004)).sub(vein.mul(0.00023)).add(glazeNoise.mul(0.00017))
    this.normalNode = proceduralNormal(height, 0.65)
    this.iridescenceNode = grazing.pow(3).mul(0.14).mul(ink.oneMinus())
    this.iridescenceThicknessNode = float(290)
    this.emissiveNode = color(hsl.integer(254, 41, 85)).mul(ink).mul(near).mul(0.025)
  }
}

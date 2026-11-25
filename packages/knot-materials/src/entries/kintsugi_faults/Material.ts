import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, mx_worley_noise_vec3, normalLocal, positionGeometry, vec3} from 'three/tsl'

import {glints} from '../../lib/glints.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** a few warped structural faults for the gold, plus an independent fine craquelure web */
const craquelure = (point: Node<'vec3'>) => {
  const bend = mx_noise_float(point.mul(1.6)).mul(0.55)
  const bend2 = mx_noise_float(point.mul(3.1).add(8)).mul(0.2)
  const coarse = point.mul(1.35).add(vec3(bend, bend2, bend.mul(-0.6)))
  const major = mx_worley_noise_vec3(coarse, 1, 0)
  const majorGap = major.y.sub(major.x)
  const minor = mx_worley_noise_vec3(point.mul(11).add(vec3(11, 4, 7)), 1, 0)
  const minorGap = minor.y.sub(minor.x)
  const age = mx_noise_float(point.mul(0.9).add(5)).mul(0.5).add(0.5)
  const goldCore = majorGap.smoothstep(0.02, 0.055).oneMinus().mul(age.smoothstep(0.3, 0.55))
  const hairCore = minorGap.smoothstep(0.004, 0.012).oneMinus().mul(goldCore.oneMinus().clamp())
  const footprint = majorGap.fwidth().max(0.0004)
  const goldWidth = footprint.mul(2).add(0.06)
  const gold = majorGap.smoothstep(goldWidth.mul(0.35), goldWidth).oneMinus().mul(age.smoothstep(0.3, 0.55))
  const hairWidth = footprint.add(0.012)
  const hair = minorGap.smoothstep(hairWidth.mul(0.3), hairWidth).oneMinus().mul(gold.oneMinus().clamp())
  return {
    gold: gold.clamp(0, 1),
    goldCore: goldCore.clamp(0, 1),
    hair: hair.clamp(0, 1),
    hairCore: hairCore.clamp(0, 1),
  }
}

/** A pale celadon bowl that once broke and was mended in gold. The glaze still carries its hairline craquelure, but the true fractures run wide and proud with metal, and they catch every light in the room while the porcelain stays quiet — closer still and the gold shows its leaf, flake by flake. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const {p, grazing, near, intimate} = viewerFrame()
    const crack = craquelure(p)
    const leaf = mx_noise_float(p.mul(300).add(9)).mul(0.5).add(0.5)
    const pooling = mx_noise_float(p.mul(3.2).add(2)).mul(0.5).add(0.5)
    const goldWidth = crack.gold
    const seamLift = crack.goldCore.mul(0.85).add(crack.hairCore.mul(-0.2))
    this.positionNode = positionGeometry.add(normalLocal.mul(seamLift.mul(0.006)))
    const glazeHeight = pooling.mul(0.3).add(leaf.mul(intimate).mul(0.12)).sub(goldWidth.mul(0.45)).add(crack.hairCore.mul(-0.2))
    this.normalNode = proceduralNormal(glazeHeight, 0.35).add(normalLocal.mul(goldWidth.mul(0.1))).normalize()
    const jade = mix(color(hsl.integer(156, 25, 76)), color(hsl.integer(135, 23, 93)), pooling.pow(2))
    const porcelain = jade.mul(float(1).sub(crack.hair.mul(0.3)))
    const gold = mix(color(hsl.integer(71, 88, 43)), color(hsl.integer(90, 100, 90)), leaf.mul(0.75).add(0.25))
    this.colorNode = mix(porcelain, gold, goldWidth.clamp(0, 1))
    this.metalnessNode = goldWidth.mul(0.95)
    this.roughnessNode = float(0.14).add(crack.hair.mul(0.16)).sub(goldWidth.mul(0.02)).add(leaf.mul(intimate).mul(0.14).mul(goldWidth))
    this.clearcoat = 1
    this.clearcoatRoughnessNode = float(0.04).add(crack.hair.mul(0.1))
    this.aoNode = crack.hair.mul(0.35).oneMinus().mul(goldWidth.mul(0.12).add(0.88))
    this.envMapIntensity = 1
    const goldGlint = glints(normalLocal, 90).mul(goldWidth).mul(near.mul(0.6).add(0.4))
    const leafGlint = glints(normalLocal.add(leaf.sub(0.5).mul(0.6)), 160).mul(goldWidth).mul(intimate).mul(leaf.smoothstep(0.7, 0.85))
    this.emissiveNode = color(hsl.integer(85, 100, 88.5)).mul(grazing.pow(3).mul(goldWidth).mul(0.1)).add(gold.mul(goldGlint.mul(0.6))).add(color(hsl.integer(93, 100, 95.8)).mul(leafGlint))
  }
}

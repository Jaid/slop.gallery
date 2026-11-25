import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, mx_noise_vec3, normalLocal, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Distance between the two nearest Voronoi features: zero exactly on a cell wall. Branchless, unlike the MaterialX worley, which matters because the seam shader evaluates this field several times per pixel. */
function crackField(position: Node<'vec3'>, scale: number) {
  // A cheap sine-free 3D hash, so the cell lookup stays affordable at 27 samples.
  const hash3 = (cell: Node<'vec3'>) => {
    let p = cell.mul(vec3(0.1031, 0.103, 0.0973)).fract()
    p = p.add(p.dot(p.yzx.add(33.33)))
    p = p.add(p.dot(p.zxy.add(p)))
    return p.fract()
  }
  const q = position.mul(scale)
  const cell = q.floor()
  const local = q.fract()
  let first: Node<'float'> = float(1e6)
  let second: Node<'float'> = float(1e6)
  for (let x = -1;x <= 1;x++) {
    for (let y = -1;y <= 1;y++) {
      for (let z = -1;z <= 1;z++) {
        const feature = hash3(cell.add(vec3(x, y, z))).mul(0.7).add(0.15)
        const distance = vec3(x, y, z).add(feature).sub(local).length()
        const nextFirst = first.min(distance)
        second = second.min(distance.max(first))
        first = nextFirst
      }
    }
  }
  return second.sub(first)
}
/** Pixel-filtered seam coverage; attenuation keeps subpixel cracks from thickening. */
function seamCoverage(field: Node<'float'>, width: number) {
  const filteredWidth = field.fwidth().add(width)
  return field.abs().smoothstep(0, filteredWidth).oneMinus().mul(float(width).div(filteredWidth))
}

/** Kintsugi: a celadon-glazed porcelain knot, broken and rejoined with molten gold. The fracture network is a real three-dimensional Voronoi wall set, warped by noise so the shards are irregular, and the seams keep their depth as you walk around: look straight into a seam and the gold is there, glance across it and you only see the porcelain lip. Two march samples are enough to read the depth, and they keep the shader affordable. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.7)
    this.name = knotData.id
    const {p, view, grazing, near, intimate} = viewerFrame()
    const scale = 4.5
    const width = 0.13
    const depth = 0.5
// Warping the lookup once, from the surface point, keeps every march sample on the same shard.
    const base = p.add(mx_noise_vec3(p.mul(3.5)).mul(0.06))
    const surface = crackField(base, scale)
    const displacementCrack = surface.smoothstep(0, width).oneMinus()
    const crack = seamCoverage(surface, width)
// March a short way along the line of sight; gold survives only where the ray stays inside the seam.
    let gold: Node<'float'> = crack
    const steps = 2
    for (let i = 0;i < steps;i++) {
      const t = (i + 0.5) / steps * depth
      gold = gold.mul(seamCoverage(crackField(base.sub(view.mul(t / scale)), scale), width))
    }
// A cheap zero crossing of a fine noise field gives the glaze its web of crazing up close.
    const crazing = mx_noise_float(p.mul(scale * 3.2).add(vec3(3.1, 7.7, 1.3)))
    const displacementHairline = crazing.abs().smoothstep(0, 0.05).oneMinus().mul(near)
    const displacement = displacementCrack.mul(0.006).add(displacementHairline.mul(0.0006))
    // Screen-space derivatives belong only in fragment shading, never displacement.
    this.positionNode = p.sub(normalLocal.mul(displacement))
    const hairline = seamCoverage(crazing, 0.05).mul(near)
    const relief = crack.mul(0.006).add(hairline.mul(0.0006)).negate()
    const porcelainNoise = mx_noise_float(p.mul(5.5)).mul(0.5).add(0.5)
    const porcelain = mix(color(hsl.integer(154, 26, 76)), color(hsl.integer(159, 37, 53)), porcelainNoise.mul(0.9))
    const goldColor = mix(color(hsl.integer(78, 91, 69)), color(hsl.integer(96, 100, 91.2)), gold.mul(0.4).add(0.4))
    this.colorNode = mix(porcelain, goldColor, gold)
    this.metalnessNode = gold
    this.roughnessNode = mix(float(0.26).add(mx_noise_float(p.mul(31)).mul(0.05)), float(0.025), gold)
    this.clearcoat = 1
    this.clearcoatRoughnessNode = mix(float(0.1), float(0.012), gold)
    const reliefNormal = proceduralNormal(relief, 1.8)
    this.normalNode = reliefNormal
    this.clearcoatNormalNode = reliefNormal
// The glaze pools and darkens inside the fracture, so the gold reads as recessed.
    this.aoNode = crack.mul(gold.oneMinus()).mul(0.5).oneMinus()
    this.emissiveNode = color(hsl.integer(57, 100, 71.1)).mul(gold).mul(intimate.mul(0.55).add(0.04)).mul(0.5)
      .add(color(hsl.integer(78, 100, 93.4)).mul(grazing.pow(3)).mul(0.05))
  }
}

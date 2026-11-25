import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_fractal_noise_vec3, mx_noise_float, time, uv, vec3} from 'three/tsl'

import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import {glints} from '../../lib/glints.ts'
import {hairline} from '../../lib/hairline.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Porcelain that broke and was forgiven in gold. Domain-warped fracture runs through a smooth celadon glaze at two scales: bold shards a hand can follow, and – only when the visitor leans close – a whisper of hairline crazing. The repair is alive: a molten pulse travels the gold seams along the knot, gold dust clings to the crack edges, and the veins flare whenever they catch a studio lamp. From the doorway it reads as a white moon threaded with light; up close it is all fracture and patience. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const tube = uv()
    const {p, facing, near, intimate} = viewerFrame()
// Fractal domain warp so the fracture lines run jagged instead of geometric.
    const warp = mx_fractal_noise_vec3(p.mul(4.5), 3, 2.1, 0.55)
    const boundary = cellularBoundary(p.add(warp.mul(0.05)).mul(4.6)).add(mx_noise_float(p.mul(27)).mul(0.015))
    const fineBoundary = cellularBoundary(p.add(warp.mul(0.025)).mul(21).add(vec3(7.3, 2.1, 4.9)))
    const vein = hairline(boundary, 0.02).mul(facing.mul(0.65).add(0.35))
// Only some fault lines were worth gold; the rest healed as dark seams.
    const goldGate = mx_fractal_noise_float(p.mul(1.6), 3, 2.1, 0.55).mul(0.5).add(0.5).smoothstep(0.32, 0.55)
    const goldVein = vein.mul(goldGate)
    const darkVein = vein.mul(goldGate.oneMinus())
    const fineVein = hairline(fineBoundary, 0.008).mul(intimate.mul(0.5).add(0.03))
    const pool = mx_noise_float(p.mul(2.8)).mul(0.5).add(0.5)
    const shardTint = mx_noise_float(p.mul(8.5)).mul(0.5).add(0.5)
    const porcelain = mix(color(hsl.integer(122, 18, 94)), color(hsl.integer(163, 18, 85)), pool.mul(0.3)).mul(shardTint.mul(0.05).add(0.975))
    const gold = color(hsl.integer(80, 100, 79.6))
// Razor-thin grooves: the glaze stays flat between cracks.
    const height = boundary.clamp(0, 0.05).mul(0.5).add(goldVein.mul(0.03)).sub(fineBoundary.clamp(0, 0.06).mul(0.15).mul(intimate))
    const normal = proceduralNormal(height, 0.25)
    this.normalNode = normal
    this.colorNode = mix(mix(mix(porcelain, color(hsl.integer(242, 9, 20)), darkVein.mul(0.55)), gold, goldVein), gold.mul(0.85), fineVein.mul(0.5))
    this.metalnessNode = goldVein.max(fineVein.mul(0.7))
    this.roughnessNode = mix(float(0.17).add(pool.mul(0.06)), float(0.18), goldVein.max(fineVein))
    this.clearcoat = 0.85
    this.clearcoatRoughness = 0.13
    this.aoNode = mix(float(1), float(0.6), vein)
// Gold dust settled along the crack edges, visible only near.
    const nearCrack = boundary.smoothstep(0.3, 0.55).oneMinus().mul(boundary.smoothstep(0.04, 0.1))
    const dust = cellularPoints(p.mul(64), 0.04, 0.2, 0.55).mul(nearCrack).mul(near)
    const pulse = tube.x.mul(TAU * 4).sub(time.mul(Math.PI)).sin().mul(0.5).add(0.5).pow(4)
    this.emissiveNode = gold.mul(goldVein).mul(pulse.mul(1.7).add(0.4))
      .add(gold.mul(glints(normal, 130)).mul(goldVein.add(fineVein).clamp()).mul(near.mul(0.4).add(0.25)))
      .add(gold.mul(dust).mul(0.4))
      .add(gold.mul(fineVein).mul(intimate).mul(0.15))
  }
}

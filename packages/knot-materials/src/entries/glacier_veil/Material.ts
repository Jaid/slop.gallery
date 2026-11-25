import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_float, normalViewGeometry, time, uv, vec3} from 'three/tsl'

import {tubeRay} from '../../lib/atelier.ts'
import {beads} from '../../lib/beads.ts'
import {glints} from '../../lib/glints.ts'
import {hairline} from '../../lib/hairline.ts'
import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A knot carved from millennial glacier ice, with the aurora itself folded into its depth. Three curtain layers hang under the surface and slide over one another as the viewer circles the plinth. Up close the ice resolves into frost blooms, trapped dust and micro-fractures, while a prism rainbow wakes along the silhouette. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.5)
    this.name = knotData.id
    const tube = uv()
    const ray = tubeRay()
    const {p, facing, rim, near, intimate} = viewerFrame()
// Each curtain samples the surface UV at its own depth, so the folds parallax apart while walking.
    const curtain = (depth: number, folds: number, bands: number, seed: number, tint: Node<'color'>, speed: number) => {
      const q = tube.sub(ray.mul(depth))
      // Evaluate distortion on the closed tube, so neither UV wrap cuts the aurora.
      const noisePosition = knotFrame(q).position
      const warp = mx_noise_float(noisePosition.mul(vec3(3.5, 2.5, 3.5)).add(seed)).add(mx_noise_float(noisePosition.mul(vec3(9, 6, 9)).add(seed + 5)).mul(0.5)).mul(1.7)
      const phase = q.x.mul(TAU * folds).add(warp).add(time.mul(Math.PI * speed))
      const fold = phase.sin().mul(0.5).add(0.5).pow(2.4)
      const striation = opticalBands(q.x.mul(TAU * folds * 4).add(warp.mul(1.3))).mul(0.65).add(0.35)
      const band = q.y.mul(TAU * bands).add(warp).cos().mul(0.5).add(0.5).pow(1.7)
      return tint.mul(fold.mul(striation).add(0.04)).mul(band)
    }
    const aurora = curtain(0.3, 3, 1, 1.7, color(hsl.integer(156, 100, 86.4)), 1).mul(0.85)
      .add(curtain(0.17, 5, 2, 11.3, color(hsl.integer(232, 100, 73.8)), 2).mul(1.05))
      .add(curtain(0.07, 8, 3, 23.9, color(hsl.integer(303, 100, 61.7)), 3).mul(0.8))
    const veil = aurora.mul(facing.mul(0.5).add(0.5)).mul(near.mul(0.45).add(0.55)).mul(1.25)
    const cloud = mx_noise_float(p.mul(2.6)).mul(0.5).add(0.5)
    const cloudFine = mx_noise_float(p.mul(8)).mul(0.5).add(0.5)
    const fracture = hairline(mx_noise_float(p.mul(4.5)), 0.025).add(hairline(mx_noise_float(p.mul(11)), 0.012).mul(0.6)).mul(near)
    const body = mix(color(hsl.integer(239, 48, 6)), color(hsl.integer(231, 51, 34)), facing.mul(0.4).add(cloud.mul(0.28)).add(0.05).clamp())
    const ice = mix(body, color(hsl.integer(218, 33, 80)), cloud.smoothstep(0.6, 0.95).mul(0.5))
    const dust = beads(p.mul(70))
    const grain = normalViewGeometry.add(dust.random.sub(0.5).mul(0.85)).normalize()
    const sparkle = glints(grain, dust.random.y.mul(120).add(110)).mul(dust.mask).mul(near.mul(0.8).add(0.2)).mul(1.8)
    const prism = spectralColor(facing.mul(TAU).add(1.2)).mul(rim.pow(3)).mul(0.5)
    const relief = cloudFine.mul(0.5)
      .add(fracture.mul(-0.45))
      .add(dust.cap.mul(dust.mask).mul(0.55))
      .mul(intimate.add(near).clamp())
    this.colorNode = ice
    this.metalness = 0.04
    this.roughnessNode = cloud.mul(0.12).add(0.08)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.045
    this.aoNode = cloud.mul(0.25).add(0.75)
    this.normalNode = proceduralNormal(relief, 0.0016)
    this.emissiveNode = veil
      .add(color(hsl.integer(232, 100, 80.4)).mul(rim.pow(2.8)).mul(1.1))
      .add(prism)
      .add(color(hsl.integer(212, 100, 97)).mul(sparkle))
  }
}

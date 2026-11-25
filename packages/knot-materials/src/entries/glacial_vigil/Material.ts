import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, color, float, mix, mx_noise_float, mx_worley_noise_vec3, time, uv, vec2, vec3} from 'three/tsl'

import {coverage, periodicSurface, surfaceTile} from '../../candidates/gpt_sol/lib/gallerySurface.ts'
import {tubeRay} from '../../lib/atelier.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import data from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.75)
    this.name = data.id
    const tube = uv()
    const {p, grazing, intimate, near} = viewerFrame()
    const ray = tubeRay().toVar()
    let frost: Node<'float'> = float(0)
    let iceLight: Node<'vec3'> = vec3(0)
    // Snow crystals suspended at five depths; only the distant layers drift, like a glacial breath.
    for (let i = 4;i >= 0;i--) {
      const depth = 0.016 + i * 0.027
      const drift = time.mul(0.12).add(i * 1.7)
      const layer = tube.sub(ray.mul(depth)).add(vec2(i * 0.131, i * 0.207))
        .add(vec2(drift.sin().mul(0.0013), drift.cos().mul(0.009)).mul(i / 4))
      const tile = surfaceTile(layer, 32, 4)
      const seed = cellNoiseVec3(vec3(tile.cell, i + 107)).toVar()
      const q = tile.local.mul(1.1).toVar()
      const theta = atan(q.y, q.x).add(seed.x.mul(0.6))
      const sector = theta.add(Math.PI / 6).div(Math.PI / 3).floor().mul(Math.PI / 3)
      const angle = theta.sub(sector)
      const r = q.length().max(0.00001)
      const along = r.mul(angle.cos())
      const across = r.mul(angle.sin()).abs()
      const arm = coverage(across, 0.0045, tile.footprint)
      const ribPhase = along.mul(19).sub(across.mul(23)).add(seed.y)
      const rib = coverage(ribPhase.fract().sub(0.5), 0.065, tile.footprint.mul(23))
        .mul(across.smoothstep(0.025, 0.105).oneMinus())
      const growth = time.mul(0.22).add(seed.y.mul(6)).sin().mul(0.045)
      const extent = along.smoothstep(0.22 + i * 0.01, growth.add(0.36)).oneMinus()
      const crystal = arm.max(rib.mul(0.72)).mul(extent).mul(seed.z.smoothstep(0.2, 0.55)).toVar()
      frost = frost.add(crystal.mul(0.7 - i * 0.09)).clamp().toVar()
      const shimmer = along.mul(84).sub(time.mul(0.8)).add(seed.x.mul(8)).cos().mul(0.5).add(0.5).pow(5)
      iceLight = iceLight.add(mix(color(hsl.integer(203, 87, 92)), color(hsl.integer(258, 71, 52.6)), i / 4).mul(crystal).mul(shimmer.mul(1.3).add(0.65)).mul(0.22 - i * 0.025)).toVar()
    }
    const cells = mx_worley_noise_vec3(p.mul(11), 0.8, 0).toVar()
    const boundary = cells.y.sub(cells.x)
    const cleavage = coverage(boundary, 0.025, boundary.fwidth()).toVar()
    const grain = mx_noise_float(periodicSurface(tube, 108, 15)).toVar()
    const body = mix(color(hsl.integer(237, 91, 34)), color(hsl.integer(210, 40, 72)), cells.x.smoothstep(0.2, 0.7))
    this.colorNode = mix(body, color(hsl.integer(179, 42, 96.4)), frost.mul(0.78).add(cleavage.mul(0.38)).add(grazing.pow(3).mul(0.48)).clamp())
    this.metalness = 0
    this.ior = 1.31
    this.roughnessNode = float(0.15).add(frost.mul(0.27)).add(cleavage.mul(0.09)).add(grain.abs().mul(0.025))
    this.clearcoat = 0.85
    this.clearcoatRoughnessNode = float(0.055).add(frost.mul(0.17))
    this.normalNode = proceduralNormal(cells.x.mul(0.0018).add(grain.mul(0.0004)).add(cleavage.mul(0.00035)), 0.7)
    this.emissiveNode = iceLight.mul(near.mul(0.2).add(0.8)).add(color(hsl.integer(208, 64, 82)).mul(cleavage).mul(intimate).mul(0.055))
    this.iridescenceNode = cleavage.mul(grazing).mul(0.3)
    this.iridescenceIOR = 1.31
    this.iridescenceThicknessNode = cells.x.mul(180).add(150)
  }
}

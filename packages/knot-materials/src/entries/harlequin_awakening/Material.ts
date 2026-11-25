import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_fractal_noise_float, time, uv, vec2, vec3} from 'three/tsl'

import {ramp} from '../../candidates/claude_sonnet/lib/ramp.ts'
import {rainbow} from '../../candidates/claude_sonnet/lib/spectralRainbow.ts'
import {voronoi} from '../../candidates/claude_sonnet/lib/voronoiNearestPair.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A uniformly distributed unit vector from two uniform numbers. */
const direction = (a: Node<'float'>, b: Node<'float'>) => {
  const z = a.mul(2).sub(1)
  const s = z.mul(z).oneMinus().max(0).sqrt()
  const phi = b.mul(TAU)
  return vec3(s.mul(phi.cos()), s.mul(phi.sin()), z)
}
/** Silica-sphere lattice of one opal domain. Its planes only reflect when they face the viewer, and the reflected wavelength slides along the spectrum as the planes tilt away. Planes bend gently across the domain, so every patch carries its own gradient of fire. */
const lattice = (cell: Node<'vec2'>, bend: Node<'vec2'>, seed: number, view: Node<'vec3'>, lobe: number, drift: number) => {
  const r = cellNoiseVec3(vec3(cell, seed))
  const r2 = cellNoiseVec3(vec3(cell, seed + 17.3))
  const wobble = vec3(
    time.mul(0.21 * drift).add(r2.x.mul(TAU)).sin(),
    time.mul(0.17 * drift).add(r2.y.mul(TAU)).sin(),
    time.mul(0.13 * drift).add(r2.z.mul(TAU)).sin(),
  ).mul(0.16)
  const curvature = vec3(bend.x, bend.y, bend.x.sub(bend.y)).mul(0.55)
  const normal = direction(r.x, r.y).add(wobble).add(curvature).normalize()
  const facing = normal.dot(view).abs()
  const sweep = r.z.add(facing.oneMinus().mul(2.2)).mul(TAU).cos().mul(-0.5).add(0.5)
  return {
    amount: facing.pow(lobe),
    tint: rainbow(sweep),
  }
}

/** Black opal: a mosaic of crystalline domains that each flash their own spectral fire at their own angle. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.6)
    this.name = knotData.id
    const {p, view, objectDistance, rim} = viewerFrame()
    const tube = uv()
    const near = ramp(objectDistance, 3.4, 1.2)
    const grandGrid: [number, number] = [70, 8]
    const q = tube.mul(vec2(...grandGrid))
    const cells = voronoi(q, grandGrid, 3, 0.92)
    const seam = cells.f2.sub(cells.f1)
    const footprint = q.fwidth().length()
    const mosaic = seam.smoothstep(0.012, footprint.mul(1.4).add(0.05))
    const primary = lattice(cells.cell, cells.toPoint, 5, view, 11, 2.2)
    const secondary = lattice(cells.cell, cells.toPoint.yx, 41, view, 15, 3.1)
    const fineGrid: [number, number] = [210, 24]
    const fineQ = tube.mul(vec2(...fineGrid))
    const fine = voronoi(fineQ, fineGrid, 9, 0.95)
    const pin = lattice(fine.cell, fine.toPoint, 77, view, 22, 4.6)
    const pinMask = fine.f2.sub(fine.f1).smoothstep(0.02, 0.2).mul(ramp(fine.f1, 0.55, 0.15))
    const potch = mx_fractal_noise_float(p.mul(5.5).add(vec3(0, 0, time.mul(0.02))), 3, 2.1, 0.5).mul(0.5).add(0.5)
    const body = mix(color(hsl.integer(262, 45, 3.3)), color(hsl.integer(264, 64, 10.5)), potch.smoothstep(0.25, 0.85)).mul(mosaic.mul(0.5).add(0.5))
    // a slow tide of inner light crosses the stone, lifting the fire of whichever domains it passes
    const tide = tube.x.mul(TAU * 2).add(tube.y.mul(TAU)).sub(time.mul(0.55)).sin().mul(0.5).add(0.5).pow(2)
    const fire = primary.tint.mul(primary.amount).mul(1.4)
      .add(secondary.tint.mul(secondary.amount).mul(0.8))
      .mul(tide.mul(0.7).add(0.65))
    const glow = primary.tint.mul(0.06).add(secondary.tint.mul(0.03))
    // the pin-fire flecks only wake as you lean in: from afar the stone is broad patches, up close it fills with sparks
    const sparks = pin.tint.mul(pin.amount).mul(pinMask).mul(near.mul(near).mul(1.9).add(near.mul(0.9)).add(0.12))
    const milk = color(hsl.integer(266, 74, 34)).mul(rim.pow(1.5)).mul(0.12)
    this.colorNode = body
    this.metalness = 0
    this.roughness = 0.1
    this.ior = 1.5
    this.clearcoat = 0.7
    this.clearcoatRoughness = 0.03
    this.emissiveNode = fire.mul(mosaic).add(glow).add(sparks).add(milk)
  }
}

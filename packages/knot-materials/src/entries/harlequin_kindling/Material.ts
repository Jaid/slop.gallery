import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {bitangentView, color, float, mix, normalViewGeometry, positionViewDirection, tangentView, time, uv, vec3} from 'three/tsl'

import {tubeCells} from '../../candidates/claude_sonnet/lib/tubeMetric.ts'
import {voronoi} from '../../candidates/claude_sonnet/lib/voronoiCells.ts'
import {wavelengthColor} from '../../candidates/claude_sonnet/lib/wavelengthColor.ts'
import {tubeRay} from '../../lib/atelier.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** One layer of the opal’s silica-sphere mosaic. Every Voronoi patch is a single crystal domain with its own lattice plane orientation and sphere spacing; Bragg’s law λ = 2·n·d·cos φ then picks the one wavelength that patch reflects toward the eye, so color is a pure function of viewing angle and sweeps through the spectrum as you move. */
function braggLayer(cells: Node<'vec2'>, period: readonly [number, number], seed: number, light: Node<'vec3'>, spread: number) {
  const domain = voronoi(cells, period, seed)
  const tangent = tangentView.normalize()
  const bitangent = (bitangentView as unknown as Node<'vec3'>).normalize()
  const normal = normalViewGeometry.normalize()
  const {random, offset, edge, id} = domain
  const preference = cellNoiseVec3(vec3(id, seed + 5.5))
// Lattice plane normal: tilted off the surface normal per domain, curved across the domain so each patch is a fan of colors.
  const tilt = random.xy.sub(0.5).mul(2.6).add(offset.mul(0.5))
  const wobble = offset.x.mul(random.z.mul(9).add(4)).add(offset.y.mul(5)).add(random.x.mul(40)).sin().mul(0.1)
  const plane = tangent.mul(tilt.x.add(wobble)).add(bitangent.mul(tilt.y.sub(wobble))).add(normal.mul(1.25 + spread)).normalize()
  const half = positionViewDirection.add(light).normalize()
  const cosine = plane.dot(half).clamp(0, 1)
  const spacing = random.z.mul(54).add(203)
  const wavelength = cosine.mul(spacing).mul(2.9)
// Each patch burns only within a narrow cone around its own preferred angle; a faint broad tail keeps the dark stone alive.
  const peak = preference.x.mul(0.3).add(0.64)
  const flash = cosine.sub(peak).div(preference.y.mul(0.04).add(0.055)).pow2().negate().exp().add(cosine.smoothstep(0.55, 0.9).mul(0.025))
  const seam = edge.smoothstep(0.03, 0.16)
  return {
    flash: flash.mul(seam),
    wavelength,
    random,
  }
}
/** Black opal cabochon: dark potch body, polished surface and patches of spectral fire. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.95)
    this.name = knotData.id
    const {facing, grazing, near, intimate} = viewerFrame()
    const cells = tubeCells(uv(), 72, 8)
// The key light drifts slowly so the stone keeps breathing even when nobody moves.
    const swing = time.mul(0.23)
    const light = vec3(swing.sin().mul(0.35).add(0.22), swing.mul(0.71).cos().mul(0.3).add(0.45), 0.8).normalize()
    const coarse = braggLayer(cells, [72, 8], 4.1, light, 0)
// Deeper layers are seen through the stone: the same lattice shifted along the refracted view ray.
    const shift = tubeRay().mul(0.045)
    const deepCells = tubeCells(uv().sub(shift), 72, 8)
    const deep = braggLayer(deepCells, [72, 8], 9.7, light.mul(vec3(1, 1, 1.1)).normalize(), 0.2)
    const pinfire = braggLayer(tubeCells(uv().sub(shift.mul(0.5)), 186, 21), [186, 21], 15.3, light, 0.5)
    const sparkWindow = intimate.mul(0.75).add(0.25)
    const fireA = wavelengthColor(coarse.wavelength).mul(coarse.flash)
    const fireB = wavelengthColor(deep.wavelength).mul(deep.flash).mul(0.4)
    const fireC = wavelengthColor(pinfire.wavelength).mul(pinfire.flash.pow(1.6)).mul(0.65).mul(sparkWindow)
    const fire = fireA.add(fireB).add(fireC)
// Milky potch body: deep blue-black that glows faintly teal where the stone is thick toward the eye.
    const body = mix(color(hsl.integer(262, 45, 2)), color(hsl.integer(235, 56, 9)), facing.pow(2).mul(0.5))
    this.colorNode = body
    this.metalness = 0
    this.roughnessNode = float(0.16).sub(fire.length().mul(0.05)).max(0.08)
    this.specularIntensity = 1
    this.ior = 1.46
    this.clearcoat = 1
    this.clearcoatRoughness = 0.035
    this.sheen = 0.15
    this.sheenColor.set(hsl.integer(256, 100, 73))
    this.sheenRoughness = 0.35
    this.emissiveNode = fire.mul(facing.mul(0.45).add(0.75)).mul(1.7)
      .add(color(hsl.integer(230, 80, 41)).mul(grazing.pow(3)).mul(near.mul(0.3).add(0.15)).mul(0.25))
  }
}

import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, normalLocal, select, time, uv, vec2, vec3} from 'three/tsl'

import {ramp} from '../../candidates/claude_sonnet/lib/ramp.ts'
import {voronoi} from '../../candidates/claude_sonnet/lib/voronoiNearestPair.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const paneGrid: [number, number] = [36, 5]
/** Six antique glass recipes picked by a unit-interval identity. */
const recipe = (t: Node<'float'>) => {
  const i = t.mul(6)
  return select(i.lessThan(1), color(hsl.integer(24, 98, 51)), select(i.lessThan(2), color(hsl.integer(67.4, 100, 74.9)), select(i.lessThan(3), color(hsl.integer(151, 99.4, 63)), select(i.lessThan(4), color(hsl.integer(264.8, 98, 41.7)), select(i.lessThan(5), color(hsl.integer(305, 92, 49)), color(hsl.integer(190, 99, 68))))))).rgb
}

/** Backlit stained glass: absorption deepens with the length of glass the light must cross, so color follows your angle. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, view, facing, objectDistance} = viewerFrame()
    const tube = uv()
    // panes: irregular cut glass in a periodic lattice, divided by lead cames
    const grid = tube.mul(vec2(...paneGrid))
    const cells = voronoi(grid, paneGrid, 6, 0.86)
    const random = cellNoiseVec3(vec3(cells.cell, 1.7))
    const random2 = cellNoiseVec3(vec3(cells.cell, 9.3))
    const seam = cells.f2.sub(cells.f1)
    const pixel = seam.fwidth().max(0.0005)
    const leadWidth = float(0.07)
    const lead = ramp(seam, leadWidth.add(pixel), leadWidth.sub(pixel).max(0)).mul(ramp(pixel, 0.4, 0.15).mul(0.7).add(0.3))
    const pillow = ramp(seam, 0.02, 0.5)
    // path through the glass: grazing views cross more of it and turn the color richer and darker
    const path = float(1).div(facing.max(0.22))
    const batch = random.x
    const base = recipe(batch)
    const flashed = mix(base, base.mul(base), random.y.mul(0.6))
    const transmitted = flashed.pow(path.mul(0.9).add(0.25))
    // hand-blown character: reams, seeds and a gradient where the sheet was flashed
    const ream = mx_fractal_noise_float(p.mul(11).add(random.xyz.mul(40)), 3, 2.1, 0.5).mul(0.5).add(0.5)
    const seeds = cellularPoints(p.mul(85), 0.04, 0.2, 0.94)
    const ripple = mx_fractal_noise_float(p.mul(30).add(random2.xyz.mul(30)), 2, 2, 0.5)
    // the lamp inside: each pane flickers on its own, and slow processions of light travel around the tube
    const flicker = time.mul(random2.x.mul(1.4).add(0.6)).add(random2.y.mul(TAU)).sin().mul(0.12)
      .add(time.mul(random2.z.mul(5).add(3)).add(random.z.mul(60)).sin().mul(0.05)).add(0.88)
    const procession = tube.x.mul(TAU * 3).sub(time.mul(0.6)).add(tube.y.mul(TAU)).sin().mul(0.5).add(0.5).pow(2).mul(0.55).add(0.62)
    const luminance = ream.mul(0.55).add(0.7).mul(flicker).mul(procession)
    // sun flare: a pane lights up when the viewer lines up with its own facet
    const facet = normalLocal.normalize().add(random.xyz.mul(2).sub(1).mul(0.85)).normalize()
    const flare = facet.dot(view).max(0).pow(36)
    const seamGlow = ramp(seam, 0.4, 0.07).mul(0.25).add(0.8)
    const glass = transmitted.mul(luminance).mul(seamGlow).mul(1.35)
      .add(mix(transmitted, vec3(1, 0.92, 0.78), 0.55).mul(flare).mul(3.2))
      .add(vec3(1, 0.95, 0.85).mul(seeds).mul(0.5))
    const near = ramp(objectDistance, 3.5, 1.3)
    const emission = glass.mul(lead.oneMinus()).mul(near.mul(0.25).add(0.85))
    // relief: pillowed panes, raised lead, subtle ripples that bend the reflections
    const height = pillow.mul(0.0035).add(lead.mul(0.0028)).add(ripple.mul(0.00035).mul(lead.oneMinus()))
    this.colorNode = mix(transmitted.mul(0.035), color(hsl.integer(277, 8, 19)), lead)
    this.metalnessNode = lead.mul(0.85)
    this.roughnessNode = mix(float(0.05), float(0.5), lead)
    this.ior = 1.52
    this.clearcoat = 0.65
    this.clearcoatRoughness = 0.04
    this.normalNode = proceduralNormal(height, 1)
    this.emissiveNode = emission
  }
}

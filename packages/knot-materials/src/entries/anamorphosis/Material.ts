import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, time, uv} from 'three/tsl'

import {tubeCells} from '../../candidates/muse_wonder/lib/tubeMetric.ts'
import {tubeRay} from '../../lib/atelier.ts'
import {filteredRibbon} from '../../lib/filteredRibbon.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A lenticular skin: fine ribbed lenses run around the tube, interleaving two unrelated engravings – silver moons on deep indigo, an ember lattice on soot, laid out on different grids so they can never fuse into one design. The picture choice is driven hard by the local view angle, with only a whisper of sweep across each lens, so whole regions flip as the visitor walks and just the turning zones dissolve into spectral moiré. It is the only piece in the room that cannot be seen standing still. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.8)
    this.name = knotData.id
    const tube = uv()
    const {near, intimate} = viewerFrame()
    const ray = tubeRay()
// Lenticule geometry: a triangular lens profile repeating around the tube.
    const stripCoord = tube.y.mul(72)
    const lensLocal = stripCoord.fract()
    const lens = lensLocal.sub(0.5).abs().mul(2).oneMinus()
// Picture choice: view angle around the tube, biased by a slow wave along the knot so whole regions commit to one picture and the boundary between them travels as the visitor walks.
    const sweep = tube.x.mul(TAU * 3).sin().mul(1.3)
    const choice = ray.y.clamp(-1, 1).mul(0.9).add(sweep).add(lensLocal.sub(0.5).mul(0.25)).smoothstep(-0.18, 0.18)
// Engraving A: ringed moons on one grid. Engraving B: an ember lattice on another.
    const moonCells = tubeCells(tube, 44, 5)
    const moonDist = moonCells.fract().sub(0.5).length()
    const moons = filteredRibbon(moonDist.sub(0.27), 0.035).max(moonDist.smoothstep(0.09, 0.15).oneMinus().mul(0.9))
    const latticeCells = tubeCells(tube, 30, 7)
    const latticeField = latticeCells.x.add(latticeCells.y).fract().sub(0.5)
    const latticeField2 = latticeCells.x.sub(latticeCells.y).fract().sub(0.5)
    const lattice = filteredRibbon(latticeField, 0.06).max(filteredRibbon(latticeField2, 0.06))
// Crossfade in a narrow band only, so the two pictures rarely coexist.
    const visB = choice.smoothstep(0.42, 0.58)
    const visA = visB.oneMinus()
    const lineMask = moons.mul(visA).max(lattice.mul(visB))
    const base = mix(color(hsl.integer(267, 96, 19)), color(hsl.integer(41, 75, 7)), choice)
    const lineColor = mix(color(hsl.integer(261, 100, 91)), color(hsl.integer(45, 100, 65)), choice)
    this.colorNode = mix(mix(base, color(hsl.integer(261, 100, 91)), moons.mul(visA)), color(hsl.integer(45, 100, 65)), lattice.mul(visB))
// Where neither picture wins, the lenses shimmer with spectral moiré.
    const band = choice.sub(0.5).abs().mul(2).oneMinus().clamp()
    const shimmer = spectralColor(stripCoord.mul(TAU).add(ray.y.mul(7)).add(tube.x.mul(TAU * 8)).add(time.mul(0.6)))
    const height = lens.mul(0.8).add(lineMask.mul(0.14))
    this.normalNode = proceduralNormal(height, 0.35)
    this.metalnessNode = mix(float(0.2), float(0.75), lineMask)
    this.roughnessNode = mix(float(0.38), float(0.26), lineMask)
    this.clearcoat = 0.3
    this.clearcoatRoughness = 0.25
    this.emissiveNode = lineColor.mul(lineMask).mul(0.4)
      .add(shimmer.mul(band).mul(0.32))
      .add(lineColor.mul(lineMask).mul(intimate).mul(0.2))
      .add(shimmer.mul(band).mul(near).mul(0.1))
  }
}

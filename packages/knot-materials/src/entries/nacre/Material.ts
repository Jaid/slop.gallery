import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, normalViewGeometry, positionGeometry, time, uv, vec2} from 'three/tsl'

import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {filteredRibbon} from '../../lib/filteredRibbon.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Abalone nacre: aragonite platelets mortared into terraces, each one a thin film that re-tints the studio as the viewer moves. Growth ridges march along the form in stepped plateaus; the interference color pools in the low ground and flares along the risers. Close up, the brick-and-mortar platelets scintillate like a city seen from far above. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const p = positionGeometry
    const tube = uv()
    const {facing, grazing, rim, near, intimate} = viewerFrame()
    const warp = mx_noise_float(p.mul(3)).mul(2)
    const growth = tube.x.mul(TAU * 24).add(warp)
    const ridge = opticalBands(growth)
    const micro = opticalBands(growth.mul(7).add(warp.mul(1.6)))
    const mortar = filteredRibbon(cellularBoundary(p.mul(26)), 0.03)
    const layer = mx_fractal_noise_float(p.mul(4), 4, 2, 0.5).mul(0.5).add(0.5)
    const blush = mx_noise_float(p.mul(1.7).add(11)).mul(0.5).add(0.5)
// The interference phase sweeps with the viewing angle, so the whole shell re-tints while walking.
    const phase = layer.mul(TAU * 1.5).add(facing.mul(TAU * 0.9)).add(ridge.mul(2)).add(time.mul(Math.PI).mul(0.35))
    const orient = spectralColor(phase)
    const scintilla = glints(normalViewGeometry, layer.mul(90).add(80)).mul(mortar.oneMinus()).mul(near).mul(0.6)
    const ground = mix(mix(color(hsl.integer(252, 19, 79)), color(hsl.integer(85, 29, 85)), ridge.mul(0.7).add(0.3)), color(hsl.integer(32, 42, 82)), blush.mul(0.35))
    const pearl = mix(ground, orient, grazing.pow(0.8).mul(0.3).add(0.16))
    const relief = ridge.mul(0.35).add(micro.mul(0.15)).sub(mortar.mul(0.3)).add(layer.mul(0.1)).mul(intimate.add(near).clamp())
    this.colorNode = pearl
    this.metalness = 0.14
    this.roughnessNode = float(0.09).mix(0.24, mortar)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.04
    this.ior = 1.56
    this.specularIntensity = 1.15
    this.anisotropyNode = vec2(0.3, 0)
    this.iridescenceNode = float(0.9)
    this.iridescenceIORNode = float(1.35)
    this.iridescenceThicknessNode = float(140).add(layer.mul(320))
    this.aoNode = float(1).sub(mortar.mul(0.3))
    this.normalNode = proceduralNormal(relief, 0.002)
    this.emissiveNode = orient.mul(grazing.pow(0.8).mul(0.55).add(0.3)).mul(0.5)
      .add(orient.mul(mortar).mul(0.55))
      .add(orient.mul(rim.pow(1.8)).mul(0.8))
      .add(orient.mul(intimate).mul(0.2))
      .add(color(hsl.integer(65, 100, 97)).mul(scintilla))
  }
}

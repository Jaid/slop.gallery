import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_float, mx_noise_vec3, positionViewDirection, tangentView, time, uv, vec3} from 'three/tsl'

import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** 4. CHROMOSPHERIC SPICULE: Solar Coronagraph & Relativistic Alfvén Flux */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    this.envMapIntensity = 0.15
    const {p, grazing, near, intimate} = viewerFrame()
    const tube = uv()
    // Convective solar granulation base
    const granule = cellularBoundary(p.mul(26).add(mx_noise_vec3(p.mul(4)).mul(0.6)))
    const cellBorders = granule.smoothstep(0.02, 0.1)
    // Magnetic loop arcades bursting across the knot
    const loopCoord = tube.y.mul(Math.PI * 6).sin().abs()
    const magneticTurbulence = mx_noise_float(vec3(p.x.mul(14), p.y.mul(5).add(time.mul(1.2)), p.z.mul(14)))
    const spiculeStream = loopCoord.pow(4).mul(magneticTurbulence.add(0.4)).clamp()
    // Relativistic Doppler beaming along the knot tangent flow
    const tangentFlow = tangentView.dot(positionViewDirection).clamp(-1, 1)
    const blueshift = tangentFlow.smoothstep(0, 0.8)
    const redshift = tangentFlow.negate().smoothstep(0, 0.8)
    const hAlphaRed = color(hsl.integer(30.5, 100, 57.6))
    // 656.3 nm Hydrogen-Alpha
    const heliumYellow = color(hsl.integer(92, 100, 85))
    const coronalCyan = color(hsl.integer(209, 100, 82))
    // 10-million K EUV iron emission
    const plasmaTint = mix(mix(heliumYellow, hAlphaRed, redshift), coronalCyan, blueshift)
    this.colorNode = color(hsl.integer(49, 43, 3))
    this.metalness = 0.1
    this.roughness = 0.85
    this.clearcoat = 0.3
    this.clearcoatRoughness = 0.2
    this.emissiveNode = plasmaTint.mul(spiculeStream).mul(4).mul(intimate.mul(0.8).add(0.6))
      .add(hAlphaRed.mul(cellBorders.oneMinus()).mul(1.5))
      .add(coronalCyan.mul(grazing.pow(4)).mul(2.2))
      .mul(near.mul(0.6).add(0.4))
  }
}

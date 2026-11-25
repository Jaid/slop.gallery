import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float} from 'three/tsl'

import {cellularPoints} from '../../lib/cellularPoints.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** 5. OPALINE AEROGEL: "Frozen Smoke" with Rayleigh-Mie Forward Scatter */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    // True Rayleigh scattering phase: smoky-cyan backscatter vs fiery sunset-amber forward transmission
    const forwardPhase = facing.pow(3.5)
    const rayleighCyan = color(hsl.integer(230, 94, 63.5))
    const transmittedSunset = color(hsl.integer(43, 100, 66))
    const scatterColor = mix(rayleighCyan, transmittedSunset, forwardPhase)
    // Hypervelocity micrometeorite impact needle tunnels
    const deepTrackSample = p.sub(view.mul(0.12))
    const trackField = mx_noise_float(deepTrackSample.mul(36))
    const impactTrack = opticalLine(trackField, 0.02).mul(intimate)
    // Compact stardust inclusions, not entire glowing spatial cells.
    const stardustSparks = cellularPoints(p.mul(70), 0.03, 0.18, 0.65)
    this.colorNode = color(hsl.integer(236, 56, 5))
    this.transmission = 0.88
    this.thickness = 0.65
    this.ior = 1.06
    // Ultra-low density silica aerogel
    this.attenuationColor.set(hsl.integer(49, 100, 71))
    this.attenuationDistance = 0.55
    this.roughness = 0.06
    // Silvery gossamer silica nanosphere sheen
    this.sheen = 0.95
    this.sheenRoughnessNode = float(0.25)
    this.sheenNode = color(hsl.integer(221, 100, 87.4))
    this.emissiveNode = scatterColor.mul(forwardPhase).mul(1.8)
      .add(color(hsl.integer(92, 100, 92)).mul(impactTrack).mul(3.5))
      .add(color(hsl.integer(0, 0, 100)).mul(stardustSparks).mul(2.5))
      .add(rayleighCyan.mul(grazing.pow(2.2)).mul(0.65))
      .mul(near.mul(0.5).add(0.5))
  }
}

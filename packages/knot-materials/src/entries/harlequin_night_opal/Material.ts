import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, luminance, mix, mx_fractal_noise_float, mx_noise_float, mx_noise_vec3, time, vec3} from 'three/tsl'

import {environmentRadiance} from '../../candidates/claude_opus/lib/environmentRadiance.ts'
import {pixelFootprint} from '../../candidates/claude_opus/lib/footprint.ts'
import {tubeInterior} from '../../candidates/claude_opus/lib/tubeInterior.ts'
import {voronoi3d} from '../../candidates/claude_opus/lib/voronoi3d.ts'
import {wavelengthColor} from '../../candidates/claude_opus/lib/wavelengthColorZucconi.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

type Layer = {
  activity: number
  depth: number
  scale: number
  seed: number
}
/** Black opal. Beneath a polished potch surface, stacked silica domains act as Bragg gratings: each patch diffracts the wavelength λ = 2nd·cosθ toward the viewer, lit by whatever part of the gallery its mirror direction sees. Tilting the head sweeps every patch through the spectrum. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.65)
    this.name = knotData.id
    const {objectDistance} = viewerFrame()
    const interior = tubeInterior({ior: 1.45})
    const {direction, entry, frame} = interior
    const outward = frame.normal
    const pixel = pixelFootprint()
    const near = objectDistance.smoothstep(1, 2.2).oneMinus()
    const drift = time.mul(0.19)
// color gathers in veins and bars, leaving quiet potch between them
    const vein = mx_noise_float(entry.mul(vec3(2.6, 2.6, 3.4)).add(4.2)).add(mx_noise_float(entry.mul(6.1)).mul(0.3))
    const richness = vein.smoothstep(-0.85, 0.05)
    const domains = (layer: Layer) => {
      const sample = entry.add(direction.mul(layer.depth))
// broad warp gives jigsaw outlines, the fine one frays their edges
      const warp = mx_noise_vec3(sample.mul(layer.scale * 0.2).add(layer.seed)).mul(0.9)
        .add(mx_noise_vec3(sample.mul(layer.scale * 1.9).add(layer.seed + 5)).mul(0.07))
      const lattice = sample.mul(layer.scale).add(warp)
      const domain = voronoi3d(lattice, layer.seed)
      const identity = domain.identity
      const spacing = cellNoiseVec3(domain.cell.add(layer.seed + 17.31))
// the silica lattice settles slowly, as if the stone were still breathing
      const breath = vec3(drift.add(identity.x.mul(TAU)).sin(), drift.mul(1.37).add(identity.y.mul(TAU)).cos(), drift.mul(0.71).add(identity.z.mul(TAU)).sin()).mul(0.08)
// slight stacking faults keep each patch from looking like a flat mirror
      const bend = mx_noise_vec3(lattice.mul(1.3).add(layer.seed * 3)).mul(0.07)
      const grating = identity.mul(2).sub(1).add(breath).add(bend).add(outward.mul(0.7)).normalize()
      const cosine = direction.dot(grating).abs()
// Bragg: λ = 2·n·d·cosθ, sphere spacing per domain
      const wavelength = spacing.x.mul(260).add(470).mul(cosine)
// a domain only flares when its mirror direction finds one of the gallery's lights
      const radiance = luminance(environmentRadiance(environment, direction.reflect(grating), 0.18))
      const flash = radiance.mul(0.8).pow(1.8).min(1.4).add(0.3)
      const seam = domain.gap.smoothstep(0.015, 0.1)
      const footprint = pixel.balanced.mul(layer.scale)
// unresolved domains average to a faint glow instead of sparkling noise
      const resolved = footprint.smoothstep(0.45, 1.3).oneMinus()
      const present = spacing.y.smoothstep(layer.activity, layer.activity + 0.1).mul(seam)
      const light = wavelengthColor(wavelength).mul(flash).mul(cosine.pow(2))
      return {
        light: light.mul(present.mul(resolved).add(resolved.oneMinus().mul(0.15))),
        present,
      }
    }
    const upper = domains({
      activity: 0.1,
      depth: 0.01,
      scale: 13,
      seed: 3.1,
    })
    const lower = domains({
      activity: 0.12,
      depth: 0.05,
      scale: 8.5,
      seed: 11.7,
    })
// pinfire: tiny flecks that only reveal themselves to a close observer
    const pinfire = domains({
      activity: 0.72,
      depth: 0.003,
      scale: 70,
      seed: 47.9,
    })
// the upper stratum hides the lower one wherever it is ordered
    const upperShare = richness.mul(upper.present)
    const fire = upper.light.mul(richness).mul(1.2)
      .add(lower.light.mul(upperShare.oneMinus()).mul(richness.mul(0.6).add(0.4)).mul(vec3(0.55, 0.75, 0.95)))
      .add(pinfire.light.mul(near).mul(0.9))
    const potch = mx_fractal_noise_float(entry.mul(5), 3, 2, 0.5).mul(0.5).add(0.5)
    this.colorNode = mix(color(hsl.integer(264, 100, 0)), color(hsl.integer(260, 41, 3)), potch)
    this.metalness = 0
    this.roughness = 0.04
    this.specularIntensity = 0.55
    this.clearcoat = 0.2
    this.clearcoatRoughness = 0.02
    this.ior = 1.45
    this.emissiveNode = fire.mul(float(1))
  }
}

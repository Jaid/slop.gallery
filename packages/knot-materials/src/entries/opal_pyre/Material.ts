import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, time, vec3} from 'three/tsl'

import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A Mexican-fire opal the size of a knotted ring: a deep indigo matrix with overlapping play-of-colour fields with a slowly advancing phase so the fire flickers through every hue in turn. Black dendrite inclusions are etched across the surface as if some ancient fossil were caught in the silica, and from intimate range the glow inside brightens until the opal looks lit from within. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.55)
    this.name = knotData.id
    this.envMapIntensity = 0.55
    const {p, view: viewDir, facing, grazing, near, intimate} = viewerFrame()
    const rim = grazing.pow(1.8)
    // ---- host matrix ----
    // A black opal host with subtle milky veining. The base is a deep
    // cobalt-indigo; the veining is brighter silica.
    const hostRnd = mx_noise_float(p.mul(2.8)).mul(0.5).add(0.5)
    const host = mix(color(hsl.integer(273, 70, 5)), color(hsl.integer(275, 60, 13)), hostRnd.mul(0.6))
    const milkyVein = mx_noise_float(p.mul(11)).smoothstep(0.62, 0.78).mul(hostRnd.pow(2))
    const hostWithVeins = mix(host, color(hsl.integer(277, 47, 30)), milkyVein.mul(0.5))
    // ---- dendrite inclusions ----
    // Black MnO2 dendrites: a fractal noise thresholded at the high end
    // gives a feathery branching pattern.
    const dendrite = mx_fractal_noise_float(p.mul(3.6).add(vec3(2.3, 5.1, 0)), 4, 2.1, 0.55)
      .smoothstep(0.42, 0.52)
      .mul(intimate)
    // ---- play-of-colour fields ----
    // Continuous 3D fields let the fire cross grid boundaries without clipped circles.
    const patchRnd = mx_fractal_noise_float(p.mul(3), 3, 2, 0.5).mul(0.5).add(0.5).clamp()
    const patchMask = patchRnd.smoothstep(0.35, 0.65)
    const patchSeed = patchRnd.mul(12)
    // The fire phase is a dot product against the view direction plus
    // time and per-patch offset, producing true angular colour shift.
    const firePhase = viewDir.dot(p.sub(vec3(0.5))).mul(8).add(time.mul(0.4)).add(patchSeed)
    const rWave = firePhase.add(0).cos().mul(0.5).add(0.5)
    const gWave = firePhase.add(2.094).cos().mul(0.5).add(0.5)
    const bWave = firePhase.add(4.189).cos().mul(0.5).add(0.5)
    // Per-region iridescence thickness: thin films of different
    // thicknesses in different patches produce different play-of-colour.
    const patchThickness = mix(280, 720, patchRnd)
    const thickness = patchThickness.add(grazing.mul(180)).add(rim.mul(120))
    // ---- assembly ----
    this.colorNode = mix(hostWithVeins, color(hsl.integer(277, 78, 3)), dendrite)
    this.metalness = 0.05
    this.roughnessNode = float(0.14).add(milkyVein.mul(0.18))
    this.sheen = 0.35
    this.sheenColor.set(hsl.integer(296, 100, 75))
    this.sheenRoughness = 0.4
    this.transmission = 0.2
    this.thickness = 0.45
    this.ior = 1.46
    this.attenuationColor.set(hsl.integer(283, 64, 6))
    this.attenuationDistance = 0.6
    this.iridescence = 1
    this.iridescenceIOR = 1.32
    this.iridescenceThicknessNode = thickness
    this.normalNode = proceduralNormal(milkyVein.mul(0.0015).add(hostRnd.mul(0.0004)), 0.7)
    // ---- emissive ----
    // Three independent play-of-colour fields: warm, cool, and a magenta
    // accent. They cross-fade through the cosine palette as the fire
    // phase advances. From intimate range the glow inside brightens until
    // the opal looks lit from within.
    const innerFire = color(hsl.integer(75, 100, 80.8)).mul(rWave.pow(2))
      .add(color(hsl.integer(139, 100, 89.6)).mul(gWave.pow(2)))
      .add(color(hsl.integer(280, 100, 60)).mul(bWave.pow(2)))
    const innerGlow = innerFire
      .mul(patchMask.mul(0.85).add(0.15))
      .mul(near.mul(0.6).add(0.4))
      .mul(intimate.mul(2).add(0.6))
    const haloGlow = mix(color(hsl.integer(292, 100, 74)), color(hsl.integer(81, 69, 88)), facing)
      .mul(rim)
      .mul(near.mul(0.4).add(0.3))
      .mul(0.25)
    this.emissiveNode = innerGlow.add(haloGlow).mul(dendrite.oneMinus())
  }
}

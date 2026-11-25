import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_fractal_noise_float, time, uv, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A pelagic organism. Its body is nearly water — a clear gel with a faint blue attenuation — and everything you actually see lives inside it: a gut that glows, a net of photophores, and slow waves of bioluminescence that travel the length of the animal. Bring a light close and it answers with a brighter, faster pulse. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.4)
    this.name = knotData.id
    const {p, view, grazing, near, intimate, objectDistance} = viewerFrame()
    const tube = uv()
// The creature reacts to being looked at: the nearer you stand, the more alive it becomes.
    const alarm = objectDistance.smoothstep(1.2, 4.2).oneMinus()
    const breath = time.mul(alarm.mul(0.7).add(0.35)).add(p.length().mul(3.1)).sin().mul(0.5).add(0.5)
// ---------------------------------------------------------------
// The gel body: clear, faintly blue, with a soft internal scatter.
// ---------------------------------------------------------------
    const gel = mix(color(hsl.integer(230, 45, 6)), color(hsl.integer(228, 60, 17)), mx_fractal_noise_float(p.mul(5), 3, 2.1, 0.5).mul(0.5).add(0.5))
    this.colorNode = gel
    this.metalness = 0
    this.transmission = 0.22
    this.thickness = 0.7
    this.ior = 1.34
    this.dispersion = 0.25
    this.attenuationColor.set(hsl.integer(235, 78, 55.5))
    this.attenuationDistance = 1.1
    this.roughness = 0.12
    this.clearcoat = 0.5
    this.clearcoatRoughness = 0.06
// ---------------------------------------------------------------
// Internal anatomy, parallaxed so the organs slide inside the gel as
// you circle the animal. The gut is the brightest structure; the
// photophore net is finer and pulses out of phase.
// ---------------------------------------------------------------
    const deep = p.sub(view.mul(0.13))
    const deepFine = p.sub(view.mul(0.21))
    const gutField = mx_fractal_noise_float(deep.mul(3.4).add(vec3(0, time.mul(0.06), 0)), 4, 2.2, 0.55)
    const gut = gutField.abs().smoothstep(0.02, 0.22).oneMinus().mul(0.95).add(gutField.abs().smoothstep(0.22, 0.5).oneMinus().mul(0.2))
    const netField = mx_fractal_noise_float(deepFine.mul(11), 4, 2.3, 0.6)
    const net = netField.abs().smoothstep(0.01, 0.14).oneMinus()
    const wave = time.mul(alarm.mul(0.8).add(0.3)).sub(p.length().mul(7)).sin().mul(0.5).add(0.5)
// A scatter of photophores, each with its own colour and its own clock.
    const spots = p.mul(46)
    const spotId = cellNoiseVec3(spots.floor())
    const spotDistance = spots.fract().sub(spotId.mul(0.6).add(0.2)).length()
    const spot = spotDistance.smoothstep(0.06, 0.16).oneMinus()
    const spotPulse = time.mul(spotId.y.mul(2.4).add(0.6)).add(spotId.z.mul(30)).sin().mul(0.5).add(0.5)
    const spotColor = mix(color(hsl.integer(172, 100, 87.85)), color(hsl.integer(303, 100, 61.7)), spotId.x)
// A row of photophores runs the length of the animal like a lit spine.
    const spine = tube.y.sub(0.5).abs().smoothstep(0.05, 0.22).oneMinus()
    const spineBead = tube.x.mul(46).fract().sub(0.5).abs().smoothstep(0.08, 0.3).oneMinus()
    const spinePulse = time.mul(1.1).sub(tube.x.mul(46)).sin().mul(0.5).add(0.5)
    const spineGlow = spine.mul(spineBead).mul(spinePulse.mul(0.7).add(0.3))
    const gutColor = mix(color(hsl.integer(179, 83, 85.4)), color(hsl.integer(220, 100, 87.2)), gutField.mul(0.5).add(0.5))
    this.emissiveNode = gutColor.mul(gut).mul(breath.mul(0.6).add(0.55)).mul(alarm.mul(0.7).add(0.4)).mul(1.1)
      .add(spotColor.mul(spot).mul(spotPulse.mul(0.85).add(0.15)).mul(alarm.mul(0.6).add(0.3)).mul(0.85))
      .add(color(hsl.integer(180, 91, 76)).mul(net).mul(wave).mul(near).mul(0.45))
      .add(color(hsl.integer(176, 100, 90.4)).mul(spineGlow).mul(alarm.mul(0.6).add(0.4)).mul(0.9))
      .add(gutColor.mul(grazing.pow(2)).mul(intimate.mul(0.6).add(0.2)).mul(0.2))
      .add(color(hsl.integer(233, 100, 82.3)).mul(grazing.pow(6)).mul(0.18))
    this.normalNode = proceduralNormal(mx_fractal_noise_float(p.mul(9), 3, 2, 0.5).mul(0.5).add(gut.mul(0.3)).add(net.mul(0.25)), 0.0007)
    this.clearcoatNormalNode = this.normalNode
  }
}

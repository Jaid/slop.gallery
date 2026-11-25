import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, normalView, uv} from 'three/tsl'

import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A tiger's eye, cabochon cut. The stone is a crowd of parallel silicates that all run the length of the tube, so every one of them reflects at the same angle. Ask the tube's own frame where the visitor is standing and the one sheet of fibre that faces them lights up: that sheet is the eye, and it slides across the gold as you walk, while the fibres and the chatoyant pupil stay locked to the stone. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.3)
    this.name = knotData.id
    const tube = uv()
    const {p, grazing, near, intimate} = viewerFrame()
// The fibres: fine parallel threads running the length of the stone, drifting in slow waves.
    const drift = mx_fractal_noise_float(p.mul(2.6), 3, 2.1, 0.55).mul(1.1)
    const across = tube.y.mul(TAU)
    const fibre = across.add(drift.mul(0.3)).mul(44).sin().mul(0.5).add(0.5).pow(0.5).mul(near.mul(0.55).add(0.45))
// The ribbons: broad bands of gold and umber following the fibre bundle.
    const ribbon = across.add(drift.mul(0.8)).mul(2).add(tube.x.mul(TAU).mul(0.22)).sin().mul(0.5).add(0.5).pow(1.8)
// The eye: the one sheet of fibre whose plane happens to square up to the visitor, which is exactly
// where the studio lamps reflect into the stone. It is a moving band because it is a real highlight.
    const eye = glints(normalView, 26).add(glints(normalView, 7).mul(0.3))
    const silk = fibre.mul(0.35).add(0.65).mul(eye.mul(0.85).add(0.28))
    const umber = mix(color(hsl.integer(59, 46, 4)), color(hsl.integer(61, 84, 28)), ribbon)
    const gold = mix(color(hsl.integer(61, 79, 17)), color(hsl.integer(73, 86, 57)), fibre.mul(0.9).add(0.1))
    this.colorNode = mix(umber, gold, ribbon.mul(0.55).add(silk.mul(0.2)).add(eye.mul(0.5)).clamp(0, 1))
    this.metalness = 0
    this.roughnessNode = float(0.12).sub(eye.mul(0.06)).sub(fibre.mul(0.03)).add(grazing.mul(0.03)).clamp(0.025, 0.4)
    this.ior = 1.55
// All the fibres lie along the tube, so the specular is stretched across them: that stretch is the eye.
    this.anisotropy = 0.98
    this.anisotropyRotation = 0
    this.clearcoat = 0.25
    this.clearcoatRoughness = 0.02
    this.normalNode = proceduralNormal(fibre.mul(0.00018).add(ribbon.mul(0.0004)), 0.35)
    const chatoyant = glints(normalView, 90).mul(fibre.mul(0.5).add(0.5))
    this.emissiveNode = color(hsl.integer(81, 100, 86)).mul(chatoyant).mul(0.6)
      .add(color(hsl.integer(89, 100, 94.3)).mul(eye).mul(silk).mul(near.mul(0.4).add(0.25)).mul(0.3))
      .add(color(hsl.integer(54, 86, 25)).mul(ribbon.oneMinus()).mul(grazing.pow(2)).mul(0.07))
      .add(color(hsl.integer(80, 99, 88.5)).mul(fibre).mul(intimate.mul(0.5).add(0.2)).mul(0.04))
  }
}

import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mx_noise_float, time, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A flawless mercury mirror from a distance. Walk up and it senses you: concentric ripples spread from the point of the surface nearest to your eyes and follow you as you move, while a soft white presence glows exactly where the surface faces you, as if the sculpture were reflecting your gaze. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment)
    this.name = knotData.id
    const {p, cameraLocal, facing, distance} = viewerFrame()
    const reach = cameraLocal.sub(p).length()
    const wake = distance.smoothstep(0.9, 5).oneMinus()
    const ringsA = reach.mul(48).sub(time.mul(3.2)).sin()
    const ringsB = reach.mul(17).sub(time.mul(1.1)).add(mx_noise_float(p.mul(3)).mul(2)).sin()
    const idle = mx_noise_float(p.mul(6).add(vec3(time.mul(0.08), 0, time.mul(0.05))))
    const envelope = facing.pow(1.5).mul(0.7).add(0.3).mul(wake)
    const height = ringsA.mul(0.7).add(ringsB.mul(0.5)).mul(envelope).add(idle.mul(0.5))
    const crest = height.smoothstep(0.7, 1.1)
    this.colorNode = color(hsl.integer(268, 100, 96.5))
    this.metalness = 1
    this.roughnessNode = height.abs().mul(0.02).add(0.02)
    this.normalNode = proceduralNormal(height, 0.0035)
    this.emissiveNode = color(hsl.integer(259, 100, 85)).mul(crest).mul(wake).mul(0.3).add(color(hsl.integer(0, 0, 100)).mul(facing.pow(40)).mul(wake).mul(0.45))
  }
}

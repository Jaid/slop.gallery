import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, normalViewGeometry, positionGeometry, time, uv, vec3} from 'three/tsl'

import {beads} from '../../lib/beads.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Mercury that refuses to hold still. Heavy swells crawl along the knot while capillary ripples shiver over them, and droplets bead across the mirror and drag their own reflections along. A whisper of phosphorescent vapour pools in the troughs and burns along the silhouette – the metal swallowed something gilded and remembers it as light. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.45)
    this.name = knotData.id
    const p = positionGeometry
    const tube = uv()
    const {rim, near, intimate} = viewerFrame()
    const wobble = vec3(time.mul(Math.PI).sin(), time.mul(Math.PI * 2).sin(), time.mul(Math.PI * 3).sin()).mul(0.06)
    const flow = tube.x.mul(TAU * 3).sub(time.mul(Math.PI * 2)).sin().add(tube.y.mul(TAU).mul(2).sin().mul(0.4)).mul(0.55)
    const swell = mx_fractal_noise_float(p.mul(2.4).add(wobble), 3, 2, 0.5).add(flow)
    const swell01 = swell.mul(0.5).add(0.5).clamp()
    const ripple = mx_fractal_noise_float(p.mul(9).add(wobble.mul(2.5)), 3, 2, 0.5)
    const capillary = p.x.mul(TAU * 9).add(p.y.mul(TAU * 7)).add(time.mul(Math.PI * 4)).sin()
    const bead = beads(p.mul(11).add(wobble.mul(3)), 0.35)
    const dome = bead.cap.mul(bead.mask)
    const beadRing = bead.mask.sub(bead.core).clamp()
    const height = swell.mul(0.55)
      .add(ripple.mul(0.28).mul(near.mul(0.7).add(0.3)))
      .add(capillary.mul(0.06).mul(near))
      .add(dome.mul(0.5))
    const trough = swell01.oneMinus()
    const vapour = trough.smoothstep(0.55, 0.95).mul(0.12).add(beadRing.mul(0.1))
    const metal = mix(color(hsl.integer(258, 14, 33)), color(hsl.integer(248, 41, 96)), swell01)
    const amalgam = mix(metal, color(hsl.integer(80, 64, 47)), trough.smoothstep(0.6, 0.9).mul(0.5))
    this.colorNode = amalgam
    this.metalness = 1
    this.roughnessNode = float(0.045).add(trough.mul(0.05)).mix(float(0.02), bead.mask)
    this.aoNode = float(0.8).add(swell01.mul(0.2))
    this.normalNode = proceduralNormal(height, 0.004)
    this.emissiveNode = color(hsl.integer(199, 99, 90)).mul(vapour).mul(intimate.mul(0.5).add(0.6))
      .add(color(hsl.integer(199, 99, 90)).mul(rim.pow(3)).mul(0.18))
      .add(color(hsl.integer(212, 100, 97)).mul(glints(normalViewGeometry, 140)).mul(beadRing).mul(near.mul(0.7).add(0.3)).mul(0.7))
  }
}

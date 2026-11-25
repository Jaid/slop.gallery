import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalLocal, positionGeometry, time, transformNormalToView, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Quicksilver. A knot of liquid mercury, dense enough that its surface moves in slow, heavy swells rather than ripples. The swells bend the studio reflections into long silver ribbons; lean in and a second family of capillary waves appears, so the metal never settles. A whisper of oxide film tints the crests, the way gallium does when it has been handled. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.95)
    this.name = knotData.id
    const {p, grazing, intimate} = viewerFrame()
// Heavy swells: long wavelengths, slow speeds, large amplitudes.
    const swells = [{
      dir: vec3(0.82, 0.18, 0.54),
      freq: 19,
      speed: 0.62,
      amp: 1,
    }, {
      dir: vec3(-0.28, 0.92, 0.28),
      freq: 25,
      speed: -0.5,
      amp: 0.8,
    }, {
      dir: vec3(0.18, -0.52, 0.83),
      freq: 32,
      speed: 0.4,
      amp: 0.6,
    }, {
      dir: vec3(-0.72, -0.36, 0.6),
      freq: 41,
      speed: -0.32,
      amp: 0.42,
    }]
// Capillary waves: short, quick, and only resolved at arm's length.
    const capillaries = [{
      dir: vec3(0.5, 0.7, -0.5),
      freq: 74,
      speed: 1.6,
      amp: 0.2,
    }, {
      dir: vec3(-0.6, 0.3, 0.74),
      freq: 103,
      speed: -1.3,
      amp: 0.15,
    }, {
      dir: vec3(0.3, -0.8, 0.5),
      freq: 137,
      speed: 1.05,
      amp: 0.11,
    }]
    let height: Node<'float'> = float(0)
    let gradient: Node<'vec3'> = vec3(0)
    for (const wave of swells) {
      const phase = p.dot(wave.dir).mul(wave.freq).add(time.mul(wave.speed))
      height = height.add(phase.sin().mul(wave.amp))
      gradient = gradient.add(wave.dir.mul(wave.freq).mul(phase.cos()).mul(wave.amp))
    }
    for (const wave of capillaries) {
      const phase = p.dot(wave.dir).mul(wave.freq).add(time.mul(wave.speed))
      height = height.add(phase.sin().mul(wave.amp).mul(intimate))
      gradient = gradient.add(wave.dir.mul(wave.freq).mul(phase.cos()).mul(wave.amp).mul(intimate))
    }
// The surface normal follows the analytic gradient, so the mirror bends with the metal.
    const base = normalLocal.normalize()
    const tangentGradient = gradient.sub(base.mul(gradient.dot(base)))
    const surfaceNormal = base.sub(tangentGradient.mul(0.0055)).normalize()
    this.normalNode = transformNormalToView(surfaceNormal)
// A faint oxide skin, thickest in the troughs where the metal has been exposed.
    const oxide = mx_noise_float(p.mul(7)).mul(0.5).add(0.5)
    const film = height.mul(0.5).add(0.5).mul(oxide).mul(intimate.mul(0.6).add(0.4))
    this.colorNode = mix(color(hsl.integer(257, 9, 80)), color(hsl.integer(261, 16, 92)), oxide.mul(0.5).add(0.5))
    this.metalness = 1
    this.roughnessNode = float(0.022).add(film.mul(0.03)).add(grazing.mul(0.008)).clamp(0.015, 0.06)
    this.emissiveNode = color(hsl.integer(260, 99, 78)).mul(grazing.pow(4)).mul(0.02)
    this.positionNode = positionGeometry.add(normalLocal.mul(height.mul(0.0012)))
  }
}

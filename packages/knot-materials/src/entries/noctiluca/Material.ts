import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, negateOnBackSide, normalLocal, transformNormalToView} from 'three/tsl'

import {glitter} from '../../candidates/deepseek/lib/glitter.ts'
import {loopDrift, loopPhase} from '../../candidates/deepseek/lib/loopClock.ts'
import {waterWaves} from '../../candidates/deepseek/lib/waterWaves.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {filament} from '../../lib/filament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A sea of dinoflagellates wrapped around the knot. Long swells displace the tube itself, chop and capillary ripples carry the specular streaks, and every crest near the visitor ignites in blue light that races away in rings. Plankton patches drift with the water, so the glow keeps changing while the wave field stays periodic and closes exactly at the end of the two-second angle loop, which is why every train travels a whole number of wavelengths per loop. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.42)
    this.name = knotData.id
    const {p, facing, grazing, distance, intimate} = viewerFrame()
    const clock = loopPhase
    const capillary = intimate.mul(0.75).add(0.25)
    const swell = waterWaves(p, clock, [{
      amplitude: 0.012,
      direction: [0.86, 0.3, -0.41],
      speed: 1,
      wavelength: 0.62,
    }, {
      amplitude: 0.0035,
      direction: [0.52, -0.44, -0.73],
      speed: 1,
      wavelength: 0.34,
    }])
    const chop = waterWaves(p, clock, [{
      amplitude: 0.0026,
      direction: [-0.35, 0.72, 0.6],
      speed: 3,
      wavelength: 0.21,
    }, {
      amplitude: 0.0016,
      direction: [0.25, -0.62, 0.74],
      speed: 4,
      wavelength: 0.12,
    }, {
      amplitude: capillary.mul(0.0009),
      direction: [-0.72, 0.17, 0.67],
      speed: 9,
      wavelength: 0.062,
    }])
    this.positionNode = p.add(normalLocal.mul(swell.height))
    const slope = swell.slope.add(chop.slope)
    const objectNormal = normalLocal.normalize()
    const steep = slope.sub(objectNormal.mul(slope.dot(objectNormal)))
    this.normalNode = negateOnBackSide(transformNormalToView(objectNormal.sub(steep.mul(0.62)).normalize()).normalize())
    const height = swell.height.mul(0.55).add(chop.height).add(1)
    const crestField = height.div(capillary.mul(0.35).add(1)).sub(0.34)
    const crest = crestField.smoothstep(0.56, 1.16)
    const crestLine = filament(crestField.sub(0.7), 0.026).mul(crestField.fwidth().smoothstep(0.035, 0.12).oneMinus())
    const halo = filament(crestField.sub(0.5), 0.26)
    const envelope = mx_noise_float(loopDrift(p.mul(1.05), 0.4)).mul(0.5).add(0.5)
    const plankton = envelope.smoothstep(0.42, 0.74)
    const patchGreen = mx_noise_float(p.mul(3.4).add(40)).mul(0.5).add(0.5)
    const contact = distance.smoothstep(0.85, 3.3).oneMinus()
    const wake = contact.pow(1.2).mul(0.7).add(0.26)
    const rings = distance.mul(9.5).sub(loopPhase.mul(2)).sin().mul(0.5).add(0.5).pow(3)
    const cloud = mx_noise_float(loopDrift(p.mul(2.6), 0.5)).mul(0.5).add(0.5)
    const mote = glitter(p, 0.019, 80, 0.6)
    // Keep each plankton highlight inside its cell, rather than lighting the entire box.
    const moteCoord = p.div(0.019)
    const moteCenter = cellNoiseVec3(moteCoord.floor()).mul(0.5).add(0.25)
    const moteRadius = moteCoord.fwidth().length().add(0.18).min(0.24)
    const moteMask = moteCoord.fract().sub(moteCenter).length().smoothstep(0.06, moteRadius).oneMinus()
    const body = mix(color(hsl.integer(231, 55, 5)), color(hsl.integer(232, 62, 11)), mx_noise_float(p.mul(5.5)).mul(0.5).add(0.5))
    this.colorNode = mix(body, color(hsl.integer(231, 69, 17)), facing.mul(0.4))
    this.roughnessNode = float(0.045).add(grazing.mul(0.035)).sub(intimate.mul(0.012)).clamp(0.025, 0.12)
    this.metalness = 0
    this.ior = 1.33
    this.clearcoat = 0.8
    this.clearcoatRoughness = 0.025
    this.clearcoatNormalNode = this.normalNode
    this.sheen = 0.07
    this.sheenColor.set(hsl.integer(221, 100, 87))
    this.sheenRoughness = 0.32
    const bloomCore = color(hsl.integer(197, 100, 99))
    const aqua = color(hsl.integer(183, 87, 84.6))
    const electric = color(hsl.integer(257.3, 100, 57.4))
    const deep = color(hsl.integer(257, 88, 28))
    const green = color(hsl.integer(152, 100, 89.8))
    this.emissiveNode = bloomCore.mul(crestLine.mul(plankton).mul(wake).mul(1.8))
      .add(mix(aqua, green, patchGreen).mul(crest.mul(plankton).mul(wake).mul(0.44)))
      .add(aqua.mul(halo.mul(plankton).mul(contact.mul(0.4).add(0.12)).mul(0.17)))
      .add(electric.mul(rings.mul(contact.pow(2)).mul(plankton.mul(0.6).add(0.2)).mul(0.55)))
      .add(color(hsl.integer(219, 100, 93)).mul(mote.sparkle).mul(moteMask).mul(intimate).mul(0.5))
      .add(deep.mul(cloud.mul(cloud).mul(0.09)))
      .add(aqua.mul(grazing.pow(6)).mul(0.05))
  }
}

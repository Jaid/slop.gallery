import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalViewGeometry, positionViewDirection, time, uv, vec3} from 'three/tsl'

import {detailNormal} from '../../candidates/deepseek/lib/detailNormal.ts'
import {filament} from '../../lib/filament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A stagnation of the field: a rational surface where the lines close on themselves three times for every two turns. Hot gas is braided along those closed lines, a wave of current runs through every strand, and the whole chain flares every few seconds, lighting the bronze chamber from inside. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.8)
    this.name = knotData.id
    const tube = uv()
    const {p, grazing, near, intimate} = viewerFrame()
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
/** One family of closed field lines at a rational slope, with a current wave running along it. */
    const braid = (slopeU: number, slopeV: number, count: number, pulseSpeed: number, seed: number) => {
      const stream = tube.x.mul(slopeU).add(tube.y.mul(slopeV)).mul(count).add(seed)
      const wander = mx_noise_float(p.mul(3.4).add(vec3(seed, seed * 2.3, 0))).mul(0.12)
      const field = stream.add(wander).fract().sub(0.5).abs()
      const wave = stream.mul(TAU).sub(time.mul(pulseSpeed)).add(wander.mul(9)).sin().mul(0.5).add(0.5)
      return {
        core: filament(field, 0.014),
        halo: filament(field, 0.075),
        wave: wave.mul(0.72).add(0.28),
      }
    }
    const primaryHelix = braid(2, 1, 6, 1.1, 1.7)
    const secondaryHelix = braid(3, 2, 4, 0.8, 5.1)
    const strandHelix = braid(2, 1, 12, 1.5, 9.3)
    const surge = time.mul(0.24).fract().pow(6).mul(1.4).add(1)
    const flutter = mx_noise_float(p.mul(9).add(vec3(time.mul(0.6), time.mul(0.4), 0))).mul(0.35).add(0.85)
// Field lines cross the surface at a shallow angle, so they bunch up near the silhouette.
    const bunching = facing.oneMinus().pow(1.4).mul(0.6).add(0.7)
// Bronze chamber: brushed, lightly oxidised, and holding the colour of the plasma.
    const brush = mx_noise_float(vec3(p.x.mul(180), p.y.mul(9), p.z.mul(180))).mul(0.5).add(0.5)
    const oxide = mx_noise_float(p.mul(7).add(vec3(4.4, 2.2, 8.8))).mul(0.5).add(0.5).smoothstep(0.5, 0.8)
    const shell = mix(color(hsl.integer(80, 16, 19)), color(hsl.integer(72, 19, 28)), oxide).add(color(hsl.integer(82, 17, 42)).mul(brush).mul(near).mul(0.12))
    const coreGlow = primaryHelix.core.mul(primaryHelix.wave)
    const haloGlow = primaryHelix.halo.mul(0.55).add(secondaryHelix.halo.mul(0.3))
    const fineStrands = strandHelix.core.mul(near).mul(0.5)
    const islands = primaryHelix.halo.mul(secondaryHelix.halo).mul(2.2)
    this.colorNode = shell.add(color(hsl.integer(168, 83, 21)).mul(haloGlow).mul(0.03)).add(color(hsl.integer(180, 68, 22)).mul(fineStrands).mul(0.05))
    this.metalnessNode = mix(float(0.94), float(0.6), oxide.mul(0.5))
    this.roughnessNode = float(0.24).add(brush.mul(near).mul(0.1)).add(oxide.mul(0.14)).clamp(0.05, 1)
    this.anisotropy = 0.4
    this.normalNode = detailNormal(normalViewGeometry, brush.mul(near).mul(0.0004), 0.3)
    this.clearcoatNode = grazing.pow(2.2).mul(0.5).add(0.1)
    this.clearcoatRoughness = 0.12
    this.emissiveNode = color(hsl.integer(159, 100, 97.8)).mul(coreGlow).mul(0.62).mul(surge).mul(bunching)
      .add(color(hsl.integer(157.3, 99, 86)).mul(haloGlow).mul(0.26).mul(flutter).mul(surge))
      .add(color(hsl.integer(177, 100, 89.8)).mul(secondaryHelix.core).mul(secondaryHelix.wave).mul(0.4))
      .add(color(hsl.integer(180, 100, 94)).mul(fineStrands).mul(0.22).mul(flutter))
      .add(color(hsl.integer(167, 100, 88.4)).mul(islands).mul(intimate.mul(0.5).add(0.35)).mul(0.16))
      .add(color(hsl.integer(158, 98.5, 74)).mul(grazing.pow(6)).mul(0.1))
      .add(shell.mul(haloGlow).mul(0.1))
  }
}

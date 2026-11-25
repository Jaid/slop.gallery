import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, Fn as fn, hash, mix, mx_cell_noise_float, mx_noise_float, negateOnBackSide, time, transformNormalToView, uv, varying, vec2, vec3} from 'three/tsl'

import {spectralRamp} from '../../candidates/deepseek/lib/spectralRamp.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {filament} from '../../lib/filament.ts'
import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A comb jelly from the midnight zone. Eight rows of combs row the darkness with light: a wave of diffraction runs along every row and breaks the body into running rainbows. Under the glass skin a slow heart of organs smoulders, and scattered photophores fire on their own asynchronous schedule. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.5)
    this.name = knotData.id
    const tube = uv()
// A creature that swims in place: a slow travelling undulation along the bell.
    const body = fn(([coordinate]: [Node<'vec2'>]) => {
      const {position, normal} = knotFrame(coordinate)
      const wave = coordinate.x.mul(TAU * 3).sub(time.mul(0.45)).sin().mul(0.6).add(coordinate.y.mul(TAU * 2).add(time.mul(0.31)).sin().mul(0.4))
      const breath = time.mul(0.9).sin().mul(0.35).add(0.65)
// The comb rows stand proud of the bell as narrow ribs.
      const rib = coordinate.y.mul(TAU * 4).sin().mul(0.5).add(0.5).pow(14)
      return position.add(normal.mul(wave.mul(0.0075).add(breath.mul(0.0025)).add(rib.mul(0.0022))))
    })
    this.positionNode = body(tube)
    const epsilon = 0.0001
    const du = body(tube.add(vec2(epsilon, 0))).sub(body(tube.sub(vec2(epsilon, 0))))
    const dv = body(tube.add(vec2(0, epsilon))).sub(body(tube.sub(vec2(0, epsilon))))
    const bodyNormal = varying(transformNormalToView(du.cross(dv).normalize())).normalize()
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
// Eight comb rows run the length of the bell; each one beats a wave of light along itself.
    const rows = filament(tube.y.mul(TAU * 4).sin(), 0.2)
    const halo = filament(tube.y.mul(TAU * 4).sin(), 0.6)
    const stroke = tube.x.mul(TAU * 5).sub(time.mul(1.15)).add(tube.y.mul(TAU * 4).sin().mul(0.4))
    const ripple = stroke.sin().mul(0.5).add(0.5)
    // The spectrum is not cyclic: sweep it smoothly with the periodic wave, never a sawtooth.
    const rainbow = spectralRamp(ripple, 1.25)
    const wash = spectralRamp(ripple, 1.8)
// The travelling wave throws a bright crest ahead of a trailing wash of scattered light.
    const crest = ripple.pow(3).mul(0.75).add(ripple.mul(0.25))
    const pulse = time.mul(0.34).sin().mul(0.16).add(0.86)
// Comb plates: a hair comb of fine ribs standing perpendicular to every row.
    const plates = filament(tube.x.mul(TAU * 150).sin(), 0.05).mul(near)
    const cilia = filament(tube.y.mul(TAU * 40).add(tube.x.mul(TAU * 60)).sin(), 0.05).mul(near)
// Photophores: single cells that fire on their own patient schedule.
    const q = p.mul(22)
    const cell = q.floor()
    const identity = cellNoiseVec3(cell)
    const spot = q.fract().sub(identity.mul(0.5).add(0.25)).length()
    const bead = spot.smoothstep(0.1, 0.34).oneMinus().mul(mx_cell_noise_float(cell).smoothstep(0.86, 0.93))
    const beat = time.mul(1.35).add(identity.x.mul(9)).fract()
    const flash = hash(cell.x.mul(17.3).add(cell.y.mul(41.7)).add(cell.z.mul(7.1)).add(time.mul(1.35).floor()))
    const spark = bead.mul(flash.smoothstep(0.52, 0.66)).mul(beat.oneMinus().pow(3))
// Organs below the skin: a slow rose core and the canals that feed it, seen through the glass.
    const core = p.sub(view.mul(0.075))
    const coreField = mx_noise_float(core.mul(3.4).add(vec3(0, time.mul(0.04).sin().mul(0.4), 0)))
    const heart = coreField.smoothstep(0.2, 0.95).mul(time.mul(0.62).sin().mul(0.22).add(0.78))
    const canal = filament(mx_noise_float(core.mul(11)).mul(0.7).add(core.y.mul(6)), 0.02)
    const skin = grazing.pow(3).mul(0.5).add(facing.pow(0.7).mul(0.25))
    this.colorNode = mix(color(hsl.integer(283, 38, 3)), color(hsl.integer(271, 42, 8)), heart.mul(0.4).add(grazing.mul(0.3)))
      .add(rainbow.mul(rows).mul(0.16)).add(wash.mul(halo).mul(0.05))
    this.metalness = 0
    this.roughnessNode = float(0.14).add(plates.mul(0.3)).add(cilia.mul(0.2)).add(heart.mul(0.1)).clamp(0.03, 1)
    this.clearcoat = 1
    this.clearcoatRoughnessNode = float(0.05).add(heart.mul(0.08))
    this.normalNode = negateOnBackSide(bodyNormal)
    this.emissiveNode = rainbow.mul(rows).mul(crest).mul(0.8).mul(pulse)
      .add(wash.mul(halo).mul(0.14).mul(pulse))
      .add(color(hsl.integer(9, 100, 63)).mul(heart).mul(0.42))
      .add(color(hsl.integer(352, 100, 74)).mul(heart).mul(grazing).mul(0.16))
      .add(color(hsl.integer(298, 100, 68)).mul(canal).mul(intimate.mul(0.5).add(0.12)).mul(0.42))
      .add(color(hsl.integer(258, 100, 94.4)).mul(spark).mul(near.mul(0.6).add(0.4)).mul(1.25))
      .add(color(hsl.integer(261, 100, 74.5)).mul(plates).mul(rows).mul(near).mul(0.3))
      .add(color(hsl.integer(279, 100, 45.6)).mul(skin).mul(0.1))
      .add(color(hsl.integer(289, 100, 66)).mul(cilia).mul(near).mul(0.08))
  }
}

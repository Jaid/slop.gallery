import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, normalLocal, time, uv, vec3} from 'three/tsl'

import {surfaceLine} from '../../candidates/deepseek/lib/surfaceLine.ts'
import {uvFootprint} from '../../candidates/deepseek/lib/uvFootprint.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A deep-sea creature, still swimming. The body is gel: you can see into it, and what you see is moving. Nine radial canals run down the length of it, a ring of lappets fringes the bell, and a slow contraction travels along the whole animal, tightening the skin and firing the rows of light organs in step with the wave. The membranes carry a thin-film sheen, so the edges of the gel flare violet and green as you circle, and the deeper organs only become legible when you look through the skin at a grazing angle. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.95)
    this.name = knotData.id
    const p = viewerFrame().p
    const {view, facing, grazing, near, intimate} = viewerFrame()
    const tube = uv()
    const t = time
    const footprint = uvFootprint()
// A contraction wave travels the length of the animal once every two seconds.
    const phase = tube.x.mul(Math.PI * 6).sub(t.mul(Math.PI))
    const contraction = phase.sin().mul(0.5).add(0.5)
    const bell = contraction.pow(1.7)
    const canals = surfaceLine(tube.x.mul(9).fract().sub(0.5).abs(), float(0.006).add(footprint.u.mul(0.6)), footprint.u.mul(1.1))
    const lappets = tube.y.sub(0.7).add(tube.x.mul(18).mul(Math.PI * 2).cos().mul(0.035))
    const margin = surfaceLine(lappets.abs(), float(0.012), footprint.v)
    const inner = mx_fractal_noise_float(p.add(view.mul(0.05)).mul(11), 3, 2.05, 0.5).mul(0.5).add(0.5)
    const organField = mx_fractal_noise_float(p.add(view.mul(0.09)).mul(6.5), 3, 2, 0.5).mul(0.5).add(0.5)
    const organBand = tube.y.sub(0.34).abs().mul(-1).add(0.1).smoothstep(0, 0.06)
    const organ = organBand.mul(organField.smoothstep(0.52, 0.72)).mul(tube.x.mul(4).fract().sub(0.5).abs().mul(-1).add(0.12).smoothstep(0, 0.05))
    const flash = phase.sub(0.9).sin().mul(0.5).add(0.5).pow(6)
    const photophore = organBand.oneMinus().mul(tube.y.sub(0.62).abs().mul(-1).add(0.05).smoothstep(0, 0.04))
    const gel = mx_noise_float(p.mul(28).add(vec3(0, t.mul(0.03), 0))).mul(0.5).add(0.5)
    const bodySkin = mx_fractal_noise_float(p.mul(6), 3, 2, 0.5).mul(0.5).add(0.5)
    const membrane = mix(color(hsl.integer(218, 79, 16)), color(hsl.integer(197, 93, 51)), bodySkin.mul(0.5).add(0.3))
    this.colorNode = mix(color(hsl.integer(223, 72, 13)), membrane, lappets.abs().smoothstep(0.2, 0.02).oneMinus())
      .add(color(hsl.integer(208, 87, 28)).mul(canals.coverage.mul(canals.energy)))
      .add(color(hsl.integer(185, 85, 79)).mul(organ.mul(0.5)))
    const relief = canals.coverage.mul(0.5).add(margin.coverage.mul(0.8)).add(bell.mul(0.4)).add(inner.mul(0.3))
    this.positionNode = p.sub(normalLocal.mul(bell.mul(0.008).mul(near.mul(0.4).add(0.6))))
    this.normalNode = proceduralNormal(relief, 0.0016)
    this.metalnessNode = float(0.1)
    this.roughnessNode = mix(float(0.08), float(0.3), margin.coverage.mul(0.6).add(gel.mul(0.2)))
    this.iridescenceNode = float(0.4).add(grazing.mul(0.35))
    this.iridescenceIOR = 1.35
    this.iridescenceThicknessNode = bodySkin.mul(320).add(180).add(bell.mul(120))
    this.clearcoat = 0.5
    this.clearcoatRoughness = 0.06
    this.specularColorNode = mix(color(hsl.integer(192, 70, 88.6)), color(hsl.integer(0, 0, 100)), facing.mul(0.6))
    this.aoNode = mix(float(0.7), float(1), organ.mul(0.4).add(canals.coverage))
// Interior light: brighter where the gel is thin, brightest at the crest of a contraction.
    const interior = inner.mul(0.55).add(organField.mul(0.45)).mul(grazing.mul(0.5).add(0.6))
    this.emissiveNode = color(hsl.integer(188, 93, 82)).mul(interior.pow(2.2)).mul(0.7)
      .add(mix(color(hsl.integer(203, 99, 88.7)), color(hsl.integer(318, 100, 70.5)), organField.mul(1.4)).mul(organ).mul(1.35))
      .add(color(hsl.integer(196, 100, 96.8)).mul(photophore).mul(flash).mul(near.mul(0.7).add(0.35)).mul(1.6))
      .add(color(hsl.integer(187, 93, 74)).mul(canals.coverage.mul(canals.energy)).mul(bell.mul(0.6).add(0.5)).mul(0.8))
      .add(color(hsl.integer(291, 100, 55)).mul(grazing.pow(2.2)).mul(0.85))
      .add(color(hsl.integer(216, 100, 82)).mul(bell.pow(3)).mul(0.25))
      .add(color(hsl.integer(202, 99, 92)).mul(intimate).mul(facing.pow(3)).mul(0.35))
  }
}

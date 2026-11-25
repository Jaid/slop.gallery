import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, normalLocal, positionGeometry, tangentLocal, time, uv, vec3} from 'three/tsl'

import {wavelengthColor} from '../../candidates/space_bunny/lib/wavelength.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const combRows = 8
const gratingSpacing = 1320
/** The gallery's high window, in the knot's own frame. One honest light source, like the real sea. */
const windowLight = vec3(-3, 9, -16).normalize()
const T = tangentLocal
type Comb = {
  lean: Node<'float'>
  plate: Node<'float'>
  rib: Node<'float'>
}
/** One row of comb plates. The cilia are a regular grating with a spacing fixed in the animal's own frame, and they beat in a metachronal wave that runs down the row, so the colour the row returns slides along its length instead of sitting still. Once the plates fall below a pixel the wave is still there – only the individual cilia dissolve, exactly as they do in clear water. */
const combRow = (along: Node<'float'>, across: Node<'float'>, index: Node<'float'>, pitch: number): Comb => { // Three whole turns along the tube: the metachronal wave is periodic in u, so a row never ends.
  const beat = along.mul(TAU * 3).sub(time.mul(0.5)).add(index.mul(0.27)).sin()
  const spacing = along.mul(pitch).add(beat.mul(0.3))
  const offset = spacing.fract().sub(0.5).abs().sub(0.5).abs()
  const foot = spacing.fwidth().max(0.02)
  const plate = offset.smoothstep(0.36, float(0.36).add(foot.mul(1.4))).mul(foot.smoothstep(0.35, 1.1).oneMinus())
  const reach = across.abs().smoothstep(0.46, 0.36).oneMinus()
  return {
    lean: beat.mul(0.5).add(0.5),
    plate: plate.mul(reach),
    rib: reach.mul(0.5).add(0.5),
  }
}
/** Cilia. Eight comb rows run the length of a body that is almost entirely water, and every plate in them is a grating fine enough to send whole rainbows across a dark room. The colour obeys the grating equation, so it depends on the angle between the eye and the row: walking past the piece drags a spectrum along its length, and three diffraction orders overlap the way they do in a real spectroscope. Everything else is almost nothing – two dark masses, a skin of water, and a light that runs down the rows when the animal is pleased. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const {p, view, grazing, near, intimate, rim} = viewerFrame()
    const tube = uv()
    const rowIndex = tube.y.mul(combRows)
    const row = rowIndex.floor()
    const across = rowIndex.fract().sub(0.5)
    const nearRow = combRow(tube.x, across, row, 34)
    const farRow = combRow(tube.x, across, row.add(1), 34)
    const fineRow = combRow(tube.x, across, row.add(2), 120)
    const rib = nearRow.rib.max(farRow.rib)
    const plate = nearRow.plate.max(farRow.plate).max(fineRow.plate.mul(intimate))
// Grating equation for the first order: mλ = d(V·row − L·row), in the row's own tangent frame.
    const tangential = view.dot(T)
    const incidence = windowLight.dot(T)
    const order = tangential.sub(incidence)
    const wavelength = float(gratingSpacing).mul(order)
    const spectrum = wavelengthColor(wavelength)
      .add(wavelengthColor(wavelength.mul(2)).mul(0.34))
      .add(wavelengthColor(wavelength.mul(3)).mul(0.16))
    const inBand = order.abs().smoothstep(0.68, 0.52)
// Diffraction needs the light and the eye to graze the plates together.
    const incidenceAngle = windowLight.dot(normalLocal).abs()
    const graze = float(1).sub(incidenceAngle.mul(0.5)).sub(tangential.abs().mul(0.18)).max(0.04)
    const shimmer = rib.sub(0.5).mul(1.4).max(0).mul(inBand).mul(graze)
    const wave = tube.x.mul(2).sub(time.mul(0.11)).add(row.mul(0.19)).fract().sub(0.5).pow(2).mul(-9).exp()
    const jelly = mx_fractal_noise_float(p.mul(6).add(vec3(3.3, 8.1, 2.7)), 3, 2.1, 0.55).mul(0.5).add(0.5)
    const gut = mx_fractal_noise_float(p.mul(2.2).add(vec3(7.1, 1.9, 5.3)), 2, 2.2, 0.5).mul(0.5).add(0.5)
    let flesh = mix(vec3(0.03, 0.09, 0.12), vec3(0.11, 0.24, 0.28), jelly.pow(0.8))
    flesh = mix(flesh, vec3(0.015, 0.05, 0.07), gut.pow(2.4).mul(0.7))
    flesh = mix(flesh, vec3(0.14, 0.34, 0.38), rib.mul(0.3))
    flesh = mix(flesh, vec3(0.62, 0.8, 0.85), rib.pow(8).mul(0.6))
    flesh = mix(flesh, vec3(0.75, 0.9, 0.95), plate.mul(0.5))
    this.colorNode = flesh
    this.metalness = 0
    this.roughnessNode = float(0.1).add(jelly.mul(0.06)).sub(plate.mul(0.05)).clamp(0.04, 0.4)
    this.clearcoatNode = float(0.7)
    this.clearcoatRoughness = 0.05
    this.ior = 1.34
    this.sheenNode = float(0.45).add(grazing.mul(0.45))
    this.sheenColor.set(hsl.integer(236, 100, 89))
    this.sheenRoughness = 0.25
    this.specularIntensityNode = float(0.9)
    const bump = proceduralNormal(plate.mul(0.0006).add(jelly.mul(0.0005)), 1)
    this.normalNode = bump
// A comb jelly is almost all water: the ridges it can raise are millimetres at most.
    const swell = mx_fractal_noise_float(p.mul(3.4).add(vec3(1.3, 6.7, 9.1)), 2, 2.1, 0.5)
    this.positionNode = positionGeometry.add(normalLocal.mul(swell.mul(0.0012).add(rib.mul(0.0005))))
    const sparkle = glints(bump, 120).mul(plate).mul(near.mul(0.7).add(0.3))
    this.emissiveNode = spectrum.mul(shimmer.mul(0.85))
      .add(color(hsl.integer(0, 0, 100)).mul(shimmer.pow(2.2).mul(0.45)))
      .add(color(hsl.integer(221, 100, 83.5)).mul(wave.mul(0.12)))
      .add(color(hsl.integer(0, 0, 100)).mul(sparkle.mul(0.2)))
      .add(vec3(0.16, 0.4, 0.52).mul(grazing.pow(2.2).mul(0.2)))
      .add(vec3(0.45, 0.7, 0.8).mul(rim.mul(0.08).mul(nearRow.lean.mul(0.5).add(0.5))))
  }
}

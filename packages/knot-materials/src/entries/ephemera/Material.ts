import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mx_fractal_noise_float, mx_noise_float, mx_noise_vec3, time, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const filmIndex = 1.34
/** Ephemera. A soap film stretched over the knot: a water skin a few hundred nanometres thick. Light reflecting off the front and back of that skin interferes with itself, and because the film drains and swirls the interference order sweeps through the whole spectrum, so the surface is never the same color twice. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const {p, facing, grazing, near} = viewerFrame()
// The film drains under gravity and is stirred by Marangoni convection.
    const drain = p.y.mul(-330)
    const curl = mx_noise_vec3(p.mul(3.4)).mul(0.9)
// Fringes of equal thickness: bands stretched across the drainage direction.
    const bands = mx_noise_float(vec3(p.x.mul(11), p.y.mul(2.2), p.z.mul(11)).add(curl))
    const swirl = mx_fractal_noise_float(p.mul(5.5).add(curl).add(vec3(0, time.mul(0.09), 0)), 3, 2, 0.5)
    const ripple = mx_noise_float(p.mul(13).add(vec3(time.mul(0.05), time.mul(-0.04), time.mul(0.03))))
    const thickness = swirl.mul(220).add(bands.mul(150)).add(ripple.mul(60)).add(drain).add(520).clamp(40, 900)
// The angle inside the film, from Snell's law.
    const cosTheta = float(1).sub(facing.mul(facing).oneMinus().div(filmIndex * filmIndex)).max(0).sqrt()
    const path = thickness.mul(2).mul(filmIndex).mul(cosTheta)
// Interference of the two reflected waves, one per primary.
    const film = vec3(path.div(680), path.div(530), path.div(440)).mul(TAU).cos().mul(0.5).add(0.5)
// Where the film is thinnest it collapses into a Newton black film that reflects nothing.
    const blackFilm = thickness.smoothstep(70, 170).oneMinus()
    const sheen = film.pow(1.7).mul(1.25).clamp().mul(blackFilm.oneMinus())
    this.colorNode = color(hsl.integer(261, 33, 5.5))
// A soap film is mostly air: it only becomes visible where it reflects.
    this.transparent = true
    this.opacityNode = float(0.25).add(sheen.mul(0.5)).add(grazing.pow(2).mul(0.4)).clamp()
    this.metalness = 0
    this.roughnessNode = float(0.012).add(ripple.mul(0.008))
    this.transmission = 0.9
    this.thickness = 0
    this.ior = filmIndex
    this.attenuationColor.set(hsl.integer(227, 100, 87))
    this.attenuationDistance = 2.2
    this.iridescence = 1
    this.iridescenceIOR = filmIndex
    this.iridescenceThicknessNode = thickness
    this.clearcoat = 1
    this.clearcoatRoughness = 0.006
    this.normalNode = proceduralNormal(ripple.mul(0.3), 0.0003)
    this.clearcoatNormalNode = this.normalNode
    this.emissiveNode = sheen.mul(near.mul(0.25).add(0.6)).mul(1.6)
      .add(color(hsl.integer(230, 100, 90)).mul(grazing.pow(3)).mul(0.2))
  }
}

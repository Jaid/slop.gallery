import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, mx_noise_vec3, normalLocal, positionGeometry, time, vec3} from 'three/tsl'

import {cellularPoints} from '../../lib/cellularPoints.ts'
import {hairline} from '../../lib/hairline.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A full-saturation hue wheel in linear light: the color of a diffraction grating, not a pigment. */
function diffractionSpectrum(phase: Node<'float'>) {
  return vec3(phase, phase.add(2.0944), phase.add(4.1888)).cos().mul(0.5).add(0.5)
}

/** Black opal. A sediment of ordered silica microspheres: each neighbourhood has its own lattice spacing, and the spacing plus the angle of your gaze decide which wavelength survives. The color is interference, so it migrates across the surface as you walk; the body stays nearly black so the diffraction can shout. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.85)
    this.name = knotData.id
    const {p, view, facing, grazing, rim, near, intimate} = viewerFrame()
// The spheres are still settling – a drift far too slow to notice directly.
    const drift = vec3(time.mul(0.004), time.mul(-0.003), time.mul(0.0025))
    const domain = mx_noise_vec3(p.mul(10).add(drift)).mul(0.5).add(0.5)
    const grain = mx_fractal_noise_float(p.mul(23), 3, 2.05, 0.55).mul(0.5).add(0.5)
    const spacing = domain.x.mul(0.7).add(0.28)
    const planes = domain.sub(0.5).mul(2).normalize()
    const tilt = view.dot(planes).abs()
// Bragg: a wider lattice diffracts a longer wavelength, and tilting
// the gaze away from the lattice planes shortens it.
    const bragg = spacing.mul(1.9).add(domain.z.mul(0.35)).sub(tilt.mul(0.45)).add(grain.mul(0.08))
    const spectrum = diffractionSpectrum(bragg.mul(TAU))
    const ordered = domain.y.smoothstep(0.2, 0.5)
    const fire = domain.z.pow(1.25)
// Pinfire: the fire is granular, never a smooth wash. The grain grows
// finer as the viewer leans in, which is where the lattice resolves.
    const pinfire = grain.mul(0.55).add(0.45).mul(near.mul(0.35).add(0.65))
    const incidence = grazing.mul(0.5).add(0.5)
    const play = ordered.mul(fire).mul(pinfire).mul(incidence).clamp()
    const body = mix(color(hsl.integer(262, 45, 3.3)), color(hsl.integer(249, 35, 9)), grain.mul(0.7).add(0.1))
    const potch = mix(color(hsl.integer(256, 18, 55)), color(hsl.integer(252, 21, 30)), grain)
    const stone = mix(body, potch, ordered.oneMinus().mul(grain.mul(0.35).add(0.2)))
    this.colorNode = mix(stone, spectrum.mul(1.5), play)
    this.metalness = 0
    this.roughnessNode = float(0.07).add(grain.mul(0.05)).sub(play.mul(0.025))
    this.clearcoat = 0.42
    this.clearcoatRoughness = 0.03
    this.iridescenceNode = play.mul(0.3)
    this.iridescenceIOR = 1.5
    this.iridescenceThicknessNode = bragg.mul(260).add(280)
// A hand-polished nodule is never a perfect torus, and the lattice
// itself only resolves once a sphere covers more than a pixel. Both
// heights are in object units, so the bump normal needs no fudge.
    const undulation = mx_fractal_noise_float(p.mul(3.4), 3, 2.05, 0.55).mul(0.0045)
    const spheres = cellularPoints(p.mul(78).add(drift.mul(4)), 0.05, 0.235, 0)
    const lattice = spheres.mul(0.0007).mul(near.mul(0.8).add(0.2))
    this.positionNode = positionGeometry.add(normalLocal.mul(undulation))
    this.normalNode = proceduralNormal(undulation.add(lattice), 1)
// Contra-luz: backlit opal shows its fire from within.
    const flameField = mx_fractal_noise_float(p.mul(13).add(vec3(0, time.mul(0.03), 0)), 4, 2.1, 0.5)
    const flame = hairline(flameField.sub(0.02), 0.022)
    const shimmer = mx_noise_float(p.mul(46)).mul(play).mul(facing.mul(0.6).add(0.4))
    const sparkle = mx_fractal_noise_float(p.mul(120).add(drift.mul(9)), 2, 2.2, 0.5).mul(0.5).add(0.5).pow(9).mul(near)
    const contraLuz: Node<'vec3'> = spectrum
      .mul(play)
      .mul(intimate.mul(0.55).add(0.16))
      .mul(0.95)
      .add(color(hsl.integer(250, 100, 90)).mul(flame).mul(play.mul(0.6).add(0.08)).mul(0.35))
      .add(color(hsl.integer(252, 99, 77)).mul(rim).mul(near.mul(0.5).add(0.5)).mul(0.05))
      .add(spectrum.mul(shimmer).mul(near).mul(0.3))
      .add(spectrum.mul(sparkle).mul(play).mul(2.4))
    this.emissiveNode = contraLuz
  }
}

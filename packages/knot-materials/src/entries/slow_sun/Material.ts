import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, color, exp, float, Fn, max, mix, mx_cell_noise_float, mx_fractal_noise_float, mx_noise_float, mx_noise_vec3, positionViewDirection, sin, time, transformNormalToView, uv, varying, vec2, vec3} from 'three/tsl'

import {bumpNormal} from '../../candidates/deepseek/lib/bumpNormal.ts'
import {voronoiSurface} from '../../candidates/deepseek/lib/voronoiSurface.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {filament} from '../../lib/filament.ts'
import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const granulePeriod = vec2(90, 11)
const spotCentres = [vec2(1.25, 0.32), vec2(3.45, 0.6), vec2(5.72, 0.23)] as const
function solarPalette(h: Node<'float'>) {
  let c = mix(color(hsl.integer(32, 100, 5.4)), color(hsl.integer(31, 100, 23.7)), h.smoothstep(0, 0.18))
  c = mix(c, color(hsl.integer(33.7, 100, 47)), h.smoothstep(0.18, 0.42))
  c = mix(c, color(hsl.integer(49, 100, 67)), h.smoothstep(0.42, 0.64))
  c = mix(c, color(hsl.integer(81, 100, 82.4)), h.smoothstep(0.64, 0.82))
  c = mix(c, color(hsl.integer(94, 100, 96.4)), h.smoothstep(0.82, 1))
  return c
}
/** Convection, spots, faculae, a flare and the bright chromosphere, all boiling in object space. */
function sunFields(tube: Node<'vec2'>, p: Node<'vec3'>) {
  const m = vec2(tube.x.mul(7.177), tube.y.mul(0.8168))
  const boil = mx_noise_vec3(p.mul(9).add(vec3(time.mul(0.055), time.mul(-0.032), time.mul(0.021)))).xy.mul(0.85)
  const drift = vec2(time.mul(0.018), 0)
  const cells = voronoiSurface(tube.mul(granulePeriod).add(boil).add(drift), granulePeriod, 17.7)
  const lane = cells.edge.smoothstep(0, 0.16).oneMinus()
  const fine = mx_fractal_noise_float(p.mul(19).add(vec3(0, 0, time.mul(0.08))), 3, 2.05, 0.55).mul(0.5).add(0.5)
  let heat = float(0.4).add(cells.random.x.mul(0.2).mul(lane.oneMinus())).add(fine.mul(0.3)).sub(lane.mul(0.46))
  let active: Node<'float'> = float(0)
  let spotDark: Node<'float'> = float(0)
  let spotRim: Node<'float'> = float(0)
  for (const centre of spotCentres) {
    const delta = m.sub(centre)
    const radius = delta.length()
    const angle = atan(delta.y, delta.x)
    const breathe = sin(time.mul(0.19).add(centre.x.mul(3.1))).mul(0.005)
    const umbra = radius.smoothstep(0.09, breathe.add(0.14)).oneMinus()
    const penumbra = radius.smoothstep(0.155, breathe.add(0.285)).oneMinus()
    const filaments = sin(angle.mul(44).add(mx_noise_float(p.mul(26).add(vec3(centre, 5.1))).mul(5.2))).max(0).pow(7)
    const penumbraDark = penumbra.mul(0.45).mul(filaments.mul(0.7).oneMinus())
    spotDark = spotDark.add(umbra.mul(1.05)).add(penumbra.mul(0.32)).add(penumbraDark)
    spotRim = max(spotRim, exp(radius.sub(0.213).pow2().mul(-7000)).mul(0.12).add(penumbra.mul(filaments).mul(0.16)))
    active = max(active, penumbra)
  }
  const faculaField = mx_fractal_noise_float(p.mul(34).add(vec3(2.2, 8.1, 4.4)), 4, 2.02, 0.6)
  const facula = filament(faculaField, 0.009).mul(active.mul(0.45).add(0.06))
  const brightPoints = mx_noise_float(p.mul(62).add(vec3(0, 0, time.mul(0.11)))).smoothstep(0.72, 0.9).mul(0.14)
// A new active region ignites every couple of seconds and hurls a ring of light outward.
  const slot = time.mul(0.58)
  const slotIndex = slot.floor()
  const slotPhase = slot.fract()
  const flareRandom = cellNoiseVec3(vec3(slotIndex, 2.3, 7.1))
  const flareCentre = vec2(flareRandom.x.mul(7.177), flareRandom.y.mul(0.8168))
  const flareRadius = m.sub(flareCentre).length()
  const flarePulse = slotPhase.oneMinus().pow(5).mul(slotPhase.smoothstep(0, 0.06))
  const flare = exp(flareRadius.pow2().mul(-420)).mul(flarePulse)
  const flareRing = exp(flareRadius.sub(slotPhase.mul(0.34)).pow2().mul(-2600)).mul(flarePulse).mul(0.5)
  const arcs = filament(mx_noise_float(m.mul(vec2(9, 12)).add(vec3(0, 0, time.mul(0.045)))), 0.006).mul(active.mul(0.3).add(0.02))
  heat = heat.sub(spotDark).add(spotRim).add(facula.mul(0.32)).add(brightPoints).add(flare.mul(0.85)).add(flareRing.mul(0.65)).clamp(0, 1.25)
  return {
    arcs,
    cells,
    flare,
    flareRing,
    heat,
    lane,
    spotDark,
  }
}
const sunPosition = Fn(([tube]: [Node<'vec2'>]) => {
  const {position: p, normal} = knotFrame(tube)
  const swell = mx_noise_float(p.mul(2.35).add(vec3(4.1, 1.7, 7.2))).mul(0.0022)
  const boil = mx_noise_float(p.mul(6.4).add(vec3(0, 0, time.mul(0.09)))).mul(0.0021)
  return p.add(normal.mul(swell.add(boil)))
})

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.12)
    this.name = knotData.id
    const tube = uv()
    this.positionNode = sunPosition(tube)
    const epsilon = 0.0004
    const du = sunPosition(tube.add(vec2(epsilon, 0))).sub(sunPosition(tube.sub(vec2(epsilon, 0))))
    const dv = sunPosition(tube.add(vec2(0, epsilon))).sub(sunPosition(tube.sub(vec2(0, epsilon))))
    const surfaceNormal = varying(transformNormalToView(du.cross(dv).normalize())).normalize()
    const {p, grazing, near} = viewerFrame()
    const fields = sunFields(tube, p)
// The boiling granulation is a relief only in the shading; it steers the limb darkening and the highlights.
    const hotPoints = mx_cell_noise_float(p.mul(84)).smoothstep(0.86, 0.94).mul(0.5).add(mx_noise_float(p.mul(58).add(vec3(0, 0, time.mul(0.18)))).smoothstep(0.82, 0.94).mul(0.35))
    const granuleRelief = fields.heat.mul(near.mul(0.00032).add(0.00012)).add(mx_noise_float(p.mul(95).add(vec3(1.7, 4.4, 8.2))).mul(near.mul(0.0002)))
    const bump = bumpNormal(granuleRelief, surfaceNormal, 1.1)
    this.normalNode = bump
    this.clearcoatNormalNode = bump
    const fakeLight = transformNormalToView(vec3(-0.34, 0.72, 0.6).normalize())
    const boilShade = bump.dot(fakeLight).mul(0.32).add(0.68)
    const facing = bump.dot(positionViewDirection).abs().clamp()
    const limb = facing.pow(0.33).mul(0.72).add(0.28)
    const hue = solarPalette(fields.heat)
    const hot = fields.heat.pow(2.2)
    this.colorNode = hue.mul(0.16)
    this.metalness = 0
    this.roughness = 0.82
    this.ior = 1.2
    this.clearcoat = 0.08
    this.clearcoatRoughness = 0.55
    const granulation = fields.lane.oneMinus().mul(0.38).add(0.62)
    const spotShade = fields.spotDark.mul(0.65).oneMinus().max(0.18)
    this.emissiveNode = hue.mul(limb).mul(boilShade).mul(granulation).mul(spotShade).mul(1.05)
      .add(color(hsl.integer(94, 100, 97)).mul(fields.flare.mul(2.2)))
      .add(color(hsl.integer(83, 100, 86.6)).mul(fields.flareRing.mul(0.9)))
      .add(color(hsl.integer(72, 100, 79.1)).mul(fields.arcs.mul(0.55)))
      .add(color(hsl.integer(92, 100, 94.7)).mul(fields.arcs.mul(0.38)))
      .add(color(hsl.integer(91, 100, 97.6)).mul(fields.heat.smoothstep(0.88, 1.12).mul(0.45)))
      .add(color(hsl.integer(89, 100, 96.3)).mul(fields.flare.mul(0.9)))
      .add(color(hsl.integer(97, 100, 98.4)).mul(hotPoints))
      .add(color(hsl.integer(43.8, 100, 65.3)).mul(grazing.pow(4)).mul(0.9))
      .add(color(hsl.integer(78, 100, 89)).mul(grazing.pow(10)).mul(0.38))
      .add(color(hsl.integer(61, 100, 73.8)).mul(grazing.pow(2).mul(near).mul(mx_noise_float(p.mul(22).add(vec3(0, 0, time.mul(0.2)))).mul(0.5).add(0.5)).mul(0.16)))
      .add(color(hsl.integer(83, 100, 93.2)).mul(hot.mul(0.12)))
  }
}

import type {Node, Texture} from 'three/webgpu'

import {float, mix, mx_fractal_noise_float, mx_noise_float, normalLocal, positionViewDirection, time, transformNormalToView, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../candidates/claude_fable/lib/cellNoiseVec3.ts'
import {debugLayer} from '../../candidates/claude_fable/lib/debugLayer.ts'
import {environmentHighlight} from '../../candidates/claude_fable/lib/environmentHighlight.ts'
import {fresnel, interiorRay} from '../../candidates/claude_fable/lib/interiorRay.ts'
import {proceduralNormal} from '../../candidates/claude_fable/lib/proceduralNormal.ts'
import {rgb} from '../../candidates/claude_fable/lib/rgb.ts'
import {spectralColor} from '../../candidates/claude_fable/lib/spectralColor.ts'
import {viewerFrame} from '../../candidates/claude_fable/lib/viewerFrame.ts'
import {voronoi} from '../../candidates/claude_fable/lib/voronoi.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import knotData from './data.ts'

const opalIndex = 1.45
/** View-space studio lamps shared with the glint helper: each patch diffracts each lamp separately. */
const lamps = [vec3(0.35, 0.78, 0.52), vec3(-0.62, 0.28, 0.73), vec3(0.1, -0.35, 0.93)]
/** One layer of play-of-color: Voronoi patches of ordered silica spheres, each a diffraction grating with its own orientation and spacing. A patch flashes a color when the grating equation is satisfied between a lamp and the eye, so each patch has a narrow window of view directions – walk past and the fire jumps from patch to patch. */
function playOfColor(position: Node<'vec3'>, normal: Node<'vec3'>, scale: number, seed: number) {
  const q = position.mul(scale).add(seed * 13.7)
  const {cell, edge} = voronoi(q)
  const patch = cellNoiseVec3(cell.add(seed * 7.3))
  const patch2 = cellNoiseVec3(cell.add(seed * 7.3 + 11.1))
// Grating vector in the tangent plane: random orientation, spacing tuned so visible orders sweep through the spectrum.
  const tangentA = normal.cross(vec3(0.3, 0.9, 0.1)).normalize()
  const tangentB = normal.cross(tangentA)
  const orientation = patch.x.mul(Math.PI * 2)
// Sphere spacing in visible-wavelength units (the sphere lattice of opal is 150–350 nm).
  const spacing = patch.y.mul(1.1).add(0.3)
  const grating = tangentA.mul(orientation.cos()).add(tangentB.mul(orientation.sin()))
  const gratingView = transformNormalToView(grating)
  let fire: Node<'vec3'> = vec3(0)
  for (const lamp of lamps) {
// The grating equation d·(sin θi − sin θr) = m·λ: the geometry selects one wavelength per diffraction order.
// As the viewer moves, that wavelength sweeps through the spectrum and out of the visible range – the flash.
    const path = lamp.normalize().sub(positionViewDirection).dot(gratingView).abs().mul(spacing)
    for (const order of [1, 2]) {
      const wavelength = path.div(order)
      const visible = wavelength.smoothstep(0.38, 0.43).mul(wavelength.smoothstep(0.72, 0.66))
      const hue = float(0.7).sub(wavelength).div(0.3).mul(Math.PI * 1.7)
      fire = fire.add(spectralColor(hue).mul(visible).mul(order === 1 ? 1 : 0.35))
    }
  }
  const gate = patch2.y.smoothstep(0.62, 0.7)
  const border = edge.smoothstep(0.01, 0.07)
  return fire.mul(gate).mul(border).mul(patch2.z.mul(0.8).add(0.5))
}
/** Precious opal. Under a polished dome the stone holds several depths of play-of-color, each patch a tiny diffraction grating that only lights up for a particular angle between lamp and eye. The colors therefore belong to the viewer's position, not to the stone: they slide, vanish and reappear as one walks around the piece. The milky body scatters a soft blue (opalescence) at the limb and warms to a faint orange where light passes through thicker stone. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.45)
    this.name = knotData.id
    const {p, facing, grazing, near, intimate} = viewerFrame()
    const n = normalLocal.normalize()
    const ray = interiorRay(opalIndex, n)
// Three layers of patches at increasing depth and decreasing size, each seen through the stone with parallax.
    const layerA = playOfColor(ray.at(0.006), n, 22, 1)
    const layerB = playOfColor(ray.at(0.02), n, 38, 2)
    const layerC = playOfColor(ray.at(0.045), n, 64, 3)
    const depthTint = vec3(1, 0.9, 0.78)
    const fire = layerA.add(layerB.mul(depthTint).mul(0.8)).add(layerC.mul(depthTint.mul(depthTint)).mul(0.6))
// The milky body: white opal with a blue opalescence at grazing angles and a warm transmitted tint at the limb.
    const body = mx_fractal_noise_float(p.mul(7), 3, 2, 0.5).mul(0.5).add(0.5)
    const milk = mix(rgb('#f7f3ec'), rgb('#e3ecf6'), body)
    const opalescence = rgb('#9cc3ff').mul(grazing.pow(2)).mul(0.2)
    const warmth = rgb('#ffb680').mul(grazing.pow(6)).mul(0.4)
    this.colorNode = milk.mul(0.17)
    this.metalness = 0
    this.ior = opalIndex
// The polished dome: a slightly rippled surface with a glassy clearcoat.
    const ripple = mx_noise_float(p.mul(11)).mul(0.5).add(mx_noise_float(p.mul(33)).mul(0.2))
    this.normalNode = proceduralNormal(ripple.mul(0.003), 1)
    this.roughnessNode = float(0.16).add(body.mul(0.06))
    this.clearcoat = 0.7
    this.clearcoatRoughness = 0.06
    this.sheen = 0.3
    this.sheenColor.set('#cfe0ff')
    this.sheenRoughness = 0.6
// Fire passes the dome's Fresnel transmittance; the brightest flashes overshoot for the tone mapper to bloom.
    const transmit = fresnel(facing, 0.035).oneMinus()
    const highlight = environmentHighlight(environment, n, 0.03).mul(fresnel(facing, 0.035)).mul(0.5)
    const breath = time.mul(0.3).sin().mul(0.05).add(1)
    const {emissive, isolated} = debugLayer({
      fire,
      layerA,
      layerB,
      layerC,
      opalescence,
      warmth,
      highlight,
    }, () => fire.mul(transmit).mul(near.mul(0.5).add(1)).mul(breath).mul(1.7)
      .add(opalescence).add(warmth)
      .add(highlight)
      .add(milk.mul(intimate).mul(0.02)))
    this.emissiveNode = emissive
    if (isolated) {
      this.colorNode = vec3(0)
      this.envMapIntensity = 0
      this.clearcoat = 0
      this.sheen = 0
    }
  }
}

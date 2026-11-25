import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraViewMatrix, color, float, mix, modelViewMatrix, mx_noise_float, normalViewGeometry, positionViewDirection, time, vec3, vec4} from 'three/tsl'

import {detailNormal} from '../../candidates/deepseek/lib/detailNormal.ts'
import {filament} from '../../lib/filament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Rutile needles of corundum sit at 120°, so their three families draw a star of six rays. */
const axisAngles = [0, Math.PI * 2 / 3, Math.PI * 4 / 3]
const cAxis = vec3(0.31, 0.87, 0.39).normalize()
const aAxis = cAxis.cross(vec3(0.9, -0.3, 0.2)).normalize()
const bAxis = cAxis.cross(aAxis).normalize()
/** The crystal axis at an angle inside the basal plane, as an object-space and a view-space direction. */
const axisObject = (angle: number) => aAxis.mul(Math.cos(angle)).add(bAxis.mul(Math.sin(angle))).normalize()
const axisView = (angle: number) => modelViewMatrix.mul(vec4(axisObject(angle), 0)).xyz.normalize()
/** A star ruby. Needles of rutile grew along three axes of the corundum lattice, and light that grazes them is thrown back the way it came, so a six-rayed star floats over the stone and follows the eye across it. Move closer and the silk itself appears: hair-fine needles at 120°, and the growth zones the crystal laid down while it cooled. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.72)
    this.name = knotData.id
    const {p, grazing, near, intimate} = viewerFrame()
    const view = positionViewDirection
// Two of the studio lights: the key lamp and a cool panel further around the room.
    const keyLight = cameraViewMatrix.mul(vec4(-3, 9, -16, 0)).xyz.normalize()
    const panel = cameraViewMatrix.mul(vec4(0.62, -0.2, 0.75, 0)).xyz.normalize()
// Silk: hair-fine needles along each axis, with a slow crystalline tilt so nothing is perfectly ruled.
    const tilt = mx_noise_float(p.mul(2.4)).mul(0.22)
    let silk: Node<'float'> = float(0)
    for (const [index, angle] of axisAngles.entries()) {
      const across = p.dot(cAxis.cross(axisObject(angle)).normalize())
      silk = silk.max(filament(across.mul(620 + index * 110).add(tilt.mul(5)).sin(), 0.05))
    }
    const silkGlow = silk.mul(near.mul(0.85).add(0.15))
    const shadedNormal = detailNormal(normalViewGeometry, silk.mul(near).mul(0.00035), 0.5)
/** Asterism: every ray is sharp across its needle axis and long along its own direction. */
    const star = (light: Node<'vec3'>, weight: number, width: number, length: number) => {
      const mirror = light.add(view).normalize()
      const offset = shadedNormal.sub(mirror)
      let burst: Node<'float'> = offset.lengthSq().div(width * width).negate().exp().mul(0.85)
      for (const angle of axisAngles) {
        const axis = axisView(angle)
// The tiny offset keeps the cross product from vanishing where the needle meets the normal head-on.
        const ray = shadedNormal.cross(axis).add(vec3(0.0001)).normalize()
        const across = offset.dot(axis).div(width)
        const along = offset.dot(ray).abs().div(length).pow(1.15)
        burst = burst.add(across.mul(across).negate().exp().mul(along.negate().exp()).mul(0.5))
      }
      return burst.mul(weight)
    }
    const asterism = star(keyLight, 1, 0.05, 0.6).add(star(panel, 0.4, 0.075, 0.42))
// Growth zoning and the cloudy interior the stone hides behind its polish.
    const zoning = mx_noise_float(p.mul(5.5).add(vec3(2.2, 6.6, 4.4))).mul(0.5).add(0.5)
    const growth = p.dot(cAxis).mul(9).sin().mul(0.5).add(0.5)
    const interior = mx_noise_float(p.mul(3.1)).mul(0.5).add(0.5).smoothstep(0.42, 0.9)
    const heart = color(hsl.integer(26, 98, 45.4)).mul(interior).mul(time.mul(0.21).sin().mul(0.18).add(0.92))
    this.colorNode = mix(color(hsl.integer(16, 87, 13)), color(hsl.integer(21, 91, 29)), zoning.mul(0.55).add(growth.mul(0.25)))
      .add(color(hsl.integer(12, 77, 5)).mul(silk.mul(0.35)))
    this.metalness = 0
    this.roughnessNode = float(0.055).add(silk.mul(near).mul(0.09)).add(growth.mul(0.02)).clamp(0.03, 1)
    this.clearcoat = 1
    this.clearcoatRoughnessNode = float(0.028).add(silk.mul(near).mul(0.03))
    this.ior = 1.77
    this.normalNode = shadedNormal
    this.emissiveNode = mix(color(hsl.integer(2, 100, 77)), color(hsl.integer(357, 100, 97)), asterism).mul(asterism).mul(0.62)
      .add(heart.mul(0.12))
      .add(color(hsl.integer(16, 100, 64.3)).mul(silkGlow).mul(0.07))
      .add(color(hsl.integer(22, 100, 59)).mul(grazing.pow(2.4)).mul(0.13))
      .add(color(hsl.integer(1, 100, 88.5)).mul(asterism.mul(intimate)).mul(0.2))
  }
}

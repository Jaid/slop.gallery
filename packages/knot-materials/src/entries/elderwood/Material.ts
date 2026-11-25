import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {bitangentLocal, color, float, mix, mx_noise_float, mx_noise_vec3, normalViewGeometry, tangentLocal, vec2, vec3} from 'three/tsl'

import {breath} from '../../candidates/gpt_sol/lib/exhibition/facetOptics.ts'
import {crest, resolved, stroke, wave} from '../../candidates/gpt_sol/lib/exhibition/patterns.ts'
import {engravedNormal} from '../../candidates/gpt_sol/lib/exhibition/ReliefKnotMaterial.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import data from './data.ts'

/** A knot carved out of an ancient mineralized trunk: the growth rings continue through every loop. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.85)
    this.name = data.id
    const {p, view, grazing, near, intimate} = viewerFrame()
    const curl = mx_noise_vec3(p.mul(2.4).add(5.8)).mul(0.065).toVar()
    const tree = p.add(curl)
    const radius = vec2(tree.y.mul(1.15), tree.z.mul(1.6)).length().toVar()
    const burl = mx_noise_float(tree.mul(vec3(2.5, 7, 7))).mul(2.5).toVar()
    const ringPhase = radius.mul(108).add(burl).add(tree.x.mul(3))
    const ring = wave(ringPhase).mul(0.5).add(0.5).toVar()
    const latewood = crest(ringPhase, 7).toVar()
    const eras = wave(radius.mul(19).add(burl.mul(0.2))).mul(0.5).add(0.5)
    const fiberSpace = tree.mul(vec3(12, 180, 180))
    const fiber = mx_noise_float(fiberSpace).mul(resolved(fiberSpace)).toVar()
    const poreSpace = tree.mul(vec3(24, 310, 310))
    const vessels = mx_noise_float(poreSpace).mul(0.5).add(0.5).smoothstep(0.55, 0.78)
      .mul(resolved(poreSpace)).toVar()
    const char = mx_noise_float(p.mul(4.5).add(18)).mul(0.5).add(0.5).smoothstep(0.55, 0.75).toVar()
    const mineralField = mx_noise_float(p.mul(5.5).add(47)).mul(0.5).add(0.5)
    const mineral = mineralField.smoothstep(0.54, 0.67)
      .mul(latewood.mul(0.75).add(0.25)).mul(char.oneMinus()).toVar()
    const wood = mix(color(hsl.integer(41, 56, 16)), color(hsl.integer(54, 64, 51)), eras.mul(0.55).add(ring.mul(0.45)))
      .mul(latewood.mul(-0.33).add(1)).mul(fiber.mul(0.12).add(0.96))
    const darkWood = mix(wood, color(hsl.integer(138, 11, 11)).mul(fiber.mul(0.1).add(0.9)), char.mul(0.9))
    const jade = mix(color(hsl.integer(168, 81, 25)), color(hsl.integer(148, 45, 61)), ring.mul(0.4).add(mineralField.mul(0.6)))
    const grainAxis = vec3(1, 0.12, 0.05).normalize()
    const radialPlane = tree.mul(vec3(0, 1, 1.6)).add(vec3(0, 0.05, 0))
    const chatoyantPlane = radialPlane.div(radialPlane.length().max(0.000001))
    const crossPlane = chatoyantPlane.cross(grainAxis)
    const eyeField = view.dot(crossPlane.div(crossPlane.length().max(0.000001))).toVar()
    const eye = stroke(eyeField, 0.095, eyeField.fwidth())
      .mul(char.oneMinus()).mul(near.mul(0.25).add(0.75)).toVar()
    this.colorNode = mix(darkWood, jade, mineral)
      .add(color(hsl.integer(73, 65, 58)).mul(eye).mul(latewood.oneMinus()).mul(0.075))
    this.metalnessNode = mineral.mul(0.25).add(0.065)
    this.roughnessNode = mix(float(0.34).add(latewood.mul(0.12)), float(0.62), char)
      .mix(0.24, mineral).sub(eye.mul(0.03)).clamp(0.21, 0.66)
    const relief = ring.mul(0.0006).sub(latewood.mul(0.00035)).add(fiber.mul(0.000075))
      .sub(vessels.mul(0.00017)).add(mineral.mul(0.0002))
    this.normalNode = engravedNormal(normalViewGeometry, relief, 0.8)
    this.clearcoat = 0.75
    this.clearcoatNode = char.mul(-0.62).add(0.75)
    this.clearcoatRoughnessNode = char.mul(0.15).add(0.13)
    this.clearcoatNormalNode = engravedNormal(normalViewGeometry, ring.mul(0.0002).add(mineral.mul(0.0001)), 0.4)
    this.anisotropy = 0.68
    // Project the trunk’s object-space grain into the surface frame; end grain becomes isotropic.
    const grainFlow = vec2(grainAxis.dot(tangentLocal), grainAxis.dot(vec3(bitangentLocal as unknown as Node<'vec3'>)))
    this.anisotropyNode = grainFlow.mul(0.68).mul(char.oneMinus())
    const sapPulse = radius.mul(13).add(breath).sin().mul(0.5).add(0.5).pow(4)
    this.emissiveNode = color(hsl.integer(141, 50, 71)).mul(mineral).mul(sapPulse).mul(intimate.mul(0.065).add(0.02))
      .add(color(hsl.integer(70, 67, 66)).mul(eye).mul(grazing.mul(0.35).add(0.1)).mul(0.1))
    this.aoNode = vessels.mul(-0.12).sub(char.mul(0.12)).add(1)
    this.userData = {
      collection: 'The Unwritten Atlas',
      opticalEffect: 'mineralized growth rings and chatoyant grain',
    }
  }
}

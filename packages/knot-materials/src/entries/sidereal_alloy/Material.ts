import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {bitangentLocal, color, float, mix, mx_cell_noise_vec3, mx_noise_float, normalViewGeometry, tangentLocal, vec2, vec3} from 'three/tsl'

import {breath, facetGlints, tangentViewFrame} from '../../candidates/gpt_sol/lib/exhibition/facetOptics.ts'
import {fill, resolved, stroke, wave} from '../../candidates/gpt_sol/lib/exhibition/patterns.ts'
import {engravedNormal} from '../../candidates/gpt_sol/lib/exhibition/ReliefKnotMaterial.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import data from './data.ts'

/** Three intersecting crystallographic lamellae, with individual machining frames and nickel identities. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.25)
    this.name = data.id
    const {p, grazing, intimate} = viewerFrame()
    const {T, B, N} = tangentViewFrame()
    const localB = vec3(bitangentLocal as unknown as Node<'vec3'>)
    const directions = [vec3(1, 1, 0.2).normalize(), vec3(-1, 1, 0.2).normalize(), vec3(0.15, 1, -1).normalize()]
    let alloy: Node<'vec3'> = color(hsl.integer(246, 15, 32)).rgb
    let brush: Node<'vec2'> = vec2(0.7, 0)
    let relief: Node<'float'> = float(0)
    let seams: Node<'float'> = float(0)
    let brightness: Node<'float'> = float(0)
    let facetLean: Node<'vec2'> = vec2(0)
    for (const [index, direction] of directions.entries()) {
      const plane = p.dot(direction).mul(22 + index * 4).add(index * 5.7)
      const random = mx_cell_noise_vec3(vec3(plane.floor(), index + 3.1, 24.7)).toVar()
      const point = plane.fract().sub(0.5)
      const width = random.x.mul(0.18).add(0.14)
      const signedDistance = point.abs().sub(width)
      const footprint = plane.fwidth().max(0.00001)
      const plate = fill(signedDistance, footprint).toVar()
      const edge = stroke(signedDistance, 0.009, footprint).toVar()
      const polishPhase = plane.mul(110).add(random.z.mul(15)).add(breath.sin().mul(0.15))
      const polishing = wave(polishPhase).mul(intimate).toVar()
      const nickel = mix(color(hsl.integer(246, 16, 48)), color(hsl.integer(118, 7, 75)), random.y)
        .mul(polishing.mul(0.055).add(0.95))
      alloy = mix(alloy, nickel, plate.mul(0.84)).toVar()
      const flow = vec2(direction.dot(localB), direction.dot(tangentLocal).negate())
      const frame = flow.div(flow.length().max(0.0001)).mul(0.84)
      brush = mix(brush, frame, plate).toVar()
      relief = relief.add(plate.mul(0.00022)).sub(edge.mul(0.00038)).add(polishing.mul(plate).mul(0.000018))
      seams = seams.max(edge)
      brightness = mix(brightness, random.y, plate).toVar()
      facetLean = mix(facetLean, random.xy.sub(0.5).mul(0.14), plate).toVar()
    }
    const oxideField = mx_noise_float(p.mul(9).add(7)).mul(0.5).add(0.5)
    const rust = oxideField.smoothstep(0.58, 0.72).mul(seams).toVar()
    const pitCoordinates = p.mul(235)
    const pits = mx_noise_float(pitCoordinates).mul(resolved(pitCoordinates)).toVar()
    const inscriptionPhase = p.dot(vec3(-17, 31, 13)).add(mx_noise_float(p.mul(8)).mul(0.8))
    const inscriptions = stroke(inscriptionPhase.sin(), 0.008, inscriptionPhase.fwidth())
      .mul(brightness.smoothstep(0.52, 0.8)).mul(intimate)
    this.colorNode = mix(alloy, color(hsl.integer(57, 55, 47)), rust.mul(0.7))
      .mul(seams.mul(-0.16).add(1)).mul(pits.mul(0.025).add(0.98))
      .add(color(hsl.integer(101, 22, 79)).mul(inscriptions).mul(0.18))
    this.metalnessNode = rust.mul(-0.24).add(0.98)
    const annealing = p.dot(vec3(7, 11, -6)).add(breath).sin().mul(0.012)
    this.roughnessNode = float(0.37).sub(brightness.mul(0.17)).add(seams.mul(0.09)).add(rust.mul(0.13)).add(annealing).clamp(0.19, 0.54)
    this.anisotropy = 0.84
    this.anisotropyNode = brush.mul(rust.mul(-0.6).add(1))
    this.normalNode = engravedNormal(normalViewGeometry, relief.sub(pits.mul(0.000025)).sub(inscriptions.mul(0.0001)), 0.65)
    this.clearcoat = 0.2
    this.clearcoatRoughness = 0.23
    this.clearcoatNormalNode = normalViewGeometry
    this.aoNode = seams.mul(-0.12).add(1)
    const facet = N.add(T.mul(facetLean.x)).add(B.mul(facetLean.y)).normalize()
    const glints = facetGlints(facet, 150).mul(brightness).mul(0.16)
    this.emissiveNode = color(hsl.integer(234, 55, 89)).mul(glints)
      .add(color(hsl.integer(65, 60, 62)).mul(rust).mul(grazing.pow(2)).mul(breath.sin().mul(0.06).add(0.94)).mul(0.035))
    this.userData = {
      collection: 'The Unwritten Atlas',
      opticalEffect: 'anisotropic crystallographic lamellae',
    }
  }
}

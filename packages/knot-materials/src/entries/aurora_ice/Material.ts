import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, normalViewGeometry, time, vec3} from 'three/tsl'

import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import {cosinePalette} from '../../lib/cosinePalette.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

function iceLine(field: Node<'float'>, width: number) {
  const footprint = field.fwidth().max(0.0001)
  return field.abs().smoothstep(width, footprint.mul(1.3).add(width)).oneMinus()
}
/** Clear glacial crystal containing animated volumetric aurora curtains and ancient air bubbles. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.82)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const drift = vec3(time.mul(0.018), time.mul(0.027), time.mul(-0.015))
    const chord = facing.mul(0.23).add(0.045)
    let aurora: Node<'vec3'> = vec3(0)
    let transmittance: Node<'float'> = float(1)
    const steps = 7
    for (let index = 0;index < steps;index++) {
      const depth = (index + 0.5) / steps
      const samplePoint = p.sub(view.mul(chord.mul(depth)))
      const q = samplePoint.mul(5.2).add(drift).add(vec3(index * 0.17, index * -0.11, index * 0.13))
      const slowWarp = mx_noise_float(q.mul(vec3(0.42, 0.23, 0.36)).add(vec3(0, time.mul(0.035), 0)))
      const foldPhase = q.y.mul(1.35).add(q.x.mul(0.36).add(time.mul(0.14)).sin().mul(1.15)).add(q.z.mul(0.58).sub(time.mul(0.09)).sin().mul(0.72)).add(slowWarp.mul(1.6))
      const broad = foldPhase.sin().abs().smoothstep(0.055, 0.36).oneMinus()
      const striationPhase = foldPhase.mul(4.1).add(q.x.mul(1.7)).add(slowWarp.mul(3.2))
      const striations = striationPhase.sin().abs().smoothstep(0.065, 0.28).oneMinus().mul(near.mul(0.62).add(0.38))
      const veilNoise = mx_noise_float(q.mul(1.15).add(vec3(4.7, -1.3, 2.9))).mul(0.5).add(0.5)
      const density = broad.mul(veilNoise.smoothstep(0.25, 0.76)).mul(striations.mul(0.58).add(0.42))
      const polarPhase = foldPhase.mul(0.37).add(q.z.mul(0.28)).add(time.mul(0.045))
      const emerald = polarPhase.cos().mul(0.5).add(0.5).pow(3)
      const violet = polarPhase.mul(0.73).add(1.9).sin().mul(0.5).add(0.5).pow(5)
      const layerColor = [color(hsl.integer(164, 100, 86.78)), color(hsl.integer(264, 100, 52)), color(hsl.integer(320.5, 100, 61.7))][index % 3]
      const tint = cosinePalette(foldPhase.mul(0.095).add(depth * 0.31).add(time.mul(0.009)), [0.18, 0.48, 0.48], [0.18, 0.4, 0.46], [1, 1, 1], [0.47, 0.08, 0.76]).mul(0.34).add(layerColor.mul(0.72)).add(color(hsl.integer(173, 100, 87.6)).mul(emerald).mul(0.28)).add(color(hsl.integer(320, 100, 63)).mul(violet).mul(0.46))
      const centerLight = 1 - Math.abs(depth - 0.5) * 1.35
      aurora = aurora.add(tint.mul(density).mul(transmittance).mul(centerLight))
      transmittance = transmittance.mul(density.mul(0.22).oneMinus().clamp())
    }
    const coarseIce = mx_fractal_noise_float(p.mul(5.5).add(vec3(-0.8, 1.4, 2.1)), 3, 2.1, 0.53)
    const riftBoundary = cellularBoundary(p.mul(8).add(vec3(2.7, -3.1, 0.6)))
    const rift = iceLine(riftBoundary.sub(0.018), 0.009).mul(coarseIce.abs().smoothstep(0.05, 0.52).oneMinus())
    const frost = coarseIce.mul(0.5).add(0.5).smoothstep(0.72, 0.91).mul(rift.mul(0.65).add(0.2))
    const bubblePoint = p.sub(view.mul(0.11))
    const bubbles = cellularPoints(bubblePoint.mul(48), 0.018, 0.13, 0.82).mul(intimate)
    const iceBase = mix(color(hsl.integer(245, 59, 10)), color(hsl.integer(217, 52, 55)), facing.mul(0.18).add(frost.mul(0.36)))
    this.colorNode = mix(iceBase, color(hsl.integer(197, 64, 94.6)), rift.mul(0.42).add(bubbles.mul(0.7)).clamp())
    this.metalness = 0
    this.roughnessNode = float(0.035).add(frost.mul(0.34)).add(rift.mul(0.13))
    this.transmission = 0.86
    this.thickness = 0.62
    this.ior = 1.31
    this.dispersion = 0.17
    this.attenuationColor.set(hsl.integer(214, 70, 59))
    this.attenuationDistance = 1.35
    this.clearcoat = 1
    this.clearcoatRoughness = 0.018
    this.iridescence = 0.12
    this.iridescenceThicknessNode = facing.mul(130).add(80)
    this.normalNode = proceduralNormal(coarseIce.mul(0.12).sub(rift.mul(0.75)).add(frost.mul(0.32)), 0.0022)
    const crystalSpark = glints(normalViewGeometry, 170).mul(frost.add(rift.mul(0.6))).mul(near).mul(0.7)
    const bubbleSpark = glints(normalViewGeometry.add(vec3(0.17, -0.12, 0.09)).normalize(), 110).mul(bubbles)
    this.emissiveNode = aurora.div(steps).mul(4.3).mul(facing.mul(0.32).add(0.88)).add(color(hsl.integer(196, 100, 96.9)).mul(rift).mul(grazing.pow(2)).mul(0.22)).add(color(hsl.integer(0, 0, 100)).mul(crystalSpark.add(bubbleSpark))).add(color(hsl.integer(267, 100, 52.5)).mul(grazing.pow(4)).mul(0.08))
  }
}

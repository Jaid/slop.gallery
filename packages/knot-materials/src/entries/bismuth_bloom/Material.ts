import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, float, mix, modelWorldMatrixInverse, mx_noise_float, normalLocal, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec2, vec4} from 'three/tsl'

import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

/** Crystallised bismuth grown into stepped spiral pyramids. The knot is sheathed in a host of microscopic terraces, each one a different height and so a different oxide-film thickness: a long rainbow staircase in which the lowest terraces catch warm gold and magenta, and the upper terraces burn to cyan and violet. Each terrace has a slow rotation of its own iridescence, so the colours breathe as the viewer moves around. The terraces themselves are built from quantized concentric rings so they actually appear as steps rather than as smooth gradient noise. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    this.envMapIntensity = 1.6
    const p = positionGeometry
    const cameraLocal = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz
    const viewDir = cameraLocal.sub(p).normalize()
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    const rim = grazing.pow(2)
    const distance = positionView.length()
    const near = distance.smoothstep(1.25, 5.5).oneMinus()
    const intimate = distance.smoothstep(0.8, 2.7).oneMinus()
    // ---- terrace centres ----
    // The terraces grow in spiralled pyramids along the tube direction. We
    // quantize the distance to a per-cell centre to produce hard step edges.
    const terracesU = p.x.mul(7)
    const terracesV = p.y.mul(5).add(p.z.mul(3))
    const cellId = vec2(terracesU.floor(), terracesV.floor())
    const cellRnd = mx_noise_float(vec2(cellId.x.add(cellId.y).mul(0.31)).add(0.5))
    const centreOffset = vec2(cellRnd.fract().sub(0.5), cellRnd.fract().fract().sub(0.5)).mul(0.5)
    const local = vec2(terracesU.fract().sub(0.5), terracesV.fract().sub(0.5)).sub(centreOffset)
    // Polar coordinates of the local point.
    const radius = local.length()
    // ---- terrace rings ----
    // Six concentric steps that descend in height as radius grows. The
    // step index is the ring number; the fractional part is how far we
    // are inside the ring.
    const terraceCount = 6
    const terraceRing = radius.mul(terraceCount)
    const terraceIndex = terraceRing.floor()
    const terraceFrac = terraceRing.fract()
    // The ring is a sharp-edged band: bright at the centre of the ring,
    // dark at the edge. The ring's edge is at integer multiples of
    // (1/terraceCount).
    const ringCentreDist = terraceFrac.sub(0.5).abs()
    const ringEdge = ringCentreDist.smoothstep(0.5, 0.42)
    // Vertex displacement: each step rises sharply to the centre of its
    // ring, then drops at the next.
    const stepHeight = terraceIndex.div(float(terraceCount - 1)).mul(0.005)
    const stepRelief = ringEdge.mul(0.004).add(stepHeight)
    this.positionNode = p.add(normalLocal.mul(stepRelief))
    // ---- substrate ----
    // The metal beneath the oxide film is dark bismuth-lead.
    const substrateNoise = mx_noise_float(p.mul(11)).mul(0.5).add(0.5)
    const substrateColor = color(hsl.integer(56, 18, 10)).mul(substrateNoise.mul(0.5).add(0.5))
    // ---- per-terrace tints ----
    // Each terrace gets a distinct iridescence thickness: warm terraces
    // (low and broad) have the thinnest film and so the highest order
    // interference; cool terraces (high and narrow) have thicker films.
    const terraceT = terraceIndex.div(float(terraceCount - 1)).clamp()
    const thicknessBase = mix(220, 880, terraceT)
    const thicknessWave = time.mul(0.15).add(terraceIndex.mul(0.7)).sin().mul(70)
    const thicknessDrift = thicknessBase.add(thicknessWave).add(viewDir.dot(p).mul(180))
    const iridescenceThicknessNode = thicknessDrift.clamp(120, 1100)
    // ---- assembly ----
    this.colorNode = substrateColor
    this.metalness = 1
    this.roughnessNode = float(0.18).sub(ringEdge.mul(0.07)).clamp(0.05, 0.3)
    this.iridescence = 1
    this.iridescenceNode = float(1)
    this.iridescenceIOR = 1.45
    this.iridescenceThicknessNode = iridescenceThicknessNode
    this.clearcoat = 0.35
    this.clearcoatRoughness = 0.08
    this.normalNode = proceduralNormal(stepRelief.mul(180).add(substrateNoise.mul(0.0005)), 0.7)
    // ---- edge glow ----
    const stepRim = ringCentreDist.smoothstep(0.5, 0.45)
    const rimGlow = mix(color(hsl.integer(63, 100, 77.4)), color(hsl.integer(219, 100, 87)), terraceT).mul(stepRim).mul(rim).mul(0.9)
    const facingGlow = mix(color(hsl.integer(7, 99, 65)), color(hsl.integer(293, 100, 66.5)), time.mul(0.2).add(terraceT).fract())
      .mul(facing.pow(2.5))
      .mul(near)
      .mul(0.25)
    const coreGlow = mix(color(hsl.integer(87, 100, 94.5)), color(hsl.integer(221, 99, 83)), terraceT).mul(grazing.pow(4)).mul(intimate).mul(0.4)
    this.emissiveNode = rimGlow.add(facingGlow).add(coreGlow)
  }
}

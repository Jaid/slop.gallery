import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, mx_worley_noise_vec3, normalLocal, positionGeometry, time, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cosinePalette} from '../../lib/cosinePalette.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Spacetime at the Planck scale: tiny bubbles and wormhole-like voids flicker in and out, edged with neon wireframe loops. Bubble scale changes with camera distance. Nested topological layers are revealed at different viewing angles. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.6)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    // Foam scale changes with distance — closer = finer bubbles (zooming into Planck scale)
    const baseScale = 9
    const foamDrift = vec3(time.mul(0.15), time.mul(-0.11), time.mul(0.08))
    // Primary foam layer — Voronoi cells form bubbles
    const foamCoord = p.mul(baseScale).add(foamDrift)
    const worley1 = mx_worley_noise_vec3(foamCoord, 1, 0)
    const f1 = worley1.x // distance to nearest
    const f2 = worley1.y // distance to second nearest
    const cellBoundary = f2.sub(f1) // thin at cell edges
    // Wireframe on cell boundaries
    const wireFw = cellBoundary.fwidth().max(0.0001)
    const wireframe = cellBoundary.smoothstep(0.02, wireFw.mul(1.5).add(0.035))
      .oneMinus()
      .mul(wireFw.smoothstep(0.08, 0.3).oneMinus())
    // Secondary finer foam layer for detail at close range
    const fineCoord = p.mul(baseScale * 2.7).sub(foamDrift.mul(1.5))
    const worley2 = mx_worley_noise_vec3(fineCoord, 1, 0)
    const fineBoundary = worley2.y.sub(worley2.x)
    const fineFw = fineBoundary.fwidth().max(0.0001)
    const fineWire = fineBoundary.smoothstep(0.015, fineFw.mul(1.3).add(0.025))
      .oneMinus()
      .mul(fineFw.smoothstep(0.06, 0.25).oneMinus())
      .mul(near)
    // Parallax deeper foam layer
    const deepCoord = p.sub(view.mul(0.12)).mul(baseScale * 1.4).add(foamDrift.mul(0.7))
    const worley3 = mx_worley_noise_vec3(deepCoord, 1, 0)
    const deepBoundary = worley3.y.sub(worley3.x)
    const deepFw = deepBoundary.fwidth().max(0.0001)
    const deepWire = deepBoundary.smoothstep(0.018, deepFw.mul(1.4).add(0.03))
      .oneMinus()
      .mul(deepFw.smoothstep(0.07, 0.28).oneMinus())
      .mul(facing.mul(0.6).add(0.2))
    // Bubble void interiors — dark holes that flicker in/out
    const flickerPhase = mx_noise_float(foamCoord.floor().add(time.mul(2.5)))
    const voidMask = f1.smoothstep(0.12, 0.04)
      .mul(flickerPhase.mul(0.5).add(0.5).smoothstep(0.3, 0.6))
    // 4D noise for temporal flickering of the foam structure
    const temporalFlicker = mx_noise_float(
      p.mul(baseScale * 0.5).add(vec3(time.mul(1.2), time.mul(-0.8), time.mul(0.6))),
    ).mul(0.5).add(0.5)
    const flickerMask = temporalFlicker.smoothstep(0.25, 0.55)
    // Color: each cell gets a neon tint for its wireframe
    const cellId = foamCoord.floor()
    const cellRnd = cellNoiseVec3(cellId)
    // Neon wireframe colors using cosine palette
    const wireHue = cellRnd.x.mul(0.8).add(time.mul(0.03))
    const neonColor = cosinePalette(
      wireHue,
      [0.5, 0.5, 0.5],
      [0.5, 0.5, 0.5],
      [1, 1, 1],
      [0, 0.33, 0.67],
    )
    // Deep space black for the base
    const voidColor = color(hsl.integer(277, 76, 2))
    const foamSurface = color(hsl.integer(282, 42, 6))
    // Wireframe luminosity
    const allWire = wireframe.add(fineWire.mul(0.6)).add(deepWire.mul(0.35)).clamp()
    this.colorNode = mix(voidColor, foamSurface, flickerMask.mul(0.3))
    this.metalness = 0.3
    this.roughnessNode = float(0.05).add(allWire.mul(0.1)).clamp(0.02, 0.2)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.02
    // Normals — foamy bubble surface
    const foamHeight = f1.mul(0.015).add(cellBoundary.mul(0.008))
      .add(voidMask.mul(-0.01))
      .add(worley2.x.mul(near).mul(0.004))
    this.normalNode = proceduralNormal(foamHeight, 0.8)
    // Displacement — bubble surface relief
    this.positionNode = positionGeometry.add(normalLocal.mul(foamHeight))
    // Emissive — the neon wireframe network is the star
    const primaryGlow = neonColor.mul(wireframe).mul(flickerMask)
    const fineGlow = neonColor.mul(0.7).mul(fineWire).mul(flickerMask)
    const deepGlow = cosinePalette(
      wireHue.add(0.4),
      [0.5, 0.5, 0.5],
      [0.4, 0.4, 0.4],
      [1, 1, 1],
      [0.15, 0.45, 0.75],
    ).mul(deepWire)
    // Void glow — wormhole interiors
    const voidGlow = color(hsl.integer(277, 100, 40)).mul(voidMask).mul(intimate).mul(flickerMask)
    // Energy discharge at intersections
    const intersectionGlow = wireframe.mul(fineWire).mul(near)
    // Rim energy
    const rimEnergy = grazing.pow(4).mul(neonColor).mul(0.15)
    this.emissiveNode = primaryGlow.mul(1.8)
      .add(fineGlow)
      .add(deepGlow.mul(0.6))
      .add(voidGlow.mul(0.8))
      .add(color(hsl.integer(0, 0, 100)).mul(intersectionGlow).mul(0.5))
      .add(rimEnergy)
  }
}

import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, Fn, mix, mx_noise_vec3, negateOnBackSide, time, transformNormalToView, uv, varying, vec2, vec3} from 'three/tsl'

import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import {glints} from '../../lib/glints.ts'
import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Physical Kintsugi relief displacement: Bulges the hand-laid urushi lacquer seams proud of the porcelain surface. */
const kintsugiDisplacement = Fn(([tube]: [Node<'vec2'>]) => {
  const {position: p, normal} = knotFrame(tube)
  // Domain-warped fracture cleavage
  const warp = mx_noise_vec3(p.mul(3.2)).mul(0.14)
  const fractureDist = cellularBoundary(p.mul(2.5).add(warp).add(vec3(1.2, -2, 0.7)))
  const seamWidth = 0.038
  const seamMask = fractureDist.smoothstep(0.006, seamWidth).oneMinus()
  // Semicircular meniscus bead profile
  const normalizedDist = fractureDist.div(seamWidth).clamp()
  const bead = float(1).sub(normalizedDist.pow(2)).max(0).sqrt()
  // Physical relief: builds up lacquer bead 0.014 units proud of the porcelain
  const relief = bead.mul(seamMask).mul(0.014)
  return p.add(normal.mul(relief))
})

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.15) // Crisp studio softbox reflections on glazed celadon and burnished gold
    this.name = knotData.id
    const tube = uv()
    const {p, facing, grazing, near, intimate} = viewerFrame()
    // 1. Physical Relief Displacement: urushi lacquer bead sits proud of the porcelain
    this.positionNode = kintsugiDisplacement(tube)
    const eps = 0.0003
    const du = kintsugiDisplacement(tube.add(vec2(eps, 0))).sub(kintsugiDisplacement(tube.sub(vec2(eps, 0))))
    const dv = kintsugiDisplacement(tube.add(vec2(0, eps))).sub(kintsugiDisplacement(tube.sub(vec2(0, eps))))
    const displacedNormal = varying(transformNormalToView(du.cross(dv).normalize())).normalize()
    this.normalNode = negateOnBackSide(displacedNormal)
    // 2. Major Kintsugi Fracture Identification
    const warp = mx_noise_vec3(p.mul(3.2)).mul(0.14)
    const fractureDist = cellularBoundary(p.mul(2.5).add(warp).add(vec3(1.2, -2, 0.7)))
    const seamWidth = 0.038
    const seamMask = fractureDist.smoothstep(0.006, seamWidth).oneMinus()
    const normalizedDist = fractureDist.div(seamWidth).clamp()
    const bead = float(1).sub(normalizedDist.pow(2)).max(0).sqrt()
    // 3. Authentic Longquan Imperial Celadon Porcelain
    // Signature jade-green / seafoam hue with depth beneath glassy silica glaze
    const jadeCeladon = color(hsl.integer(177, 33, 67))
    const deepCeladon = color(hsl.integer(177, 38, 53))
    const teaStainedPatina = color(hsl.integer(76, 25, 40))
    // Double-layer "ice crackle" crazing occurring beneath the glaze
    const crackleDist1 = cellularBoundary(p.mul(18).add(warp.mul(0.35)))
    const crackle1 = crackleDist1.smoothstep(0.003, 0.015).oneMinus()
    const crackleDist2 = cellularBoundary(p.mul(46))
    const crackle2 = crackleDist2.smoothstep(0.001, 0.007).oneMinus()
    const iceCrackle = crackle1.max(crackle2.mul(0.55)).mul(seamMask.oneMinus())
    // Celadon glaze deepens gracefully with viewing angle and crazing fissures
    const celadonBase = mix(
      mix(jadeCeladon, deepCeladon, grazing.mul(0.5)),
      teaStainedPatina,
      iceCrackle.mul(near.mul(0.5).add(0.4)),
    )
    // 4. Pure 24-Karat Gold Urushi Lacquer (Maki-e Gold Powder)
    const richGold = color(hsl.integer(79, 84, 74))
    const specularGold = color(hsl.integer(85, 100, 85.7))
    const burnishedGold = color(hsl.integer(75, 84, 62))
    // Gold dust micro-flakes suspended in the resin
    const goldFlakes = cellularPoints(p.mul(80), 0.03, 0.18, 0.65).mul(seamMask)
    const goldAlbedo = mix(
      mix(richGold, burnishedGold, bead.mul(-0.3).add(0.3)),
      specularGold,
      goldFlakes.mul(0.7),
    )
    // Combined surface albedo
    this.colorNode = mix(celadonBase, goldAlbedo, seamMask)
    // PBR Material Response
    // Celadon is non-metallic (0); gold lacquer is pure conductor (1)
    this.metalnessNode = seamMask.mul(0.98)
    this.roughnessNode = mix(
      float(0.08), // Flawless glassy porcelain glaze
      float(0.2), // Burnished 24K gold powder lacquer
      seamMask,
    )
    // Dual-layer clearcoat: the glassy silica glaze covers the porcelain,
    // while the raised gold lacquer bead sits on top
    this.clearcoat = 1
    this.clearcoatRoughnessNode = mix(float(0.02), float(0.12), seamMask)
    this.ior = 1.52 // Optical porcelain glaze
    // Ambient occlusion in deep contact folds and crevices
    const foldOcclusion = facing.smoothstep(0.08, 0.5)
    this.aoNode = mix(float(0.45), float(1), foldOcclusion).mul(mix(float(1), float(0.6), seamMask.mul(bead.oneMinus())))
    // Micro-sparkle of 24K gold dust under gallery spotlights
    const goldGlints = glints(displacedNormal, 70).mul(seamMask).mul(0.85)
    // 5. Ancient Celestial Core Warmth: Divine starlight sealed within the mended fracture
    const emberPulse = time.mul(0.7).add(p.x.mul(5)).sin().mul(0.15).add(0.85)
    const internalCore = bead.pow(4).mul(seamMask)
    const amberCrimson = mix(color(hsl.integer(32.7, 100, 59)), color(hsl.integer(65, 100, 73.4)), internalCore)
    // Subsurface ember radiation from the deep fracture root
    this.emissiveNode = amberCrimson
      .mul(internalCore)
      .mul(emberPulse)
      .mul(near.mul(0.5).add(0.7))
      .mul(1.6)
      .add(color(hsl.integer(0, 0, 100)).mul(goldGlints).mul(intimate))
  }
}

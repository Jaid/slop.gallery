import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalLocal, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, uv, vec2} from 'three/tsl'

import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import knotData from './data.ts'

/** The knot is sheathed in a mail of fine silvery rings. Each ring sits on a hex lattice, has its own slow rotation, and lights up with a sharp anisotropic streak when the camera catches it edge-on. The rings interlock: where one ring crosses another, the surface darkens, and where four rings meet at a seam, a tiny dark gap appears as if real wire. Walking around the knot, every ring brightens and dims in turn, so the whole surface seems to ripple. From intimate range you can see the weave pattern, each link catching its neighbour's glow. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.1)
    this.name = knotData.id
    this.envMapIntensity = 1.5
    const p = positionGeometry
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    const distance = positionView.length()
    const near = distance.smoothstep(1.25, 5.5).oneMinus()
    const intimate = distance.smoothstep(0.8, 2.7).oneMinus()
    // ---- tube coordinate frame ----
    const tube = uv()
    const cellU = tube.x.mul(36)
    const cellV = tube.y.mul(36)
    const cellId = vec2(cellU.floor(), cellV.floor())
    // Stagger alternate rows so the rings interlock.
    const stagger = cellId.x.mod(2).mul(0.5)
    const cellLocal = vec2(
      cellU.fract().sub(stagger).sub(0.5),
      cellV.fract().add(stagger).mod(1).sub(0.5),
    )
    const cellRnd = mx_noise_float(cellId.x.add(cellId.y.mul(0.31)).add(0.3))
    const ringAngle = cellRnd.mul(TAU)
    const cosA = ringAngle.cos()
    const sinA = ringAngle.sin()
    // The ring is an annulus in the rotated cell.
    const rotX = cellLocal.x.mul(cosA).sub(cellLocal.y.mul(sinA))
    const rotY = cellLocal.x.mul(sinA).add(cellLocal.y.mul(cosA))
    const ringDist = vec2(rotX, rotY).length()
    // Each ring has a thin wire that catches light, and a darker centre
    // hole that exposes the metal below.
    const wireWidth = float(0.07)
    const ringInner = float(0.22)
    const ringOuter = ringInner.add(wireWidth)
    const wire = ringDist.smoothstep(ringOuter, ringOuter.sub(wireWidth)).oneMinus()
      .mul(ringDist.smoothstep(ringInner.add(wireWidth.mul(0.4)), ringInner))
    const hole = ringDist.smoothstep(ringInner.sub(0.05), ringInner.add(0.05)).oneMinus()
    const ringMask = wire.clamp()
    // ---- between-rings metal ----
    // The dark iron-blue base of the mail between rings.
    const baseRnd = mx_noise_float(p.mul(7)).mul(0.5).add(0.5)
    const baseMetal = mix(color(hsl.integer(272, 42, 15)), color(hsl.integer(274, 45, 23)), baseRnd)
    // ---- per-ring anisotropic streak ----
    const tangentDir = vec2(sinA.negate(), cosA)
    // Project the view direction onto the ring's perpendicular direction
    // (the ring's normal), and use the part of the view that's aligned
    // with that perpendicular to drive the highlight.
    const perpDir = vec2(cosA, sinA)
    const viewX = positionView.x
    const viewY = positionView.y
    const viewZ = positionView.z
    const perpProj = viewX.mul(perpDir.x).add(viewY.mul(perpDir.y)).add(viewZ.mul(perpDir.x.add(perpDir.y)))
    const ringHighlight = perpProj.abs().smoothstep(0.35, 1.2).oneMinus()
    const ringShimmer = ringHighlight.mul(ringMask).mul(grazing.pow(1.5).add(0.3))
    // ---- ring breathing ----
    const breath = time.mul(0.6).add(cellRnd.mul(TAU)).sin().mul(0.5).add(0.5)
    const ringGlow = ringShimmer.mul(breath)
    // ---- vertex displacement for wire relief ----
    // Each wire is slightly raised, and each hole is depressed.
    const relief = ringMask.mul(0.0018).sub(hole.mul(0.0012))
    this.positionNode = p.add(normalLocal.mul(relief))
    // ---- assembly ----
    this.colorNode = baseMetal
    this.metalness = 0.95
    this.roughnessNode = float(0.18).sub(ringMask.mul(0.06))
    this.anisotropy = 0.95
    this.anisotropyNode = vec2(tangentDir.x.mul(0.85), tangentDir.y.mul(0.85)).mul(ringMask)
    this.clearcoat = 0.45
    this.clearcoatRoughness = 0.1
    this.normalNode = proceduralNormal(ringMask.mul(0.005).add(hole.mul(0.003)).add(baseRnd.mul(0.0006)), 0.7)
    // ---- emissive ----
    const ringEmissive = color(hsl.integer(258, 100, 94.4)).mul(ringGlow).mul(near.mul(0.5).add(0.4)).mul(2.8)
    const seamShadow = color(hsl.integer(265, 32, 4)).mul(hole.mul(0.8))
    const haloGlow = mix(color(hsl.integer(264, 100, 80)), color(hsl.integer(92, 100, 94.7)), facing)
      .mul(grazing.pow(2))
      .mul(intimate)
      .mul(0.22)
    this.emissiveNode = ringEmissive.add(haloGlow)
    this.colorNode = (mix as unknown as (a: any, b: any, t: any) => typeof baseMetal)(
      this.colorNode,
      color(hsl.integer(272, 34, 7)),
      seamShadow,
    )
  }
}

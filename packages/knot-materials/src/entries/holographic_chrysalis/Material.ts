import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalLocal, time, vec2} from 'three/tsl'

import {filament} from '../../lib/filament.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A folded Morpho butterfly wing wrapped around the knot. The scales are arranged on a true hex lattice (each row offset by half a cell), and each scale is a tilted multi-layer film. The iridescence IOR and thickness depend on the grazing angle and on a slow ripple, so two adjacent scales never agree on the same colour: a deep cobalt that brightens to teal along the rim, then burns to magenta at the most oblique angles. Scale veins darken and faintly glow at intimate range, revealing a hex lattice that was always there. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.95)
    this.name = knotData.id
    this.envMapIntensity = 0.8
    const {p, view, facing, grazing, near, intimate, rim} = viewerFrame()
    near
    // ---- hex scale lattice ----
    // A true hex tiling: rows alternate offset by 0.5 so the cells nest
    // like real butterfly scales.
    const cellScale = 90
    const hexU = p.x.mul(cellScale)
    const hexV = p.y.mul(cellScale)
    const rowIndex = hexV.floor()
    const stagger = rowIndex.mod(2).mul(0.5)
    const cellU = hexU.floor().add(stagger)
    const cellV = rowIndex
    const cellId = vec2(cellU, cellV)
    const localU = hexU.fract().sub(stagger).sub(0.5)
    const localV = hexV.fract().sub(0.5)
    const cellRnd = mx_noise_float(vec2(cellId.x.add(cellId.y.mul(0.31))).add(0.3))
    const scaleAngle = cellRnd.mul(TAU)
    // Each scale is a small dome with a darker rim. The hex distance is
    // approximated by the larger of the two axial coordinates.
    const domeDist = vec2(localU, localV).length()
    const dome = float(1).sub(domeDist.smoothstep(0.55, 0)).clamp()
    domeDist
    // ---- scale relief ----
    const scaleHeight = dome.mul(0.003)
    this.positionNode = p.add(normalLocal.mul(scaleHeight))
    // ---- scale veins ----
    // Three radial lines from the centre of each scale.
    const cosA = scaleAngle.cos()
    const sinA = scaleAngle.sin()
    const radialDot = localU.mul(cosA).add(localV.mul(sinA))
    const vein1 = filament(radialDot.mul(8), 0.3)
    const vein2 = filament(radialDot.sub(0.5).mul(8), 0.3)
    const vein3 = filament(radialDot.add(0.5).mul(8), 0.3)
    const veins = vein1.add(vein2).add(vein3).mul(dome).mul(0.45)
    // ---- iridescence thickness ----
    // The iridescence IOR stays constant; the thickness is driven by:
    //  1. a slow ripple that breathes across the wing,
    //  2. the grazing angle (thin-film colour shift),
    //  3. per-scale jitter so no two scales are identical.
    const ripple = p.dot(vec2(0.7, 1.2)).add(time.mul(0.25))
    const rippleWave = ripple.sin().mul(0.5).add(0.5)
    const thickness = float(360)
      .add(rippleWave.mul(160))
      .add(grazing.mul(440))
      .add(cellRnd.mul(120))
      .add(view.dot(normalLocal.normalize()).abs().mul(180))
    // ---- membrane substrate ----
    // A deep midnight base between the scales with a tiny amount of
    // structure so it doesn't look like plastic.
    const membraneRnd = mx_noise_float(p.mul(28)).mul(0.5).add(0.5)
    const membraneColor = mix(color(hsl.integer(273, 70, 3.3)), color(hsl.integer(260, 62, 11)), membraneRnd)
    // ---- per-scale structural tint ----
    // A hand-built cosine palette that sweeps through the Morpho spectrum.
    const phase = thickness.mul(0.0035).add(view.x.mul(0.7).sub(view.z.mul(0.4)))
    const structuralR = phase.cos().mul(0.5).add(0.5)
    const structuralB = phase.add(4.189).cos().mul(0.5).add(0.5)
    const deepBlue = color(hsl.integer(264.6, 98.6, 36))
    const cyan = color(hsl.integer(207, 99, 83))
    const magenta = color(hsl.integer(351, 100, 61.7))
    const violet = color(hsl.integer(290, 100, 47))
    const baseTint = mix(deepBlue, cyan, structuralB).mul(structuralB.add(0.2))
    const rimTint = mix(magenta, violet, structuralR).mul(structuralR)
    const scaleTint = mix(baseTint, rimTint, rim.pow(1.1))
    // ---- assembly ----
    const body = mix(membraneColor, scaleTint, dome.mul(0.9).add(0.1))
    const veinedBody = (mix as unknown as (a: any, b: any, t: any) => typeof body)(body, color(hsl.integer(272, 50, 3)), veins.clamp().mul(0.8))
    this.colorNode = veinedBody
    this.metalness = 0.65
    this.roughnessNode = dome.mul(0.32).add(veins.clamp().mul(0.4)).add(0.06)
    this.clearcoat = 0.9
    this.clearcoatRoughness = 0.03
    this.iridescence = 1
    this.iridescenceNode = dome.mul(0.85).add(0.15)
    this.iridescenceIOR = 1.34
    this.iridescenceThicknessNode = thickness
    // Anisotropic sheen runs along each scale's radial direction.
    const tangentDir = vec2(sinA.negate(), cosA)
    const tangentCoord = localU.mul(tangentDir.x).add(localV.mul(tangentDir.y))
    const ridge = tangentCoord.mul(110).sin().abs().pow(8).mul(dome)
    this.normalNode = proceduralNormal(scaleHeight.add(membraneRnd.mul(0.0009)).add(ridge.mul(0.0008)), 0.8)
    // ---- glow ----
    const veinGlow = color(hsl.integer(269, 100, 47.4)).mul(veins.clamp()).mul(intimate).mul(0.7)
    const crest = color(hsl.integer(224, 100, 95)).mul(dome.smoothstep(0.55, 0.95)).mul(ridge).mul(intimate.mul(0.5).add(0.5)).mul(0.7)
    const rimGlow = mix(color(hsl.integer(269, 100, 47.4)), color(hsl.integer(346, 100, 69.6)), rim.pow(0.6)).mul(rim.pow(1.4)).mul(0.35)
    const facingTint = mix(color(hsl.integer(271, 85, 31)), color(hsl.integer(272, 100, 95.6)), facing).mul(facing).mul(0.15)
    this.emissiveNode = veinGlow.add(crest).add(rimGlow).add(facingTint)
    facing
  }
}

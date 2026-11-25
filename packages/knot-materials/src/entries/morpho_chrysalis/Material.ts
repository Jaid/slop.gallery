import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {bitangentView, color, float, mix, mx_noise_float, normalViewGeometry, tangentView, time, uv, vec2, vec3} from 'three/tsl'
import {Color} from 'three/webgpu'

import {detailNormal} from '../../candidates/deepseek/lib/detailNormal.ts'
import {uvFootprint} from '../../candidates/deepseek/lib/uvFootprint.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const columns = 112
const rows = 26
/** A folded morpho wing, taught to breathe. Every scale is its own mirror: each carries a private tilt, so the blue arrives as a mosaic that re-forms whenever the eye moves, flares into a flash when you face it and slides toward violet as you turn away. A slow flutter runs the length of the wing, the black margin keeps its scalloped edge and white beads, and the velvet body stays dark. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.85)
    this.name = knotData.id
    this.sheenColor = new Color(hsl.integer(274, 100, 54))
    const tube = uv()
    const {facing, grazing, near, intimate} = viewerFrame()
    const t = time
    const footprint = uvFootprint()
// Brick layout of overlapping scales; rows alternate their offset and wrap on an even count.
    const lattice = vec2(tube.x.mul(columns), tube.y.mul(rows))
    const row = lattice.y.floor()
    const shifted = vec2(lattice.x.add(row.mod(2).mul(0.5)), lattice.y)
    const cell = shifted.floor()
    const local = shifted.fract().sub(0.5)
    const identity = cellNoiseVec3(vec3(cell.x.mod(columns).add(columns).mod(columns), cell.y.mod(rows).add(rows).mod(rows), 3.7))
    const tilt = identity.x.sub(0.5).mul(2)
    const tiltSide = identity.y.sub(0.5).mul(2)
    const scaleHint = identity.z
// Flutter: a shallow wave creeps along the wing and lifts every scale in turn.
    const flutter = tube.x.mul(Math.PI * 4).sub(t.mul(Math.PI)).sin()
    const beat = tube.x.mul(Math.PI * 6).sub(t.mul(Math.PI)).sin().mul(0.5).add(0.5)
    const scaleTilt = tilt.mul(flutter.mul(0.8).add(1))
    const tip = local.y.add(0.26)
    const radial = vec2(local.x.div(float(0.44).sub(tip.mul(0.12))), tip.div(0.6)).length()
    const feather = footprint.u.mul(columns).max(footprint.v.mul(rows))
    const scale = radial.smoothstep(float(0.9).sub(feather.mul(0.7)), float(0.9).add(feather.mul(0.7))).oneMinus()
    const bulge = radial.mul(radial).oneMinus().max(0)
    const depth = tip.mul(0.55).add(0.55)
// Wing pattern across the tube: basal line, blue field with veins, black margin, velvet body.
    const across = tube.y
    const veins = tube.x.mul(11).fract().sub(0.5).abs()
    const scallop = tube.x.mul(11).mul(Math.PI * 2).cos().mul(0.016)
    const field = across.smoothstep(0.03, 0.07).mul(across.smoothstep(float(0.56).add(scallop), float(0.53).add(scallop)))
    const margin = across.smoothstep(float(0.53).add(scallop), float(0.57).add(scallop)).mul(across.smoothstep(0.76, 0.7))
    const body = across.smoothstep(0.76, 0.84)
// Structural colour: interference from the scale stacks, shifted by tilt and viewing angle.
    const scaleFacing = facing.add(scaleTilt.mul(0.2)).clamp(0.02, 1)
    const phase = mix(float(2.12), float(1.74), scaleFacing.oneMinus().pow(1.45)).add(scaleHint.sub(0.5).mul(0.12))
    const wingColor = spectralColor(phase).mul(0.95)
    const flash = scaleFacing.smoothstep(0.2, 0.62).mul(scale.mul(0.22).add(0.78)).mul(beat.mul(0.55).add(0.72))
    const veinShadow = veins.smoothstep(0, 0.55).oneMinus().mul(0.28).add(0.72)
    const inset = scale.mul(0.16).add(0.84)
    const wingMask = flash.mul(field).mul(veinShadow).mul(inset)
    const marginDark = mix(color(hsl.integer(293, 27, 4.4)), color(hsl.integer(286, 60, 23)), grazing.pow(2).mul(0.9))
    const spotRadius = vec2(veins.mul(1.15), across.sub(0.63).mul(15)).length()
    const spots = spotRadius.smoothstep(float(0.34), float(0.34).add(feather.mul(4))).oneMinus().mul(margin).mul(scale)
    const velvet = mix(color(hsl.integer(48, 23, 5)), color(hsl.integer(59, 50, 11)), mx_noise_float(vec3(uv().x.mul(130), uv().y.mul(34), 2.5)).mul(0.25).add(0.4))
    const bodyColor = velvet.mul(scale.mul(0.35).add(0.65)).mul(intimate.mul(0.12).add(0.88))
    this.colorNode = color(hsl.integer(293, 34, 3.6)).mul(body)
      .add(bodyColor.mul(body))
      .add(wingColor.mul(wingMask))
      .add(marginDark.mul(margin))
      .add(color(hsl.integer(87, 100, 97)).mul(spots))
    const relief = scale.mul(bulge.mul(0.7).add(depth.mul(0.3))).add(veins.smoothstep(0.55, 0.2).mul(0.3)).add(veins.smoothstep(0.5, 0).mul(-0.35))
    const scaleNormal = normalViewGeometry.add(vec3(tangentView).mul(scaleTilt.mul(0.16))).add(vec3(bitangentView as unknown as Node<'vec3'>).mul(tiltSide.mul(0.16))).normalize()
    this.normalNode = detailNormal(scaleNormal, relief, 0.0013)
    this.roughnessNode = mix(float(0.14), float(0.44), margin.mul(0.4).add(body.mul(0.6)))
    this.metalnessNode = float(0.85).sub(body.mul(0.4))
    this.clearcoat = 0.14
    this.clearcoatRoughness = 0.1
    this.sheen = 0.22
    this.sheenRoughnessNode = mix(float(0.2), float(0.6), body)
    this.iridescenceNode = field.mul(scaleFacing.oneMinus().pow(1.6)).mul(0.6)
    this.iridescenceThicknessNode = scaleFacing.mul(220).add(160)
    const glint = glints(scaleNormal, 110).mul(scale).mul(field).mul(facing.pow(2))
    this.emissiveNode = wingColor.mul(wingMask).mul(1.25)
      .add(color(hsl.integer(0, 0, 100)).mul(glint).mul(near.mul(0.25).add(0.06)))
      .add(marginDark.mul(vec3(0.155, 0.107, 1)).mul(grazing.pow(3)).mul(0.3))
  }
}

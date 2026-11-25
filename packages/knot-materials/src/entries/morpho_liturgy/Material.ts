import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, normalViewGeometry, uv, vec2, vec3} from 'three/tsl'

import {detailNormal} from '../../candidates/muse_wonder/lib/detailNormal.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

/** A shingled coat of butterfly scales in staggered rows, each scale rising from its tucked base to a rounded free tip that shadows the row behind. Each scale has its own tilt identity, so it only answers in saturated cyan-to-violet structural color when the viewer reaches its private reflection angle – elsewhere it falls back to dark umber – and a slow walk makes whole processions ignite and extinguish in sequence. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.65)
    this.name = knotData.id
    const tube = uv()
    const {view, facing, grazing, near} = viewerFrame()
    const modules = vec2(176, 20)
    const q = tube.mul(modules)
    const offset = q.y.floor().mod(2).mul(0.5)
    const shifted = vec2(q.x.add(offset), q.y)
    const cell = shifted.floor()
    const local = shifted.fract().sub(0.5)
    const random = cellNoiseVec3(vec3(wrapCell(cell, modules), 19.3))
    const along = local.x.add(0.5)
    const across = local.y.mul(2)
    const domeAcross = float(1).sub(across.pow2()).max(0)
    const tipCurve = domeAcross.mul(0.18).add(0.78)
    const pastTip = along.sub(tipCurve)
    const inside = pastTip.smoothstep(-0.015, 0.02).oneMinus()
    const ridgeStripe = local.y.mul(44).add(random.z.mul(6)).sin()
    const height = along.mul(0.22).add(domeAcross.mul(0.16)).add(ridgeStripe.mul(near).mul(0.006)).mul(inside).sub(inside.oneMinus().mul(0.05))
    const scaleNormal = detailNormal(normalViewGeometry, height, 0.07)
    this.normalNode = scaleNormal
    const sheenPhase = facing.mul(3.4).add(view.x.mul(1.7)).add(view.y.mul(1.1)).sub(view.z.mul(0.8)).add(random.x.mul(6.283)).add(random.y.mul(2.1)).add(ridgeStripe.mul(near).mul(0.3))
    const wave = sheenPhase.cos().mul(0.5).add(0.5)
    const flash = wave.pow(4)
    const hueMix = sheenPhase.mul(0.85).add(1.2).cos().mul(0.5).add(0.5)
    let lit = mix(color(hsl.integer(252, 100, 59)), color(hsl.integer(293, 100, 52.6)), hueMix)
    lit = mix(lit, color(hsl.integer(175, 100, 88.2)), flash.mul(0.35))
    const deep = mix(color(hsl.integer(294, 44, 5)), color(hsl.integer(307, 49, 13)), random.z)
    const tipBand = pastTip.abs().smoothstep(0.02, 0.14).oneMinus().mul(inside)
    const baseShadow = along.smoothstep(0.02, 0.2).oneMinus()
    let scaleColor = mix(deep, lit, flash.mul(0.88).add(0.06).mul(along.mul(0.45).add(0.62)))
    scaleColor = mix(scaleColor, color(hsl.integer(219, 100, 92.5)), tipBand.mul(flash.mul(0.45).add(0.1)))
    scaleColor = scaleColor.mul(baseShadow.mul(-0.5).add(1))
    this.colorNode = mix(color(hsl.integer(273, 38, 3.4)), scaleColor, inside)
    this.metalnessNode = flash.mul(0.45).add(0.15).mul(inside)
    this.roughnessNode = mix(float(0.55), flash.mul(-0.22).add(0.38), inside)
    this.iridescenceNode = flash.mul(0.55).add(0.15).mul(inside)
    this.iridescenceThicknessNode = random.x.mul(280).add(facing.mul(180)).add(160)
    this.clearcoat = 0.22
    this.clearcoatRoughness = 0.22
    this.clearcoatNormalNode = scaleNormal
    this.aoNode = inside.mul(baseShadow.mul(-0.42).add(1)).add(inside.oneMinus().mul(0.35))
    const sparkle = glints(scaleNormal, 140).mul(tipBand).mul(near.mul(0.5).add(0.5))
    this.emissiveNode = lit.mul(flash).mul(inside).mul(grazing.mul(0.3).add(0.12)).mul(0.24).add(color(hsl.integer(229, 100, 92.3)).mul(sparkle).mul(0.5))
  }
}

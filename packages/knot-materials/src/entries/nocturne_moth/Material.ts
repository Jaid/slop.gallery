import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, normalViewGeometry, positionViewDirection, uv, vec2, vec3} from 'three/tsl'

import {premiumBands} from '../../candidates/gpt_astra/lib/premiumBands.ts'
import {premiumDetail} from '../../candidates/gpt_astra/lib/premiumDetail.ts'
import {premiumLine} from '../../candidates/gpt_astra/lib/premiumLine.ts'
import {premiumView} from '../../candidates/gpt_astra/lib/premiumView.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal as premiumNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.95)
    this.name = knotData.id
    const st = uv()
    const view = premiumView()
    const detail = premiumDetail()
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    // Even row count and integer repeats keep both torus UV seams closed.
    const grid = st.mul(vec2(144, 36))
    const row = grid.y.floor()
    const offset = row.mul(Math.PI).cos().mul(0.25)
    const x = grid.x.add(offset).fract().sub(0.5)
    const y = grid.y.fract()
    const footprint = grid.fwidth()
    const scalesResolved = footprint.x.max(footprint.y).smoothstep(0.22, 1.15).oneMinus().mul(detail)
    const shell = x.mul(x).mul(1.65).add(y.sub(0.27).abs().pow(2).mul(0.78))
    const scaleEdge = premiumLine(shell.sub(0.255), 0.019).mul(scalesResolved)
    const dome = x.mul(Math.PI).cos().abs().pow(2).mul(y.mul(Math.PI).sin().abs().pow(2))
    const ribs = premiumBands(x.mul(92).add(y.mul(3))).mul(scalesResolved)
    const u = st.x.mul(TAU)
    const v = st.y.mul(TAU)
    const wingMark = u.mul(5).sin().add(v.mul(3).sin().mul(0.7)).add(u.mul(10).sub(v.mul(2)).cos().mul(0.22))
    const eyespot = wingMark.abs().smoothstep(0.17, 0.35).oneMinus()
    const eyespotRing = premiumLine(wingMark.abs().sub(0.48), 0.055)
    const direction = view.dot(vec3(0.7, -0.15, 0.69).normalize())
    const structuralPhase = facing.mul(9).add(direction.mul(3.4)).add(u.mul(2).sin().mul(0.65)).add(v.mul(2).cos().mul(0.4))
    const jadeShift = structuralPhase.sin().mul(0.5).add(0.5)
    const bronzeShift = structuralPhase.add(1.8).cos().mul(0.5).add(0.5).pow(3)
    const petrol = mix(color(hsl.integer(249, 58, 11)), color(hsl.integer(201, 85, 40)), jadeShift)
    const wing = mix(petrol, color(hsl.integer(77, 60, 53)), bronzeShift.mul(0.75))
    const patterned = mix(wing, color(hsl.integer(257, 38, 7)), eyespot.mul(0.82))
    const scaleLight = dome.mul(scalesResolved).mul(0.12).add(ribs.mul(0.055)).add(0.83)
    this.colorNode = patterned.mul(scaleLight).add(color(hsl.integer(172, 56, 68)).mul(eyespotRing).mul(0.12)).mul(scaleEdge.mul(0.34).oneMinus())
    this.metalness = 0.48
    this.roughnessNode = scaleEdge.mul(0.09).add(eyespot.mul(0.08)).add(ribs.mul(0.035)).add(0.235)
    this.anisotropy = 0.72
    this.anisotropyRotation = Math.PI * 0.5
    this.iridescence = 0.72
    this.iridescenceIOR = 1.38
    this.iridescenceThicknessNode = u.mul(2).sin().mul(38).add(v.mul(4).cos().mul(26)).add(dome.mul(scalesResolved).mul(24)).add(355)
    this.sheen = 0.35
    this.sheenColor.set(hsl.integer(208, 65, 68.5))
    this.sheenRoughness = 0.52
    this.clearcoat = 0.2
    this.clearcoatRoughness = 0.2
    this.normalNode = premiumNormal(dome.mul(scalesResolved).mul(0.7).sub(scaleEdge.mul(0.27)).add(ribs.mul(0.035)), 0.00038)
    this.emissiveNode = color(hsl.integer(188, 77, 46)).mul(eyespotRing).mul(grazing.pow(3)).mul(0.07)
    this.envMapIntensity = 1.05
  }
}

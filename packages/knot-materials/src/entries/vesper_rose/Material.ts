import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_atan2, mx_noise_float, normalLocal, positionGeometry, time, uv, vec2, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import {filteredRibbon} from '../../lib/filteredRibbon.ts'
import {hairline} from '../../lib/hairline.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

const leadColor = color(hsl.integer(258, 10, 21))
const giltColor = color(hsl.integer(87, 78, 68))
/** A cathedral window bent into a closed curve. Diamond quarries of pale antique glass run between dark cames, a jeweled belt of rose medallions winds along the form, and a low sun sweeps through as the viewer walks: cobalt, ruby and gold fire through the panes while the lead stays black. Up close, grisaille vines, seed bubbles and hand-cut wavering resolve in the glass. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.75)
    this.name = knotData.id
    const tube = uv()
    const p = positionGeometry
    const {view, rim, near, intimate} = viewerFrame()
// The low sun sways on its axis, and its transmission ignites whatever the viewer faces away from.
    const sunDir = vec3(time.mul(Math.PI).sin().mul(0.35).add(0.2), 0.9, 0.37).normalize()
// Diamond quarry lattice; integer frequencies keep it seamless through both UV wraps.
    const a = tube.x.mul(24).add(tube.y.mul(3))
    const b = tube.x.mul(24).sub(tube.y.mul(3))
    const dA = a.sub(a.round()).abs()
    const dB = b.sub(b.round()).abs()
    const paneId = wrapCell(vec2(a.floor().add(b.floor()), a.floor().sub(b.floor())), vec2(48, 6))
    const paneRnd = cellNoiseVec3(vec3(paneId, 5.2))
    const lead = filteredRibbon(dA, 0.055).max(filteredRibbon(dB, 0.055))
    const quarry = mix(mix(color(hsl.integer(157, 16, 71)), color(hsl.integer(89, 32, 75)), paneRnd.x), color(hsl.integer(230, 22, 69)), paneRnd.y.mul(0.6))
    const accent = mix(color(hsl.integer(265.5, 95, 37)), color(hsl.integer(17, 92, 41)), paneRnd.y)
    const quarryTint = mix(quarry, accent, paneRnd.z.smoothstep(0.8, 0.9))
// The jeweled belt: twelve rose medallions along the middle of the tube.
    const beltEdge = tube.y.sub(0.5).abs()
    const belt = beltEdge.smoothstep(0.27, 0.3).oneMinus()
    const k = tube.x.mul(12).floor()
    const centerU = k.add(0.5).div(12)
    const point = vec2(tube.x.sub(centerU).mul(7.2), tube.y.sub(0.5).mul(0.817))
    const r = point.length()
    const theta = mx_atan2(point.y, point.x.add(0.000001)) as unknown as Node<'float'>
    const rosetteRnd = cellNoiseVec3(vec3(wrapCell(vec2(k, 0), vec2(12, 1)), 1.3))
    const thetaRot = theta.sub(rosetteRnd.x.mul(TAU))
    const lobe = thetaRot.mul(8).cos().mul(0.5).add(0.5).pow(0.65)
    const petalEdge = lobe.mul(0.07).add(0.055)
    const sector = thetaRot.add(Math.PI * 1.125).mul(4).div(Math.PI).floor().mod(8)
    const jewelRnd = cellNoiseVec3(vec3(wrapCell(vec2(k, sector), vec2(12, 8)), 3.7))
// Averaging two hash channels evens the palette spread across the petals.
    const pick = jewelRnd.x.add(jewelRnd.y).mul(0.5)
    const jewel = mix(mix(color(hsl.integer(265.5, 95, 37)), color(hsl.integer(22, 97.7, 45.6)), pick.smoothstep(0.2, 0.3)), color(hsl.integer(75, 93, 72)), pick.smoothstep(0.45, 0.55))
    const jewelGlass = mix(mix(jewel, color(hsl.integer(154, 97.5, 59)), pick.smoothstep(0.7, 0.8)), color(hsl.integer(299, 88, 42.5)), pick.smoothstep(0.88, 0.93))
    const petal = r.sub(0.033).smoothstep(0, 0.004).mul(r.sub(petalEdge).smoothstep(0, 0.004).oneMinus())
    const boss = r.smoothstep(0.03, 0.036).oneMinus()
    const star = thetaRot.mul(2).cos().abs().pow(4).mul(boss).mul(0.6)
    const bossGlass = mix(color(hsl.integer(75, 93, 72)), color(hsl.integer(88, 100, 88.1)), star)
    const ring = filteredRibbon(r.sub(0.033), 0.004)
      .add(filteredRibbon(r.sub(petalEdge), 0.004))
      .add(filteredRibbon(r.sub(0.115), 0.005))
      .add(filteredRibbon(r.sub(0.132), 0.006))
    const roundel = r.smoothstep(0.132, 0.138).oneMinus()
    const face = boss.max(petal)
    const diaper = filteredRibbon(dA.sub(0.2), 0.03).add(filteredRibbon(dB.sub(0.2), 0.03)).mul(belt)
    const border = filteredRibbon(beltEdge.sub(0.3), 0.014)
// Compose the panes and the metalwork that cages them.
    const came = lead.add(diaper).add(border).add(ring.mul(roundel)).clamp()
    const cameMetal = mix(leadColor, giltColor, belt.mul(0.85).add(roundel.mul(0.35)))
    const ground = mix(color(hsl.integer(266, 95.6, 30.6)), color(hsl.integer(161, 94, 33)), rosetteRnd.y)
    let pane = mix(quarryTint, ground, belt)
    pane = mix(pane, mix(bossGlass, jewelGlass, petal), roundel.mul(face))
    const paint = hairline(mx_noise_float(p.mul(6)).sub(0.05), 0.02).add(hairline(mx_noise_float(p.mul(9).add(3)), 0.012).mul(0.7)).mul(near)
    const seed = cellularPoints(p.mul(30), 0.02, 0.07, 0.68).mul(near)
    const sunBehind = normalLocal.dot(sunDir).negate().smoothstep(-0.15, 0.45)
    const through = sunBehind.mul(view.dot(sunDir).negate().smoothstep(0.1, 0.92))
    const flicker = time.mul(Math.PI * 4).sin().mul(0.05).add(0.98)
    const flare = through.pow(8).mul(2.5).mul(flicker)
    const lit = pane.mul(through.mul(1.6).add(0.45).add(flare))
    const relief = came.mul(0.5).add(roundel.mul(0.2)).add(paint.mul(-0.2)).sub(seed.mul(0.3)).mul(intimate.add(near).clamp())
    this.colorNode = mix(pane.add(color(hsl.integer(92, 37, 95)).mul(paint).mul(0.55)).add(color(hsl.integer(87, 100, 97.7)).mul(seed).mul(0.5)), cameMetal, came)
    this.metalnessNode = came.mul(0.9)
    this.roughnessNode = float(0.1).mix(0.4, came)
    this.clearcoatNode = float(0.45).mix(0.1, came)
    this.clearcoatRoughness = 0.08
    this.aoNode = float(1).sub(came.mul(0.35))
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(5)).mul(0.35).add(relief), 0.0015)
    this.emissiveNode = lit.mul(came.oneMinus())
      .add(color(hsl.integer(85, 100, 92)).mul(rim.pow(3)).mul(0.5))
      .add(color(hsl.integer(93, 100, 95.5)).mul(flare).mul(came.oneMinus()).mul(0.6))
  }
}

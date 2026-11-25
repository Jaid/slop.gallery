import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, Fn as fn, mix, mx_noise_float, negateOnBackSide, positionWorld, select, time, uv, vec2, vec3, vec4} from 'three/tsl'

import {viewerFrame} from '../../candidates/gpt_astra/lib/viewerFrame.ts'
import {visibility} from '../../candidates/gpt_astra/lib/visibility.ts'
import {wrapCell} from '../../candidates/gpt_astra/lib/wrapCell.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import knotData from './data.ts'

const packedCells = fn(([
  q,
  period,
]: [
  Node<'vec2'>,
  Node<'vec2'>,
]) => {
  const base = q.floor().toVar()
  const fraction = q.fract().toVar()
  const first = float(1e6).toVar()
  const second = float(1e6).toVar()
  const nearest = vec2(0).toVar()
  const identity = float(0).toVar()
  for (let y = -1; y <= 1; y++) {
    for (let x = -1; x <= 1; x++) {
      const offset = vec2(x, y)
      const id = wrapCell(base.add(offset), period)
      const random = cellNoiseVec3(vec3(id, 7.19))
      const delta = offset
        .add(random.xy.mul(0.7).add(0.15))
        .sub(fraction)
      const distanceSquared = delta.dot(delta).toVar()
      const nearer = distanceSquared.lessThan(first).toVar()
      second.assign(select(nearer, first, second.min(distanceSquared)))
      nearest.assign(select(nearer, delta, nearest))
      identity.assign(select(nearer, random.z, identity))
      first.assign(first.min(distanceSquared))
    }
  }
  return vec4(nearest, identity, second.sqrt().sub(first.sqrt()).max(0))
})

/** A packed assembly of soap films and liquid Plateau borders. Two membrane depths separate under parallax. Thin-film colour comes from the physical iridescence model, not a rainbow ramp. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.95)
    this.name = knotData.id
    const tube = uv()
    const {p, N, T, B, near, uvSlope} = viewerFrame()
    const period = vec2(72, 8)
    const q = tube.mul(period)
    const cells = packedCells(q, period)
    const cellVisibility = visibility(q.fwidth().length(), 0.22, 0.95)
    const rawBorder = cells.w.smoothstep(0.016, cells.w.fwidth().add(0.045)).oneMinus()
    const border = mix(float(0.18), rawBorder, cellVisibility)
    const interior = border.oneMinus()
    const backQ = q
      .sub(uvSlope.mul(period).mul(0.03))
      .add(vec2(0.37, 0.19))
    const backCells = packedCells(backQ, period)
    const backBorder = backCells.w.smoothstep(0.012, backCells.w.fwidth().add(0.033)).oneMinus()
      .mul(near)
      .mul(visibility(backQ.fwidth().length(), 0.25, 0.9))
    const capXY = cells.xy.mul(1.22)
    const capZ = float(1)
      .sub(capXY.dot(capXY))
      .max(0.1)
      .sqrt()
    const capNormal = N.mul(capZ)
      .sub(T.mul(capXY.x))
      .sub(B.mul(capXY.y))
      .normalize()
    const foamNormal = mix(N, capNormal, interior.mul(cellVisibility)).normalize()
    const drainage = positionWorld.y.mul(21)
      .sub(time.mul(0.28))
      .add(cells.z.mul(TAU))
      .sin()
    const currents = mx_noise_float(p.mul(12).add(vec3(0, time.mul(-0.03), 0)))
    const filmThickness = cells.z.mul(450)
      .add(drainage.mul(90))
      .add(currents.mul(60))
      .add(210)
      .clamp(80, 1100)
    this.envMapIntensity = 1.2
    this.colorNode = mix(color(hsl.integer(175, 33, 91)), color(hsl.integer(0, 0, 100)), border.mul(0.65).add(backBorder.mul(0.25)))
    this.metalness = 0
    this.roughnessNode = float(0.035)
      .add(border.mul(0.11))
      .add(cellVisibility.oneMinus().mul(0.17))
    // Air / water film / air: the low bulk IOR is intentional.
    // Using the same IOR for the film and substrate would largely
    // eliminate the interference responsible for soap colours.
    this.ior = 1.025
    this.iorNode = border.mul(0.308).add(1.025)
    this.iridescence = 1
    this.iridescenceIOR = 1.34
    this.iridescenceNode = interior
      .mul(cellVisibility)
      .mul(0.96)
    this.iridescenceThicknessNode = mix(float(440), filmThickness, cellVisibility)
    this.transmission = 0.92
    this.transmissionNode = border.mul(-0.46).add(0.94)
    this.thicknessNode = interior.mul(0.028).add(0.006)
    this.attenuationColor.set(hsl.integer(172, 100, 97.3))
    this.attenuationDistance = 1.3
    this.normalNode = negateOnBackSide(foamNormal)
    this.aoNode = border.mul(-0.12).add(1)
  }
}

import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_atan2, normalViewGeometry, time, uv, vec2} from 'three/tsl'

import {glints} from '../../lib/glints.ts'
import {hairline as opticalLine} from '../../lib/hairline.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

function brassGear(q: Node<'vec3'>, offsetY: number, outer: number, teeth: number, rotation: Node<'float'>) {
  const theta = mx_atan2(q.z, q.x) as Node<'float'>
  const radius = vec2(q.x, q.z).length()
  const dY = q.y.sub(offsetY)
  const plate = dY.mul(dY).mul(-2600).exp()
  const dR = radius.sub(outer)
  const rim = dR.mul(dR).mul(-320).exp()
  const toothRing = opticalLine(theta.mul(teeth).add(rotation).sin(), 0.3)
  const toothed = rim.mul(toothRing.mul(0.85).add(0.15))
  const spokes = opticalLine(theta.mul(5).add(rotation).sin(), 0.22)
    .mul(radius.smoothstep(outer * 0.12, outer * 0.4))
    .mul(radius.smoothstep(outer, outer * 1.15).oneMinus())
  const dH = radius.sub(outer * 0.16)
  const hub = dH.mul(dH).mul(-2400).exp()
  return plate.mul(toothed.add(spokes.mul(0.9)).add(hub.mul(1.6))).clamp()
}

/** A heart of brass behind smoked glass: counter-turning wheels on two parallax planes, a gold mainspring coiled around the shell, an escapement that ticks. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, view, facing, near} = viewerFrame()
    const tube = uv()
    const qNear = p.sub(view.mul(0.05))
    const qFar = p.sub(view.mul(0.12))
    const rotA = time.mul(1.1)
    const rotB = time.mul(-0.7)
    const rotC = time.mul(3).floor().div(3).mul(0.42)
    const gearA = brassGear(qFar, 0.17, 0.36, 14, rotA)
    const gearB = brassGear(qNear, -0.14, 0.48, 22, rotB)
    const gearC = brassGear(qNear, 0, 0.26, 10, rotC)
    const mechanism = gearA.max(gearB).max(gearC)
    const detail = gearA.add(gearB.mul(0.8)).add(gearC.mul(1.1)).clamp()
    const brass = mix(color(hsl.integer(84, 75, 32)), color(hsl.integer(84, 100, 88.4)), detail)
    const coil = opticalLine(tube.x.mul(Math.PI * 2 * 24).add(tube.y.mul(Math.PI * 2)).sin(), 0.2)
    const pulse = time.mul(0.75).sin()
    const beat = pulse.mul(pulse).mul(0.45).add(0.7)
    const tickFlash = time.mul(3).fract().mul(-14).exp()
    const vis = facing.mul(0.55).add(0.45)
    this.colorNode = mix(mix(color(hsl.integer(76, 28, 8)), brass, mechanism.mul(0.85)), color(hsl.integer(82, 79, 71)), coil.mul(0.85))
    this.transmission = 0.9
    this.transmissionNode = mechanism.mul(-0.7).add(0.92).clamp()
    this.roughness = 0.06
    this.ior = 1.5
    this.thickness = 0.22
    this.dispersion = 0.2
    this.attenuationColor.set(hsl.integer(76, 55, 20))
    this.attenuationDistance = 0.6
    this.clearcoat = 1
    this.clearcoatRoughness = 0.03
    this.envMapIntensity = 1.2
    this.emissiveNode = brass.mul(mechanism).mul(vis).mul(near.mul(0.8).add(0.35)).mul(beat).add(brass.mul(gearC).mul(tickFlash).mul(0.6)).add(color(hsl.integer(84, 100, 88.4)).mul(coil).mul(0.35)).add(color(hsl.integer(83, 100, 93.2)).mul(glints(normalViewGeometry, 90)).mul(coil).mul(0.5))
  }
}

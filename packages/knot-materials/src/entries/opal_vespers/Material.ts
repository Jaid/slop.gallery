import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalLocal, time, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Black opal. Large grains keep a single spectrum banked until the view aligns, then open it across the whole patch. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.32)
    this.name = knotData.id
    const {p, view, facing, grazing, cameraLocal, objectDistance} = viewerFrame()
    const proximity = objectDistance.smoothstep(1.5, 4.6).oneMinus()
    const orbit = cameraLocal.x.atan(cameraLocal.z)
    const milk = mx_noise_float(p.mul(2.4)).mul(0.5).add(0.5)
    const q = p.mul(3.3)
    const cell = q.floor()
    const local = q.fract()
    const footprint = q.fwidth().length()
    const filter = footprint.min(0.1)
    const visibility = footprint.smoothstep(0.3, 1).oneMinus()
    const bandVisibility = p.fwidth().length().mul(6.5).add(view.fwidth().length().mul(3)).smoothstep(0.6, 3).oneMinus()
    let rawPatch: Node<'float'> = float(0)
    let patch: Node<'float'> = float(0)
    let coverage: Node<'float'> = float(0)
    let tintSum: Node<'vec3'> = vec3(0)
    let glow: Node<'vec3'> = vec3(0)
    let veinRelief: Node<'float'> = float(0)
    // Include every grain whose full radius can reach this point, not just its containing cell.
    for (let x = -1;x <= 1;x++) {
      for (let y = -1;y <= 1;y++) {
        for (let z = -1;z <= 1;z++) {
          const offset = vec3(x, y, z)
          const identity = cell.add(offset)
          const rnd = cellNoiseVec3(identity)
          const rnd2 = cellNoiseVec3(identity.add(vec3(5.2, 1.7, 8.4)))
          const dist = local.sub(offset.add(rnd.mul(0.42).add(0.29))).length()
          const reach = rnd.z.mul(0.18).add(0.46)
          const raw = dist.smoothstep(reach.mul(0.28), reach).oneMinus()
          const grainPatch = dist.smoothstep(reach.mul(0.28), reach.add(filter)).oneMinus().mul(visibility)
          const axis = rnd2.sub(0.5)
          const align = axis.dot(view).div(axis.length().max(0.2))
          const breath = time.mul(0.7).add(rnd.x.mul(TAU)).sin().mul(0.06)
          const active = align.smoothstep(float(0.02).add(breath), float(0.7).add(breath))
          const hue = rnd.y.mul(TAU).add(align.mul(2.1)).add(orbit).add(facing.mul(0.4))
          const tint = spectralColor(hue)
          const phase = p.dot(axis).mul(6.5).add(align.mul(3)).add(rnd.x.mul(2))
          const veins = phase.cos().mul(bandVisibility).mul(0.5).add(0.5)
          const core = veins.smoothstep(0.48, 0.92)
          const mask = active.mul(grainPatch)
          rawPatch = rawPatch.max(raw)
          patch = patch.max(grainPatch)
          coverage = coverage.add(mask)
          tintSum = tintSum.add(tint.mul(mask))
          glow = glow.add(tint.mul(mask).mul(core.mul(2.4).add(1.15)))
          veinRelief = veinRelief.max(core.mul(mask))
        }
      }
    }
    const fireMask = coverage.clamp()
    const fire = tintSum.div(coverage.max(0.000001))
    const potch = mix(color(hsl.integer(295, 24, 4)), color(hsl.integer(297, 23, 24)), facing.pow(0.7).mul(0.42).add(milk.mul(0.1)))
    this.colorNode = mix(potch, fire, fireMask.mul(0.92))
    this.metalness = 0
    this.roughnessNode = float(0.28).sub(fireMask.mul(0.14)).clamp(0.08, 0.4)
    this.clearcoat = 0.72
    this.clearcoatRoughness = 0.06
    this.ior = 1.45
    this.sheenNode = color(hsl.integer(264, 56, 86)).mul(grazing.pow(1.6)).mul(fireMask.oneMinus()).mul(0.16)
    this.sheenRoughness = 0.5
    const pinScale = p.mul(40)
    const pinFade = pinScale.fwidth().length().smoothstep(0.16, 0.48).oneMinus()
    const pins = cellularPoints(pinScale, 0.02, 0.08, 0.74)
    const pinIdentity = cellNoiseVec3(pinScale.floor())
    const pinAxis = pinIdentity.sub(0.5)
    const pinAlign = pinAxis.dot(view).div(pinAxis.length().max(0.2))
    const pinHue = pinIdentity.x.mul(TAU).add(orbit).add(pinAlign.mul(1.4))
    this.emissiveNode = glow
      .add(spectralColor(pinHue).mul(pins).mul(pinFade).mul(proximity).mul(fireMask.mul(0.65).add(0.35)).mul(2.2))
    this.normalNode = proceduralNormal(patch.mul(0.004).add(milk.mul(0.007)).add(veinRelief.mul(0.0005)), 1)
    this.positionNode = p.add(normalLocal.mul(milk.sub(0.5).mul(0.007).add(rawPatch.mul(0.004))))
  }
}

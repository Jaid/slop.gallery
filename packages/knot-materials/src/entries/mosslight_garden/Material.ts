import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, normalLocal, normalViewGeometry, positionGeometry, time, vec3} from 'three/tsl'

import {beads} from '../../lib/beads.ts'
import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

function rootLine(boundary: Node<'float'>, width: number) {
  const footprint = boundary.fwidth().max(0.0001)
  return boundary.smoothstep(width, footprint.mul(1.35).add(width)).oneMinus()
}
/** A miniature moss biome with wet leaves, dewdrops, submerged mycelium and wandering spores. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.7)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const macro = mx_fractal_noise_float(p.mul(5.5).add(vec3(2.1, -0.7, 4.2)), 4, 2.08, 0.53).mul(0.5).add(0.5)
    const tufts = mx_fractal_noise_float(p.mul(24).add(macro.mul(2.4)), 3, 2.2, 0.5).mul(0.5).add(0.5)
    const leafNoise = mx_noise_float(p.mul(58).add(vec3(-1.3, 4.8, 2.6))).mul(0.5).add(0.5)
    const mossHeight = macro.mul(0.006).add(tufts.pow(2).mul(0.0045)).add(leafNoise.mul(0.0012))
    this.positionNode = positionGeometry.add(normalLocal.mul(mossHeight))
    const buried = p.sub(view.mul(0.028).div(facing.max(0.3)))
    const rootBoundary = cellularBoundary(buried.mul(12).add(vec3(4.3, -2.6, 7.8)))
    const roots = rootLine(rootBoundary, 0.038).mul(macro.smoothstep(0.18, 0.8))
    const fineRootBoundary = cellularBoundary(buried.mul(27).add(vec3(-3.1, 8.2, 1.7)))
    const fineRoots = rootLine(fineRootBoundary, 0.022).mul(intimate)
    const dew = beads(p.mul(39), 6.4)
    const dewMask = dew.mask.mul(near).mul(dew.random.x.smoothstep(0.62, 0.76))
    const sporePoint = p.sub(view.mul(0.09))
    const spores = cellularPoints(sporePoint.mul(78), 0.018, 0.13, 0.87).mul(intimate)
    const darkMoss = mix(color(hsl.integer(163, 42, 7)), color(hsl.integer(149, 75, 19)), macro)
    const moss = mix(darkMoss, color(hsl.integer(126, 77, 53)), tufts.pow(2).mul(0.68)).add(color(hsl.integer(158, 66, 29)).mul(leafNoise.mul(grazing).mul(0.24)))
    const wetMoss = mix(moss, color(hsl.integer(171, 52, 9)), dewMask.mul(0.5))
    const rootTint = mix(color(hsl.integer(176, 94, 32)), color(hsl.integer(167, 90, 84.5)), fineRoots.mul(0.55).add(facing.mul(0.15)))
    this.colorNode = mix(wetMoss, rootTint, roots.mul(0.42).add(fineRoots.mul(0.28)).clamp())
    this.metalness = 0
    this.roughnessNode = mix(float(0.92), float(0.035), dewMask).sub(roots.mul(0.16)).clamp(0.025, 1)
    this.clearcoatNode = dewMask.mul(0.96).add(roots.mul(0.12)).clamp()
    this.clearcoatRoughnessNode = mix(float(0.26), float(0.018), dewMask)
    this.sheen = 0.38
    this.sheenColor.set(hsl.integer(133, 63, 63))
    this.sheenRoughness = 0.86
    this.normalNode = proceduralNormal(mossHeight.add(tufts.mul(0.0026)).add(dew.cap.mul(dewMask).mul(0.01)), 0.9)
    const wetNormal = normalViewGeometry.add(dew.random.sub(0.5).mul(dew.cap).mul(0.7)).normalize()
    const dewSpark = glints(wetNormal, 150).mul(dewMask).mul(1.2)
    const signalPhase = p.dot(vec3(8.3, -5.4, 6.7)).sub(time.mul(0.75)).add(macro.mul(5.2))
    const rootSignal = signalPhase.sin().mul(0.5).add(0.5).pow(12).mul(roots.max(fineRoots))
    const fireflyFlicker = time.mul(dew.random.y.mul(2.2).add(2.4)).add(dew.random.z.mul(24)).sin().mul(0.35).add(0.65)
    this.emissiveNode = rootTint.mul(roots.max(fineRoots)).mul(0.055).add(rootTint.mul(rootSignal).mul(near.mul(0.65).add(0.35)).mul(1.05)).add(color(hsl.integer(102, 83, 93.4)).mul(spores).mul(fireflyFlicker).mul(1.8)).add(color(hsl.integer(0, 0, 100)).mul(dewSpark))
  }
}

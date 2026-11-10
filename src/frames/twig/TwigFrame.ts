import {color, float, max, mix, mx_fractal_noise_float, mx_noise_float, vec3} from 'three/tsl'
import {CylinderGeometry, MeshPhysicalNodeMaterial} from 'three/webgpu'

import {heightNormal, visibleDetail} from '#src/lib/materials/filters.ts'

import PortraitFrame, {frameBack} from '../base/PortraitFrame.ts'
import {assembleFrame, ornament, place, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import {frameSurface} from '../lib/materials/frameAttributes.ts'

const imageDepth = -0.066
const birch = 0
const bark = 1
/** a flat panel of birch bark the branches are nailed onto, its edge rounded */
const profile = FrameProfile.from([-0.005, imageDepth], birch)
  .line(-0.005, -0.068)
  .line(0.07, -0.068)
  .arc(0.076, -0.076, 0.4, {steps: 3})
  .line(0.076, frameBack)
  .line(-0.005, frameBack)
/** how far the branches run on past the corners where they cross */
const overhang = 0.075
/** A branch along x of `length`, thicker at one end, bowing gently and wandering a little, its bark mapped round and along it. */
function branch(length: number, radius: number, seed: number) {
  const cylinder = new CylinderGeometry(radius * 0.82, radius, length, 9, 6)
  cylinder.rotateZ(Math.PI / 2)
  const position = cylinder.getAttribute('position')
  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index) / length
    // A gentle bow plus a wander, so no two branches are straight alike.
    position.setY(index, position.getY(index) + Math.sin(Math.PI * (x + 0.5)) * radius * 0.5 + Math.sin(x * 9 + seed) * radius * 0.18)
    position.setZ(index, position.getZ(index) + Math.sin(x * 6.3 + seed * 1.7) * radius * 0.25)
  }
  cylinder.computeVertexNormals()
  // Round the branch as a share of a turn, along it in meters.
  const uv = cylinder.getAttribute('uv')
  for (let index = 0; index < uv.count; index++) {
    uv.setY(index, uv.getY(index) * length + seed)
  }
  return ornament(cylinder, {
    kind: 1,
    ownUv: true,
    cavity: 0,
  })
}
/** The Lodge’s: an Adirondack frame of rough branches crossing at the corners, nailed over a panel of birch bark. */
export default class TwigFrame extends PortraitFrame {
  override readonly description = 'An Adirondack camp frame for the Lodge: rough branches still in their furrowed, lichen-spotted bark, crossing at the corners and running on past them, nailed over a panel of paper birch bark banded with dark lenticels and peeling here and there.'
  override readonly front = -0.068 + 0.04
  override readonly imageDepth = imageDepth
  override readonly impactSound = 'hardwood'
  override readonly reach = 0.12
  override readonly tint = '#6b5a48'
  override readonly title = 'Adirondack twig'

  override createGeometry(width: number, height: number) {
    const halfWidth = width / 2
    const halfHeight = height / 2
    const inner = 0.032
    const radius = 0.015
    // The rails lie on the panel; the stiles cross over them in front.
    const rail = (seed: number) => branch(width + (inner + overhang) * 2, radius, seed)
    const stile = (seed: number) => branch(height + (inner + overhang) * 2, radius * 0.92, seed)
    return assembleFrame([
      ...sweepProfile(profile, halfWidth, halfHeight),
      [bark, place(rail(1), [{position: [0, halfHeight + inner, -0.068 + radius]}])],
      [bark, place(rail(2.6), [{
        position: [0, -halfHeight - inner, -0.068 + radius],
        angle: Math.PI,
      }])],
      [bark, place(stile(4.1), [{
        position: [halfWidth + inner, 0, -0.068 + radius * 2.6],
        angle: -Math.PI / 2,
      }])],
      [bark, place(stile(5.7), [{
        position: [-halfWidth - inner, 0, -0.068 + radius * 2.6],
        angle: Math.PI / 2,
      }])],
    ])
  }

  protected override createMaterials() {
    return [new BirchMaterial, new BarkMaterial]
  }
}
/**
 * Rough bark for the branches: furrowed along each branch, gray-brown over a reddish inner bark showing in the furrows, with lichen in patches. Its coordinates are the branch’s own, round it and along it.
 */
class BarkMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({roughness: 0.9})
    const surface = frameSurface()
    const p = surface.position
    const footprint = max(p.x.fwidth(), p.y.fwidth()).max(p.z.fwidth())
    // uv.x runs round the branch, uv.y along it.
    const round = surface.along.mul(Math.PI * 2)
    const along = surface.across
    const furrows = mx_noise_float(vec3(round.cos().mul(3), round.sin().mul(3), along.mul(6))).abs().smoothstep(0, 0.35).oneMinus()
    const flakes = mx_fractal_noise_float(p.mul(160), 3).mul(0.5).add(0.5)
    const lichen = mx_noise_float(p.mul(20)).mul(0.5).add(0.5).smoothstep(0.68, 0.8)
    const outer = mix(color('#5a4d40'), color('#7d6e5c'), flakes)
    const barkColor = mix(mix(outer, color('#4a2a1a'), furrows.mul(0.7)), color('#8f9a6a'), lichen.mul(0.6))
    this.colorNode = barkColor
    this.roughnessNode = float(0.92).sub(lichen.mul(0.1))
    this.normalNode = heightNormal(furrows.mul(-0.0012).add(flakes.mul(0.0004)).mul(visibleDetail(footprint, 0.004).mul(0.7).add(0.3)))
  }
}
/** Paper birch bark: chalky white, banded by dark lenticels running along the members, peeling here and there to the tan bark under it. */
class BirchMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({roughness: 0.75})
    const surface = frameSurface()
    const p = surface.position
    const lenticels = mx_noise_float(vec3(surface.along.mul(18), surface.reach.mul(260), surface.member)).mul(0.5).add(0.5).smoothstep(0.78, 0.86)
    const peeling = mx_fractal_noise_float(vec3(surface.along.mul(6), surface.reach.mul(30), surface.member.add(4)), 3).mul(0.5).add(0.5).smoothstep(0.66, 0.7)
    const chalk = mx_noise_float(p.mul(90)).mul(0.5).add(0.5)
    const white = mix(color('#d9d4c6'), color('#efece2'), chalk)
    this.colorNode = mix(mix(white, color('#2a2420'), lenticels), color('#b08a5e'), peeling)
    this.normalNode = heightNormal(peeling.mul(-0.0003).sub(lenticels.mul(0.0001)))
  }
}

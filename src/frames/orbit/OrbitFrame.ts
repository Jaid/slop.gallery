import {color, float, max, mix, select, time, vec3} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import PortraitFrame, {frameBack} from '../base/PortraitFrame.ts'
import {assembleFrame, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import {frameSurface} from '../lib/materials/frameAttributes.ts'
import frameStudio from '../lib/materials/frameStudio.ts'
import FrameVelvetMaterial from '../lib/materials/FrameVelvetMaterial.ts'

const imageDepth = -0.064
const velvet = 0
const gold = 1
/** where the gold rod runs round the panel, as a half-round standing on it */
const rod = {
  from: 0.07,
  to: 0.084,
  z: -0.068,
}
/** a thin gold rod at the sight edge, a broad panel of dark velvet with a gold rod running round it, and the panel’s rounded edge down to the wall */
const profile = FrameProfile.from([-0.005, imageDepth], gold)
  .line(-0.005, -0.061)
  .arc(0.005, -0.061, 0.5)
  .line(0.006, rod.z, {material: velvet})
  .line(rod.from, rod.z)
  .arc(rod.to, rod.z, 0.5, {
    steps: 10,
    material: gold,
  })
  .line(0.112, rod.z, {material: velvet})
  .arc(0.118, -0.08, 0.45, {steps: 6})
  .line(0.118, frameBack)
  .line(-0.005, frameBack)
/** Moonfall’s: a dark velvet panel ringed by a gold rod, a bead of light orbiting round it like the beads round the sculpture’s rings. */
export default class OrbitFrame extends PortraitFrame {
  override readonly description = 'An orbit for the sculpture’s neighbors: a broad panel of midnight teal velvet ringed by a polished gold rod, round which a bead of light keeps running like the beads on Moonfall’s rings, a pale cyan tail trailing behind it, the work held in by a second, slimmer rod.'
  override readonly front = profile.front
  override readonly imageDepth = imageDepth
  override readonly reach = profile.reach
  override readonly tint = '#0c2328'
  override readonly title = 'Orbiting bead'

  override createGeometry(width: number, height: number) {
    return assembleFrame([...sweepProfile(profile, width / 2, height / 2)])
  }

  protected override createMaterials() {
    return [new FrameVelvetMaterial({
      pile: '#06171b',
      crushed: '#0f3138',
      sheen: '#3aa6a0',
    }), new OrbitGoldMaterial]
  }
}

/**
 * The polished gold of the rods, with a bead of light running round the outer one like the beads round Moonfall’s orbits, trailing a glowing tail. The bead keeps to a quarter of the round per member, so it runs a little faster along the longer ones.
 */
class OrbitGoldMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      metalness: 1,
      roughness: 0.16,
      envMap: frameStudio,
      color: '#e2b261',
    })
    const surface = frameSurface()
    const member = surface.member.round()
    // Clockwise round the frame from the top left corner, 0 to 1.
    const around = member.add(surface.along.div(surface.halfLength).mul(0.5).add(0.5)).div(4)
    const bead = time.mul(0.045).fract()
    const behind = around.sub(bead).add(1).fract()
    // The bead itself, then the tail fading out behind it.
    const head = max(float(0), float(1).sub(behind.oneMinus().min(behind).div(0.004))).pow(2)
    const tail = select(behind.greaterThan(0.5), behind.sub(1).mul(26).exp(), float(0))
    const onRod = surface.reach.greaterThan(rod.from - 0.001).and(surface.isOrnament.lessThan(0.5))
    const glow = select(onRod, max(head.mul(6), tail.mul(1.4)), float(0))
    this.emissiveNode = mix(color('#7af2e6'), vec3(1, 0.96, 0.85), head).mul(glow)
  }
}

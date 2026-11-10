import PortraitFrame, {frameBack} from '../base/PortraitFrame.ts'
import {assembleFrame, place, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import FrameWoodMaterial, {oak} from '../lib/materials/FrameWoodMaterial.ts'
import {block} from '../lib/ornaments.ts'

const imageDepth = -0.062
/** a chamfered oak slip round the work, mitered, which the stiles and rails sit round */
const slip = FrameProfile.from([-0.005, imageDepth])
  .line(-0.005, -0.056)
  .line(0.004, -0.052)
  .line(0.009, -0.052)
  .line(0.009, frameBack)
  .line(-0.005, frameBack)
/** the stiles and rails: how wide, how far they stand forward, how far the stiles run on past the rails and the tenons through them */
const member = {
  inner: 0.009,
  width: 0.064,
  stile: -0.026,
  rail: -0.036,
  horn: 0.04,
  tenon: 0.016,
}

/** The Corridor’s: an Arts and Crafts frame of quartersawn oak, its rails tenoned right through the stiles and pegged, the stiles running on past them. */
export default class MissionFrame extends PortraitFrame {
  override readonly description = 'An Arts and Crafts frame for the timber passage: stiles and rails of fumed quartersawn oak, its medullary rays flashing silver, the rails tenoned right through the stiles and standing out past them, every joint fixed with two square pegs and the stiles running on past the rails, round a chamfered slip.'
  override readonly front = member.stile + 0.004
  override readonly imageDepth = imageDepth
  override readonly impactSound = 'hardwood'
  override readonly reach = member.inner + member.width + member.horn
  override readonly tint = '#7a5a34'
  override readonly title = 'Through-tenon oak'

  override createGeometry(width: number, height: number) {
    const halfWidth = width / 2
    const halfHeight = height / 2
    const outerX = halfWidth + member.inner + member.width
    const outerY = halfHeight + member.inner + member.width
    const stileDepth = member.stile - frameBack
    const railDepth = member.rail - frameBack
    const stileLength = (outerY + member.horn) * 2
    // Each piece is built lying along x, its grain along it, and turned upright if it is a stile.
    const stileCenter = halfWidth + member.inner + member.width / 2
    const stiles = place(block(stileLength, member.width, stileDepth), [-1, 1].map(side => ({
      position: [side * stileCenter, 0, frameBack] as const,
      angle: Math.PI / 2,
    })))
    const railLength = (outerX + member.tenon) * 2
    const railCenter = halfHeight + member.inner + member.width / 2
    const rails = place(block(railLength, member.width * 0.8, railDepth), [-1, 1].map(side => ({position: [0, side * railCenter, frameBack] as const})))
    // Two pegs through every joint, their square heads just proud of the stile.
    const pegs = place(block(0.011, 0.011, 0.003, {kind: 1}), [-1, 1].flatMap(sx => [-1, 1].flatMap(sy => [-1, 1].map(offset => ({
      position: [sx * stileCenter, sy * (railCenter + offset * member.width * 0.2), member.stile] as const,
      angle: Math.PI / 4,
    })))))
    return assembleFrame([...sweepProfile(slip, halfWidth, halfHeight), [0, stiles], [0, rails], [0, pegs]])
  }

  protected override createMaterials() {
    return [new FrameWoodMaterial({
      timber: {
        ...oak,
        light: '#9a7444',
        dark: '#6b4c28',
        ring: '#432c14',
        rays: 1,
      },
      roughness: 0.55,
      gloss: 0.15,
      grime: 0.3,
    })]
  }
}

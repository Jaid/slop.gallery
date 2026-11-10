import PortraitFrame, {frameBack} from '../base/PortraitFrame.ts'
import {along, assembleFrame, corners, place, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import FrameMetalMaterial, {blackIron} from '../lib/materials/FrameMetalMaterial.ts'
import {dome, relief} from '../lib/ornaments.ts'

const imageDepth = -0.06
/** the flat bar’s face, which the straps and rivets sit on */
const bar = {
  from: 0.016,
  to: 0.082,
  z: -0.05,
}
/** a square iron rod at the sight edge, then a broad flat bar hammered slightly round at its edges, standing out from the wall on its own thickness */
const profile = FrameProfile.from([-0.005, imageDepth])
  .line(-0.005, -0.048)
  .line(0.009, -0.048)
  .line(0.009, -0.054)
  .line(0.013, -0.054)
  .arc(bar.from, bar.z, 0.3, {steps: 3})
  .line(bar.to, bar.z)
  .arc(0.087, -0.056, 0.3, {steps: 3})
  .line(0.087, frameBack)
  .line(-0.005, frameBack)
/** an iron strap bent round the top right corner: two arms along both members, cut square at their ends */
function strapOutline() {
  const arm = 0.1
  const half = 0.025
  return [[half, half], [-arm, half], [-arm, -half], [-half, -half], [-half, -arm], [half, -arm]] as const
}
const rivet = () => dome(0.006, 0.004, {
  segments: 6,
  rings: 2,
})

/** The Bastion’s own ironmongery: a flat bar of blackened wrought iron round a square rod, its corners bound by riveted straps. */
export default class StrapworkFrame extends PortraitFrame {
  override readonly description = 'Forged for cold stone and long shadows: a broad flat bar of blackened wrought iron, hammered round at its edges, round a square rod at the sight edge, its corners bound by bent straps riveted through, with more rivets marching along every member and a bloom of rust where the damp gets in.'
  override readonly front = profile.front + 0.009
  override readonly imageDepth = imageDepth
  override readonly impactSound = 'heavy'
  override readonly reach = profile.reach
  override readonly tint = '#2a2826'
  override readonly title = 'Riveted strapwork'

  override createGeometry(width: number, height: number) {
    const halfWidth = width / 2
    const halfHeight = height / 2
    const middle = (bar.from + bar.to) / 2
    const strapZ = bar.z
    // Three rivets through every strap: one in its corner and one near the end of either arm.
    const strapRivets = corners(halfWidth, halfHeight, middle, strapZ + 0.004).flatMap(({position: [x, y, z], angle = 0}) => [[0, 0], [-0.075, 0], [0, -0.075]].map(([dx, dy]) => ({
      position: [x + dx * Math.cos(angle) - dy * Math.sin(angle), y + dx * Math.sin(angle) + dy * Math.cos(angle), z] as const,
    })))
    return assembleFrame([
      ...sweepProfile(profile, halfWidth, halfHeight),
      [0, place(relief(strapOutline(), 0.004, {
        bevel: 0.0012,
        kind: 1,
      }), corners(halfWidth, halfHeight, middle, strapZ))],
      [0, place(rivet(), strapRivets)],
      [0, place(rivet(), along(halfWidth, halfHeight, middle, bar.z, {
        spacing: 0.16,
        inset: 0.16,
        limit: 24,
      }))],
    ])
  }

  protected override createMaterials() {
    return [new FrameMetalMaterial({metal: blackIron})]
  }
}

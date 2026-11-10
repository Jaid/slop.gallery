import PortraitFrame, {frameBack} from '../base/PortraitFrame.ts'
import {assembleFrame, corners, place, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import FrameMetalMaterial, {brass} from '../lib/materials/FrameMetalMaterial.ts'
import FramePaintMaterial from '../lib/materials/FramePaintMaterial.ts'
import {relief} from '../lib/ornaments.ts'

const imageDepth = -0.056
const lacquer = 0
const metal = 1
/** the step heights of the ziggurat, from the sight edge up to its crown */
const levels = [-0.05, -0.039, -0.028, -0.017] as const
/** Each step’s tread in black lacquer, its nosing a thin brass bevel, so a line of brass runs round every step. */
function ziggurat() {
  const profile = FrameProfile.from([-0.005, imageDepth], metal)
    .line(-0.005, -0.047)
    .line(0.003, -0.047)
    .line(0.004, levels[0], {material: lacquer})
  let r = 0.004
  for (let step = 0; step < levels.length; step++) {
    const top = step === levels.length - 1
    r += top ? 0.022 : 0.017
    profile.line(r, levels[step])
    if (top) {
      continue
    }
    // Up the riser to a brass nosing on the next tread.
    profile.line(r, levels[step + 1] - 0.003)
      .line(r + 0.003, levels[step + 1], {material: metal})
      .line(r + 0.0035, levels[step + 1], {material: lacquer})
    r += 0.0035
  }
  // Down the outside in two broad steps, back to the wall.
  return profile.line(r + 0.003, levels[3] - 0.003, {material: metal})
    .line(r + 0.003, levels[2], {material: lacquer})
    .line(r + 0.016, levels[2])
    .line(r + 0.016, levels[1])
    .line(r + 0.026, levels[1])
    .line(r + 0.026, frameBack)
    .line(-0.005, frameBack)
}
const profile = ziggurat()
/** where the fans spread from, on the crown of the corners */
const fanReach = 0.06
/** A sunburst fanning out over the miter of the top right corner: rays of alternating length round a quarter circle. */
function fanOutline() {
  const rays = 9
  const points: Array<readonly [number, number]> = [[0, 0]]
  for (let index = 0; index <= rays * 2; index++) {
    const angle = Math.PI / 4 + (index / (rays * 2) - 0.5) * Math.PI * 0.62
    const radius = index % 2 === 0 ? (index % 4 === 0 ? 0.04 : 0.032) : 0.02
    points.push([Math.cos(angle) * radius, Math.sin(angle) * radius])
  }
  return points
}

/** The Banquet’s: an Art Deco ziggurat in black lacquer, a brass line round every step and a brass sunburst on every corner. */
export default class DecoFrame extends PortraitFrame {
  override readonly description = 'An Art Deco ziggurat for the Banquet’s formal navy: black piano lacquer climbing in four steps to its crown and down again, a line of brass round the nosing of every step and a brass sunburst fanning out over every corner.'
  override readonly front = profile.front + 0.004
  override readonly imageDepth = imageDepth
  override readonly impactSound = 'hardwood'
  override readonly reach = profile.reach
  override readonly tint = '#0d0d10'
  override readonly title = 'Art Deco ziggurat'

  override createGeometry(width: number, height: number) {
    const halfWidth = width / 2
    const halfHeight = height / 2
    return assembleFrame([
      ...sweepProfile(profile, halfWidth, halfHeight),
      [metal, place(relief(fanOutline(), 0.004, {bevel: 0.0015}), corners(halfWidth, halfHeight, fanReach, levels[3]))],
    ])
  }

  protected override createMaterials() {
    return [
      new FramePaintMaterial({
        color: '#0c0c0e',
        roughness: 0.3,
        clearcoat: 1,
        grime: 0.1,
      }),
      new FrameMetalMaterial({metal: brass}),
    ]
  }
}

import PortraitFrame, {frameBack} from '../base/PortraitFrame.ts'
import {along, assembleFrame, corners, place, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import FrameMetalMaterial, {blackIron} from '../lib/materials/FrameMetalMaterial.ts'
import FrameWoodMaterial, {oak} from '../lib/materials/FrameWoodMaterial.ts'
import {dome, relief} from '../lib/ornaments.ts'

const imageDepth = -0.062
const wood = 0
const iron = 1
/** the boards’ face, which the irons are nailed to */
const face = {
  from: 0.012,
  to: 0.1,
  z: -0.038,
}
/** a plain square edge at the sight, then broad, thick boards with their arrises worn round, square at the outside */
const profile = FrameProfile.from([-0.005, imageDepth], wood)
  .line(-0.005, -0.044)
  .arc(face.from, face.z, 0.15, {steps: 3})
  .line(face.to, face.z)
  .arc(0.106, -0.046, 0.18, {steps: 3})
  .line(0.106, frameBack)
  .line(-0.005, frameBack)
/** a forged iron bracket over the top right corner: two arms along the members, each ending in a curl split from the iron */
function bracketOutline() {
  const arm = 0.12
  const half = 0.016
  const spade = 0.024
  /** a half disc of the spade round the arm’s end, from angle `from` to `to` */
  const arc = (x: number, y: number, from: number, to: number) => Array.from({length: 7}, (_, index) => {
    const angle = from + (to - from) * index / 6
    return [x + Math.cos(angle) * spade, y + Math.sin(angle) * spade] as const
  })
  return [
    [half, half],
    [-arm, half],
    ...arc(-arm, 0, Math.PI / 2, Math.PI * 1.5),
    [-arm, -half],
    [-half, -half],
    [-half, -arm],
    ...arc(0, -arm, Math.PI, Math.PI * 2),
    [half, -arm],
  ] as const
}
const nail = () => dome(0.006, 0.004, {
  segments: 4,
  rings: 1,
})

/** The Bastion’s own carpentry: thick boards of weathered oak, their corners bound by forged iron brackets and nailed with square nails. */
export default class OakFrame extends PortraitFrame {
  override readonly description = 'A frame for a gatehouse: thick boards of weathered oak, gray at their worn arrises and open in the grain, their corners bound by forged iron brackets ending in spade-shaped curls, all of it fastened with square hand-cut nails.'
  override readonly front = profile.front + 0.006
  override readonly imageDepth = imageDepth
  override readonly impactSound = 'hardwood'
  override readonly reach = profile.reach
  override readonly tint = '#6b5a45'
  override readonly title = 'Iron-bound oak'

  override createGeometry(width: number, height: number) {
    const halfWidth = width / 2
    const halfHeight = height / 2
    const middle = (face.from + face.to) / 2
    const bracketNails = corners(halfWidth, halfHeight, middle, face.z + 0.003).flatMap(({position: [x, y, z], angle = 0}) => [[0, 0], [-0.1, 0], [0, -0.1]].map(([dx, dy]) => ({
      position: [x + dx * Math.cos(angle) - dy * Math.sin(angle), y + dx * Math.sin(angle) + dy * Math.cos(angle), z] as const,
      angle: angle + Math.PI / 4,
    })))
    return assembleFrame([
      ...sweepProfile(profile, halfWidth, halfHeight),
      [iron, place(relief(bracketOutline(), 0.003, {
        bevel: 0.001,
        kind: 1,
      }), corners(halfWidth, halfHeight, middle, face.z))],
      [iron, place(nail(), bracketNails)],
      [iron, place(nail(), along(halfWidth, halfHeight, middle, face.z, {
        spacing: 0.22,
        inset: 0.24,
        limit: 20,
      }))],
    ])
  }

  protected override createMaterials() {
    return [
      new FrameWoodMaterial({
        timber: {
          ...oak,
          light: '#7f7262',
          dark: '#4e4235',
          ring: '#2a221a',
          rings: 90,
          rays: 0.3,
          pores: 1,
        },
        roughness: 0.85,
        grime: 0.7,
        stain: '#d8d2c8',
      }),
      new FrameMetalMaterial({metal: blackIron}),
    ]
  }
}

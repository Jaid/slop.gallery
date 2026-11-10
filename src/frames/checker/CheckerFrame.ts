import {float, select} from 'three/tsl'

import PortraitFrame, {frameBack} from '../base/PortraitFrame.ts'
import {assembleFrame, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import {fittedPeriod} from '../lib/materials/frameAttributes.ts'
import FrameMetalMaterial, {brass} from '../lib/materials/FrameMetalMaterial.ts'
import FrameStoneMaterial, {carrara, neroMarquina} from '../lib/materials/FrameStoneMaterial.ts'

const imageDepth = -0.05
const stone = 0
const metal = 1
/** the flat face the squares are laid in, three rows across */
const face = {
  from: 0.008,
  to: 0.083,
  z: -0.044,
}
const rows = 3
/** a brass sight edge, a flat face of marble squares, a brass bead and a polished black marble edge */
const profile = FrameProfile.from([-0.005, imageDepth], metal)
  .line(-0.005, -0.041)
  .arc(0.006, -0.041, 0.35)
  .line(face.from, face.z, {material: stone})
  .line(face.to, face.z)
  .line(0.085, -0.04, {material: metal})
  .arc(0.094, -0.04, 0.5)
  .line(0.096, -0.046, {material: stone})
  .arc(0.104, -0.062, 0.3, {steps: 6})
  .line(0.104, frameBack)
  .line(-0.005, frameBack)

/** The Banquet’s: its floor’s checker of Carrara and Nero Marquina, laid three squares across a flat face between brass beads. */
export default class CheckerFrame extends PortraitFrame {
  override readonly description = 'The Banquet’s floor turned up onto the wall: a flat face laid with polished squares of white Carrara and black Nero Marquina, three across, each veined on its own, between a brass sight edge and a brass bead, finished with a rounded edge of black marble.'
  override readonly front = profile.front
  override readonly imageDepth = imageDepth
  override readonly impactSound = 'heavy'
  override readonly reach = profile.reach
  override readonly tint = '#d9d7d1'
  override readonly title = 'Marble checker'

  override createGeometry(width: number, height: number) {
    return assembleFrame([...sweepProfile(profile, width / 2, height / 2)])
  }

  protected override createMaterials() {
    const size = (face.to - face.from) / rows
    return [
      new FrameStoneMaterial({
        stone: neroMarquina,
        inlays: [{
          stone: carrara,
          mask: surface => {
            // Squares fitted so whole ones run into the miters, which halve them diagonally like the floor’s at a wall.
            const period = fittedPeriod(surface.openingHalf, size, face.from)
            const column = surface.along.sub(surface.openingHalf.add(face.from)).div(period).floor()
            const row = surface.reach.sub(face.from).div(size).floor()
            const white = column.add(row).mod(2).abs().lessThan(0.5)
            const inside = surface.reach.greaterThanEqual(face.from).and(surface.reach.lessThanEqual(face.to)).and(surface.isOrnament.lessThan(0.5))
            return select(white.and(inside), float(1), float(0))
          },
        }],
      }),
      new FrameMetalMaterial({metal: brass}),
    ]
  }
}

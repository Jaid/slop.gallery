import PortraitFrame, {frameBack} from '../base/PortraitFrame.ts'
import {assembleFrame, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import FrameMetalMaterial, {bronze as bronzeMetal} from '../lib/materials/FrameMetalMaterial.ts'
import FrameStoneMaterial, {travertine} from '../lib/materials/FrameStoneMaterial.ts'

const imageDepth = -0.06
const stone = 0
const bronze = 1
/** a slim bronze slip round the work, then the travertine architrave of a doorway: two fasciae stepping forward under a cyma reversa and a fillet */
const profile = FrameProfile.from([-0.005, imageDepth], bronze)
  .line(-0.005, -0.05)
  .arc(0.004, -0.05, 0.5, {steps: 6})
  .line(0.006, -0.056, {material: stone})
  .line(0.007, -0.04)
  .line(0.045, -0.039)
  .line(0.046, -0.031)
  .line(0.085, -0.029)
  .ogee(0.112, -0.012, {
    reverse: true,
    steps: 12,
  })
  .line(0.124, -0.012)
  .line(0.128, -0.02)
  .line(0.13, frameBack)
  .line(-0.005, frameBack)

/** The Lobby’s: a doorway’s architrave in travertine, like its walls, round a bronze slip. */
export default class TravertineFrame extends PortraitFrame {
  override readonly description = 'Carved from the Lobby’s own travertine like the architrave of a doorway: two fasciae stepping forward under a cyma reversa and a fillet, its bedding and voids running level across the whole frame as if it were cut from one block, round a slim slip of rubbed bronze.'
  override readonly front = profile.front
  override readonly imageDepth = imageDepth
  override readonly impactSound = 'heavy'
  override readonly reach = profile.reach
  override readonly tint = '#d3c4a6'
  override readonly title = 'Travertine architrave'

  override createGeometry(width: number, height: number) {
    return assembleFrame([...sweepProfile(profile, width / 2, height / 2)])
  }

  protected override createMaterials() {
    return [new FrameStoneMaterial({stone: travertine}), new FrameMetalMaterial({metal: bronzeMetal})]
  }
}

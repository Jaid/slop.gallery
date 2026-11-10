import PortraitFrame, {frameBack} from '../base/PortraitFrame.ts'
import {assembleFrame, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import GiltMaterial from '../lib/materials/GiltMaterial.ts'

const imageDepth = -0.045
/** a sight bead round the work, a short flat, an ogee rising to a torus, and a cove falling to the outer edge */
const profile = FrameProfile.from([-0.005, imageDepth])
  .line(-0.005, -0.038)
  .arc(0.007, -0.038, 0.5, {steps: 8})
  .line(0.02, -0.036)
  .ogee(0.05, -0.012, {steps: 12})
  .smooth()
  .arc(0.066, -0.012, 0.5, {steps: 10})
  .line(0.07, -0.015)
  .arc(0.085, -0.048, -0.22, {steps: 8})
  .line(0.085, frameBack)
  .line(-0.005, frameBack)

/** The frame every work wears where its room has none of its own: a classic moulding in water gilding. */
export default class ClassicFrame extends PortraitFrame {
  override readonly description = 'A classic moulding in water gilding on red bole: a sight bead, an ogee rising to a burnished torus and a cove falling away to the wall.'
  override readonly front = profile.front
  override readonly imageDepth = imageDepth
  override readonly reach = profile.reach
  override readonly tint = '#b8924f'
  override readonly title = 'Classic gilt'

  override createGeometry(width: number, height: number) {
    return assembleFrame([...sweepProfile(profile, width / 2, height / 2)])
  }

  protected override createMaterials() {
    return [new GiltMaterial]
  }
}

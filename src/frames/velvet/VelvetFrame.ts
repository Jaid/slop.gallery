import PortraitFrame, {frameBack} from '../base/PortraitFrame.ts'
import {assembleFrame, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import {band, beadAndReel, gadroons, legible, repeatPhase} from '../lib/materials/carving.ts'
import FrameVelvetMaterial, {oxblood} from '../lib/materials/FrameVelvetMaterial.ts'
import GiltMaterial from '../lib/materials/GiltMaterial.ts'

const imageDepth = -0.07
const gilt = 0
const velvet = 1
/** a gilt fillet at the sight edge, a sloping liner of velvet, a gilt bead, a bold gadrooned bolection and a cove down to the wall */
const profile = FrameProfile.from([-0.005, imageDepth], gilt)
  .line(-0.005, -0.062)
  .arc(0.004, -0.062, 0.45)
  .line(0.006, -0.066, {material: velvet})
  .arc(0.04, -0.046, -0.08, {steps: 6})
  .line(0.042, -0.044, {material: gilt})
  .arc(0.052, -0.044, 0.5)
  .line(0.054, -0.042)
  .arc(0.112, -0.03, 0.22, {steps: 18})
  .arc(0.14, -0.072, -0.2, {steps: 8})
  .line(0.14, frameBack)
  .line(-0.005, frameBack)

/** The Sienna’s: a broad Baroque frame in gilding round a sloping liner of oxblood velvet. */
export default class VelvetFrame extends PortraitFrame {
  override readonly description = 'Questionable company deserves a Baroque frame: a bold bolection in burnished water gilding, swelling with gadroons over a beaded fillet, round a deep sloping liner of crushed oxblood velvet that glows where the chandelier grazes it.'
  override readonly front = profile.front
  override readonly imageDepth = imageDepth
  override readonly reach = profile.reach
  override readonly tint = '#b5853f'
  override readonly title = 'Baroque velvet liner'

  override createGeometry(width: number, height: number) {
    return assembleFrame([...sweepProfile(profile, width / 2, height / 2)])
  }

  protected override createMaterials() {
    return [
      new GiltMaterial({
        wear: 0.35,
        grime: 0.7,
        relief: {
          depth: 0.006,
          height: surface => {
            const bead = band(surface, 0.042, 0.052)
            const bolection = band(surface, 0.054, 0.112)
            return legible(surface, beadAndReel(repeatPhase(surface, 0.016, 0.047), bead.t), 0.005).mul(bead.inside).mul(0.003)
              .add(legible(surface, gadroons(repeatPhase(surface, 0.03, 0.083), bolection.t), 0.01).mul(bolection.inside).mul(0.006))
          },
        },
      }),
      new FrameVelvetMaterial(oxblood),
    ]
  }
}

import PortraitFrame, {frameBack} from '../base/PortraitFrame.ts'
import {assembleFrame, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import {band, beadAndReel, legible, repeatPhase, ribbon} from '../lib/materials/carving.ts'
import FrameWoodMaterial, {burlWalnut, walnut} from '../lib/materials/FrameWoodMaterial.ts'
import GiltMaterial from '../lib/materials/GiltMaterial.ts'

const imageDepth = -0.056
const gilt = 0
const burl = 1
const wood = 2
/** a gilt bead at the sight edge, a broad flat of figured burl veneer, a carved walnut torus and a walnut cove down to the wall */
const profile = FrameProfile.from([-0.005, imageDepth], gilt)
  .line(-0.005, -0.047)
  .arc(0.007, -0.047, 0.5)
  .line(0.009, -0.05)
  .line(0.012, -0.047, {material: burl})
  .line(0.08, -0.042)
  .line(0.082, -0.038, {material: wood})
  .arc(0.1, -0.038, 0.5, {steps: 10})
  .arc(0.12, -0.07, -0.25, {steps: 8})
  .line(0.12, frameBack)
  .line(-0.005, frameBack)

/** The Sienna’s: a Victorian frame with a broad panel of burl walnut veneer, a carved walnut torus and a gilt sight edge. */
export default class BurlFrame extends PortraitFrame {
  override readonly description = 'A Victorian parlor frame for low light and rich textures: a broad, gently sloping panel of French-polished burl walnut, its swirling eyes catching the candles, between a gilt bead-and-reel at the sight edge and a walnut torus carved with a twisted ribbon.'
  override readonly front = profile.front
  override readonly imageDepth = imageDepth
  override readonly impactSound = 'hardwood'
  override readonly reach = profile.reach
  override readonly tint = '#6b4425'
  override readonly title = 'Burl walnut parlor'

  override createGeometry(width: number, height: number) {
    return assembleFrame([...sweepProfile(profile, width / 2, height / 2)])
  }

  protected override createMaterials() {
    return [
      new GiltMaterial({
        wear: 0.25,
        relief: {
          depth: 0.003,
          height: surface => {
            const sight = band(surface, -0.005, 0.007)
            return legible(surface, beadAndReel(repeatPhase(surface, 0.016, 0), sight.t), 0.005).mul(sight.inside).mul(0.0025)
          },
        },
      }),
      new FrameWoodMaterial({
        timber: burlWalnut,
        gloss: 0.9,
        roughness: 0.3,
      }),
      new FrameWoodMaterial({
        timber: walnut,
        gloss: 0.3,
        roughness: 0.45,
        relief: surface => {
          const torus = band(surface, 0.082, 0.1)
          return legible(surface, ribbon(repeatPhase(surface, 0.03, 0.091), torus.t), 0.008).mul(torus.inside).mul(0.004)
        },
      }),
    ]
  }
}

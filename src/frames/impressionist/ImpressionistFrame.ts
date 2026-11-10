import {float, mx_noise_float, vec3} from 'three/tsl'

import {visibleDetail} from '#src/lib/materials/filters.ts'

import PortraitFrame, {frameBack} from '../base/PortraitFrame.ts'
import {assembleFrame, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import {band, reeds} from '../lib/materials/carving.ts'
import FramePaintMaterial from '../lib/materials/FramePaintMaterial.ts'
import GiltMaterial from '../lib/materials/GiltMaterial.ts'

const imageDepth = -0.052
const gilt = 0
const paint = 1
/** a slim gilt fillet at the sight edge, then a broad white face sloping back from the work, three reeds near its outer edge and a plain round down to the wall */
const profile = FrameProfile.from([-0.005, imageDepth], gilt)
  .line(-0.005, -0.038)
  .arc(0.005, -0.038, 0.45)
  .line(0.007, -0.04, {material: paint})
  .line(0.074, -0.05)
  .line(0.076, -0.047)
  .line(0.098, -0.047)
  .arc(0.112, -0.062, 0.4, {steps: 8})
  .line(0.112, frameBack)
  .line(-0.005, frameBack)

/** The Salon’s: a broad frame painted white, as the Impressionists framed their pictures against the jury’s gilt, a slim gilt fillet round the work. */
export default class ImpressionistFrame extends PortraitFrame {
  override readonly description = 'The frame the Impressionists chose to defy the Salon’s gilt: a broad face sloping back from the work, painted a chalky off-white in visible brushstrokes, three fine reeds near its outer edge and only a slim gilt fillet round the picture, so the colors of the painting carry the light.'
  override readonly front = profile.front
  override readonly imageDepth = imageDepth
  override readonly reach = profile.reach
  override readonly tint = '#ece7dc'
  override readonly title = 'Impressionist white'

  override createGeometry(width: number, height: number) {
    return assembleFrame([...sweepProfile(profile, width / 2, height / 2)])
  }

  protected override createMaterials() {
    return [
      new GiltMaterial({wear: 0.15}),
      new FramePaintMaterial({
        color: '#ece6d8',
        roughness: 0.8,
        grime: 0.5,
        wear: 0.2,
        under: '#9c8b70',
        layers: surface => {
          const p = surface.position
          const footprint = p.x.fwidth().max(p.y.fwidth()).max(p.z.fwidth())
          // Long strokes of a flat brush along the member, the paint thick at their edges.
          const strokes = mx_noise_float(vec3(surface.along.mul(14), surface.reach.mul(420), surface.member)).mul(0.5).add(0.5)
          const fluted = band(surface, 0.077, 0.098)
          const height = strokes.mul(0.00012).mul(visibleDetail(footprint, 0.003)).add(reeds(fluted.t, 3).mul(fluted.inside).mul(0.0018))
          return [{
            mask: float(0),
            color: vec3(1),
            height,
          }]
        },
      }),
    ]
  }
}

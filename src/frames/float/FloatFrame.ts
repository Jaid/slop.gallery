import {mx_noise_float, vec3} from 'three/tsl'

import {visibleDetail} from '#src/lib/materials/filters.ts'

import PortraitFrame, {frameBack} from '../base/PortraitFrame.ts'
import {assembleFrame, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import FrameMetalMaterial, {satinSteel} from '../lib/materials/FrameMetalMaterial.ts'
import FramePaintMaterial from '../lib/materials/FramePaintMaterial.ts'

const imageDepth = -0.052
const shadow = 0
const steel = 1
/** how deep the tray lies under the floating work, and where its steel wall stands */
const tray = {
  z: -0.078,
  wall: 0.02,
}
/** the work’s own edge falling to a dark tray far below it, then a slim steel wall rising past the work to a thin lip and down the outside to the wall */
const profile = FrameProfile.from([-0.004, imageDepth], shadow)
  .line(-0.004, tray.z)
  .line(tray.wall, tray.z)
  .line(tray.wall, -0.046, {material: steel})
  .line(tray.wall + 0.006, -0.046)
  .line(tray.wall + 0.006, frameBack)
  .line(-0.004, frameBack)

/** The Oculus’: a museum float frame, the work standing proud of a deep shadow gap inside a slim box of brushed stainless steel. */
export default class FloatFrame extends PortraitFrame {
  override readonly description = 'A float frame as a museum of modern art would hang it: the work mounted proud on a hidden block, seeming to hover over a deep black shadow gap, inside a slim box of brushed stainless steel no thicker than a pencil, its lip catching the light borrowed from the gallery above.'
  override readonly front = profile.front
  override readonly imageDepth = imageDepth
  override readonly impactSound = 'heavy'
  override readonly reach = profile.reach
  override readonly tint = '#9aa0a5'
  override readonly title = 'Steel float'

  override createGeometry(width: number, height: number) {
    return assembleFrame([...sweepProfile(profile, width / 2, height / 2)])
  }

  protected override createMaterials() {
    return [
      new FramePaintMaterial({
        color: '#0a0b0c',
        roughness: 0.9,
        grime: 0,
      }),
      new FrameMetalMaterial({
        metal: satinSteel,
        finish: surface => {
          const p = surface.position
          // Brushed along every member, the strokes fading before they could shimmer.
          const brushing = mx_noise_float(vec3(surface.along.mul(4), surface.reach.add(p.z).mul(900), surface.member)).mul(visibleDetail(p.x.fwidth().max(p.y.fwidth()), 0.002))
          return {
            height: brushing.mul(0.000006),
            roughness: brushing.mul(0.03),
          }
        },
      }),
    ]
  }
}

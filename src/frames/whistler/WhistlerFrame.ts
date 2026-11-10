import {abs, clamp, float, max, select, smoothstep, vec2, vec3} from 'three/tsl'

import PortraitFrame, {frameBack} from '../base/PortraitFrame.ts'
import {assembleFrame, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import GiltMaterial from '../lib/materials/GiltMaterial.ts'

const imageDepth = -0.05
const reeds = 11
const reed = 0.0068
/** a plain flat at the sight edge, then a broad flat face of half-round reeds side by side, and a plain edge down to the wall */
function reededProfile() {
  const profile = FrameProfile.from([-0.005, imageDepth])
    .line(-0.005, -0.043)
    .line(0.008, -0.043)
  let r = 0.008
  for (let index = 0; index < reeds; index++) {
    profile.arc(r + reed, -0.043, 0.5, {steps: 4})
    r += reed
  }
  return profile.line(r + 0.006, -0.043)
    .line(r + 0.006, frameBack)
    .line(-0.005, frameBack)
}
const profile = reededProfile()
/** where the butterfly is painted: on the bottom member, this far in from its right end */
const butterfly = {
  inset: 0.075,
  size: 0.032,
}

/** The Salon’s: a flat frame of pale gold reeds, as Whistler designed for his nocturnes, signed with his butterfly. */
export default class WhistlerFrame extends PortraitFrame {
  override readonly description = 'A frame as Whistler designed them against the Salon’s ornate gilt: a broad flat face of eleven slender half-round reeds in matte oil gilding, almost no depth and no ornament but his butterfly monogram, painted in sepia near the lower right corner.'
  override readonly front = profile.front
  override readonly imageDepth = imageDepth
  override readonly reach = profile.reach
  override readonly tint = '#cdb27a'
  override readonly title = 'Whistler reeds'

  override createGeometry(width: number, height: number) {
    return assembleFrame([...sweepProfile(profile, width / 2, height / 2)])
  }

  protected override createMaterials() {
    return [new GiltMaterial({
      wear: 0.15,
      grime: 0.3,
      environmentIntensity: 0.55,
      roughness: {
        burnished: 0.28,
        matte: 0.42,
      },
      overlay: surface => {
        // Whistler’s butterfly, two pairs of wings round a long body, painted in sepia on the bottom member, whose run starts at its right end.
        const middle = reeds * reed / 2 + 0.008
        const p = vec2(surface.along.add(surface.openingHalf.add(middle)).sub(butterfly.inset), surface.reach.sub(middle)).div(butterfly.size)
        const wing = (dx: number, dy: number, rx: number, ry: number) => smoothstep(1, 0.8, vec2(abs(p.x).sub(dx).div(rx), p.y.sub(dy).div(ry)).length())
        const body = smoothstep(0.08, 0.04, abs(p.x)).mul(smoothstep(0.5, 0.42, abs(p.y.add(0.05))))
        const sign = clamp(max(max(wing(0.33, 0.12, 0.34, 0.26), wing(0.24, -0.22, 0.22, 0.2)), body), 0, 1)
        return {
          mask: select(surface.member.round().equal(2), sign, float(0)).mul(0.9),
          color: vec3(0.16, 0.08, 0.04),
        }
      },
    })]
  }
}

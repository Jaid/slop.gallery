import {atan, select, smoothstep, vec2} from 'three/tsl'

import PortraitFrame, {frameBack} from '../base/PortraitFrame.ts'
import {assembleFrame, corners, place, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import {acanthus, band, beadAndReel, legible, repeatPhase, ribbon} from '../lib/materials/carving.ts'
import GiltMaterial from '../lib/materials/GiltMaterial.ts'
import {relief} from '../lib/ornaments.ts'

const imageDepth = -0.062
/** an astragal at the sight edge, a tall ogee rising to a ribboned torus, and a deep cove falling away to the wall */
const profile = FrameProfile.from([-0.005, imageDepth])
  .line(-0.005, -0.052)
  .arc(0.009, -0.052, 0.5, {steps: 8})
  .line(0.012, -0.055)
  .line(0.016, -0.055)
  .ogee(0.07, -0.012, {steps: 16})
  .line(0.074, -0.012)
  .arc(0.1, -0.012, 0.5, {steps: 12})
  .arc(0.14, -0.07, -0.25, {steps: 8})
  .line(0.14, frameBack)
  .line(-0.005, frameBack)
/** how far out the shells sit on the miters, over the ogee’s shoulder */
const shellReach = 0.08
const shellRadius = 0.046
/** A scallop shell fanning out over the miter of the top right corner, toward the outside, its edge scalloped into lobes. */
function shellOutline() {
  const count = 29
  const lobes = 7
  const points: Array<readonly [number, number]> = []
  for (let index = 0; index < count; index++) {
    const t = index / (count - 1)
    const angle = Math.PI / 4 + (t - 0.5) * Math.PI * 0.72
    const radius = shellRadius * (1 - 0.06 * Math.abs(Math.sin(lobes * Math.PI * t)))
    points.push([Math.cos(angle) * radius, Math.sin(angle) * radius])
  }
  // The hinge, tucked in toward the opening.
  points.push([-0.011, -0.004], [-0.004, -0.011])
  return points
}

/** The Lobby’s: a carved Louis XIV frame in burnished water gilding, a scallop shell on every miter. */
export default class LouisFrame extends PortraitFrame {
  override readonly description = 'A carved Louis XIV frame in burnished water gilding: bead and reel at the sight edge, a tall ogee of acanthus leaves, a ribboned torus and a deep cove to the wall, a ribbed scallop shell spreading over every miter.'
  override readonly front = profile.front
  override readonly imageDepth = imageDepth
  override readonly reach = profile.reach
  override readonly tint = '#c79a4e'
  override readonly title = 'Louis XIV shell'

  override createGeometry(width: number, height: number) {
    const halfWidth = width / 2
    const halfHeight = height / 2
    const shell = relief(shellOutline(), 0.018, {
      bevel: 0.005,
      kind: 1,
    })
    return assembleFrame([
      ...sweepProfile(profile, halfWidth, halfHeight),
      [0, place(shell, corners(halfWidth, halfHeight, shellReach, -0.034))],
    ])
  }

  protected override createMaterials() {
    return [new GiltMaterial({
      wear: 0.25,
      grime: 0.6,
      relief: {
        depth: 0.008,
        height: surface => {
          const sight = band(surface, -0.005, 0.009)
          const ogee = band(surface, 0.016, 0.07)
          const torus = band(surface, 0.074, 0.1)
          const members = legible(surface, beadAndReel(repeatPhase(surface, 0.02, 0), sight.t), 0.006).mul(sight.inside).mul(0.004)
            .add(legible(surface, acanthus(repeatPhase(surface, 0.06, 0.04), ogee.t), 0.012).mul(ogee.inside).mul(0.0045))
            .add(legible(surface, ribbon(repeatPhase(surface, 0.032, 0.087), torus.t), 0.008).mul(torus.inside).mul(0.005))
          // The shell’s ribs fan out from its hinge.
          const p = vec2(surface.along, surface.across)
          const angle = atan(p.y, p.x).sub(Math.PI / 4)
          const ribs = angle.mul(11).cos().abs().pow(0.6).mul(smoothstep(0.004, 0.02, p.length()))
          return select(surface.isOrnament.greaterThan(0.5), legible(surface, ribs, 0.008).mul(0.006), members)
        },
      },
    })]
  }
}

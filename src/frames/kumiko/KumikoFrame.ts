import type {FrameSurface} from '../lib/materials/frameAttributes.ts'

import {abs, float, max, min, select, smoothstep} from 'three/tsl'

import PortraitFrame, {frameBack} from '../base/PortraitFrame.ts'
import {assembleFrame, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import {band} from '../lib/materials/carving.ts'
import {fittedPeriod} from '../lib/materials/frameAttributes.ts'
import FrameWoodMaterial, {hinoki} from '../lib/materials/FrameWoodMaterial.ts'

const imageDepth = -0.058
/** the band of lattice, set into a shallow recess */
const lattice = {
  from: 0.016,
  to: 0.076,
  z: -0.05,
}
/** a plain hinoki stile round the work, the latticed band a little lower, and a plain hinoki stile at its outside, all with crisp square arrises */
const profile = FrameProfile.from([-0.005, imageDepth])
  .line(-0.005, -0.042)
  .line(lattice.from - 0.002, -0.042)
  .line(lattice.from - 0.002, lattice.z)
  .line(lattice.to + 0.002, lattice.z)
  .line(lattice.to + 0.002, -0.042)
  .line(0.092, -0.042)
  .line(0.092, frameBack)
  .line(-0.005, frameBack)
/**
 * Asanoha, the hemp-leaf pattern of kumiko: a lattice of equilateral triangles, each split by slats from its middle to its corners, so six-pointed stars of slats meet at every node. How much slat covers the point, 0 in the gaps between them.
 */
function asanoha(surface: FrameSurface) {
  const {t} = band(surface, lattice.from, lattice.to)
  const side = (lattice.to - lattice.from) / 2
  const period = fittedPeriod(surface.openingHalf, side, (lattice.from + lattice.to) / 2)
  // Skewed coordinates of a triangle lattice, two rows of triangles across the band.
  const x = surface.along.div(period)
  const y = t.mul(2).mul(Math.sqrt(3) / 2)
  const u = x.sub(y.div(Math.sqrt(3)))
  const v = y.mul(2 / Math.sqrt(3))
  const fu = u.fract()
  const fv = v.fract()
  const lower = fu.add(fv).lessThan(1)
  const a = select(lower, float(1).sub(fu).sub(fv), fu.add(fv).sub(1))
  const b = select(lower, fu, float(1).sub(fv))
  const c = select(lower, fv, float(1).sub(fu))
  // Slats along the triangles’ edges, where a barycentric coordinate is 0, and from their middles to their corners, where two are equal.
  const edges = min(min(a, b), c)
  const spokes = min(min(abs(a.sub(b)), abs(b.sub(c))), abs(c.sub(a))).mul(0.5)
  const slat = 0.035
  return max(smoothstep(slat, slat * 0.6, edges), smoothstep(slat, slat * 0.6, spokes))
}
const inBand = (surface: FrameSurface) => band(surface, lattice.from, lattice.to).inside

/** The Corridor’s: a hinoki frame set with a band of kumiko, slats fitted into the hemp-leaf pattern over a dark ground. */
export default class KumikoFrame extends PortraitFrame {
  override readonly description = 'A frame from a Japanese joiner for the long way round: plain stiles of pale hinoki with crisp square arrises, between them a recessed band of kumiko, thin slats fitted without nails into the asanoha hemp-leaf pattern of six-pointed stars, over a dark ground that shows through the gaps.'
  override readonly front = profile.front
  override readonly imageDepth = imageDepth
  override readonly impactSound = 'hardwood'
  override readonly reach = profile.reach
  override readonly tint = '#d8c39a'
  override readonly title = 'Kumiko asanoha'

  override createGeometry(width: number, height: number) {
    return assembleFrame([...sweepProfile(profile, width / 2, height / 2)])
  }

  protected override createMaterials() {
    return [
      new FrameWoodMaterial({
        timber: hinoki,
        roughness: 0.6,
        grime: 0.2,
        // The slats stand 4 mm proud of the dark ground in the band, which shows between them in shadow.
        relief: surface => asanoha(surface).mul(inBand(surface)).mul(0.004),
        shade: surface => float(1).sub(asanoha(surface).oneMinus().mul(inBand(surface)).mul(0.88)),
      }),
    ]
  }
}

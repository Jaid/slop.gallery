import type {FrameSurface} from '../lib/materials/frameAttributes.ts'
import type {Node} from 'three/webgpu'

import {clamp, float, min, vec2} from 'three/tsl'

import PortraitFrame, {frameBack} from '../base/PortraitFrame.ts'
import {assembleFrame, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import {band, beadAndReel, legible, repeatPhase} from '../lib/materials/carving.ts'
import FrameMetalMaterial, {bronze} from '../lib/materials/FrameMetalMaterial.ts'

type Float = Node<'float'>

const imageDepth = -0.054
const key = {
  from: 0.016,
  to: 0.074,
  z: -0.046,
}
/** a beaded bronze edge at the sight, a flat band cast with a meander, and a beaded round at the outside */
const profile = FrameProfile.from([-0.005, imageDepth])
  .line(-0.005, -0.045)
  .arc(0.008, -0.045, 0.5)
  .line(0.011, -0.048)
  .line(0.013, key.z)
  .line(key.to + 0.003, key.z)
  .line(key.to + 0.005, -0.04)
  .arc(0.094, -0.04, 0.5, {steps: 10})
  .line(0.098, -0.06)
  .line(0.098, frameBack)
  .line(-0.005, frameBack)
/** the strokes of one repeat of a spiral meander in the unit square, which the next repeat carries on from its bottom */
const strokes = [
  [[0, 0.12], [0.88, 0.12]],
  [[0.88, 0.12], [0.88, 0.88]],
  [[0.88, 0.88], [0.32, 0.88]],
  [[0.32, 0.88], [0.32, 0.36]],
  [[0.32, 0.36], [0.62, 0.36]],
  [[0.62, 0.36], [0.62, 0.62]],
  [[0, 0.12], [0, 0.88]],
  [[0, 0.88], [0.12, 0.88]],
] as const
/** How close the point lies to the meander’s strokes, as a raised band 1 on the strokes falling to 0 between them. */
function meander(phase: Float, t: Float) {
  const p = vec2(phase, t)
  let distance: Float = float(1)
  for (const [[ax, ay], [bx, by]] of strokes) {
    const a = vec2(ax, ay)
    const ab = vec2(bx - ax, by - ay)
    const h = clamp(p.sub(a).dot(ab).div(ab.dot(ab)), 0, 1)
    distance = min(distance, p.sub(a.add(ab.mul(h))).length())
  }
  // Square-shouldered strokes, as cast and chased.
  return clamp(float(1).sub(distance.sub(0.055).div(0.03)), 0, 1)
}
const relief = (surface: FrameSurface) => {
  const flat = band(surface, key.from, key.to)
  const keyed = meander(repeatPhase(surface, key.to - key.from, (key.from + key.to) / 2), flat.t).mul(flat.inside)
  const sight = band(surface, -0.005, 0.008)
  const outer = band(surface, key.to + 0.005, 0.094)
  const beads = legible(surface, beadAndReel(repeatPhase(surface, 0.013, 0), sight.t), 0.004).mul(sight.inside).add(legible(surface, beadAndReel(repeatPhase(surface, 0.016, 0.085), outer.t), 0.005).mul(outer.inside))
  return {
    keyed,
    height: legible(surface, keyed, 0.005).mul(0.0018).add(beads.mul(0.0025)),
  }
}

/** The Forge’s: cast bronze chased with a Greek key, the meander running round a flat band between beaded rounds, verdigris in its hollows. */
export default class MeanderFrame extends PortraitFrame {
  override readonly description = 'Cast bronze like the fittings of a Roman villa: a flat band chased with a running spiral meander, the Greek key, between beaded rounds, rubbed bright on its raised strokes and crusted with verdigris in the hollows between them.'
  override readonly front = profile.front
  override readonly imageDepth = imageDepth
  override readonly impactSound = 'heavy'
  override readonly reach = profile.reach
  override readonly tint = '#8a6a40'
  override readonly title = 'Bronze meander'

  override createGeometry(width: number, height: number) {
    return assembleFrame([...sweepProfile(profile, width / 2, height / 2)])
  }

  protected override createMaterials() {
    return [new FrameMetalMaterial({
      metal: {
        ...bronze,
        patina: {
          amount: 0.85,
          color: '#3d8069',
        },
      },
      finish: surface => {
        const {keyed, height} = relief(surface)
        // The raised strokes are rubbed bright; the ground between them dull, where the verdigris gathers.
        const flat = band(surface, key.from, key.to)
        return {
          brightness: keyed.mul(0.5).add(0.6),
          height,
          hollow: keyed.oneMinus().mul(flat.inside).mul(0.8),
          roughness: keyed.mul(-0.08),
        }
      },
    })]
  }
}

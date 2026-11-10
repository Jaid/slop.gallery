import type {FrameSurface} from '../lib/materials/frameAttributes.ts'
import type {Node} from 'three/webgpu'

import {atan, clamp, float, max, select, vec2} from 'three/tsl'

import {line} from '#src/lib/materials/filters.ts'

import PortraitFrame, {frameBack} from '../base/PortraitFrame.ts'
import {assembleFrame, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import {band, beadAndReel, legible, repeatPhase} from '../lib/materials/carving.ts'
import FramePaintMaterial, {layerGold} from '../lib/materials/FramePaintMaterial.ts'
import GiltMaterial from '../lib/materials/GiltMaterial.ts'

type Float = Node<'float'>

const imageDepth = -0.052
const gilt = 0
const paint = 1
const frieze = {
  from: 0.01,
  to: 0.084,
}
/** a gilt bead at the sight edge, the broad painted frieze of a cassetta, and a gilt torus and cove at its outer edge */
const profile = FrameProfile.from([-0.005, imageDepth], gilt)
  .line(-0.005, -0.044)
  .arc(0.008, -0.044, 0.5)
  .line(0.01, -0.048, {material: paint})
  .line(0.084, -0.048)
  .line(0.086, -0.041, {material: gilt})
  .arc(0.101, -0.041, 0.5, {steps: 10})
  .arc(0.112, -0.064, -0.25, {steps: 6})
  .line(0.112, frameBack)
  .line(-0.005, frameBack)
/**
 * A running scroll of the sgraffito, where the paint is scratched through to the gold under it: a stem waving along the band, a tendril curling off it into each of its bays and a leaf where they part, as a share of the band covered, 0 to 1.
 */
function scroll(surface: FrameSurface, t: Float) {
  const period = 0.074
  const phase = repeatPhase(surface, period, (frieze.from + frieze.to) / 2)
  // Square units: the band is about as wide as a repeat is long.
  const p = vec2(phase, t)
  const y = phase.mul(Math.PI * 2).sin().mul(0.26).add(0.5)
  const slope = phase.mul(Math.PI * 2).cos().mul(0.26 * Math.PI * 2)
  const stem = line(t.sub(y).div(slope.mul(slope).add(1).sqrt()), 0.028)
  const curl = (center: readonly [number, number], radius: number) => {
    const offset = p.sub(vec2(...center))
    // A spiral: its radius shrinks as it winds in.
    const angle = atan(offset.y, offset.x)
    const spiral = offset.length().sub(angle.add(Math.PI).div(Math.PI * 2).mul(radius * 0.55).add(radius * 0.4))
    return line(spiral, 0.02).mul(select(offset.length().lessThan(radius * 1.05), float(1), float(0)))
  }
  const leaf = (center: readonly [number, number], angle: number) => {
    const offset = p.sub(vec2(...center))
    const along = offset.x.mul(Math.cos(angle)).add(offset.y.mul(Math.sin(angle)))
    const across = offset.y.mul(Math.cos(angle)).sub(offset.x.mul(Math.sin(angle)))
    return clamp(float(1).sub(along.div(0.13).mul(along.div(0.13))).sub(across.div(0.05).mul(across.div(0.05))).mul(8), 0, 1)
  }
  return clamp(max(max(stem, max(curl([0.28, 0.2], 0.2), curl([0.78, 0.8], 0.2))), max(leaf([0.52, 0.42], 0.9), leaf([0.02, 0.58], -2.2))), 0, 1)
}

/** The Vesper’s: an Italian cassetta painted in the green of its walls, scratched through in a running scroll to the gold beneath. */
export default class SgraffitoFrame extends PortraitFrame {
  override readonly description = 'An Italian Renaissance cassetta: its broad frieze painted in the Vesper’s own verdigris green and scratched through in sgraffito to the gold beneath, a stem curling into tendrils and leaves along every member, between a gilt bead-and-reel and a gilt torus.'
  override readonly front = profile.front
  override readonly imageDepth = imageDepth
  override readonly reach = profile.reach
  override readonly tint = '#3f6b58'
  override readonly title = 'Verdigris sgraffito'

  override createGeometry(width: number, height: number) {
    return assembleFrame([...sweepProfile(profile, width / 2, height / 2)])
  }

  protected override createMaterials() {
    return [
      new GiltMaterial({
        wear: 0.3,
        relief: {
          depth: 0.003,
          height: surface => {
            const sight = band(surface, -0.005, 0.008)
            return legible(surface, beadAndReel(repeatPhase(surface, 0.018, 0), sight.t), 0.006).mul(sight.inside).mul(0.003)
          },
        },
      }),
      new FramePaintMaterial({
        color: '#2f5a48',
        roughness: 0.7,
        wear: 0.25,
        under: '#a77a3a',
        grime: 0.3,
        layers: surface => {
          const {t} = band(surface, frieze.from, frieze.to)
          const scratched = scroll(surface, t).mul(band(surface, frieze.from, frieze.to).inside)
          return [{
            mask: scratched,
            color: layerGold,
            metalness: 1,
            roughness: 0.3,
            height: scratched.mul(-0.00025),
          }]
        },
      }),
    ]
  }
}

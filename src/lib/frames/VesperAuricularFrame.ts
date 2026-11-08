import type {FrameSurface} from '#src/lib/materials/frames/frameAttributes.ts'
import type {Node} from 'three/webgpu'

import {color, float, mix, mx_cell_noise_float, mx_noise_float, select, smoothstep, vec2, vec3} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {heightNormal, insideBy, line, visibleDetail} from '#src/lib/materials/filters.ts'
import {band, beadAndReel, legible, repeatPhase} from '#src/lib/materials/frames/carving.ts'
import {backSurface, galleryLabel, hangingWire, scribble, waxSeal} from '#src/lib/materials/frames/frameBacks.ts'
import frameStudio from '#src/lib/materials/frames/frameStudio.ts'
import GiltMaterial from '#src/lib/materials/frames/GiltMaterial.ts'
import {repeat} from '#src/lib/materials/sdf.ts'

import PortraitFrame, {frameBack} from './base/PortraitFrame.ts'
import {withOpening} from './frameBack.ts'
import {assembleFrame, corners, place, sweepProfile} from './frameGeometry.ts'
import FrameProfile from './FrameProfile.ts'
import {relief} from './ornaments.ts'

type Float = Node<'float'>

const imageDepth = -0.06
/** the material of the back */
const back = 1
/** the two swelling rolls the lobes melt over */
const rolls = {
  from: 0.01,
  between: 0.05,
  to: 0.09,
}
/** a gilt bead at the sight edge, then two swelling rolls, the outer lower than the inner, melting into each other */
const profile = FrameProfile.from([-0.005, imageDepth])
  .line(-0.005, -0.05)
  .arc(0.008, -0.05, 0.5, {steps: 6})
  .line(rolls.from, -0.052)
  .arc(rolls.between, -0.052, 0.36, {steps: 14})
  .arc(rolls.to, -0.062, 0.32, {steps: 12})
  .line(0.094, -0.072)
  .line(0.094, frameBack)
  .line(-0.005, frameBack, {material: back})
/** half the reach of a cartouche from the corner it sits on */
const cartoucheSize = 0.034
/** where the cartouches’ backs lie, sunk into the rolls, and how far they stand out from there */
const cartoucheBack = -0.046
const cartoucheDepth = 0.014
/** An auricular cartouche for the corners: a fleshy lump with lobes curling out from it, fattest toward the outside of the corner, as points counterclockwise round its middle. */
function cartouche() {
  const count = 22
  return Array.from({length: count}, (_, index): readonly [number, number] => {
    const angle = index / count * Math.PI * 2
    const outward = Math.cos(angle - Math.PI / 4) * 0.5 + 0.5
    const bulges = Math.sin(angle * 3 + 0.6) * 0.18 + Math.sin(angle * 5 + 1.9) * 0.1
    const radius = cartoucheSize * (0.55 + outward * 0.4 + bulges)
    return [Math.cos(angle) * radius, Math.sin(angle) * radius]
  })
}
/**
 * The melting relief of the auricular style as a height from 0 to 1: lumps like the folds of an ear or wax gone soft, flowing along every member, mirrored about its middle and through the miters, where both members meet the same distance from the corner, and creased deep between them.
 */
function lobes(surface: FrameSurface): Float {
  const x = surface.toCorner
  const r = surface.reach
  const warp = vec2(mx_noise_float(vec3(x.mul(9), r.mul(20), 1.3)), mx_noise_float(vec3(x.mul(9), r.mul(20), 7.9))).mul(0.02)
  const q = vec2(x, r).add(warp)
  // Slow swells, about 7 cm along and 3 cm across, softened by a finer layer, warped into one another.
  const swell = mx_noise_float(vec3(q.x.mul(14), q.y.mul(34), 0.5)).mul(0.5).add(0.5)
  const fine = mx_noise_float(vec3(q.x.mul(30), q.y.mul(70), 3.3)).mul(0.5).add(0.5)
  const field = swell.mul(0.75).add(fine.mul(0.25))
  // Rounded, fleshy bodies, and a deep crease winding where one lobe folds over the next.
  const body = field.smoothstep(0.3, 0.7)
  const crease = field.sub(0.5).mul(field.sub(0.5)).mul(-220).exp()
  return body.mul(0.85).sub(crease.mul(0.45)).add(0.3).clamp(0, 1)
}
/** The cartouches’ own lobes, curling out from their middle in their front face’s meters. */
function cartoucheLobes(surface: FrameSurface): Float {
  const p = vec2(surface.along, surface.across)
  const swirl = p.length().mul(260).add(mx_noise_float(vec3(p.mul(70), 4.2)).mul(2.5)).sin().mul(0.5).add(0.5)
  return swirl.mul(smoothstep(0.004, 0.01, p.length()))
}

/** The Vesper’s: a Dutch auricular frame in gilt, its mouldings melting into lobes like the folds of an ear, a fleshy cartouche on every corner. */
export default class VesperAuricularFrame extends PortraitFrame {
  override readonly description = 'The old masters’ strangest fashion, in the manner of the Lutmas of Amsterdam: an auricular frame in water gilding, its two rolls melting into lumps and folds like the cartilage of an ear or wax gone soft in the sun, creased deep and dark between them, with a fleshy cartouche curling over every corner. Its back is old pine riddled with worm holes, sealed in red wax by a collector, a torn label and a lot number chalked on at an auction.'
  override readonly front = Math.max(profile.front, cartoucheBack + cartoucheDepth)
  override readonly imageDepth = imageDepth
  override readonly reach = profile.reach
  override readonly tint = '#b88a3e'
  override readonly title = 'Auricular gilt'

  override createGeometry(width: number, height: number) {
    const halfWidth = width / 2
    const halfHeight = height / 2
    return assembleFrame([
      ...withOpening(sweepProfile(profile, halfWidth, halfHeight), back, halfWidth, halfHeight),
      [0, place(relief(cartouche(), cartoucheDepth, {
        bevel: 0.006,
        kind: 1,
      }), corners(halfWidth, halfHeight, 0.05, cartoucheBack))],
    ])
  }

  protected override createMaterials() {
    return [new GiltMaterial({
      wear: 0.1,
      grime: 0.7,
      relief: {
        depth: 0.006,
        height: surface => {
          const sight = band(surface, -0.005, 0.008)
          const beads = legible(surface, beadAndReel(repeatPhase(surface, 0.014, 0), sight.t), 0.005).mul(sight.inside).mul(0.0018)
          const melting = legible(surface, lobes(surface), 0.008).mul(band(surface, rolls.from, rolls.to).inside).mul(0.006)
          return select(surface.isOrnament.greaterThan(0.5), legible(surface, cartoucheLobes(surface), 0.005).mul(0.003), beads.add(melting))
        },
      },
    }), new AuricularBackMaterial]
  }
}
/** The back, three and a half centuries old: dark pine planks riddled with worm holes, a collector’s seal in red wax, the remains of a torn label, a lot number chalked on at an auction, and the hanging wire across it. */
class AuricularBackMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      envMap: frameStudio,
      envMapIntensity: 0.4,
      roughness: 0.8,
    })
    const surface = backSurface()
    const {footprint, opening, point} = surface
    const outer = opening.add(profile.reach)
    const plank = point.x.div(0.15).floor()
    const grain = mx_noise_float(vec3(point.x.mul(30).add(plank.mul(5)), point.y.mul(2.5), 7.1)).mul(0.5).add(0.5)
    const joint = line(repeat(point.x, 0.15), 0.001)
    const pine = mix(color('#2e1e12'), color('#4a3220'), grain).mul(joint.mul(-0.7).add(1))
    // Worm holes, one at a random spot in some of the 5 mm cells, thick in patches.
    const cell = point.div(0.005).floor()
    const hole = point.sub(cell.add(vec2(mx_cell_noise_float(vec3(cell, 1)), mx_cell_noise_float(vec3(cell, 2))).mul(0.6).add(0.2)).mul(0.005)).length()
    const wormy = mx_noise_float(vec3(point.mul(6), 9.3)).mul(0.5).add(0.5).smoothstep(0.5, 0.7)
    const holes = select(mx_cell_noise_float(vec3(cell, 3)).lessThan(wormy.mul(0.6)), insideBy(hole.sub(0.0006), footprint), float(0)).mul(visibleDetail(footprint, 0.002))
    const seal = waxSeal(surface, vec2(outer.x.mul(-0.35), outer.y.mul(-0.4)), 0.026)
    const label = galleryLabel(surface, vec2(outer.x.mul(0.3), outer.y.mul(-0.38)), [0.12, 0.075], -0.06)
    const torn = mx_noise_float(vec3(point.mul(60), 2.2)).mul(0.5).add(0.5).smoothstep(0.32, 0.36)
    const chalk = scribble(surface, vec2(0, outer.y.mul(-0.05)), 0.22, 0.05, 8.9)
    const hanger = hangingWire(surface)
    const marked = mix(mix(mix(pine.mul(holes.mul(-0.9).add(1)), color('#d8d2c4'), chalk.mul(0.7)), label.color.mul(0.7), label.cover.mul(torn)), seal.color, seal.cover)
    this.colorNode = mix(marked, hanger.color, hanger.cover)
    this.metalnessNode = hanger.cover
    this.roughnessNode = mix(mix(float(0.82), float(0.3), seal.cover), float(0.4), hanger.cover)
    this.normalNode = heightNormal(grain.mul(0.00006).sub(joint.mul(0.0005)).sub(holes.mul(0.0003)).add(seal.height).add(hanger.height))
  }
}

import type {FrameSurface} from '../lib/materials/frameAttributes.ts'
import type {Node} from 'three/webgpu'

import {atan, clamp, color, float, max, mix, mx_noise_float, select, smoothstep, vec2, vec3} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {heightNormal, visibleDetail} from '#src/lib/materials/filters.ts'

import PortraitFrame, {frameBack} from '../base/PortraitFrame.ts'
import {assembleFrame, corners, middles, place, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import {band, beadAndReel, legible, repeatPhase} from '../lib/materials/carving.ts'
import {frameSurface as readSurface} from '../lib/materials/frameAttributes.ts'
import GiltMaterial from '../lib/materials/GiltMaterial.ts'
import {relief} from '../lib/ornaments.ts'

type Float = Node<'float'>

const imageDepth = -0.074
const gilt = 0
const linen = 1
/** a gilt fillet at the sight edge, a linen liner, a beaded gilt slip, a deep cove rising to a torus of leaves and berries, and a cove falling to the wall */
const profile = FrameProfile.from([-0.005, imageDepth], gilt)
  .line(-0.005, -0.068)
  .arc(0.004, -0.068, 0.45)
  .line(0.006, -0.07, {material: linen})
  .line(0.032, -0.065)
  .line(0.034, -0.06, {material: gilt})
  .arc(0.042, -0.06, 0.5)
  .arc(0.1, -0.016, -0.22, {steps: 10})
  .arc(0.124, -0.016, 0.5, {steps: 10})
  .arc(0.148, -0.078, -0.2, {steps: 8})
  .line(0.148, frameBack)
  .line(-0.005, frameBack)
const torus = {
  from: 0.1,
  to: 0.124,
}
/** Laurel leaves overlapping along a torus, slanting the same way, with a cluster of berries between every pair. */
function leafAndBerry(surface: FrameSurface, t: Float) {
  const phase = repeatPhase(surface, 0.028, (torus.from + torus.to) / 2)
  const slant = phase.add(t.mul(0.35)).fract()
  const x = slant.sub(0.45).mul(2.2)
  const y = t.mul(2).sub(1)
  const leaf = clamp(float(1).sub(x.mul(x).add(y.mul(y).mul(0.55))), 0, 1).sqrt().mul(smoothstep(0.98, 0.7, y.abs()))
  const midrib = smoothstep(0.08, 0, x.abs()).mul(0.25).mul(select(leaf.greaterThan(0.01), float(1), float(0)))
  const berry = (dx: number, dy: number) => clamp(float(1).sub(vec2(phase.sub(0.88 + dx).mul(9), t.sub(0.5 + dy).mul(9)).length()), 0, 1).sqrt()
  return max(leaf.add(midrib), max(berry(0, 0.16), max(berry(0.05, -0.08), berry(-0.04, -0.14))))
}
/** A C-scroll cartouche for the top right corner, a pair of scrolls curling away from the miter with a cusp between them. */
function cartoucheOutline() {
  const points: Array<readonly [number, number]> = []
  const count = 15
  for (let index = 0; index < count; index++) {
    const t = index / (count - 1)
    const angle = Math.PI * (-0.05 + 1.1 * t)
    // A lobed rim that bulges at either scroll and dips at the cusp on the diagonal.
    const radius = 0.034 + 0.012 * Math.sin(Math.PI * 2 * t) ** 2 - 0.008 * Math.exp(-((t - 0.5) ** 2) / 0.004)
    points.push([Math.cos(angle) * radius * 0.82 + Math.SQRT1_2 * 0.006, Math.sin(angle) * radius])
  }
  // Turned to fan over the diagonal toward the outside.
  return points.map(([x, y]) => [x * Math.SQRT1_2 - y * Math.SQRT1_2 + 0.004, x * Math.SQRT1_2 + y * Math.SQRT1_2 + 0.004] as const).toReversed()
}
/** an oval medallion with a scroll at either end, for the middle of every member */
function medallionOutline() {
  const points: Array<readonly [number, number]> = []
  const count = 14
  for (let index = 0; index < count; index++) {
    const angle = Math.PI * 2 * index / count
    const lobe = 1 + 0.25 * Math.cos(angle * 2) ** 8
    points.push([Math.cos(angle) * 0.04 * lobe, Math.sin(angle) * 0.022])
  }
  return points
}
/** The Salon’s: a heavy Barbizon frame, a deep gilt cove rising to a torus of leaves and berries round a linen liner, C-scroll cartouches on its corners and medallions in its middles. */
export default class BarbizonFrame extends PortraitFrame {
  override readonly description = 'The frame the Salon’s jury expected: a heavy Barbizon moulding in water gilding, a deep cove rising to a torus of laurel leaves and berries, C-scroll cartouches over the corners and scrolled medallions in the middles, round a liner of unbleached linen and a beaded slip.'
  override readonly front = profile.front + 0.012
  override readonly imageDepth = imageDepth
  override readonly reach = profile.reach
  override readonly tint = '#c0924b'
  override readonly title = 'Barbizon cartouche'

  override createGeometry(width: number, height: number) {
    const halfWidth = width / 2
    const halfHeight = height / 2
    return assembleFrame([
      ...sweepProfile(profile, halfWidth, halfHeight),
      [gilt, place(relief(cartoucheOutline(), 0.012, {
        bevel: 0.004,
        kind: 1,
      }), corners(halfWidth, halfHeight, 0.085, -0.03))],
      [gilt, place(relief(medallionOutline(), 0.01, {
        bevel: 0.004,
        kind: 2,
      }), middles(halfWidth, halfHeight, 0.106, -0.02))],
    ])
  }

  protected override createMaterials() {
    return [
      new GiltMaterial({
        wear: 0.3,
        grime: 0.65,
        relief: {
          depth: 0.006,
          height: surface => {
            const slip = band(surface, 0.034, 0.042)
            const leaves = band(surface, torus.from, torus.to)
            const members = legible(surface, beadAndReel(repeatPhase(surface, 0.014, 0.038), slip.t), 0.005).mul(slip.inside).mul(0.0025)
              .add(legible(surface, leafAndBerry(surface, leaves.t), 0.008).mul(leaves.inside).mul(0.005))
            // The ornaments’ scrolls: ribs curling round their middles.
            const p = vec2(surface.along, surface.across)
            const curl = atan(p.y, p.x).mul(5).add(p.length().mul(160)).sin().mul(0.5).add(0.5)
            return select(surface.isOrnament.greaterThan(0.5), legible(surface, curl, 0.006).mul(0.004), members)
          },
        },
      }),
      new LinenMaterial,
    ]
  }
}

/** Unbleached linen, its weave fine and slubby, for the liner round the work. */
class LinenMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      roughness: 0.92,
      sheen: 0.4,
      sheenRoughness: 0.6,
    })
    const surface = readSurface()
    const p = surface.position
    const footprint = max(p.x.fwidth(), p.y.fwidth()).max(p.z.fwidth())
    const warp = surface.along.mul(1400).sin().mul(0.5).add(0.5)
    const weft = surface.across.mul(1400).sin().mul(0.5).add(0.5)
    const weave = max(warp, weft).mul(visibleDetail(footprint, 0.0012))
    const slub = mx_noise_float(vec3(surface.along.mul(60), surface.across.mul(400), surface.member)).mul(0.5).add(0.5)
    this.colorNode = mix(color('#b8a88a'), color('#d8cbb0'), slub.mul(0.6).add(weave.mul(0.15))).mul(surface.cavity.smoothstep(0, 0.8).mul(-0.3).add(1))
    this.sheenNode = color('#e8dcc0').mul(0.3)
    this.normalNode = heightNormal(weave.mul(0.00004).add(slub.mul(0.00003)))
  }
}

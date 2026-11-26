import type {Placement} from '../lib/frameGeometry.ts'
import type {PlanePoint, RestingSurface} from '../lib/ornaments.ts'

import hsl from 'okhsl'
import {float, mx_noise_float, smoothstep, vec3} from 'three/tsl'

import PortraitFrame, {frameBack, frameDetail, frameTriangleBudget} from '../base/PortraitFrame.ts'
import {assembleFrame, middles, place, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import {band, beadAndReel, carvingByPiece, legible, repeatPhase} from '../lib/materials/carving.ts'
import GiltMaterial from '../lib/materials/GiltMaterial.ts'
import {curled, sheet, smoothPath, tube} from '../lib/ornaments.ts'

const imageDepth = -0.06
/** the broad hollow sweeping up from the sight edge, sanded matte, and the rounded rail it rises to */
const hollow = {
  from: 0.008,
  to: 0.062,
}
const rail = {
  from: 0.062,
  to: 0.084,
}
/** a beaded sight edge, a broad hollow sweeping up to a rounded rail, and a cove falling to the wall */
const profile = FrameProfile.from([-0.005, imageDepth])
  .line(-0.005, -0.052)
  .arc(0.006, -0.052, 0.45, {steps: 5})
  .line(hollow.from, -0.054)
  .arc(hollow.to, -0.03, -0.12, {steps: 10})
  .arc(rail.to, -0.03, 0.42, {steps: 8})
  .line(0.087, -0.034)
  .arc(0.112, -0.072, -0.22, {steps: 6})
  .line(0.112, frameBack)
  .line(-0.005, frameBack)
/** the moulding under a point near the top right corner, as seen from the front: the members meet in the miter */
const atCorner: RestingSurface = (x, y) => profile.heightAt(Math.max(x, y))
/** the moulding under a point near the middle of the top member */
const atMiddle: RestingSurface = (_, y) => profile.heightAt(y)
/** where the sides of an ornament end: sunk into the moulding, or, past its edge, down at the wall, so what reaches out over the edge stands there solid */
const footOf = (rest: RestingSurface): RestingSurface => (x, y) => (Math.max(x, y) > profile.reach - 0.002 ? frameBack + 0.004 : rest(x, y) - 0.002)
/** The moulding with its hollows narrower than about two centimeters filled in, for a shell to lie over them instead of sinking into every one. */
const envelope = (rest: RestingSurface): RestingSurface => (x, y) => Math.max(...[-0.02, -0.01, 0, 0.01, 0.02].map(offset => rest(x + offset * Math.SQRT1_2, y + offset * Math.SQRT1_2)))

type Shell = {
  height: number
  /** where the hinge lies */
  hinge: PlanePoint
  radius: number
  ribs: number
  /** half its spread, in radians */
  spread: number
  /** which way it fans, in radians */
  toward: number
}
/**
 * A rocaille shell fanning out from its hinge, its ribs radiating to a scalloped rim that curls up, lying over the moulding with its hollows filled in: `columns` pieces round it and `rings` out to its rim.
 */
function shell({hinge, toward, spread, radius, height, ribs}: Shell, rest: RestingSurface, columns: number, rings: number) {
  const under = envelope(rest)
  const foot = footOf(rest)
  return sheet(columns, rings + 1, (column, row) => {
    const t = column / columns
    const angle = toward + (t * 2 - 1) * spread
    const rib = Math.abs(Math.cos(t * ribs * Math.PI))
    const share = Math.min(1, row / rings)
    const reach = radius * (0.1 + 0.9 * share) * (0.86 + 0.14 * rib) * (1 - 0.25 * Math.abs(t * 2 - 1) ** 3)
    const [x, y] = [hinge[0] + Math.cos(angle) * reach, hinge[1] + Math.sin(angle) * reach]
    if (row === rings + 1) {
      return [x, y, foot(x, y)]
    }
    const swell = (1 - share ** 1.8) * (0.45 + 0.55 * rib) + 0.35 * share ** 4
    return [x, y, under(x, y) + height * (0.25 + 0.75 * swell)]
  }, {kind: 2})
}
/** A rococo scroll along its path, a broad ribbon swelling in its middle and tapering into the volutes it curls up into, `detail` times as finely round as within {@link frameTriangleBudget}. */
function scroll(path: ReadonlyArray<PlanePoint>, width: number, rest: RestingSurface, detail: number) {
  return tube(path, t => width * (0.3 + 0.7 * Math.sin(Math.PI * Math.min(1, t * 1.12) ** 0.75)), rest, {
    sides: 4 * detail,
    flatten: 0.65,
    foot: footOf(rest),
    kind: 1,
  })
}
/** A little flower of five petals round a domed heart, lying on the moulding around `middle`, `detail` times as fine as within {@link frameTriangleBudget}. */
function flower(middle: PlanePoint, radius: number, rest: RestingSurface, detail: number) {
  const around = 20 * detail
  const rings = 2 * detail
  const foot = footOf(rest)
  return sheet(around, rings + 1, (column, row) => {
    const angle = column / around * Math.PI * 2
    const petal = Math.abs(Math.cos(angle * 5 / 2)) ** 0.6
    const share = Math.min(1, row / rings)
    const reach = radius * share * (0.55 + 0.45 * petal)
    const [x, y] = [middle[0] + Math.cos(angle) * reach, middle[1] + Math.sin(angle) * reach]
    if (row === rings + 1) {
      return [x, y, foot(x, y)]
    }
    return [x, y, rest(x, y) + radius * 0.45 * (share < 0.34 ? 1.1 : (1 - share * share) * (0.5 + 0.5 * petal) + 0.2)]
  }, {
    kind: 3,
    pole: true,
    wrap: true,
  })
}
/** A leaf curving from its stalk at `base` along `toward` radians, `length` long, bending to one side by `bend`, cupped and lying on the moulding, `detail` times as fine as within {@link frameTriangleBudget}. */
function sprig(base: PlanePoint, toward: number, length: number, bend: number, rest: RestingSurface, detail: number) {
  const along = 6 * detail
  const across = 2 * detail
  const foot = footOf(rest)
  return sheet(along, across + 2, (column, row) => {
    const u = column / along
    const v = Math.min(1, Math.max(-1, (row - 1) / across * 2 - 1))
    const angle = toward + bend * u
    const width = length * 0.24 * Math.sin(Math.PI * u ** 0.8) * v
    const [x, y] = [base[0] + Math.cos(toward) * u * length - Math.sin(angle) * width, base[1] + Math.sin(toward) * u * length + Math.cos(angle) * width]
    if (row === 0 || row === across + 2) {
      return [x, y, foot(x, y)]
    }
    return [x, y, rest(x, y) + length * 0.07 * (0.6 + 0.4 * Math.abs(v)) * (0.4 + Math.sin(Math.PI * u))]
  }, {kind: 3})
}
/** The cartouche over the top right corner: a rocaille shell fanning out over the miter between a long scroll sweeping in along the top member and a shorter one along the side member, each curling up into a volute, a little C-scroll cupping the shell’s hinge, a flower and two leaves in the crook of the longer scroll and another flower with a leaf below the shorter one. */
function cornerCartouche(detail: number) {
  const long = curled(smoothPath([[0.05, 0.088], [0.015, 0.093], [-0.03, 0.086], [-0.07, 0.07], [-0.095, 0.05]], 3 * detail), 0.017, 1.1, 10 * detail)
  const short = curled(smoothPath([[0.088, 0.04], [0.093, 0.005], [0.084, -0.035], [0.064, -0.065]], 4 * detail), 0.014, -1.05, 9 * detail)
  const cup = curled(curled(smoothPath([[0.007, 0.056], [0.01, 0.024], [0.024, 0.01], [0.056, 0.007]], 3 * detail), 0.0065, 0.9, 6 * detail).toReversed(), 0.0065, -0.9, 6 * detail)
  return [
    shell({
      hinge: [0.038, 0.038],
      toward: Math.PI / 4,
      spread: 1.35,
      radius: 0.078,
      height: 0.016,
      ribs: 9,
    }, atCorner, 27 * detail, 4 * detail),
    scroll(long, 0.0075, atCorner, detail),
    scroll(short, 0.0068, atCorner, detail),
    flower([-0.05, 0.035], 0.013, atCorner, detail),
    sprig([-0.04, 0.036], 0.3, 0.032, -0.6, atCorner, detail),
    sprig([-0.058, 0.03], Math.PI + 0.5, 0.026, 0.7, atCorner, detail),
    scroll(cup, 0.0045, atCorner, detail),
    flower([0.034, -0.05], 0.011, atCorner, detail),
    sprig([0.03, -0.06], -Math.PI / 2 - 0.4, 0.028, 0.6, atCorner, detail),
  ]
}
/** The right half of the cartouche in the middle of the top member, which the left half mirrors: a scroll sweeping out from beside the shell and curling down into a volute, and the shell itself, fanning out over the edge of the frame. */
function middleCartouche(detail: number) {
  const half = curled(smoothPath([[0.035, 0.09], [0.07, 0.092], [0.105, 0.075], [0.125, 0.05]], 4 * detail), 0.015, -1.1, 9 * detail)
  return {
    shell: shell({
      hinge: [0, 0.042],
      toward: Math.PI / 2,
      spread: 1.2,
      radius: 0.085,
      height: 0.017,
      ribs: 11,
    }, atMiddle, 33 * detail, 4 * detail),
    small: shell({
      hinge: [0, 0.045],
      toward: Math.PI / 2,
      spread: 1.1,
      radius: 0.06,
      height: 0.013,
      ribs: 7,
    }, atMiddle, 21 * detail, 3 * detail),
    scroll: scroll(half, 0.0068, atMiddle, detail),
  }
}

/** One of the golden frames: a Louis XV frame in burnished and matte water gilding, a broad sanded hollow sweeping up to a rounded rail, rocaille cartouches of scrolls and shells breaking over its corners and the middles of its members. */
export default class RocailleFrame extends PortraitFrame {
  override readonly description = 'A Louis XV frame as the Paris carvers cut them for the Salon, in burnished and matte water gilding: a broad hollow sanded matte sweeping up from a beaded sight edge to a burnished rail, and over every corner a rocaille cartouche breaking the line, a ribbed shell fanning out over the miter between two scrolls of unequal length that sweep along the members and curl up into volutes, a flower in the crook of the longer one, with a smaller cartouche of twin scrolls round a shell spilling over the edge in the middle of every member.'
  override readonly front = -0.021 + 0.019
  override readonly imageDepth = imageDepth
  override readonly reach = 0.135
  override readonly tint = hsl.integer(80, 66, 68)
  override readonly title = 'Rocaille'

  override createGeometry(width: number, height: number, budget = frameTriangleBudget) {
    const halfWidth = width / 2
    const halfHeight = height / 2
    const detail = frameDetail(budget)
    const middle = middleCartouche(detail)
    // Mirrored left to right and top to bottom, as rococo frames are, rather than turned round.
    const mirrored = ([sx, sy]: readonly [number, number]): Placement => ({
      position: [sx * halfWidth, sy * halfHeight, 0],
      scale: [sx, sy, 1],
    })
    const cornerPlacements = [[1, 1], [-1, 1], [1, -1], [-1, -1]].map(signs => mirrored(signs as [number, number]))
    // The long members carry the full cartouche, the short ones a smaller shell alone.
    const [top, right, bottom, left] = middles(halfWidth, halfHeight, 0, 0)
    const [long, short] = halfWidth >= halfHeight ? [[top, bottom], [right, left]] : [[right, left], [top, bottom]]
    const halves = long.flatMap(placement => [placement, {
      ...placement,
      scale: [-1, 1, 1] as const,
    }])
    return assembleFrame([
      ...sweepProfile(profile, halfWidth, halfHeight),
      ...cornerCartouche(detail).map(part => [0, place(part, cornerPlacements)] as const),
      [0, place(middle.shell, long)],
      [0, place(middle.small, short)],
      [0, place(middle.scroll, halves)],
    ])
  }

  protected override createMaterials() {
    return [new GiltMaterial({
      burnishedReflections: true,
      wear: 0.12,
      grime: 0.5,
      roughness: {
        burnished: 0.1,
        matte: 0.38,
      },
      relief: {
        depth: 0.003,
        height: surface => carvingByPiece(surface, {
          members: footprint => {
            const sight = band(surface, -0.005, 0.006)
            const sanded = band(surface, hollow.from, hollow.to)
            // The sanded hollow: gesso mixed with sand before gilding, so the leaf lies matte over a fine grain.
            const grain = mx_noise_float(vec3(surface.position.mul(1400))).mul(0.5).add(0.5)
            return legible(surface, beadAndReel(repeatPhase(surface, 0.011, 0), sight.t), 0.004, footprint).mul(sight.inside).mul(0.0018)
              .add(legible(surface, grain, 0.0015, footprint).mul(sanded.inside).mul(0.00025))
          },
          // A scroll is grooved down its crown between two fillets.
          ornaments: [[1, footprint => {
            const across = surface.across.sub(0.5).abs()
            const groove = float(0.6).sub(smoothstep(0.1, 0, across).mul(0.45)).add(smoothstep(0.06, 0, across.sub(0.2).abs()).mul(0.3))
            return legible(surface, groove, 0.004, footprint).mul(0.0018)
          }]],
          // Fine striations along the shell’s ribs and the flower’s petals.
          others: footprint => legible(surface, surface.along.mul(80).fract().sub(0.5).abs().smoothstep(0.1, 0.4).mul(0.3).add(0.5), 0.003, footprint).mul(0.0012),
        }),
      },
    })]
  }
}

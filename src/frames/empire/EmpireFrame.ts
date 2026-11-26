import type {PlanePoint, RestingSurface} from '../lib/ornaments.ts'

import hsl from 'okhsl'
import {atan, smoothstep, vec2} from 'three/tsl'

import PortraitFrame, {frameBack, frameDetail, frameTriangleBudget} from '../base/PortraitFrame.ts'
import {assembleFrame, corners, middles, place, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import {band, beadAndReel, carvingByPiece, legible, repeatPhase} from '../lib/materials/carving.ts'
import GiltMaterial from '../lib/materials/GiltMaterial.ts'
import {curled, sheet, smoothPath, tube, turned} from '../lib/ornaments.ts'

const imageDepth = -0.066
/** the flat frieze inside the cove, gilt matte and strewn with stars */
const frieze = {
  from: 0.009,
  to: 0.034,
}
/** the deep cove rising outward, plain and burnished */
const cove = {
  from: 0.036,
  to: 0.088,
  top: -0.018,
}
/** the torus at the outside, wound with laurel */
const torus = {
  from: 0.09,
  to: 0.112,
}
/** a pearled sight edge, a flat frieze, a deep cove rising to a laurel torus, and a little cove to the wall */
const profile = FrameProfile.from([-0.005, imageDepth])
  .line(-0.005, -0.058)
  .arc(0.007, -0.058, 0.5, {steps: 6})
  .line(frieze.from, -0.06)
  .line(frieze.to, -0.058)
  .line(cove.from, -0.054)
  .arc(cove.to, cove.top, -0.3, {steps: 12})
  .line(torus.from, -0.014)
  .arc(torus.to, -0.014, 0.5, {steps: 10})
  .arc(0.125, -0.07, -0.18, {steps: 6})
  .line(0.125, frameBack)
  .line(-0.005, frameBack)
const smooth = (from: number, to: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)))
  return t * t * (3 - 2 * t)
}
/** the moulding under a point near the top right corner, the members meeting in the miter */
const atCorner: RestingSurface = (x, y) => profile.heightAt(Math.max(x, y))
/** the moulding under a point near the middle of the top member */
const atMiddle: RestingSurface = (_, y) => profile.heightAt(y)
/** The moulding with its hollows narrower than about a centimeter filled in, so a palmette lies over the cove’s curve instead of sinking into its every step. */
const envelope = (rest: RestingSurface): RestingSurface => (x, y) => Math.max(...[-0.006, -0.003, 0, 0.003, 0.006].map(offset => rest(x + offset * Math.SQRT1_2, y + offset * Math.SQRT1_2)))

type Palmette = {
  /** where the lobes spring from */
  base: PlanePoint
  height: number
  /** how long its middle lobe is, the outer ones shorter */
  length: number
  /** how many lobes it has, an odd number */
  lobes: number
  /** half the angle its outermost lobes spread to */
  spread: number
  /** which way its middle lobe points, in radians */
  toward: number
  /** how wide a lobe is at most */
  width: number
}

/**
 * A palmette as Percier and Fontaine drew them: a fan of flame-shaped lobes springing from a boss between two volutes, the middle one longest, the outer ones bending away and curling their tips up, cast in composition and lying on the moulding. Each lobe is `along` pieces long and four across between its sunk edges, both `detail` times as many as within {@link frameTriangleBudget}, and so are the pieces of the volutes and the boss.
 */
function palmette({base, toward, lobes, spread, length, width, height}: Palmette, rest: RestingSurface, plainAlong: number, detail: number) {
  const along = plainAlong * detail
  const across = 4 * detail
  const under = envelope(rest)
  const parts = Array.from({length: lobes}, (_, index) => {
    const side = index / (lobes - 1) * 2 - 1
    const lobeLength = length * (1 - 0.32 * side * side)
    const bend = side * 0.7
    // The inner lobes lie over the outer ones where they overlap.
    const layer = (1 - Math.abs(side)) * 0.0012
    // The midline, bending away from the middle as it goes.
    const midline: Array<PlanePoint> = [[base[0], base[1]]]
    for (let step = 1; step <= along; step++) {
      const angle = toward + side * spread + bend * (step / along) ** 2
      const [x, y] = midline.at(-1)!
      midline.push([x + Math.cos(angle) * lobeLength / along, y + Math.sin(angle) * lobeLength / along])
    }
    return sheet(along, across + 2, (column, row) => {
      const u = column / along
      const v = Math.min(1, Math.max(-1, (row - 1) / across * 2 - 1))
      const [x0, y0] = midline[column]
      const [x1, y1] = midline[Math.min(along, column + 1)]
      const [xp, yp] = midline[Math.max(0, column - 1)]
      const direction = Math.atan2(y1 - yp, x1 - xp)
      // Narrow where it springs, broad past its middle, then closing to a flame’s point.
      const half = width * (u < 0.55 ? 0.25 + 0.75 * Math.sin(Math.PI / 2 * u / 0.55) ** 0.7 : Math.cos(Math.PI / 2 * ((u - 0.55) / 0.45) ** 1.5)) * v
      const [x, y] = [x0 - Math.sin(direction) * half, y0 + Math.cos(direction) * half]
      if (row === 0 || row === across + 2) {
        return [x, y, under(x, y) - 0.002]
      }
      return [x, y, under(x, y) + layer + height * ((0.25 + 0.75 * (1 - v * v)) * (0.55 + 0.45 * Math.sin(Math.PI * u ** 0.7)) + 0.6 * smooth(0.72, 1, u) ** 2)]
    }, {kind: 1})
  })
  // Two volutes curling away to either side of the boss, under the outermost lobes.
  const volutes = [-1, 1].map(side => {
    const away = toward - side * Math.PI / 2
    const point = (out: number, ahead: number): PlanePoint => [base[0] + Math.cos(away) * out + Math.cos(toward) * ahead, base[1] + Math.sin(away) * out + Math.sin(toward) * ahead]
    const path = curled(smoothPath([point(0.003, 0.003), point(width * 1.2, 0.006), point(width * 2.2, 0)], 3 * detail), width * 0.75, side * 1.1, 9 * detail)
    return tube(path, t => width * 0.45 * (0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, t * 1.1))), under, {
      sides: 4 * detail,
      flatten: 0.7,
      kind: 2,
    })
  })
  const boss = turned([[width * 0.75, -0.002], [width * 0.75, height * 0.4], [width * 0.5, height * 0.8], [0, height * 0.95]], 12 * detail, {kind: 3})
  return {
    parts: [...parts, ...volutes],
    boss,
    bossAt: [base[0], base[1], under(...base)] as const,
  }
}

/** One of the golden frames: an Empire frame in burnished and matte water gilding, a deep burnished cove between a starred frieze and a laurel torus, with a great palmette spreading over every corner and a smaller one in the middle of every member. */
export default class EmpireFrame extends PortraitFrame {
  override readonly description = 'An Empire frame as Napoleon’s court had its pictures framed: water gilding burnished bright on its crests and left matte in its grounds, a pearled sight edge, a flat frieze strewn with stars, a deep cove burnished plain rising to a torus wound with laurel, and over every corner a great palmette of flame-shaped lobes springing from a boss between two volutes, with a smaller one in the middle of every member.'
  override readonly front = Math.max(profile.front, cove.top + 0.0085 * 1.6 + 0.0012)
  override readonly imageDepth = imageDepth
  override readonly reach = profile.reach
  override readonly tint = hsl.integer(80, 70, 66)
  override readonly title = 'Empire palmette'

  override createGeometry(width: number, height: number, budget = frameTriangleBudget) {
    const halfWidth = width / 2
    const halfHeight = height / 2
    const detail = frameDetail(budget)
    const great = palmette({
      base: [0.022, 0.022],
      toward: Math.PI / 4,
      lobes: 7,
      spread: 1.05,
      length: 0.086,
      width: 0.0125,
      height: 0.0085,
    }, atCorner, 7, detail)
    const small = palmette({
      base: [0, 0.018],
      toward: Math.PI / 2,
      lobes: 5,
      spread: 0.85,
      length: 0.062,
      width: 0.0105,
      height: 0.007,
    }, atMiddle, 6, detail)
    const cornerSpots = corners(halfWidth, halfHeight, 0, 0)
    const middleSpots = middles(halfWidth, halfHeight, 0, 0)
    // The bosses go where their palmettes spring from, lifted onto the moulding there.
    const lifted = (spots: ReturnType<typeof corners>, [x, y, z]: readonly [number, number, number]) => spots.map(({position, angle = 0}) => ({
      position: [position[0] + Math.cos(angle) * x - Math.sin(angle) * y, position[1] + Math.sin(angle) * x + Math.cos(angle) * y, z] as const,
      angle,
    }))
    return assembleFrame([
      ...sweepProfile(profile, halfWidth, halfHeight),
      ...great.parts.map(part => [0, place(part, cornerSpots)] as const),
      [0, place(great.boss, lifted(cornerSpots, great.bossAt))],
      ...small.parts.map(part => [0, place(part, middleSpots)] as const),
      [0, place(small.boss, lifted(middleSpots, small.bossAt))],
    ])
  }

  protected override createMaterials() {
    return [new GiltMaterial({
      burnishedReflections: true,
      wear: 0.1,
      grime: 0.45,
      roughness: {
        burnished: 0.08,
        matte: 0.42,
      },
      relief: {
        depth: 0.0025,
        height: surface => carvingByPiece(surface, {
          members: footprint => {
            const sight = band(surface, -0.005, 0.007)
            const flat = band(surface, frieze.from, frieze.to)
            const round = band(surface, torus.from, torus.to)
            // Pearls at the sight edge, round beads close together.
            const pearls = beadAndReel(repeatPhase(surface, 0.0075, 0), sight.t).max(vec2(repeatPhase(surface, 0.0075, 0).sub(0.5).mul(2), sight.t.mul(2).sub(1)).length().oneMinus().max(0).sqrt())
            // Five-pointed stars strewn over the frieze.
            const star = vec2(repeatPhase(surface, 0.045, 0.02).sub(0.5).mul(0.045), surface.reach.sub((frieze.from + frieze.to) / 2))
            const starAngle = atan(star.y, star.x)
            const starShape = smoothstep(0.0012, 0.0004, star.length().sub(starAngle.mul(5).cos().mul(0.0018).add(0.0034)))
            // Laurel leaves overlapping round the torus, slanting all one way, each with its midrib.
            const slant = repeatPhase(surface, 0.026, (torus.from + torus.to) / 2).add(round.t.mul(0.85)).fract()
            const laurel = smoothstep(0.42, 0.12, slant.sub(0.45).abs()).sub(smoothstep(0.04, 0, slant.sub(0.45).abs()).mul(0.3)).mul(round.t.mul(Math.PI).sin())
            return legible(surface, pearls, 0.004, footprint).mul(sight.inside).mul(0.0018)
              .add(legible(surface, starShape, 0.004, footprint).mul(flat.inside).mul(0.0008))
              .add(legible(surface, laurel, 0.005, footprint).mul(round.inside).mul(0.0018))
          },
          // The lobes’ midribs; the volutes and the bosses are left smooth.
          ornaments: [[1, footprint => legible(surface, surface.across.sub(0.5).abs().smoothstep(0.06, 0).mul(0.4).add(0.4), 0.003, footprint).mul(0.0012)]],
        }),
      },
    })]
  }
}

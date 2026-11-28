import type {Placement} from '../lib/frameGeometry.ts'
import type {FrameSurface} from '../lib/materials/frameAttributes.ts'
import type {Node} from 'three/webgpu'

import hsl from 'okhsl'
import {float, max, smoothstep, vec2} from 'three/tsl'

import PortraitFrame, {frameBack, frameDetail, frameTriangleBudget} from '../base/PortraitFrame.ts'
import {assembleFrame, corners, middles, place, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import {band, beadAndReel, carvingByPiece, legible, repeatPhase, ribbon} from '../lib/materials/carving.ts'
import GiltMaterial from '../lib/materials/GiltMaterial.ts'
import {sheet, triangles} from '../lib/ornaments.ts'

type Float = Node<'float'>
/** how finely a leaf is made: pieces along it and round the torus */
type LeafDetail = readonly [along: number, around: number]

const imageDepth = -0.07
/** the torus the leaves wrap, its middle and its radius in the section */
const torus = {
  r: 0.062,
  z: -0.038,
  radius: 0.026,
}
const crest = torus.z + torus.radius
/** a beaded stick wound with a ribbon at the sight edge, a cove of punched ground, a broad torus wrapped in leaves, a bead and reel and a cove to the wall */
const profile = FrameProfile.from([-0.005, imageDepth])
  .line(-0.005, -0.06)
  .arc(0.009, -0.06, 0.5, {steps: 6})
  .line(0.012, -0.062)
  .arc(torus.r - torus.radius, torus.z, -0.18, {steps: 6})
  .arc(torus.r + torus.radius, torus.z, 0.5, {steps: 12})
  .line(0.091, -0.041)
  .arc(0.103, -0.041, 0.5, {steps: 6})
  .arc(0.128, -0.078, -0.22, {steps: 6})
  .line(0.128, frameBack)
  .line(-0.005, frameBack)
/** the leaves along the torus: about how far apart their bases lie, how many times that each is long, overlapping the next by the rest, how far round the torus either half of the widest wraps, how far its tip swirls round toward the outside, how far proud of it they stand, how far from the miter the first starts and where in the middle the last one’s tip ends */
const leaf = {
  spacing: 0.11,
  overlap: 1.8,
  wrap: 1.05,
  twist: 0.25,
  thickness: 0.007,
  corner: 0.03,
  middle: 0.008,
}
/** the rosettes over the miters, where the leaves start out: their middles on the torus’ crest, their radius, how high they stand and their petals */
const rosette = {
  radius: 0.04,
  height: 0.017,
  petals: 8,
}
/** the ribbon binding the torus in the middle of every member, where the leaves’ tips meet: half its width, how far round the torus either half of it wraps and how far proud it stands */
const binding = {
  halfWidth: 0.015,
  wrap: 1.45,
  lift: 0.013,
}
/** how finely a leaf of the run is made within {@link frameTriangleBudget}, finest first, which a larger budget multiplies by its {@link frameDetail} */
const leafDetails: ReadonlyArray<LeafDetail> = [[16, 8], [14, 6], [12, 6], [10, 6], [10, 4], [8, 4], [7, 4], [6, 4], [5, 2]]
/** how finely a rosette is made, `detail` times as fine as within {@link frameTriangleBudget}: pieces round it and rings out from its middle */
const rosetteMesh = (detail: number) => [32 * detail, 4 * detail] as const
/** how finely a binding is made, `detail` times as fine as within {@link frameTriangleBudget}: pieces along the torus and round it between its sunk edges */
const bindingMesh = (detail: number) => [3 * detail, 10 * detail] as const
/** How many triangles the four rosettes and the four bindings take, made `detail` times as fine as within {@link frameTriangleBudget}. */
function fixedTriangles(detail: number) {
  const [around, rings] = rosetteMesh(detail)
  const [along, round] = bindingMesh(detail)
  return 4 * (around * rings * 2 + (along + 2) * (round + 2) * 2)
}
const smooth = (from: number, to: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)))
  return t * t * (3 - 2 * t)
}
/** How wide a leaf is at the share `u` of its length from its base, as a share of its widest: narrower at its base, broad until well past its middle and closing to a point at its tip, like a lobe of acanthus. Its lobes are carved into it, too fine for its outline. */
const leafWidth = (u: number) => (u < 0.5 ? 0.4 + 0.6 * Math.sin(Math.PI / 2 * u / 0.5) : Math.cos(Math.PI / 2 * ((u - 0.5) / 0.5) ** 2.2))
/** How far proud a leaf stands along its length, as a share of its thickness: low where it starts out from under the one before, highest where its tip curls up over the next. */
const leafRise = (u: number) => 0.35 + 0.65 * smooth(0, 0.55, u) + 0.8 * smooth(0.7, 1, u) ** 2
/** How far proud a leaf stands across, from −1 to 1, as a share of its rise: its edges curling up out of a channel either side of the raised midrib, flattening toward its point. */
const leafCup = (u: number, v: number) => {
  const pointed = smooth(0.85, 1, u)
  return (0.35 + 0.6 * Math.abs(v) ** 1.6 + 0.25 * Math.exp(-((v / 0.15) ** 2))) * (1 - pointed) + 0.8 * pointed
}
/**
 * A leaf of the run, wrapping the torus as it runs along the top member from its base at x = 0 toward +x, `length` meters long, made of `along` pieces after a sunk heel and `around` pieces between two sunk edges.
 */
function runLeaf(length: number, [along, around]: LeafDetail) {
  return sheet(along + 1, around + 2, (column, row) => {
    const u = Math.max(0, column - 1) / along
    const v = Math.min(1, Math.max(-1, (row - 1) / around * 2 - 1))
    const sunk = column === 0 || row === 0 || row === around + 2
    // Swirling round the torus toward its outside as it runs.
    const angle = v * leaf.wrap * leafWidth(u) + leaf.twist * smooth(0.25, 1, u)
    const out = torus.radius + (sunk ? -0.0015 : leaf.thickness * leafRise(u) * leafCup(u, v))
    return [u * length, torus.r + Math.sin(angle) * out, torus.z + Math.cos(angle) * out]
  }, {kind: 1})
}
/** A rosette over the miter of the top right corner: eight broad petals and eight smaller ones over them round a domed heart, lying on the torus where its two members meet, its edge sunk into the moulding, made `detail` times as fine as within {@link frameTriangleBudget}. */
function cornerRosette(detail: number) {
  const [around, rings] = rosetteMesh(detail)
  const middle = torus.r
  return sheet(around, rings, (column, row) => {
    const angle = column / around * Math.PI * 2 + Math.PI / 4
    const outer = Math.abs(Math.cos(angle * rosette.petals / 2)) ** 0.7
    const inner = Math.abs(Math.sin(angle * rosette.petals / 2)) ** 0.7
    const share = Math.min(1, row / (rings - 1))
    const radius = rosette.radius * share * (0.8 + 0.2 * outer)
    const [x, y] = [middle + Math.cos(angle) * radius, middle + Math.sin(angle) * radius]
    const heart = 1 - (share / 0.28) ** 2 * 0.35
    const innerRing = (0.75 + 0.15 * inner) * (1 - smooth(0.5, 0.68, share))
    const outerRing = (0.55 - 0.35 * share ** 2) * (0.6 + 0.4 * outer) + 0.12 * smooth(0.75, 1, share)
    const lift = row === rings ? -0.002 : rosette.height * Math.max(share < 0.28 ? heart : 0, innerRing, outerRing)
    return [x, y, profile.heightAt(Math.max(x, y)) + lift]
  }, {
    kind: 2,
    pole: true,
    wrap: true,
  })
}
/** A ribbon binding the torus round the middle of the top member, standing proud of it with its edges sunk in, made `detail` times as fine as within {@link frameTriangleBudget}. */
function middleBinding(detail: number) {
  const [along, around] = bindingMesh(detail)
  return sheet(along + 2, around + 2, (column, row) => {
    const u = Math.min(1, Math.max(0, (column - 1) / along))
    const v = Math.min(1, Math.max(-1, (row - 1) / around * 2 - 1))
    const sunk = column === 0 || column === along + 2 || row === 0 || row === around + 2
    const angle = v * binding.wrap
    const out = torus.radius + (sunk ? -0.0015 : binding.lift * (0.85 + 0.15 * Math.sin(Math.PI * u)))
    return [(u * 2 - 1) * binding.halfWidth, torus.r + Math.sin(angle) * out, torus.z + Math.cos(angle) * out]
  }, {kind: 3})
}
/** A leaf’s carving as a height from 0 to 1 over its own coordinates, u along it and v across it: a few veins slanting out from the grooved midrib, deep crevices between its three lobes, opening from its edge toward the midrib, and every lobe’s edge cut into fingers. */
function leafCarving(surface: FrameSurface): Float {
  const u = surface.along
  const side = surface.across.mul(2).sub(1).abs()
  const veins = u.mul(5).sub(side.mul(1.6)).fract().sub(0.5).abs().mul(2).smoothstep(0.82, 1).mul(0.3).mul(side.smoothstep(0.12, 0.3))
  const lobes = [0.42, 0.72].reduce<Float>((crevice, at) => max(crevice, u.sub(at).add(side.mul(0.1)).abs().smoothstep(0.05, 0.005).mul(side.smoothstep(0.15, 0.7))), float(0))
  const fingers = u.mul(16).fract().sub(0.5).abs().mul(2).smoothstep(0.55, 1).mul(side.smoothstep(0.72, 0.95))
  const midrib = side.smoothstep(0.1, 0.02).mul(0.25).sub(side.smoothstep(0.03, 0).mul(0.2))
  return float(0.6).add(midrib).sub(veins).sub(lobes.mul(0.85)).sub(fingers.mul(0.45)).clamp(0, 1)
}
/** How many triangles a leaf of the run takes with the detail given. */
function leafTriangles([along, around]: LeafDetail) {
  return 2 * (along + 1) * (around + 2)
}
/**
 * Where the leaves of the run go: in from either corner toward the middle of every member, as many as fit at about `spacing` apart, spread evenly so the last one’s tip ends under the binding, each turned along its member, mirrored on the right half of the top member and the halves matching it, and scaled to the spacing it got.
 */
function leafRuns(halfWidth: number, halfHeight: number, spacing: number) {
  const placements: Array<Placement> = []
  for (let member = 0; member < 4; member++) {
    const angle = -member * Math.PI / 2
    const [ox, oy] = [Math.round(Math.sin(-angle)), Math.round(Math.cos(angle))]
    const [rx, ry] = [Math.round(Math.cos(angle)), Math.round(Math.sin(angle))]
    const first = (member % 2 === 0 ? halfWidth : halfHeight) + torus.r - leaf.corner
    const count = Math.max(1, Math.floor((first - leaf.middle - leaf.overlap * spacing) / spacing) + 1)
    const step = (first - leaf.middle) / (count - 1 + leaf.overlap)
    const distance = member % 2 === 0 ? halfHeight : halfWidth
    for (const side of [-1, 1]) {
      for (let index = 0; index < count; index++) {
        const offset = side * (first - index * step)
        placements.push({
          position: [ox * distance + rx * offset, oy * distance + ry * offset, 0],
          angle,
          scale: [-side * step / leaf.spacing, 1, 1],
        })
      }
    }
  }
  return placements
}
/** One of the golden frames: a Florentine leaf frame, a broad torus wrapped in acanthus leaves carved in high relief and water gilt, running in from a rosette over every miter to a ribbon binding it in the middle of every member. */
export default class FlorentineFrame extends PortraitFrame {
  override readonly description = 'A Florentine leaf frame as the Medici’s carvers cut them: a broad torus wrapped in acanthus leaves carved in high relief, overlapping like scales, each cupped round its raised midrib and curling its tip up over the next, running in from a rosette over every miter to a ribbon binding the torus in the middle of every member, between a beaded stick wound with a ribbon at the sight edge, a cove of punched ground and a bead and reel, all in water gilding burnished bright on its crests.'
  override readonly front = crest + Math.max(rosette.height, binding.lift, leaf.thickness * leafRise(1) * 0.9)
  override readonly imageDepth = imageDepth
  override readonly reach = profile.reach
  override readonly tint = hsl.integer(78, 64, 66)
  override readonly title = 'Florentine leaf'

  override createGeometry(width: number, height: number, budget = frameTriangleBudget) {
    const halfWidth = width / 2
    const halfHeight = height / 2
    const detail = frameDetail(budget)
    const moulding = sweepProfile(profile, halfWidth, halfHeight)
    const mouldingTriangles = moulding.values().reduce((sum, part) => sum + triangles(part), 0)
    // As many leaves as the plainest ones leave room for in the frame’s own budget, fewer of them, spread further, if even those don’t fit.
    const plainest = leafDetails.at(-1)!
    let spacing = leaf.spacing
    let runs = leafRuns(halfWidth, halfHeight, spacing)
    while (runs.length * leafTriangles(plainest) > frameTriangleBudget - mouldingTriangles - fixedTriangles(1)) {
      spacing *= 1.04
      runs = leafRuns(halfWidth, halfHeight, spacing)
    }
    // Then the finest leaves the triangles left allow.
    const left = budget - mouldingTriangles - fixedTriangles(detail)
    const finest = leafDetails.map(([along, around]): LeafDetail => [along * detail, around * detail]).find(candidate => runs.length * leafTriangles(candidate) <= left) ?? plainest
    return assembleFrame([
      ...moulding,
      [0, place(runLeaf(leaf.spacing * leaf.overlap, finest), runs)],
      [0, place(cornerRosette(detail), corners(halfWidth, halfHeight, 0, 0))],
      [0, place(middleBinding(detail), middles(halfWidth, halfHeight, 0, 0))],
    ])
  }

  protected override createMaterials() {
    return [new GiltMaterial({
      burnishedReflections: true,
      grime: 0.6,
      roughness: {
        burnished: 0.14,
        matte: 0.32,
      },
      relief: {
        depth: 0.004,
        height: surface => carvingByPiece(surface, {
          members: footprint => {
            const sight = band(surface, -0.005, 0.009)
            const ground = band(surface, 0.012, torus.r - torus.radius)
            const outer = band(surface, 0.091, 0.103)
            // Punched ground: a close grid of round dents struck with a ring punch.
            const punch = vec2(repeatPhase(surface, 0.0024, 0.024), surface.across.div(0.0024).fract()).sub(0.5).length().smoothstep(0.22, 0.34)
            return legible(surface, ribbon(repeatPhase(surface, 0.018, 0.002), sight.t), 0.006, footprint).mul(sight.inside).mul(0.0025)
              .add(legible(surface, punch, 0.0024, footprint).mul(ground.inside).mul(0.0006))
              .add(legible(surface, beadAndReel(repeatPhase(surface, 0.013, 0.097), outer.t), 0.005, footprint).mul(outer.inside).mul(0.002))
          },
          ornaments: [
            [1, footprint => legible(surface, leafCarving(surface), 0.006, footprint).mul(0.004)],
            // The rosette’s petals, round it along and out across: a groove down the middle of every petal and the gaps between them cut deep toward the rim.
            [2, footprint => {
              const phase = surface.along.mul(rosette.petals).fract()
              const fromMiddle = phase.min(phase.oneMinus()).mul(2)
              const petals = float(0.5).sub(smoothstep(0.12, 0, fromMiddle).mul(0.25)).sub(fromMiddle.smoothstep(0.75, 1).mul(surface.across.smoothstep(0.35, 0.9)).mul(0.4))
              return legible(surface, petals, 0.004, footprint).mul(0.003)
            }],
            // The binding: the ribbon’s two edges rolled over and folds slanting across it.
            [3, footprint => {
              const folds = surface.along.mul(1.4).add(surface.across.mul(5)).fract().sub(0.5).abs().mul(2).smoothstep(0.6, 1).mul(-0.4).add(smoothstep(0.12, 0, surface.along.sub(0.5).abs().sub(0.36).abs()).mul(0.4)).add(0.5)
              return legible(surface, folds, 0.004, footprint).mul(0.006)
            }],
          ],
        }),
      },
    })]
  }
}

import type {Placement} from '../lib/frameGeometry.ts'
import type {PlanePoint} from '../lib/ornaments.ts'

import hsl from 'okhsl'
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js'
import {smoothstep} from 'three/tsl'
import {BufferGeometry, Float32BufferAttribute} from 'three/webgpu'

import PortraitFrame, {frameBack, frameDetail, frameTriangleBudget, maximumFrameReach} from '../base/PortraitFrame.ts'
import {assembleFrame, ornament, place, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import {band, beadAndReel, carvingByPiece, legible, repeatPhase} from '../lib/materials/carving.ts'
import GiltMaterial from '../lib/materials/GiltMaterial.ts'
import {sheet, triangles} from '../lib/ornaments.ts'

const imageDepth = -0.05
/** the torus round the work, out of which the rays break */
const torus = {
  from: 0.034,
  to: 0.058,
}
/** a beaded sight edge, an ogee rising to a torus and a little cove falling back to the wall, the moulding the rays break out of */
const profile = FrameProfile.from([-0.005, imageDepth])
  .line(-0.005, -0.043)
  .arc(0.007, -0.043, 0.5, {steps: 6})
  .line(0.01, -0.045)
  .ogee(torus.from, -0.022, {steps: 10})
  .arc(torus.to, -0.022, 0.5, {steps: 10})
  .arc(0.064, -0.058, -0.25, {steps: 5})
  .line(0.064, frameBack)
  .line(-0.005, frameBack)
/** the rays: where they spring from under the torus, the plane their undersides lie in, how far apart they stand at most, and the long straight ones and the shorter flaming ones between them */
const rays = {
  root: 0.05,
  floor: -0.064,
  spacing: 0.019,
  straight: {
    length: maximumFrameReach - 0.05,
    halfWidth: 0.0115,
    ridge: [0.0105, 0.0012],
  },
  flame: {
    length: 0.08,
    halfWidth: 0.0088,
    ridge: 0.007,
    sway: 0.0038,
    waves: 1.25,
  },
}
/** the fan of rays over every corner: how many gaps between the members’ last rays there, and how much longer they grow toward the diagonal */
const fan = {
  gaps: 6,
  growth: 0.32,
}
/** how finely a flaming ray is made within {@link frameTriangleBudget}, finest first: pieces along it, which a larger budget multiplies by its {@link frameDetail} */
const flameDetails = [14, 12, 10, 8, 6, 5] as const
/** How many triangles a flaming ray takes, `along` pieces long and `across` pieces round its ridge: its top and its underside. */
const flameTriangles = (along: number, across: number) => along * across * 2 + along * 2
/** A straight ray `length` meters long, springing from the origin toward +y: a blade of two burnished facets meeting in a ridge, tapering to a point, closed underneath. */
function straightRay(length: number) {
  const {halfWidth, ridge: [root, tip]} = rays.straight
  const z = rays.floor
  const left = [-halfWidth, 0, z] as const
  const right = [halfWidth, 0, z] as const
  const spine = [0, 0, z + root] as const
  const point = [0, length, z + tip] as const
  const geometry = new BufferGeometry
  geometry.setAttribute('position', new Float32BufferAttribute([...left, ...spine, ...point, ...right, ...point, ...spine, ...left, ...point, ...right], 3))
  return ornament(geometry, {kind: 1})
}
/** A flaming ray `length` meters long, springing from the origin toward +y in waves that swing wider toward its point, rising to its ridge, made of `along` pieces and `across` round its ridge, an even number, and closed underneath. Two pieces across leave a sharp ridge, more round it over. */
function flameRay(length: number, along: number, across: number) {
  const {halfWidth, ridge, sway, waves} = rays.flame
  const z = rays.floor
  const midline = (u: number) => [sway * Math.sin(Math.PI * 2 * waves * u) * u ** 0.6, u * length] as const
  const at = (column: number, side: number): PlanePoint => {
    const u = column / along
    const [x, y] = midline(u)
    const [x1, y1] = midline(Math.min(1, u + 0.01))
    const [x0, y0] = midline(Math.max(0, u - 0.01))
    const direction = Math.atan2(y1 - y0, x1 - x0)
    const half = halfWidth * (1 - u) ** 0.7 * side
    return [x - Math.sin(direction) * half, y + Math.cos(direction) * half]
  }
  const top = sheet(along, across, (column, row) => {
    const side = row / across * 2 - 1
    const [x, y] = at(column, side)
    return [x, y, z + ridge * (1 - 0.75 * column / along) * (1 - side * side)]
  }, {kind: 2})
  const under = sheet(along, 1, (column, row) => [...at(column, row * 2 - 1), z] as const, {
    kind: 2,
    back: true,
  })
  const flame = mergeGeometries([top, under])
  top.dispose()
  under.dispose()
  return flame
}
/** Where the rays along the members go: alternately straight and flaming, a straight one in the middle of every member and the last one before the corner’s fan, as many as fit at about `spacing` apart out to where the fan begins. */
function memberSpots(halfWidth: number, halfHeight: number, spacing: number) {
  const spots: Array<{
    placement: Placement
    straight: boolean
  }> = []
  for (let member = 0; member < 4; member++) {
    const angle = -member * Math.PI / 2
    const [ox, oy] = [Math.round(Math.sin(-angle)), Math.round(Math.cos(angle))]
    const [rx, ry] = [Math.round(Math.cos(angle)), Math.round(Math.sin(angle))]
    const room = (member % 2 === 0 ? halfWidth : halfHeight) + rays.root - spacing * 0.7
    const last = Math.max(2, Math.round(room / spacing / 2) * 2)
    const step = room / last
    const distance = (member % 2 === 0 ? halfHeight : halfWidth) + rays.root
    for (let index = -last; index <= last; index++) {
      const offset = index * step
      spots.push({
        straight: index % 2 === 0,
        placement: {
          position: [ox * distance + rx * offset, oy * distance + ry * offset, 0],
          angle,
        },
      })
    }
  }
  return spots
}
/** The rays fanning round the top right corner from the corner of the torus, between the last rays of its two members, alternately straight and flaming, each turned from pointing up toward pointing right and as long as brings its point out to where the members’ rays end, a little further toward the diagonal. */
function fanSpots() {
  const root = [rays.root, rays.root] as const
  return Array.from({length: fan.gaps - 1}, (_, index) => {
    const step = index + 1
    const direction = Math.PI / 2 - step / fan.gaps * Math.PI / 2
    const straight = step % 2 === 0
    const nominal = straight ? rays.straight.length : rays.flame.length
    // Out to the reach, which a ray along the diagonal meets furthest from the corner.
    const room = (maximumFrameReach - rays.root) / Math.max(Math.cos(direction), Math.sin(direction))
    return {
      root,
      straight,
      angle: direction - Math.PI / 2,
      length: Math.min(room - 0.001, nominal * (1 + fan.growth * Math.sin(2 * direction))),
    }
  })
}
/** One of the golden frames: a glory of the Spanish colonial altars, a gilt torus round the work bursting into rays, long straight blades alternating with shorter flaming ones, fanning out round every corner. */
export default class GloryFrame extends PortraitFrame {
  override readonly description = 'A glory as the gilders of Spanish colonial altars carved them round a saint, laid round the work: a gilt torus over a beaded sight edge bursting into rays all round, long straight blades burnished along their ridges alternating with shorter flaming rays, matte and chased, that sway in waves to their points, fanning out round every corner and standing off the wall, which shows between them.'
  override readonly front = profile.front
  override readonly imageDepth = imageDepth
  override readonly reach = maximumFrameReach
  override readonly tint = hsl.integer(82, 72, 68)
  override readonly title = 'Sunburst glory'

  override createGeometry(width: number, height: number, budget = frameTriangleBudget) {
    const halfWidth = width / 2
    const halfHeight = height / 2
    const detail = frameDetail(budget)
    const across = 2 * detail
    const moulding = sweepProfile(profile, halfWidth, halfHeight)
    const fans = fanSpots()
    const straightFan = fans.filter(spot => spot.straight)
    const flameFan = fans.filter(spot => !spot.straight)
    // Every ray of the fans keeps the length that brings its point out as far as the members’ rays reach, a little further toward the diagonal.
    const fanParts = [...straightFan.map(spot => straightRay(spot.length)), ...flameFan.map(spot => flameRay(spot.length, 8 * detail, across))]
    const fanPlacements = [...straightFan, ...flameFan].map(({angle, root}) => (corner: Placement): Placement => ({
      ...corner,
      position: [corner.position[0] + Math.cos(corner.angle!) * root[0] - Math.sin(corner.angle!) * root[1], corner.position[1] + Math.sin(corner.angle!) * root[0] + Math.cos(corner.angle!) * root[1], 0] as const,
      angle: corner.angle! + angle,
    }))
    const cornerSpots = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([sx, sy], index): Placement => ({
      position: [sx * halfWidth, sy * halfHeight, 0],
      angle: -index * Math.PI / 2,
    }))
    const fanned = fanParts.map((part, index) => place(part, cornerSpots.map(fanPlacements[index])))
    const fixed = moulding.values().reduce((sum, part) => sum + triangles(part), 0)
    const cost = (spots: ReturnType<typeof memberSpots>, along: number, pieces: number) => spots.filter(spot => spot.straight).length * 3 + spots.filter(spot => !spot.straight).length * flameTriangles(along, pieces)
    // As many rays as the plainest flames leave room for in the frame’s own budget, spread further if even those don’t fit, the fans’ flames as plain as they come there.
    const plainest = flameDetails.at(-1)!
    const plainFans = flameFan.length * 4 * flameTriangles(8, 2) + straightFan.length * 4 * 3
    let spacing = rays.spacing
    let spots = memberSpots(halfWidth, halfHeight, spacing)
    while (cost(spots, plainest, 2) > frameTriangleBudget - fixed - plainFans) {
      spacing *= 1.04
      spots = memberSpots(halfWidth, halfHeight, spacing)
    }
    // Then the finest flames the triangles left allow.
    const left = budget - fixed - fanned.reduce((sum, part) => sum + triangles(part), 0)
    const along = flameDetails.map(candidate => candidate * detail).find(candidate => cost(spots, candidate, across) <= left) ?? plainest
    return assembleFrame([
      ...moulding,
      [0, place(straightRay(rays.straight.length), spots.filter(spot => spot.straight).map(({placement}) => placement))],
      [0, place(flameRay(rays.flame.length, along, across), spots.filter(spot => !spot.straight).map(({placement}) => placement))],
      ...fanned.map(part => [0, part] as const),
    ])
  }

  protected override createMaterials() {
    return [new GiltMaterial({
      burnishedReflections: true,
      wear: 0.18,
      grime: 0.5,
      roughness: {
        burnished: 0.09,
        matte: 0.36,
      },
      relief: {
        depth: 0.002,
        height: surface => carvingByPiece(surface, {
          members: footprint => {
            const sight = band(surface, -0.005, 0.007)
            return legible(surface, beadAndReel(repeatPhase(surface, 0.012, 0), sight.t), 0.004, footprint).mul(sight.inside).mul(0.0018)
          },
          // The flames are chased with lines running along them, the blades left smooth to burnish.
          ornaments: [[2, footprint => legible(surface, surface.across.mul(5).fract().sub(0.5).abs().smoothstep(0.15, 0.45).mul(0.4).add(0.4).mul(smoothstep(1, 0.85, surface.along)), 0.0015, footprint).mul(0.0008)]],
        }),
      },
    })]
  }
}

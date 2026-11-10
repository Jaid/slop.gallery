import type {Placement} from '../lib/frameGeometry.ts'
import type {FrameSurface} from '../lib/materials/frameAttributes.ts'
import type {Node} from 'three/webgpu'

import {abs, clamp, color, float, max, min, mix, mx_noise_float, select, smoothstep, vec2, vec3} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {heightNormal} from '#src/lib/materials/filters.ts'
import {circle, unite} from '#src/lib/materials/sdf.ts'

import PortraitFrame, {frameBack} from '../base/PortraitFrame.ts'
import {withOpening} from '../lib/frameBack.ts'
import {assembleFrame, corners, place, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import {legible} from '../lib/materials/carving.ts'
import {backSurface, galleryLabel, hangingWire, screwHead} from '../lib/materials/frameBacks.ts'
import FrameMetalMaterial, {blackIron} from '../lib/materials/FrameMetalMaterial.ts'
import FramePaintMaterial from '../lib/materials/FramePaintMaterial.ts'
import frameStudio from '../lib/materials/frameStudio.ts'
import FrameWoodMaterial, {pine} from '../lib/materials/FrameWoodMaterial.ts'
import {block, dome, relief} from '../lib/ornaments.ts'

type Vec2 = Node<'vec2'>

const imageDepth = -0.058
/** the material of the back */
const back = 3
const wood = 0
const cardboard = 1
const iron = 2
/** the face of the battens */
const face = {
  from: -0.005,
  to: 0.074,
  z: -0.028,
}
const middle = (face.from + face.to) / 2
/** rough-sawn pine battens nailed into a box round the work, square at every arris */
const profile = FrameProfile.from([-0.005, imageDepth], wood)
  .line(face.from, face.z)
  .line(face.to, face.z)
  .line(face.to, frameBack)
  .line(-0.005, frameBack, {material: back})
/** how far the cardboard corner protectors reach along either member from the outer corner, and how wide their arms are */
const protector = {
  arm: 0.07,
  width: 0.026,
  thickness: 0.003,
}
/** The distance to the segment from `a` to `b`. */
function segment(p: Vec2, a: readonly [number, number], b: readonly [number, number]) {
  const start = vec2(...a)
  const along = vec2(b[0] - a[0], b[1] - a[1])
  const h = clamp(p.sub(start).dot(along).div(along.dot(along)), 0, 1)
  return p.sub(start.add(along.mul(h))).length()
}
/** The distance to an axis-aligned box of half extents `size` round `center`, negative inside. */
function box(p: Vec2, center: readonly [number, number], size: readonly [number, number]) {
  const q = abs(p.sub(vec2(...center))).sub(vec2(...size))
  return max(q, vec2(0)).length().add(min(max(q.x, q.y), 0))
}
/** The distance to a triangle pointing up, its tip at `tip`, `width` wide and `height` tall, negative inside. */
function arrowhead(p: Vec2, tip: readonly [number, number], width: number, height: number) {
  const q = p.sub(vec2(...tip))
  const slope = width / 2 / height
  const side = abs(q.x).add(q.y.mul(slope)).div(Math.hypot(1, slope))
  return max(side, q.y.negate().sub(height))
}
/** the strokes of the stencil letters, in a box 1 wide and 1 tall, which every stroke stops short of where it meets another, leaving the bridges of a stencil */
const letters: Record<string, ReadonlyArray<readonly [readonly [number, number], readonly [number, number]]>> = {
  F: [[[0, 0], [0, 1]], [[0, 1], [0.85, 1]], [[0, 0.52], [0.65, 0.52]]],
  R: [[[0, 0], [0, 1]], [[0, 1], [0.62, 1]], [[0.62, 1], [0.9, 0.82]], [[0.9, 0.82], [0.9, 0.68]], [[0.9, 0.68], [0.62, 0.5]], [[0, 0.5], [0.62, 0.5]], [[0.5, 0.5], [0.92, 0]]],
  A: [[[0, 0], [0.45, 1]], [[0.45, 1], [0.9, 0]], [[0.2, 0.36], [0.7, 0.36]]],
  G: [[[0.9, 0.82], [0.7, 1]], [[0.7, 1], [0.2, 1]], [[0.2, 1], [0, 0.8]], [[0, 0.8], [0, 0.2]], [[0, 0.2], [0.2, 0]], [[0.2, 0], [0.7, 0]], [[0.7, 0], [0.9, 0.2]], [[0.9, 0.2], [0.9, 0.45]], [[0.9, 0.45], [0.5, 0.45]]],
  I: [[[0.45, 0], [0.45, 1]], [[0.15, 1], [0.75, 1]], [[0.15, 0], [0.75, 0]]],
  L: [[[0, 1], [0, 0]], [[0, 0], [0.85, 0]]],
  E: [[[0, 0], [0, 1]], [[0, 1], [0.85, 1]], [[0, 0.5], [0.65, 0.5]], [[0, 0], [0.85, 0]]],
}
/** The distance to a word stenciled at `p`, in meters from its middle, letters `height` tall. */
function stencilWord(p: Vec2, word: ReadonlyArray<string>, height: number) {
  const advance = height * 0.82
  const stroke = height * 0.09
  const gap = 0.07
  const start = -(word.length * advance - advance * 0.2) / 2
  const fields = word.flatMap((character, index) => letters[character].map(([a, b]) => {
    // Every stroke stops a little short of its ends, so strokes meeting leave a bridge between them.
    const length = Math.hypot(b[0] - a[0], b[1] - a[1])
    const trim = Math.min(gap / length, 0.3)
    const from = [a[0] + (b[0] - a[0]) * trim, a[1] + (b[1] - a[1]) * trim] as const
    const to = [b[0] - (b[0] - a[0]) * trim, b[1] - (b[1] - a[1]) * trim] as const
    const local = vec2(p.x.sub(start + index * advance).div(height * 0.72), p.y.add(height / 2).div(height))
    return segment(local, from, to).mul(height * 0.72).sub(stroke)
  }))
  return unite(...fields)
}
/** ISO 780’s mark for this way up: two arrows over a bar, at `p` meters from its middle, x to the right and y up. */
function thisWayUp(p: Vec2) {
  const arrows = [-0.011, 0.011].flatMap(x => [box(p, [x, -0.001], [0.0028, 0.011]), arrowhead(p, [x, 0.02], 0.016, 0.012)])
  return unite(...arrows, box(p, [0, -0.017], [0.02, 0.0025]))
}
/** ISO 780’s mark for fragile: a wine glass with a crack running down its bowl, at `p` meters from its middle. */
function fragile(p: Vec2) {
  const bowl = max(circle(vec2(p.x.mul(1.25), p.y), [0, 0.008], 0.013), p.y.sub(0.016))
  const glass = unite(bowl, box(p, [0, -0.008], [0.0018, 0.009]), box(p, [0, -0.017], [0.009, 0.0018]))
  // A zigzag crack cut out of the bowl.
  const crack = min(min(segment(p, [-0.002, 0.017], [0.003, 0.011]), segment(p, [0.003, 0.011], [-0.002, 0.006])), segment(p, [-0.002, 0.006], [0.002, 0])).sub(0.0012)
  return max(glass, crack.negate())
}
/** ISO 780’s mark for keep dry: an umbrella with drops falling on it, at `p` meters from its middle. */
function keepDry(p: Vec2) {
  // The canopy: a half disc with three scallops bitten out of its rim.
  const canopy = max(circle(p, [0, 0.002], 0.017), p.y.sub(0.002).negate())
  const scallops = unite(...[-0.0113, 0, 0.0113].map(x => circle(p, [x, 0.0015], 0.0058)))
  const handle = unite(box(p, [0, -0.009], [0.0014, 0.011]), max(circle(p, [-0.004, -0.019], 0.004).abs().sub(0.0014), p.y.add(0.019)))
  const drops = unite(...[[-0.014, 0.026], [0, 0.03], [0.013, 0.025]].map(([x, y]) => box(p, [x, y], [0.0012, 0.003])))
  return unite(max(canopy, scallops.negate()), handle, drops)
}
/**
 * How much stencil paint lies on the point, 0 to 1: a mark sprayed in the middle of every member, upright as the viewer sees it, this way up on the top, fragile on the right, the word on the bottom and keep dry on the left, its edges a little oversprayed and the paint thin in patches.
 */
function stencil(surface: FrameSurface) {
  const member = surface.member.round()
  const across = surface.reach.sub(middle)
  // x to the right and y up as the viewer sees each member.
  const x = select(member.equal(0), surface.along, select(member.equal(1), across, select(member.equal(2), surface.along.negate(), across.negate())))
  const y = select(member.equal(0), across, select(member.equal(1), surface.along.negate(), select(member.equal(2), across.negate(), surface.along)))
  // The marks are drawn about 4 cm tall and sprayed a third larger.
  const scale = 1.35
  const p = vec2(x, y).div(scale)
  const mark = select(member.equal(0), thisWayUp(p), select(member.equal(1), fragile(p), keepDry(p))).mul(scale)
  const field = select(member.equal(2), stencilWord(vec2(x, y), ['F', 'R', 'A', 'G', 'I', 'L', 'E'], 0.042), mark)
  const spray = smoothstep(0.0009, -0.0004, field.add(mx_noise_float(surface.position.mul(900)).mul(0.0004)))
  const thin = mx_noise_float(surface.position.mul(70)).mul(0.5).add(0.5).smoothstep(0.1, 0.9).mul(0.3).add(0.7)
  return spray.mul(thin).mul(surface.isOrnament.oneMinus()).mul(select(surface.position.z.greaterThan(face.z - 0.001), float(1), float(0)))
}
/** Turns an offset from a corner of the frame given for its top right corner by that corner’s own turn, as {@link corners} turns its placements. */
const turned = ([dx, dy]: readonly [number, number], angle: number) => [dx * Math.cos(angle) - dy * Math.sin(angle), dx * Math.sin(angle) + dy * Math.cos(angle)] as const

/** The Cell’s: the crate a work arrives in, rough pine battens stenciled with handling marks, cardboard protectors nailed over the corners. */
export default class CrateFrame extends PortraitFrame {
  override readonly description = 'Nothing in it yet, as it only just arrived: still in the battens of its shipping crate, rough-sawn pine square at every arris, stenciled in black with the handling marks of ISO 780, this way up over the work, fragile and keep dry on either side and FRAGILE spelled out under it, a protector of folded kraft cardboard nailed over every corner. Its back is a plywood board screwed on all round, stenciled this way up and stuck with the waybill.'
  override readonly front = face.z + protector.thickness + 0.0015
  override readonly imageDepth = imageDepth
  override readonly impactSound = 'hardwood'
  override readonly reach = profile.reach + protector.thickness
  override readonly tint = '#c9a06c'
  override readonly title = 'Shipping crate'

  override createGeometry(width: number, height: number) {
    const halfWidth = width / 2
    const halfHeight = height / 2
    const {arm, thickness, width: armWidth} = protector
    const reach = profile.reach
    // An L over the front of every corner, from its outer corner inward, and a lip folded over either outer side.
    const front: Array<readonly [number, number]> = [[0, 0], [-arm, 0], [-arm, -armWidth], [-armWidth, -armWidth], [-armWidth, -arm], [0, -arm]]
    const lipDepth = 0.03
    const lips = corners(halfWidth, halfHeight, reach, face.z - lipDepth).flatMap(({position: [x, y, z], angle = 0}): Array<Placement & {size: readonly [number, number]}> => {
      const top = turned([-arm / 2, thickness / 2], angle)
      const side = turned([thickness / 2, -arm / 2], angle)
      const flat = Math.abs(Math.sin(angle)) < 0.5
      return [{
        position: [x + top[0], y + top[1], z],
        size: flat ? [arm, thickness] : [thickness, arm],
      }, {
        position: [x + side[0], y + side[1], z],
        size: flat ? [thickness, arm] : [arm, thickness],
      }]
    })
    // Two nails through every protector, one into either batten.
    const nailOffsets: ReadonlyArray<readonly [number, number]> = [[-0.05, -0.013], [-0.013, -0.05]]
    const nails = corners(halfWidth, halfHeight, reach, face.z + thickness).flatMap(({position: [x, y, z], angle = 0}) => nailOffsets.map(offset => {
      const [dx, dy] = turned(offset, angle)
      return {position: [x + dx, y + dy, z] as const}
    }))
    return assembleFrame([
      ...withOpening(sweepProfile(profile, halfWidth, halfHeight), back, halfWidth, halfHeight),
      [cardboard, place(relief(front, thickness, {kind: 1}), corners(halfWidth, halfHeight, reach, face.z))],
      ...lips.map(({position, size}) => [cardboard, place(block(size[0], size[1], lipDepth + thickness, {kind: 1}), [{position}])] as const),
      [iron, place(dome(0.0035, 0.0012, {
        segments: 6,
        rings: 2,
        kind: 2,
      }), nails)],
    ])
  }

  protected override createMaterials() {
    return [
      new FrameWoodMaterial({
        timber: pine,
        // Fresh, unfinished pine, paler than the varnished kind.
        stain: '#ddd6cc',
        roughness: 0.9,
        grime: 0.25,
        // Rough sawn: the arcs of the mill’s circular saw scored across every batten, and torn fibers.
        relief: surface => {
          const arcs = vec2(surface.along.add(0.4), surface.reach.add(surface.position.z).add(0.3)).length().mul(700).sin().mul(0.5).add(0.5)
          const fibers = mx_noise_float(vec3(surface.along.mul(40), surface.reach.add(surface.position.z).mul(900), surface.member)).mul(0.5).add(0.5)
          return legible(surface, arcs, 0.009).mul(0.00012).add(legible(surface, fibers, 0.003).mul(0.00006))
        },
        shade: surface => float(1).sub(stencil(surface).mul(0.9)),
      }),
      new FramePaintMaterial({
        color: '#b08452',
        roughness: 0.9,
        grime: 0.2,
        layers: surface => {
          // The flutes of the corrugation show as faint ridges through the liner.
          const flutes = surface.position.x.add(surface.position.y).mul(1100).sin().mul(0.5).add(0.5)
          return [{
            mask: float(0),
            color: vec3(0),
            height: flutes.mul(0.00001),
          }]
        },
      }),
      new FrameMetalMaterial({metal: blackIron}),
      new CrateBackMaterial,
    ]
  }
}
/** The back: a plywood board screwed onto the battens every 10 cm all round, its face veneer of rotary-cut pine with its wild figure, stenciled this way up again, the shipper’s waybill stuck on, and the hanging wire across it. */
class CrateBackMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      envMap: frameStudio,
      envMapIntensity: 0.4,
      roughness: 0.85,
    })
    const surface = backSurface()
    const {opening, point} = surface
    const outer = opening.add(profile.reach)
    const inset = outer.sub(point.abs())
    // Rotary-cut veneer: broad, wandering bands of figure.
    const figure = point.y.mul(90).add(mx_noise_float(vec3(point.mul(vec2(6, 14)), 1.7)).mul(7)).sin().mul(0.5).add(0.5)
    const veneer = mix(color('#c8ad84'), color('#a88a60'), figure.pow(4).mul(0.6))
    // The screws, every 10 cm round the edge, 3.5 cm in.
    const onSide = inset.x.lessThan(inset.y)
    const at = select(onSide, vec2(point.x.sign().mul(outer.x.sub(0.035)), point.y.div(0.1).round().mul(0.1)), vec2(point.x.div(0.1).round().mul(0.1), point.y.sign().mul(outer.y.sub(0.035))))
    const screw = screwHead(surface, at, 0.004)
    // This way up, stenciled at the same size as on the front.
    const arrows = thisWayUp(point.sub(vec2(0, outer.y.sub(0.06))).div(1.35)).mul(1.35)
    const sprayed = smoothstep(0.0009, -0.0004, arrows)
    const waybill = galleryLabel(surface, vec2(outer.x.mul(-0.35), outer.y.mul(-0.45)), [0.16, 0.1], -0.02)
    const hanger = hangingWire(surface)
    const board = mix(mix(veneer, color('#151412'), sprayed.mul(0.9)), mix(color('#8a8a86'), color('#2a2a28'), screw.slot), screw.cover)
    this.colorNode = mix(mix(board, waybill.color, waybill.cover), hanger.color, hanger.cover)
    this.metalnessNode = screw.cover.max(hanger.cover)
    this.roughnessNode = mix(float(0.85), float(0.4), screw.cover.max(hanger.cover))
    this.normalNode = heightNormal(figure.mul(0.00003).add(screw.height).add(waybill.height).add(hanger.height))
  }
}

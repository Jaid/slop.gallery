import type {Metal} from '#src/lib/materials/frames/FrameMetalMaterial.ts'
import type {Node} from 'three/webgpu'

import {color, float, hash, max, mix, mx_noise_float, positionLocal, select, time, uv, vec2, vec3} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {heightNormal, inside, line, visibleDetail} from '#src/lib/materials/filters.ts'
import {band} from '#src/lib/materials/frames/carving.ts'
import {frameSurface} from '#src/lib/materials/frames/frameAttributes.ts'
import FrameMetalMaterial from '#src/lib/materials/frames/FrameMetalMaterial.ts'
import frameStudio from '#src/lib/materials/frames/frameStudio.ts'
import FrameWoodMaterial, {walnut} from '#src/lib/materials/frames/FrameWoodMaterial.ts'

import PortraitFrame, {frameBack} from './base/PortraitFrame.ts'
import {assembleFrame, place, sweepProfile} from './frameGeometry.ts'
import FrameProfile from './FrameProfile.ts'
import {block, relief} from './ornaments.ts'

type Float = Node<'float'>

const imageDepth = -0.058
const wood = 0
const steel = 1
const hooks = 2
const blade = 3
const handle = 4
/** the block’s face, flat end grain from a chamfer at the sight edge out to its rounded, worn edge */
const face = {
  from: 0.004,
  to: 0.1,
  z: -0.031,
}
/** a chamfer at the sight edge, the broad flat face of end grain and a worn round down to the wall */
const profile = FrameProfile.from([-0.005, imageDepth], wood)
  .line(-0.005, -0.04)
  .line(face.from, face.z)
  .line(face.to, face.z)
  .arc(0.114, -0.047, 0.3, {steps: 6})
  .line(0.114, frameBack)
  .line(-0.005, frameBack)
/** the rail across the top that the hooks hang from: how far out past the opening and in front of the face it runs, and how thick it is */
const rail = {
  r: 0.066,
  standoff: 0.012,
  size: 0.009,
}
const railZ = face.z + rail.standoff + rail.size / 2
/** the hooks: how thick their wire is, at most how many hang from the rail and about how far apart */
const hook = {
  wire: 0.0018,
  thickness: 0.0036,
  most: 5,
  spacing: 0.17,
}
/** the cleaver stuck into the bottom right corner: how far out its middle sits, how far it leans and how its blade is turned */
const cleaver = {
  r: 0.056,
  lean: 0.75,
  angle: -Math.PI / 4,
}
/** iron gone dark and greasy, rusting where it isn’t handled and crusted with old blood */
const butcherIron: Metal = {
  bright: '#5e5852',
  dull: '#24201d',
  roughness: 0.5,
  patina: {
    amount: 0.75,
    color: '#3a140c',
  },
  texture: 0.00002,
}
/** a cleaver’s carbon steel, gray and dull but for its edge */
const cleaverSteel: Metal = {
  bright: '#9a9ea2',
  dull: '#3c3d3f',
  roughness: 0.32,
  patina: {
    amount: 0.5,
    color: '#3a0a06',
  },
}
/** The S-hook’s wire as a line of points, its top curled over the rail round the origin and its shank `shank` meters long, ending in a curl up to its point. */
function hookLine(shank: number) {
  const top = Array.from({length: 8}, (_, index) => {
    const angle = (210 - index / 7 * 270) * Math.PI / 180
    return [Math.cos(angle) * 0.0078, Math.sin(angle) * 0.0078] as const
  })
  const bottom = Array.from({length: 8}, (_, index) => {
    const angle = (180 + index / 7 * 220) * Math.PI / 180
    return [0.012 + Math.cos(angle) * 0.012, -shank + Math.sin(angle) * 0.012] as const
  })
  return [...top, [0.0016, -0.016] as const, [0, -shank * 0.6] as const, ...bottom]
}
/** The outline of the wire along the points, as thick as {@link hook}’s wire and tapering to the point at its end, counterclockwise. */
function wireOutline(points: ReadonlyArray<readonly [number, number]>) {
  const sides = points.map(([x, y], index) => {
    const [ax, ay] = points[Math.max(0, index - 1)]
    const [bx, by] = points[Math.min(points.length - 1, index + 1)]
    const length = Math.hypot(bx - ax, by - ay)
    const width = hook.wire * Math.min(1, (points.length - 1 - index) / 3 + 0.25)
    const normal = [-(by - ay) / length * width, (bx - ax) / length * width] as const
    return [[x + normal[0], y + normal[1]], [x - normal[0], y - normal[1]]] as const
  })
  const outline = [...sides.map(([left]) => left), ...sides.map(([, right]) => right).toReversed()]
  const area = outline.reduce((sum, [x, y], index) => {
    const [nx, ny] = outline[(index + 1) % outline.length]
    return sum + x * ny - nx * y
  }, 0)
  return area < 0 ? outline.toReversed() : outline
}
/** A rough random number from 0 to 1 for the index and the stream, so frames of every size spread their hooks alike. */
const scatter = (index: number, stream: number) => {
  const value = Math.sin(index * 127.1 + stream * 311.7) * 43_758.5453
  return value - Math.floor(value)
}
/** The hooks swaying on the rail: each turns about the point it hangs by and to and fro toward the viewer, at a beat of its own, now and then swinging wider as if it had just been let go. */
function swaying() {
  const at = uv()
  const pivot = positionLocal.xy.sub(at)
  const seed = hash(pivot.x.mul(91.3).add(3.1))
  const beat = seed.mul(0.8).add(2)
  const swell = time.mul(seed.mul(0.15).add(0.22)).add(seed.mul(17)).sin().mul(0.5).add(0.5).pow(3)
  const amplitude = swell.mul(0.13).add(0.03)
  const angle = time.mul(beat).add(seed.mul(31)).sin().mul(amplitude)
  const forward = time.mul(beat.mul(0.83)).add(seed.mul(13)).sin().mul(amplitude.mul(0.6))
  const turned = vec2(at.x.mul(angle.cos()).sub(at.y.mul(angle.sin())), at.x.mul(angle.sin()).add(at.y.mul(angle.cos())))
  return vec3(pivot.add(vec2(turned.x, turned.y.mul(forward.cos()))), positionLocal.z.sub(turned.y.mul(forward.sin())))
}
/** A knife cut in a cell of `size` meters: a thin straight scar through the point, at an angle near one of the two a butcher cuts at most, about `length` long, or none in some cells. Returns how close the point lies to it, 0 to 1. */
function cuts(plane: Node<'vec2'>, size: number, length: number, share: number, stream: number, footprint: Float): Float {
  const cell = plane.div(size).floor()
  const id = cell.x.mul(157.3).add(cell.y.mul(41.9)).add(stream)
  const middle = cell.add(vec2(hash(id), hash(id.add(1))).mul(0.6).add(0.2)).mul(size)
  const angle = select(hash(id.add(4)).lessThan(0.5), float(0.35), float(1.95)).add(hash(id.add(2)).sub(0.5).mul(0.5))
  const direction = vec2(angle.cos(), angle.sin())
  const offset = plane.sub(middle)
  const along = offset.dot(direction)
  const across = offset.dot(vec2(direction.y.negate(), direction.x))
  const scar = line(across, 0.00018).mul(along.abs().smoothstep(length / 2, length / 2 - 0.002)).mul(visibleDetail(footprint, 0.0012))
  return select(hash(id.add(3)).lessThan(share), scar, float(0))
}

/** One of the Horror Orb’s frames: a butcher’s block, scarred end grain soaked dark, an iron rail of meat hooks swaying along its top though nothing moves them, and a cleaver driven into a corner. */
export default class HorrorButcherFrame extends PortraitFrame {
  override readonly description = 'Sawn from a butcher’s block: glued squares of end grain, scored all over by knives and split by hatchet chops, soaked dark brown where blood ran into the grain and greasy with use, an iron rail along its top hung with meat hooks that keep swaying, each to its own beat, as if something heavy had just been lifted off them, and a cleaver driven deep into its bottom right corner.'
  override readonly front = face.z + 0.05 * Math.sin(cleaver.lean)
  override readonly imageDepth = imageDepth
  override readonly impactSound = 'hardwood'
  override readonly reach = profile.reach
  override readonly tint = '#5a3424'
  override readonly title = 'Butcher’s block'

  override createGeometry(width: number, height: number) {
    const halfWidth = width / 2
    const halfHeight = height / 2
    const railY = halfHeight + rail.r
    const railLength = width + 0.2
    const count = Math.min(hook.most, Math.max(2, Math.floor(width / hook.spacing)))
    const spots = Array.from({length: count}, (_, index) => ({
      index,
      position: [((index + 0.5 + (scatter(index, 1) - 0.5) * 0.5) / count - 0.5) * (width - 0.04), railY, railZ - hook.thickness / 2] as const,
    }))
    const hooksOf = (long: boolean) => {
      const own = spots.filter(({index}) => scatter(index, 2) < 0.5 === long)
      return own.length > 0 ? place(relief(wireOutline(hookLine(long ? 0.075 : 0.06)), hook.thickness, {kind: long ? 2 : 1}), own.map(({position}) => ({position}))) : undefined
    }
    const bladeOutline = [[-0.046, -0.012], [0.04, -0.012], [0.04, 0.036], [0.034, 0.046], [-0.037, 0.046], [-0.046, 0.038]] as const
    const corner = [halfWidth + cleaver.r, -(halfHeight + cleaver.r), face.z] as const
    const cleaverPlacement = [{
      position: corner,
      angle: cleaver.angle,
      tilt: cleaver.lean,
    }]
    const bladePart = relief(bladeOutline, 0.0024, {kind: 3})
    bladePart.translate(0, 0, -0.0012)
    const grip = block(0.046, 0.012, 0.01, {kind: 4})
    grip.translate(0.063, 0.038, -0.005)
    return assembleFrame([
      ...sweepProfile(profile, halfWidth, halfHeight),
      [steel, place(block(railLength, rail.size, rail.size, {kind: 0}), [{position: [0, railY, railZ - rail.size / 2]}])],
      [steel, place(block(0.008, 0.012, rail.standoff, {kind: 0}), [-1, 1].map(side => ({position: [side * (halfWidth + 0.03), railY, face.z] as const})))],
      [hooks, hooksOf(false)],
      [hooks, hooksOf(true)],
      [blade, place(bladePart, cleaverPlacement)],
      [handle, place(grip, cleaverPlacement)],
    ])
  }

  protected override createMaterials() {
    const hookMaterial = new FrameMetalMaterial({metal: butcherIron})
    hookMaterial.positionNode = swaying()
    return [
      new BlockMaterial,
      new FrameMetalMaterial({metal: butcherIron}),
      hookMaterial,
      new FrameMetalMaterial({
        metal: cleaverSteel,
        finish: surface => {
          // Ground bright along its edge, dark round the hole it hangs by.
          const edge = surface.across.smoothstep(-0.004, -0.011)
          const hole = inside(vec2(surface.along.add(0.036), surface.across.sub(0.036)).length().sub(0.0038))
          return {
            brightness: mix(float(0.75), float(1.3), edge).mul(hole.oneMinus()),
            roughness: edge.mul(-0.15).add(hole.mul(0.5)),
            height: hole.mul(-0.0008),
          }
        },
      }),
      new FrameWoodMaterial({
        timber: walnut,
        grime: 0.9,
        roughness: 0.6,
        stain: '#6a4a3a',
      }),
    ]
  }
}
/**
 * The block: squares of maple end grain glued in a checker, each showing arcs of its rings round a heart outside it, scored by a thousand knife cuts and split here and there by a hatchet’s chop, its long grain showing on the chamfer and the round; blood has soaked deep brown into it, darkest toward the bottom, and grease makes it shine.
 */
class BlockMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      envMap: frameStudio,
      envMapIntensity: 0.35,
      clearcoat: 0.08,
      clearcoatRoughness: 0.4,
    })
    const surface = frameSurface()
    const p = surface.position
    const footprint = max(p.x.fwidth(), p.y.fwidth()).max(p.z.fwidth()).toVar('blockFootprint')
    const onFace = band(surface, face.from, face.to)
    const plane = vec2(surface.along, surface.reach)
    // The pieces of end grain, glued in three strips round the work, each strip cut into pieces of a length of its own, each ringed round a heart of its own outside it.
    const strip = surface.reach.sub(face.from).div((face.to - face.from) / 3).floor().clamp(0, 2)
    const pieceLength = hash(strip.add(surface.member.mul(3.1))).mul(0.03).add(0.03)
    const pieceRun = surface.along.div(pieceLength).add(hash(strip.mul(5.3).add(1)))
    const piece = vec2(pieceRun.floor(), strip)
    const id = piece.x.mul(71.3).add(piece.y.mul(19.1)).add(surface.member.mul(5.3))
    const pieceMiddle = vec2(pieceRun.floor().add(0.5).sub(hash(strip.mul(5.3).add(1))).mul(pieceLength), strip.add(0.5).mul((face.to - face.from) / 3).add(face.from))
    const heart = pieceMiddle.add(vec2(hash(id).sub(0.5), hash(id.add(1)).sub(0.5)).mul(0.09))
    const ringPhase = plane.sub(heart).length().mul(200).add(mx_noise_float(vec3(plane.mul(60), id)).mul(1.4))
    const rings = mix(ringPhase.sin().mul(0.5).add(0.5).pow(2), float(0.3), ringPhase.fwidth().smoothstep(0.8, 2.4))
    const seam = line(pieceRun.fract().sub(0.5).abs().sub(0.5).mul(pieceLength), 0.00025).max(line(surface.reach.sub(face.from).div((face.to - face.from) / 3).fract().sub(0.5).abs().sub(0.5).mul((face.to - face.from) / 3), 0.00025)).mul(onFace.inside)
    const tone = hash(id.add(7))
    const pores = mx_noise_float(vec3(plane.mul(900), 1.3)).mul(0.5).add(0.5).mul(visibleDetail(footprint, 0.0012))
    const endGrain = mix(mix(color('#946234'), color('#6a4020'), tone), color('#3a200e'), rings.mul(0.55)).mul(pores.mul(-0.12).add(1))
    // The chamfer and the round show the long grain, running along the member.
    const longGrain = mix(color('#7e4e28'), color('#4a2a12'), mx_noise_float(vec3(surface.along.mul(6), surface.across.mul(260), surface.member)).mul(0.5).add(0.5))
    const timber = mix(longGrain, mix(endGrain, color('#2a180a'), seam.mul(0.35)), onFace.inside)
    // Knife cuts, mostly in two directions, as a butcher works, and the odd deep hatchet gash with splintered lips.
    const scored = cuts(plane, 0.012, 0.01, 0.35, 0, footprint).max(cuts(plane.add(0.004), 0.019, 0.016, 0.3, 9, footprint)).mul(onFace.inside)
    const gashLength = 0.04
    const gashCell = surface.along.div(0.16).floor()
    const gashId = gashCell.mul(13.7).add(surface.member.mul(3.1))
    const gashMiddle = vec2(gashCell.add(hash(gashId).mul(0.6).add(0.2)).mul(0.16), hash(gashId.add(1)).mul(0.04).add(face.from + 0.028))
    const gashAngle = hash(gashId.add(2)).sub(0.5).mul(0.9).add(Math.PI / 2)
    const gashOffset = plane.sub(gashMiddle)
    const gashAlong = gashOffset.dot(vec2(gashAngle.cos(), gashAngle.sin()))
    const gashAcross = gashOffset.dot(vec2(gashAngle.sin().negate(), gashAngle.cos()))
    // A wedge, widest where the blade went in deepest, closing to a crack at both ends.
    const opening = gashAlong.div(gashLength / 2).add(0.35).abs().min(1).oneMinus().max(0).pow(0.8).mul(0.0012)
    const splinters = mx_noise_float(vec3(gashAlong.mul(900), gashAcross.sign(), gashId)).mul(0.0006)
    const has = hash(gashId.add(3)).lessThan(0.5).and(gashAlong.abs().lessThan(gashLength / 2))
    const chop = select(has, inside(gashAcross.abs().sub(opening)), float(0)).mul(onFace.inside)
    const fresh = select(has, inside(gashAcross.abs().sub(opening.add(0.0011).add(splinters))), float(0)).mul(chop.oneMinus()).mul(onFace.inside)
    // Blood soaked into the grain, darkest toward the bottom, drunk deepest by the rings and the cuts.
    const low = surface.position.y.negate().div(surface.opening.y.add(0.11)).mul(0.5).add(0.5).clamp(0, 1)
    const spread = mx_noise_float(p.mul(9).add(vec3(0.7, 2.2, 0))).mul(0.5).add(0.5).add(mx_noise_float(p.mul(40)).mul(0.12)).add(low.mul(0.45))
    const soaked = spread.add(rings.mul(0.06)).smoothstep(0.55, 0.78).max(scored.mul(spread.smoothstep(0.4, 0.6)))
    const wet = spread.smoothstep(0.85, 0.95)
    // Under every hook, old blood ran down the face from the rail to the sight edge and dried.
    const isTop = surface.member.round().equal(0).and(onFace.inside.greaterThan(0.5))
    const width = surface.openingHalf.mul(2)
    const count = width.div(hook.spacing).floor().clamp(2, hook.most)
    let drips: Float = float(0)
    for (let index = 0; index < hook.most; index++) {
      const x = float(index + 0.5 + (scatter(index, 1) - 0.5) * 0.5).div(count).sub(0.5).mul(width.sub(0.04)).add(0.0035)
      const lane = surface.along.sub(x).sub(mx_noise_float(vec3(surface.reach.mul(120), index, 3.3)).mul(0.0015))
      const reachDown = float(face.from + scatter(index, 5) * 0.03)
      const blobs = mx_noise_float(vec3(surface.reach.mul(260), index, 7.7)).mul(0.0012)
      const streak = inside(lane.abs().sub(float(rail.r).sub(surface.reach).mul(0.04).add(0.0024).add(blobs))).mul(inside(surface.reach.sub(rail.r - 0.004).max(reachDown.sub(surface.reach))))
      drips = drips.max(select(float(index).lessThan(count), streak, float(0)))
    }
    drips = select(isTop, drips, float(0))
    const stained = mix(mix(timber, mix(color('#4e1a10'), color('#5e160c'), wet), soaked.mul(0.8)), color('#3a0a08'), drips.mul(0.92))
    const cut = mix(stained, stained.mul(0.55), scored)
    this.colorNode = mix(mix(cut, color('#a87a4c'), fresh.mul(0.6)), color('#0b0503'), chop)
    this.roughnessNode = mix(float(0.72), float(0.45), soaked.max(drips)).sub(wet.mul(0.15)).add(chop.mul(0.2))
    this.normalNode = heightNormal(scored.mul(-0.0002).sub(chop.mul(0.0018)).add(fresh.mul(0.0003)).sub(seam.mul(0.0001)).add(rings.mul(0.00003).mul(onFace.inside)).sub(pores.mul(0.00002)))
  }
}

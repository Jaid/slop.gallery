import type {FrameSurface} from '#src/lib/materials/frames/frameAttributes.ts'
import type {Node} from 'three/webgpu'

import {atan, cameraPosition, cameraProjectionMatrix, cameraViewMatrix, color, float, Fn, hash, max, mix, modelWorldMatrix, modelWorldMatrixInverse, mx_noise_float, normalLocal, positionGeometry, positionLocal, select, uv, vec2, vec3, vec4} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {heightNormal, inside, line, visibleDetail} from '#src/lib/materials/filters.ts'
import {band} from '#src/lib/materials/frames/carving.ts'
import {fittedPeriod, frameSurface} from '#src/lib/materials/frames/frameAttributes.ts'
import frameStudio from '#src/lib/materials/frames/frameStudio.ts'

import PortraitFrame, {frameBack} from './base/PortraitFrame.ts'
import {assembleFrame, corners, ornamentMember, place, sweepProfile} from './frameGeometry.ts'
import FrameProfile from './FrameProfile.ts'
import {anatomy, skull} from './skull.ts'

type Float = Node<'float'>
type Vec2 = Node<'vec2'>
type Vec3 = Node<'vec3'>

const imageDepth = -0.06
const bone = 0
const skulls = 1
/** where the rows of bones lie out past the opening: a string of vertebrae at the sight edge, two rows of long bones and the finger bones rolling down to the wall */
const rows = {
  vertebrae: [-0.005, 0.014],
  inner: [0.014, 0.05],
  outer: [0.05, 0.086],
  fingers: [0.086, 0.112],
} as const
/** a round of vertebrae at the sight edge, two swelling rows of long bones and a roll of finger bones down to the wall, each sunk into the ash between them */
const profile = FrameProfile.from([-0.005, imageDepth], bone)
  .line(-0.005, -0.05)
  .arc(rows.vertebrae[1], -0.05, 0.5, {steps: 8})
  .arc(rows.inner[1], -0.05, 0.42, {steps: 10})
  .arc(rows.outer[1], -0.05, 0.42, {steps: 10})
  .arc(rows.fingers[1], -0.074, 0.3, {steps: 6})
  .line(rows.fingers[1], frameBack)
  .line(-0.005, frameBack)
/** the skulls on the corners: how far out past the opening their middles sit on both members, where their feet rest and how tall they are from crown to chin */
const head = {
  reach: 0.054,
  foot: -0.046,
  height: 0.094,
}
/** A placement without its turn, upright and unscaled, so a skull’s own coordinates stay the viewer’s and its middle can be found again in the shader. */
const upright = ({position}: {position: readonly [number, number, number]}) => ({position})
/** The color of old bone at `p`: ivory gone yellow and brown in patches, grimed in its pores and finely cracked. */
function boneColor(p: Vec3, tone: Float, footprint: Float) {
  const stain = mx_noise_float(p.mul(14).add(vec3(2.3, 0, 0))).mul(0.5).add(0.5)
  const mottle = mx_noise_float(p.mul(70)).mul(0.5).add(0.5)
  const pores = mx_noise_float(p.mul(700)).mul(0.5).add(0.5).mul(visibleDetail(footprint, 0.0015))
  const crackMask = mx_noise_float(p.mul(9).add(vec3(0, 4.1, 0))).smoothstep(0, 0.5)
  const cracks = float(1).sub(mx_noise_float(p.mul(110)).abs().smoothstep(0, 0.03)).mul(crackMask).mul(visibleDetail(footprint, 0.002))
  const ivory = mix(color('#d8c89e'), color('#a68a54'), stain.mul(0.7).add(tone.mul(0.3)))
  const aged = mix(ivory, color('#6a4a28'), stain.smoothstep(0.6, 0.95).mul(0.7))
  return {
    color: mix(aged.mul(mottle.mul(0.15).add(0.9)), color('#3a2a1a'), cracks.mul(0.8).max(pores.mul(0.25))),
    height: cracks.mul(-0.00012).sub(pores.mul(0.00003)),
  }
}
/** A smooth union of two distances, blending within `k` meters. */
function blend(a: Float, b: Float, k: number): Float {
  const h = float(0.5).add(b.sub(a).mul(0.5 / k)).clamp(0, 1)
  return mix(b, a, h).sub(h.mul(h.oneMinus()).mul(k))
}
/**
 * A row of long bones laid end to end along the members within the band from `from` to `to`, each about `period` long and lying in the ash: a shaft flaring toward its ends, a round head on one of them and two knuckles on the other, laid either way round and each a little thicker or thinner than the next, with a gap at every joint, some joints bridged by a cord of dried sinew. Returns how much bone covers the point, its relief in meters, the sinew and how near the point lies to the bone’s edge.
 */
function longBones(surface: FrameSurface, [from, to]: readonly [number, number], period: number, offset: number) {
  const across = band(surface, from, to)
  const length = fittedPeriod(surface.openingHalf, period, (from + to) / 2)
  const run = surface.along.div(length).add(offset)
  const index = run.floor()
  const id = hash(index.mul(13.7).add(surface.member.mul(101.3)).add(offset * 57))
  const thick = id.mul(0.25).add(0.88)
  // In meters within the bone, its middle at 0, laid either way round.
  const a = run.fract().sub(0.5).mul(length).mul(select(id.greaterThan(0.5), float(-1), float(1)))
  const q = vec2(a, across.t.sub(0.5).mul(to - from)).div(thick)
  const half = length.div(2).div(thick)
  const flare = a.div(length.div(2)).pow(2)
  const shaft = max(q.y.abs().sub(flare.mul(0.0018).add(0.0056)), q.x.abs().sub(half.sub(0.008)))
  const knob = vec2(q.x.add(half.sub(0.0095)), q.y).length().sub(0.009)
  const knuckles = vec2(q.x.sub(half.sub(0.0085)), q.y.abs().sub(0.005)).length().sub(0.0068)
  const shape = blend(blend(shaft, knob, 0.004), knuckles, 0.003).mul(thick)
  const cover = inside(shape).mul(across.inside)
  // Some joints are bridged by a cord of sinew, wound round both bone ends meeting there.
  const tied = hash(run.round().mul(7.31).add(surface.member.mul(3.7)).add(offset * 11)).lessThan(0.22)
  const sinew = select(tied, inside(max(a.abs().sub(length.div(2)).abs().sub(0.006), q.y.abs().sub(0.0036))), float(0)).mul(across.inside)
  return {
    cover,
    sinew,
    height: shape.negate().max(0).div(0.006).min(1).sqrt().mul(0.0022).mul(across.inside).add(sinew.mul(0.0012)),
    edge: shape.negate().smoothstep(0.003, 0).mul(cover),
    id,
  }
}

/** One of the Halloween Orb’s frames: an ossuary’s, built of human bones, with a skull on every corner that turns its face after the viewer while they look elsewhere: out of the corner of the eye, every skull faces them, and the one they look at faces straight ahead again. */
export default class HalloweenOssuaryFrame extends PortraitFrame {
  override readonly description = 'Built like the walls of a charnel chapel: a string of vertebrae round the work, two rows of long bones laid end to end and tied with dried sinew, finger bones packed down to the wall, all yellowed and cracked and sunk in gray ash, with a human skull on every corner that turns its face after the viewer, its head a little cocked, while they look elsewhere, and is facing straight ahead again by the time they look at it.'
  override readonly front = head.foot + head.height * 0.44
  override readonly imageDepth = imageDepth
  override readonly impactSound = 'hardwood'
  override readonly reach = profile.reach
  override readonly tint = '#cbbd96'
  override readonly title = 'Watching skulls'

  override createGeometry(width: number, height: number) {
    const halfWidth = width / 2
    const halfHeight = height / 2
    const spots = corners(halfWidth, halfHeight, head.reach, head.foot).map(upright)
    const {cranium, mandible} = skull(head.height)
    return assembleFrame([
      ...sweepProfile(profile, halfWidth, halfHeight),
      [skulls, place(cranium, spots)],
      [skulls, place(mandible, spots)],
    ])
  }

  protected override createMaterials() {
    return [new BoneMaterial, new SkullMaterial]
  }
}

/**
 * The bones of the mouldings: the vertebrae, the long bones and the finger bones, each in its row, in the ash that fills the hollows between them.
 */
class BoneMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      envMap: frameStudio,
      envMapIntensity: 0.6,
      clearcoat: 0.12,
      clearcoatRoughness: 0.5,
    })
    const surface = frameSurface()
    const p = surface.position
    const footprint = max(p.x.fwidth(), p.y.fwidth()).max(p.z.fwidth()).toVar('ossuaryFootprint')
    // The vertebrae: rounded bodies with a raised rim, a dark disc between each and the next.
    const spine = band(surface, ...rows.vertebrae)
    const spineRun = surface.along.div(fittedPeriod(surface.openingHalf, 0.021, 0.004))
    const vertebra = spineRun.fract().mul(2).sub(1).abs()
    const spineId = hash(spineRun.floor().add(surface.member.mul(97.1)))
    // Each vertebra a little longer or shorter than the next, the discs between them shrunk to dark seams of ash.
    const gap = spineId.mul(0.1).add(0.8)
    const body = vertebra.smoothstep(gap.add(0.1), gap).mul(spine.inside)
    const rim = vertebra.smoothstep(gap.sub(0.18), gap.sub(0.08)).mul(vertebra.smoothstep(gap.add(0.06), gap.sub(0.02))).mul(spine.inside)
    const inner = longBones(surface, rows.inner, 0.1, 0)
    const outer = longBones(surface, rows.outer, 0.115, 0.5)
    // A heap of finger bones, two layers of them lying across the roll, each turned and sized its own way, knobbed at both ends.
    const hand = band(surface, ...rows.fingers)
    const handWidth = rows.fingers[1] - rows.fingers[0]
    const layer = (cell: number, shift: number, stream: number) => {
      const run = surface.along.div(cell).add(shift)
      const id = hash(run.floor().mul(17.3).add(surface.member.mul(5.1)).add(stream))
      const local = vec2(run.fract().sub(0.5).mul(cell), hand.t.sub(0.5).mul(handWidth).add(id.sub(0.5).mul(0.006)))
      const angle = id.sub(0.5).mul(0.9).add(Math.PI / 2)
      const turned = vec2(local.x.mul(angle.cos()).add(local.y.mul(angle.sin())), local.y.mul(angle.cos()).sub(local.x.mul(angle.sin())))
      const reach = id.mul(0.004).add(0.006)
      const shape = blend(max(turned.x.abs().sub(reach), turned.y.abs().sub(0.0028)), vec2(turned.x.abs().sub(reach), turned.y).length().sub(0.0036), 0.002)
      return {
        cover: inside(shape),
        height: shape.negate().max(0).div(0.0035).min(1).sqrt(),
      }
    }
    const lower = layer(0.011, 0, 0)
    const upper = layer(0.013, 0.5, 31)
    const phalanx = lower.cover.max(upper.cover).mul(hand.inside)
    const cover = body.max(inner.cover).max(outer.cover).max(phalanx).max(surface.isOrnament).toVar('ossuaryCover')
    const sinew = inner.sinew.max(outer.sinew)
    const tone = inner.id.mul(inner.cover).add(outer.id.mul(outer.cover))
    const {color: boneTone, height: grain} = boneColor(p, tone, footprint)
    const ash = mix(color('#231c15'), color('#6a6052'), mx_noise_float(p.mul(400)).mul(0.5).add(0.5).mul(0.5).add(mx_noise_float(p.mul(30)).mul(0.25).add(0.25)).mul(surface.cavity.smoothstep(0.9, 0.2).mul(0.6).add(0.4)))
    const fibers = mx_noise_float(vec3(p.x.add(p.y).mul(900), surface.across.mul(40), 0)).mul(0.5).add(0.5)
    const tendon = mix(color('#3a1c0e'), color('#6a3a1c'), fibers)
    const hollow = surface.cavity.smoothstep(0.1, 0.9)
    const edges = inner.edge.max(outer.edge).max(vertebra.smoothstep(gap.sub(0.15), gap.add(0.05)).mul(body)).max(lower.height.max(upper.height).smoothstep(0.6, 0).mul(phalanx))
    const fragments = mx_noise_float(p.mul(520)).smoothstep(0.6, 0.72).mul(visibleDetail(footprint, 0.0015))
    this.colorNode = mix(mix(mix(ash, color('#9a8c70'), fragments.mul(0.6)), boneTone.mul(hollow.mul(-0.35).add(1)).mul(edges.mul(-0.45).add(1)), cover), tendon, sinew)
    this.roughnessNode = mix(float(0.95), float(0.55), cover).sub(sinew.mul(0.15))
    this.normalNode = heightNormal(inner.height.add(outer.height).add(body.mul(0.0012)).add(rim.mul(0.0004)).add(lower.height.max(upper.height.add(0.4).mul(upper.cover)).mul(hand.inside).mul(0.0012)).add(grain.mul(cover)).add(sinew.mul(fibers.mul(0.0001))))
  }
}
/** where the middle of the skull a point belongs to lies, from the point before any motion and its own coordinates, which works because {@link upright} places the skulls unturned and unscaled */
const skullMiddle = () => positionGeometry.xy.sub(uv())
const skullSeed = (middle: Vec2) => hash(middle.x.mul(53.1).add(middle.y.mul(17.9)))
/** where the viewer is, in the frame’s space */
const viewer = () => modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz
/**
 * How little the viewer looks at a point in the frame’s space: 0 while it lies near the middle of the view, rising to 1 out toward its edges or behind the viewer, and also as the viewer backs away beyond three meters or so.
 */
function unwatched(point: Vec3) {
  const clip = cameraProjectionMatrix.mul(cameraViewMatrix).mul(modelWorldMatrix).mul(vec4(point, 1)).toVar('watchClip')
  const offCenter = clip.xy.div(clip.w.max(0.0001)).length()
  return select(clip.w.greaterThan(0), offCenter.smoothstep(0.2, 0.5), float(1)).max(viewer().sub(point).length().smoothstep(3.2, 4.6))
}
/**
 * The skulls turning, a vertex stage for {@link SkullMaterial}: while the viewer doesn’t look at a skull, it turns its face after them, as far as its neck would let it, its head cocked a little; looked at, it faces straight out again.
 */
function turning() {
  return Fn(() => {
    const middle = skullMiddle()
    const seed = skullSeed(middle)
    const face = vec3(middle, head.foot + 0.3 * head.height)
    const toward = viewer().sub(face)
    const weight = unwatched(face)
    const yaw = atan(toward.x, toward.z).clamp(-0.45, 0.45).mul(weight)
    const pitch = atan(toward.y, toward.xz.length()).clamp(-0.3, 0.3).mul(weight)
    const roll = seed.sub(0.5).sign().mul(seed.mul(0.1).add(0.08)).mul(weight)
    // Cock, then raise or lower the face, then turn it, about a pivot deep behind the face.
    const turn = (v: Vec3) => {
      const cocked = vec3(v.x.mul(roll.cos()).sub(v.y.mul(roll.sin())), v.x.mul(roll.sin()).add(v.y.mul(roll.cos())), v.z)
      const raised = vec3(cocked.x, cocked.y.mul(pitch.cos()).add(cocked.z.mul(pitch.sin())), cocked.z.mul(pitch.cos()).sub(cocked.y.mul(pitch.sin())))
      return vec3(raised.x.mul(yaw.cos()).add(raised.z.mul(yaw.sin())), raised.y, raised.z.mul(yaw.cos()).sub(raised.x.mul(yaw.sin())))
    }
    const pivot = vec3(middle, head.foot - 0.1 * head.height)
    // The normals turn along, so the light stays on the skull as it moves.
    normalLocal.assign(turn(normalLocal))
    return turn(positionLocal.sub(pivot)).add(pivot)
  })()
}
/**
 * The skulls made by {@link skull}: old ivory gone brown, grimed in the sockets and the nasal hole and toward the jaw, the sutures zigzagging over the crown, a crack through some craniums and a row of worn teeth on either jaw, a few of them gone. Behind the bite and deep in the sockets lies darkness. They move by {@link turning}.
 */
class SkullMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      envMap: frameStudio,
      envMapIntensity: 0.6,
      clearcoat: 0.15,
      clearcoatRoughness: 0.45,
    })
    this.positionNode = turning()
    const surface = frameSurface()
    // The point before any motion, so the bone’s grain stays on it as the skull turns.
    const p = positionGeometry
    const footprint = max(p.x.fwidth(), p.y.fwidth()).max(p.z.fwidth()).toVar('skullFootprint')
    const isJaw = surface.member.sub(ornamentMember).round().equal(1)
    const {height} = head
    const q = uv().div(height).toVar('skullPoint')
    const mirrored = vec2(q.x.abs(), q.y)
    const seed = skullSeed(skullMiddle())
    const {orbit, nose, teeth} = anatomy
    // The sockets and the nasal hole, as the mesh sinks them.
    const orbitOffset = mirrored.x.sub(orbit.x)
    const orbitShape = orbitOffset.div(orbit.halfWidth).abs().pow(2.6).add(q.y.sub(orbit.y).add(orbitOffset.mul(orbit.droop)).div(orbit.halfHeight).abs().pow(2.6)).pow(1 / 2.6)
    const inOrbit = select(isJaw, float(0), inside(orbitShape.sub(0.86).mul(orbit.halfHeight * height)))
    const deep = orbitShape.smoothstep(0.86, 0.35)
    const v = q.y.sub(nose.y).div(nose.halfHeight)
    const noseShape = q.x.div(mix(float(nose.bottom), float(nose.top), v.smoothstep(-0.6, 1))).abs().pow(2.5).add(v.abs().pow(2.5)).pow(1 / 2.5)
    const inNose = select(isJaw, float(0), inside(noseShape.sub(0.84).mul(nose.halfHeight * height)))
    // The teeth: a crown of its own every few millimeters, wider toward the molars, some lost, the gums receded between their roots.
    const [upperGum, upperEdge] = teeth.upper
    const [lowerEdge, lowerGum] = teeth.lower
    const row = select(isJaw, q.y.sub(lowerGum).div(lowerEdge - lowerGum), q.y.sub(upperGum).div(upperEdge - upperGum))
    const span = inside(mirrored.x.sub(teeth.halfWidth).mul(height)).mul(inside(row.sub(0.5).abs().sub(0.5).mul(0.04 * height)))
    const run = q.x.div(mirrored.x.smoothstep(0.05, 0.14).mul(0.012).add(teeth.width)).add(0.5)
    const lost = hash(run.floor().add(seed.mul(41)).add(select(isJaw, float(7), float(0)))).lessThan(0.12).select(float(1), float(0))
    const between = run.fract().sub(0.5).abs().toVar('skullTooth')
    // Each crown narrows toward its root and rounds off at its edge.
    const crownShape = between.sub(float(0.46).sub(row.oneMinus().mul(0.08))).max(row.sub(0.88).mul(between.mul(4).add(0.5)))
    const toothGap = inside(crownShape.negate().mul(teeth.width * height)).max(lost)
    const inTooth = span.mul(toothGap.oneMinus())
    const bite = select(isJaw, q.y.greaterThan(lowerEdge + 0.002), q.y.lessThan(upperEdge - 0.002)).select(float(1), float(0))
    const holes = inOrbit.max(inNose).max(bite).max(span.mul(toothGap))
    // The sutures zigzag over the crown, and some craniums are cracked from the crown down toward a socket.
    const coronal = q.y.sub(float(0.31).sub(q.x.mul(q.x).mul(0.6))).add(q.x.mul(120).sin().mul(0.006))
    const sagittal = q.x.add(q.y.mul(110).sin().mul(0.005))
    const sutures = line(coronal.mul(height), 0.00018).max(line(sagittal.mul(height), 0.00018).mul(q.y.smoothstep(0.3, 0.33))).mul(visibleDetail(footprint, 0.0012)).mul(select(isJaw, float(0), float(1)))
    const crackPath = q.x.sub(seed.sub(0.5).mul(0.3)).sub(mx_noise_float(vec3(q.y.mul(9), seed.mul(13), 0)).mul(0.06))
    const crack = select(seed.lessThan(0.45).and(isJaw.not()), line(crackPath.mul(height), 0.00022).mul(q.y.smoothstep(0.12, 0.2)), float(0)).mul(visibleDetail(footprint, 0.0012))
    const {color: boneTone, height: grain} = boneColor(p, seed, footprint)
    // Grime in the hollows, round the holes and toward the jaw.
    const grime = surface.cavity.smoothstep(-0.1, 0.6).max(orbitShape.smoothstep(1.6, 1).mul(0.7)).max(noseShape.smoothstep(1.7, 1).mul(0.7)).add(q.y.smoothstep(0.1, -0.5).mul(0.3)).add(mx_noise_float(vec3(q.mul(9), seed.mul(7))).mul(0.25)).clamp(0, 1)
    const grimed = mix(boneTone, color('#46321c'), grime.mul(0.7))
    const enamel = mix(color('#c8b27a'), color('#6a4a26'), row.smoothstep(0.5, 0).mul(0.7))
    const dark = mix(color('#040302'), color('#3e2c1a'), deep.oneMinus().pow(2).mul(inOrbit))
    const gaps = mix(color('#2a1c0e'), color('#0a0604'), bite.max(inOrbit).max(inNose))
    this.colorNode = mix(mix(mix(grimed, enamel, inTooth), mix(gaps, dark, inOrbit), holes), color('#24180c'), sutures.max(crack).mul(0.75))
    this.roughnessNode = mix(mix(float(0.62), float(0.45), inTooth), float(0.95), holes)
    this.normalNode = heightNormal(grain.mul(holes.oneMinus()).sub(span.mul(toothGap).mul(0.0004)).sub(sutures.mul(0.0001)).sub(crack.mul(0.00025)).add(inTooth.mul(between.mul(2).oneMinus().mul(0.0002))))
  }
}

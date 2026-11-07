import type {Placement} from './frameGeometry.ts'
import type {Node} from 'three/webgpu'

import {atan, attribute, cameraPosition, color, float, Fn, hash, max, mix, modelWorldMatrixInverse, mx_noise_float, normalLocal, positionGeometry, positionLocal, select, time, uv, vec2, vec3, vec4} from 'three/tsl'
import {BufferGeometry, Float32BufferAttribute, MeshPhysicalNodeMaterial, Vector3} from 'three/webgpu'

import {heightNormal, inside, line, visibleDetail} from '#src/lib/materials/filters.ts'
import {band} from '#src/lib/materials/frames/carving.ts'
import {frameSurface} from '#src/lib/materials/frames/frameAttributes.ts'
import frameStudio from '#src/lib/materials/frames/frameStudio.ts'

import PortraitFrame, {frameBack, frameTriangleBudget} from './base/PortraitFrame.ts'
import {along, assembleFrame, frameShapeAttribute, ornament, ornamentMember, place, sweepProfile} from './frameGeometry.ts'
import FrameProfile from './FrameProfile.ts'

type Vec3 = Node<'vec3'>
/** a tooth’s crown: how wide it is at the gum, how long, and how far its edge reaches to either side of its middle, as a share of its width */
type ToothShape = {
  length: number
  tip: number
  width: number
}

const imageDepth = -0.058
const mouth = 0
const enamel = 1
/** the gum the teeth stand in, the groove behind it lined with rows of small teeth, the swollen lip and the skin it turns into down to the wall */
const regions = {
  gum: [-0.005, 0.026],
  groove: [0.026, 0.036],
  rows: [0.036, 0.056],
  lip: [0.036, 0.096],
} as const
/** a round ridge of gum at the sight edge, a groove, the swollen ring of the lip and a round of skin down to the wall */
const profile = FrameProfile.from([-0.005, imageDepth], mouth)
  .line(-0.005, -0.05)
  .arc(regions.gum[1], -0.05, 0.42, {steps: 8})
  .arc(regions.groove[1], -0.05, -0.35, {steps: 4})
  .arc(regions.lip[1], -0.048, 0.3, {steps: 10})
  .arc(0.112, -0.07, 0.35, {steps: 5})
  .line(0.112, frameBack)
  .line(-0.005, frameBack)
/** the teeth standing in the gum: where they root, how far they lean in over the work at rest, how many triangles each takes and how far apart they stand at least, and the shapes of the incisors and of the longer, pointed fangs between them */
const teeth = {
  reach: 0.007,
  root: -0.041,
  lean: 0.9,
  triangles: 6,
  spacing: 0.024,
  inset: 0.03,
  incisor: {
    width: 0.021,
    length: 0.028,
    tip: 0.34,
  },
  fang: {
    width: 0.019,
    length: 0.04,
    tip: 0.07,
  },
  /** every how many teeth along a member one is a fang */
  fangEvery: 6,
} as const
/**
 * A tooth standing in the gum at the origin of the top member, a chisel of six triangles: a crown `width` wide narrowing to its edge, `tip` of the width to either side of its middle, `length` long, leaning in over the work toward −y and toward the viewer, its root sunk into the gum. Its kind tells the member it stands on, and whether it is a fang, so its shader can find its root again.
 */
function tooth({width, length, tip}: ToothShape, kind: number) {
  const axis = new Vector3(0, -Math.cos(teeth.lean), Math.sin(teeth.lean))
  const face = new Vector3(0, Math.sin(teeth.lean), Math.cos(teeth.lean))
  const thickness = width * 0.5
  const root = axis.clone().multiplyScalar(-0.25 * length)
  const corner = (x: number, side: number) => root.clone().add(new Vector3(x, 0, 0)).addScaledVector(face, side * thickness / 2)
  const edge = (x: number) => axis.clone().multiplyScalar(length).add(new Vector3(x, 0, 0)).addScaledVector(face, thickness * 0.1)
  const points = [corner(-width / 2, 1), corner(width / 2, 1), corner(-width / 2, -1), corner(width / 2, -1), edge(-width * tip), edge(width * tip)]
  const middle = points.reduce((sum, point) => sum.add(point), new Vector3).divideScalar(points.length)
  const index: Array<number> = []
  // The front, the back and both sides, each turned to face away from the tooth’s middle; the root stays open in the gum.
  for (const triangle of [[0, 1, 5], [0, 5, 4], [3, 2, 4], [3, 4, 5], [2, 0, 4], [1, 3, 5]]) {
    const [a, b, c] = triangle.map(at => points[at])
    const normal = b.clone().sub(a).cross(c.clone().sub(a))
    const out = a.clone().add(b).add(c).divideScalar(3).sub(middle)
    index.push(...normal.dot(out) < 0 ? [triangle[0], triangle[2], triangle[1]] : triangle)
  }
  // Every corner shaded as if the crown were round about its axis, bulging toward the viewer, so the wedge reads as a tooth.
  const tipPoint = axis.clone().multiplyScalar(length)
  const normals = index.flatMap(at => {
    const point = points[at]
    const share = Math.min(1, Math.max(0, point.clone().sub(root).dot(axis) / tipPoint.clone().sub(root).dot(axis)))
    const onAxis = root.clone().lerp(tipPoint, share)
    return point.clone().sub(onAxis).normalize().addScaledVector(face, 0.6).addScaledVector(axis, share * 0.5).normalize().toArray()
  })
  const geometry = new BufferGeometry
  geometry.setAttribute('position', new Float32BufferAttribute(index.flatMap(at => points[at].toArray()), 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  return ornament(geometry, {kind})
}
/** The member a tooth stands on, from its kind, and whether it is a fang. */
const toothKind = () => {
  const kind = attribute<'vec4'>(frameShapeAttribute, 'vec4').x.sub(ornamentMember).round()
  return {
    member: kind.mod(4),
    isFang: kind.greaterThan(3.5),
  }
}
/** Where the tooth a point belongs to roots, in the frame’s space, from the point before any motion and its own coordinates turned like its member. */
const toothRoot = () => {
  const {member} = toothKind()
  const angle = member.mul(-Math.PI / 2)
  const own = uv()
  const turned = vec2(own.x.mul(angle.cos()).sub(own.y.mul(angle.sin())), own.x.mul(angle.sin()).add(own.y.mul(angle.cos())))
  return {
    root: vec3(positionGeometry.xy.sub(turned), teeth.root),
    run: vec2(angle.cos(), angle.sin()),
    out: vec2(angle.sin().negate(), angle.cos()),
  }
}
/**
 * The teeth moving, a vertex stage for {@link ToothMaterial}: a ripple runs round the mouth, the teeth leaning in and out as it passes; every few seconds they all bite down over the work at once and slowly let go; and those near the viewer rise from the gum and point at them, the nearer the more.
 */
function gnashing() {
  return Fn(() => {
    const {root, run, out} = toothRoot()
    const seed = hash(root.x.mul(37.1).add(root.y.mul(11.3)))
    const around = atan(root.y, root.x)
    const ripple = around.mul(7).sub(time.mul(1.6)).sin().mul(0.1)
    const phase = time.div(8.5).fract()
    const bite = phase.smoothstep(0, 0.05).mul(phase.smoothstep(0.4, 0.1)).mul(0.42)
    const tremble = time.mul(23).add(seed.mul(40)).sin().mul(0.02)
    const eye = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz
    const hunger = eye.sub(root).length().smoothstep(1.4, 0.6).mul(0.4)
    // Positive angles bite down over the work, negative ones raise the tooth toward the viewer.
    const angle = ripple.add(bite).add(tremble).sub(hunger)
    /** `v` in the frame’s space turned about the line the tooth roots along */
    const turn = (v: Vec3) => {
      const ownY = v.xy.dot(out)
      const y = ownY.mul(angle.cos()).sub(v.z.mul(angle.sin()))
      const z = ownY.mul(angle.sin()).add(v.z.mul(angle.cos()))
      return vec3(run.mul(v.xy.dot(run)).add(out.mul(y)), z)
    }
    normalLocal.assign(turn(normalLocal))
    return turn(positionLocal.sub(root)).add(root)
  })()
}

/** One of the Horror Orb’s frames: a mouth round the work, a ring of wet gums and teeth leaning in over it, behind them rows of smaller teeth and a swollen lip, the teeth rippling, biting down over the work and rising toward the viewer as they come near. */
export default class HorrorMawFrame extends PortraitFrame {
  override readonly description = 'A mouth gaping round the work: a ring of wet, raw gums with yellowed human teeth leaning in over its edge, every sixth a long fang, some rotten and one capped in gold, behind them a groove lined with rows of smaller, hooked teeth, then a swollen, cracked lip turning into pale skin down to the wall. A ripple keeps running round it, the teeth leaning in and out as it passes, every few seconds they all bite down over the work and slowly let go, and as the viewer comes near, the teeth closest to them rise from the gum and point at them.'
  override readonly front = 0
  override readonly imageDepth = imageDepth
  override readonly impactSound = 'hardwood'
  override readonly reach = profile.reach
  override readonly tint = '#8a3436'
  override readonly title = 'Maw'

  override createGeometry(width: number, height: number) {
    const halfWidth = width / 2
    const halfHeight = height / 2
    const moulding = sweepProfile(profile, halfWidth, halfHeight)
    // As many teeth as the triangles the moulding leaves.
    const left = frameTriangleBudget - moulding.values().reduce((sum, part) => sum + part.getAttribute('position').count / 3, 0)
    const spots = along(halfWidth, halfHeight, teeth.reach, teeth.root, {
      spacing: teeth.spacing,
      inset: teeth.inset,
      limit: Math.floor(left / teeth.triangles),
    })
    const byMember = Map.groupBy(spots, ({angle = 0}) => Math.round(-angle / (Math.PI / 2)))
    const parts = [...byMember].flatMap(([member, own]) => {
      const isFang = (index: number) => index % teeth.fangEvery === Math.floor(teeth.fangEvery / 2)
      const fangs: Array<Placement> = own.filter((_, index) => isFang(index))
      const incisors: Array<Placement> = own.filter((_, index) => !isFang(index))
      return [
        [enamel, incisors.length > 0 ? place(tooth(teeth.incisor, member), incisors) : undefined] as const,
        [enamel, fangs.length > 0 ? place(tooth(teeth.fang, member + 4), fangs) : undefined] as const,
      ]
    })
    return assembleFrame([...moulding, ...parts])
  }

  protected override createMaterials() {
    return [new FleshMaterial, new ToothMaterial]
  }
}

/**
 * The flesh of the mouth: raw, lumpy gums at the sight edge, stippled and veined, with sores; a dark, wet groove behind them lined with two staggered rows of small hooked teeth pointing in, each its own size; then the swollen lip, deep red and wet inside, dry and cracked across toward its outer edge, where it turns into pale, mottled, stubbled skin down to the wall. A flush keeps running round it with the teeth’s ripple.
 */
class FleshMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      envMap: frameStudio,
      envMapIntensity: 0.35,
      clearcoat: 1,
      sheen: 0.3,
      sheenRoughness: 0.5,
      sheenColor: '#c06070',
    })
    const surface = frameSurface()
    const p = surface.position
    const footprint = max(p.x.fwidth(), p.y.fwidth()).max(p.z.fwidth()).toVar('mawFootprint')
    const r = surface.reach
    const around = atan(p.y, p.x)
    const flush = around.mul(7).sub(time.mul(1.6)).sin().mul(0.5).add(0.5).toVar('mawFlush')
    const inner = band(surface, regions.gum[0], regions.groove[1]).inside
    const groove = band(surface, ...regions.groove).inside
    const lipShare = r.smoothstep(regions.lip[0] + 0.02, regions.lip[1])
    const skinShare = r.smoothstep(0.088, 0.097)
    // Lumps and stippling all over the wet flesh, veins under it, and sores, pale with red rims.
    const swelling = mx_noise_float(p.mul(45)).mul(0.5).add(0.5)
    const lumps = mx_noise_float(p.mul(140)).mul(0.6).add(mx_noise_float(p.mul(330)).mul(0.4))
    const stipple = mx_noise_float(p.mul(1200)).smoothstep(0.2, 0.7).mul(visibleDetail(footprint, 0.0008))
    const warp = vec3(mx_noise_float(p.mul(30)), mx_noise_float(p.mul(30).add(5.1)), 0).mul(0.6)
    const veins = line(mx_noise_float(p.mul(45).add(warp)), 0.025).mul(visibleDetail(footprint, 0.0015)).mul(skinShare.oneMinus())
    const soreCell = mx_noise_float(p.mul(80).add(vec3(0, 3.3, 0)))
    const sore = soreCell.smoothstep(0.66, 0.72).mul(skinShare.oneMinus())
    const soreRim = soreCell.smoothstep(0.52, 0.66).mul(sore.oneMinus()).mul(skinShare.oneMinus())
    const gum = mix(mix(color('#7e2230'), color('#b4485a'), lumps.mul(0.5).add(0.5).mul(surface.cavity.smoothstep(0.4, -0.5).mul(0.6).add(0.4))), color('#4a0c22'), veins.mul(0.45))
    const raw = mix(mix(gum, color('#5a0a16'), soreRim.mul(0.7)), color('#d0b870'), sore.mul(0.85))
    // Behind the gum, rows of smaller teeth pointing in, staggered, each its own size, some crooked, some gone.
    const rows = band(surface, ...regions.rows)
    const small = (from: number, to: number, period: number, shift: number) => {
      const run = surface.along.div(period).add(shift)
      const id = run.floor().add(surface.member.mul(97)).add(shift * 13)
      const size = hash(id).mul(0.5).add(0.6)
      const lost = hash(id.add(3)).lessThan(0.15)
      const lean = hash(id.add(2)).sub(0.5).mul(0.7)
      // In meters from where the tooth leaves the gum, at its outer end, toward its tip.
      const across = run.fract().sub(0.5).add(hash(id.add(1)).sub(0.5).mul(0.25)).mul(period)
      const down = float(to).sub(r)
      const turned = vec2(across.mul(lean.cos()).sub(down.mul(lean.sin())), across.mul(lean.sin()).add(down.mul(lean.cos())))
      const reach = size.mul(to - from)
      // A crown tapering from its root to a rounded tip.
      const t = turned.y.div(reach).clamp(0, 1)
      const radius = mix(float(period * 0.42), float(period * 0.2), t).mul(size)
      const shape = vec2(turned.x, turned.y.sub(t.mul(reach))).length().sub(radius)
      return {
        cover: select(lost, float(0), inside(shape)).mul(rows.inside),
        height: shape.negate().div(radius).clamp(0, 1).sqrt(),
        root: t.oneMinus(),
      }
    }
    const front = small(0.036, 0.047, 0.0085, 0)
    const back = small(0.045, 0.057, 0.0105, 0.5)
    const smallTeeth = front.cover.max(back.cover).mul(visibleDetail(footprint, 0.003))
    const smallRoot = select(front.cover.greaterThan(0.5), front.root, back.root)
    // The lip: deep red and wet inside, dry and cracked across toward its outer edge.
    // Wrinkles running across the lip, irregular, deeper toward its dry outer edge.
    const cracks = line(mx_noise_float(vec3(surface.along.mul(170), r.mul(18), surface.member.add(2.2))), 0.07).mul(lipShare.smoothstep(0.2, 0.8)).mul(skinShare.oneMinus()).mul(visibleDetail(footprint, 0.0015))
    const flakes = mx_noise_float(p.mul(700)).smoothstep(0.45, 0.7).mul(lipShare.smoothstep(0.5, 1)).mul(skinShare.oneMinus()).mul(visibleDetail(footprint, 0.001))
    const lip = mix(mix(mix(color('#6e1622'), color('#a8404c'), lumps.mul(0.5).add(0.5).mul(surface.cavity.smoothstep(0.3, -0.6))), color('#9a5a5e'), lipShare.mul(0.5)), color('#d0a8a0'), flakes.mul(0.5))
    // The skin, pale and mottled, blue round its veins, stubbled.
    const stubble = mx_noise_float(p.mul(1400)).smoothstep(0.6, 0.75).mul(visibleDetail(footprint, 0.0008))
    const mottle = mx_noise_float(p.mul(25)).mul(0.5).add(0.5)
    const skinVeins = line(mx_noise_float(p.mul(70).add(warp)), 0.02).mul(skinShare).mul(visibleDetail(footprint, 0.002)).mul(mx_noise_float(p.mul(12)).smoothstep(0, 0.5))
    const skin = mix(mix(mix(color('#8e6e72'), color('#5e4a5a'), mottle.mul(0.8)), color('#4a3a58'), skinVeins.mul(0.3)), color('#2a2224'), stubble.mul(0.5))
    const tissue = mix(mix(mix(lip, raw, inner), color('#24040a'), groove.mul(surface.cavity.smoothstep(0, 0.7)).mul(0.75)), skin, skinShare)
    const flushed = mix(tissue, tissue.mul(vec3(1.2, 0.75, 0.82)), flush.mul(0.4).mul(skinShare.oneMinus()))
    const smallEnamel = mix(color('#b8a070'), color('#4a3418'), smallRoot.smoothstep(0.5, 1))
    const wet = float(1).sub(lipShare.mul(0.75)).sub(skinShare).max(0)
    this.colorNode = mix(mix(flushed, smallEnamel, smallTeeth), color('#2a0a10'), cracks.mul(0.7))
    this.roughnessNode = mix(mix(float(0.4), float(0.65), lipShare), float(0.75), skinShare).add(stipple.mul(0.1))
    this.clearcoatNode = wet.mul(flush.mul(0.3).add(0.6))
    this.clearcoatRoughnessNode = mix(float(0.1), float(0.4), lumps.mul(0.5).add(0.5)).add(lipShare.mul(0.3))
    this.sheenNode = skinShare.oneMinus().mul(0.5)
    this.normalNode = heightNormal(swelling.mul(0.0015).add(lumps.mul(0.0008)).mul(skinShare.mul(-0.7).add(1)).add(front.height.mul(front.cover).max(back.height.mul(back.cover)).mul(0.0008).mul(visibleDetail(footprint, 0.003))).sub(cracks.mul(0.0002)).add(sore.mul(0.0002)).sub(veins.mul(0.00004)).add(stipple.mul(0.00002)).add(stubble.mul(0.00002)).add(flakes.mul(0.00004)))
  }
}
/**
 * The teeth: yellowed enamel, browner and crusted with tartar toward the gum, gray and translucent at the edge, finely crazed, bloody where they leave the gum; a few rotten, holed and black, and one in a while capped in gold. They move by {@link gnashing}.
 */
class ToothMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      envMap: frameStudio,
      envMapIntensity: 0.7,
      clearcoat: 0.7,
      clearcoatRoughness: 0.15,
    })
    this.positionNode = gnashing()
    const p = positionGeometry
    const footprint = max(p.x.fwidth(), p.y.fwidth()).max(p.z.fwidth())
    const {isFang} = toothKind()
    const {root} = toothRoot()
    const seed = hash(root.x.mul(37.1).add(root.y.mul(11.3)))
    const own = uv()
    // From 0 at the gum to 1 at the edge.
    const reach = select(isFang, float(teeth.fang.length), float(teeth.incisor.length)).mul(Math.cos(teeth.lean))
    const toward = own.y.negate().add(reach.mul(0.15)).div(reach.mul(1.1)).clamp(0, 1)
    const rotten = seed.lessThan(0.12)
    const gold = seed.greaterThan(0.985)
    const decay = select(rotten, mx_noise_float(vec3(own.mul(400), seed.mul(9))).smoothstep(-0.2, 0.3), float(0))
    const crazing = line(mx_noise_float(vec3(own.x.mul(500), own.y.mul(140), seed.mul(5))), 0.04).mul(visibleDetail(footprint, 0.0008))
    const shade = mix(color('#d2bf8c'), color('#a88a50'), seed.mul(1.6).fract())
    const base = mix(mix(color('#5e4824'), shade, toward.smoothstep(0.08, 0.5)), color('#bcbab0'), toward.smoothstep(0.85, 1).mul(0.5))
    const tartar = toward.smoothstep(0.2, 0.05)
    const bloody = toward.smoothstep(0.24, 0.1).mul(0.6)
    const stained = mix(mix(mix(base, color('#5e5a2a'), tartar.mul(0.6)), color('#6e0c0a'), bloody.mul(0.7)), color('#1a0e06'), decay)
    this.colorNode = select(gold, mix(color('#d8aa48'), color('#7a5a1e'), tartar), mix(stained, stained.mul(0.7), crazing))
    this.metalnessNode = select(gold, float(1), float(0))
    this.roughnessNode = select(gold, float(0.22), mix(float(0.3), float(0.8), decay.max(tartar.mul(0.6))))
    this.normalNode = heightNormal(decay.mul(-0.0004).sub(crazing.mul(0.00004)))
  }
}

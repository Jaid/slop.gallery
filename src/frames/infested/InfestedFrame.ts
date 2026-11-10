import type {FrameSurface} from '../lib/materials/frameAttributes.ts'
import type {Node} from 'three/webgpu'

import {atan, cameraPosition, color, float, hash, max, min, mix, modelWorldMatrixInverse, mx_noise_float, mx_worley_noise_float, mx_worley_noise_vec2, select, time, vec2, vec3, vec4} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {heightNormal, inside, line, visibleDetail} from '#src/lib/materials/filters.ts'

import PortraitFrame, {frameBack} from '../base/PortraitFrame.ts'
import {assembleFrame, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import {band} from '../lib/materials/carving.ts'
import {frameSurface} from '../lib/materials/frameAttributes.ts'
import frameStudio from '../lib/materials/frameStudio.ts'

type Float = Node<'float'>
type Vec2 = Node<'vec2'>

const imageDepth = -0.058
/** the broad face the cockroaches run over, and the hollow beyond it where maggots writhe */
const face = {
  from: 0.014,
  to: 0.084,
}
const hollow = {
  from: 0.084,
  to: 0.098,
}
/** a bead at the sight edge, the broad, barely rounded face, a hollow and a round down to the wall */
const profile = FrameProfile.from([-0.005, imageDepth])
  .line(-0.005, -0.046)
  .arc(0.01, -0.046, 0.4, {steps: 6})
  .line(face.from, -0.042)
  .arc(face.to, -0.042, 0.08, {steps: 10})
  .arc(hollow.to, -0.046, -0.4, {steps: 6})
  .arc(0.114, -0.07, 0.35, {steps: 6})
  .line(0.114, frameBack)
  .line(-0.005, frameBack)
/** the cockroaches: how long a stretch of the face each has to itself, how many stretches have one, how far each darts from its hole and how near the viewer may come before they flee */
const roaches = {
  stretch: 0.14,
  share: 0.7,
  roam: 0.03,
  flee: [0.8, 1.3],
}
/** The distance from `p` to the segment from `a` to `b`. */
function segment(p: Vec2, a: Vec2, b: Vec2): Float {
  const ba = b.sub(a)
  const pa = p.sub(a)
  return pa.sub(ba.mul(pa.dot(ba).div(ba.dot(ba)).clamp(0, 1))).length()
}
/** `v` turned by `angle`. */
function rotate(v: Vec2, angle: Float): Vec2 {
  return vec2(v.x.mul(angle.cos()).sub(v.y.mul(angle.sin())), v.x.mul(angle.sin()).add(v.y.mul(angle.cos())))
}
/** Where a point `along` meters along the point’s member and `out` meters out past the opening lies in the frame’s plane. */
function onMember(surface: FrameSurface, along: Float, out: Float): Vec2 {
  const side = surface.member.round()
  const {x: halfWidth, y: halfHeight} = surface.opening
  return select(side.equal(0), vec2(along, halfHeight.add(out)), select(side.equal(1), vec2(halfWidth.add(out), along.negate()), select(side.equal(2), vec2(along.negate(), halfHeight.add(out).negate()), vec2(halfWidth.add(out).negate(), along))))
}
/**
 * A cockroach seen from above at `q`, in meters, its head toward +x: the glossy wings over its abdomen split down the middle, the shield behind its head with its pale rim, six legs stepping in a tripod gait while it runs and two long antennae twitching. Returns how much of it covers the point, which part, its relief and the shadow it casts round it.
 */
function cockroach(q: Vec2, stride: Float, twitch: Float, size: Float) {
  const abdomen = vec2(q.x.add(0.003).div(0.011), q.y.div(0.0058)).length().sub(1).mul(0.0058)
  const shield = vec2(q.x.sub(0.0075).div(0.0042), q.y.div(0.0052)).length().sub(1).mul(0.0042)
  const head = q.sub(vec2(0.0118, 0)).length().sub(0.0022)
  const body = min(abdomen, min(shield, head))
  const mirrored = vec2(q.x, q.y.abs())
  let legs: Float = float(1)
  for (const [index, [x, angle, length]] of [[0.005, 0.85, 0.008], [0, 1.65, 0.009], [-0.004, 2.35, 0.012]].entries()) {
    // Each side steps in a tripod: the front and hind legs of one side with the middle one of the other.
    const step = stride.mul(index === 1 ? -1 : 1).mul(q.y.sign())
    const swing = float(angle).add(step.mul(0.35))
    const root = vec2(x, 0.004)
    const knee = root.add(vec2(swing.cos(), swing.sin()).mul(length * 0.45))
    const foot = knee.add(vec2(swing.add(0.45).cos(), swing.add(0.45).sin()).mul(length * 0.6))
    legs = min(legs, min(segment(mirrored, root, knee).sub(0.0007), segment(mirrored, knee, foot).sub(0.0005)))
  }
  let antennae: Float = float(1)
  for (const side of [-1, 1]) {
    let at: Vec2 = vec2(0.013, side * 0.001)
    let heading: Float = float(side * 0.25).add(twitch.mul(side * 0.3))
    for (let piece = 0; piece < 3; piece++) {
      const next = at.add(vec2(heading.cos(), heading.sin()).mul(0.007))
      antennae = min(antennae, segment(q, at, next))
      at = next
      heading = heading.add(twitch.mul(0.15 * side).add(side * 0.22))
    }
  }
  const cover = inside(body.mul(size))
  const limbs = inside(legs.mul(size)).max(line(antennae.mul(size), 0.00012)).mul(cover.oneMinus())
  const dome = abdomen.negate().div(0.0058).clamp(0, 1).sqrt().mul(0.0018).max(shield.negate().div(0.0042).clamp(0, 1).sqrt().mul(0.0014))
  return {
    cover,
    limbs,
    shield: inside(shield.mul(size)).mul(inside(abdomen.mul(size)).oneMinus().max(0.3)),
    rim: inside(shield.mul(size)).mul(shield.negate().smoothstep(0.0012, 0)),
    seam: line(q.y.mul(size), 0.00015).mul(q.x.lessThan(0.0035).select(float(1), float(0))).mul(inside(abdomen.mul(size))),
    height: dome.mul(size).mul(cover),
    shadow: body.mul(size).max(0).div(-0.0025).exp().mul(cover.oneMinus()),
  }
}

/** One of the Horror Orb’s frames: rotten wood gnawed through with bore holes, crawling with cockroaches that dart about and scatter into their holes when the viewer comes near, maggots writhing in its hollow. */
export default class InfestedFrame extends PortraitFrame {
  override readonly description = 'A frame left to rot: soft wood gone dark and spongy, split into cubes across its grain, riddled with bore holes and the tunnels of beetles, pale frass spilling out of them, cockroaches darting about its face and freezing, antennae twitching, until the viewer comes near, when they scatter into their holes, one after another, to creep back out once the viewer moves on, and maggots writhing in the hollow round it.'
  override readonly front = profile.front
  override readonly imageDepth = imageDepth
  override readonly impactSound = 'hardwood'
  override readonly reach = profile.reach
  override readonly tint = '#3b2a1c'
  override readonly title = 'Infested'

  override createGeometry(width: number, height: number) {
    return assembleFrame([...sweepProfile(profile, width / 2, height / 2)])
  }

  protected override createMaterials() {
    return [new InfestedMaterial]
  }
}

/**
 * The rotten wood with all that lives in it. Every stretch of the face may hold a cockroach with a hole of its own: it darts from spot to spot round the hole every second or two and freezes between, and when the viewer comes nearer than it can bear, each at its own distance, it runs into its hole and vanishes, coming out again as the viewer moves away. Maggots writhe in clusters in the hollow.
 */
class InfestedMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      envMap: frameStudio,
      envMapIntensity: 0.35,
      clearcoat: 0.3,
      clearcoatRoughness: 0.3,
    })
    const surface = frameSurface()
    const p = surface.position
    const footprint = max(p.x.fwidth(), p.y.fwidth()).max(p.z.fwidth()).toVar('rotFootprint')
    const plane = vec2(surface.along, surface.reach)
    // Rot: dark, spongy wood, split into cubes across its grain, bored through and tunneled, frass spilling round the holes.
    const grain = mx_noise_float(vec3(surface.along.mul(5), surface.across.mul(240), surface.member)).mul(0.5).add(0.5)
    const checks = mx_worley_noise_vec2(vec3(surface.along.mul(40), surface.across.mul(110), surface.member.mul(3.1)).add(mx_noise_float(p.mul(30)).mul(0.4)))
    const rotten = mx_noise_float(p.mul(7).add(vec3(3.3, 0, 1.1))).mul(0.5).add(0.5).add(surface.cavity.mul(0.2)).smoothstep(0.4, 0.65)
    const blocks = checks.y.sub(checks.x).smoothstep(0.09, 0.01).mul(visibleDetail(footprint, 0.003)).mul(rotten)
    const bores = mx_worley_noise_float(p.mul(90)).smoothstep(0.12, 0.07).mul(rotten.mul(0.7).add(0.3))
    const frass = mx_noise_float(p.mul(1600)).smoothstep(0.35, 0.6).mul(mx_worley_noise_float(p.mul(140)).smoothstep(0.32, 0.14)).mul(bores.oneMinus()).mul(visibleDetail(footprint, 0.0012))
    const tunnels = line(mx_noise_float(p.mul(28).add(vec3(4.4, 0, 0))), 0.035).mul(mx_noise_float(p.mul(6)).smoothstep(0, 0.4)).mul(visibleDetail(footprint, 0.002))
    const damp = mx_noise_float(p.mul(8)).mul(0.5).add(0.5).add(surface.cavity.mul(0.3))
    const sound = mix(color('#5a3c22'), color('#2e1e10'), grain.mul(0.6).add(damp.mul(0.4)))
    const decayed = mix(color('#6e5034'), color('#3a2614'), mx_noise_float(p.mul(160)).mul(0.5).add(0.5))
    const mycelium = mx_noise_float(p.mul(60).add(vec3(0, 9.1, 0))).smoothstep(0.45, 0.8).mul(rotten).mul(surface.cavity.smoothstep(-0.2, 0.6).mul(0.6).add(0.2))
    const wood = mix(mix(mix(sound, decayed, rotten.mul(0.7)), color('#cfc4ae'), mycelium.mul(0.35)), color('#140c06'), blocks.mul(0.85).max(tunnels.mul(0.7)))
    // The cockroaches, each in its own stretch of the face.
    const stretch = surface.along.div(roaches.stretch).floor()
    const id = stretch.mul(37.1).add(surface.member.mul(11.3))
    const home = vec2(stretch.add(0.5).mul(roaches.stretch).add(hash(id.add(1)).sub(0.5).mul(0.01)), hash(id.add(2)).mul(0.018).add(0.04))
    // A roach keeps off the miters, where the next member would cut it off.
    const there = hash(id).lessThan(roaches.share).and(home.x.abs().add(roaches.stretch / 2 + 0.005).lessThan(surface.openingHalf.add(face.from))).and(surface.isOrnament.lessThan(0.5))
    const target = (step: Float) => home.add(vec2(hash(step.mul(1.7).add(id)).sub(0.5).mul(roaches.roam * 2), hash(step.mul(2.3).add(id).add(0.5)).sub(0.5).mul(0.016)))
    const pace = hash(id.add(3)).mul(1.4).add(1.1)
    const clock = time.div(pace).add(hash(id.add(4)).mul(10))
    const step = clock.floor()
    const dash = clock.fract().smoothstep(0, 0.18)
    const from = target(step.sub(1))
    const to = target(step)
    const walking = mix(from, to, dash)
    const way = to.sub(from)
    const heading = atan(way.y, way.x)
    // The nearer the viewer, the farther into its hole, each roach bearing a distance of its own.
    const eye = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz
    const distance = eye.sub(vec3(onMember(surface, home.x, home.y), -0.04)).length()
    const bearable = hash(id.add(5)).mul(roaches.flee[1] - roaches.flee[0]).add(roaches.flee[0])
    const fright = distance.smoothstep(bearable, bearable.sub(0.45))
    const at = mix(walking, home, fright.smoothstep(0, 0.65))
    const size = float(1).sub(fright.smoothstep(0.6, 1)).max(0.04)
    const running = dash.greaterThan(0).and(dash.lessThan(1)).or(fright.greaterThan(0.02).and(fright.lessThan(0.98)))
    const stride = select(running, time.mul(34).add(hash(id.add(6)).mul(6)).sin(), float(0))
    const twitch = time.mul(hash(id.add(7)).mul(3).add(5)).add(id).sin().mul(mx_noise_float(vec3(time.mul(2), id, 0.3)).mul(0.5).add(0.5))
    const q = rotate(plane.sub(at), heading.negate()).div(size)
    const roach = cockroach(q, stride, twitch, size)
    const shown = select(there, size.greaterThan(0.05).select(float(1), float(0)), float(0))
    const hole = select(there, inside(plane.sub(home).length().sub(0.0042)), float(0))
    const holeRim = select(there, plane.sub(home).length().sub(0.0042).abs().smoothstep(0.0025, 0), float(0)).mul(hole.oneMinus())
    const chitin = mix(mix(color('#3a1608'), color('#4a1e0a'), roach.shield), color('#8a5422'), roach.rim.mul(0.7))
    const roachColor = mix(chitin, color('#140804'), roach.seam)
    // The maggots, writhing in clusters in the hollow.
    const inHollow = band(surface, hollow.from, hollow.to)
    const cluster = mx_noise_float(vec3(surface.along.mul(14), surface.member, 0.7)).smoothstep(0.2, 0.45).mul(inHollow.inside)
    const maggotCell = surface.along.div(0.0045)
    const maggotId = maggotCell.floor().add(surface.member.mul(500))
    const maggotAt = vec2(maggotCell.fract().sub(0.5).mul(0.0045).add(time.mul(0.6).add(maggotId).sin().mul(0.0006)), inHollow.t.sub(hash(maggotId).mul(0.5).add(0.25)).mul(hollow.to - hollow.from))
    const wriggle = maggotAt.x.mul(900).add(time.mul(hash(maggotId.add(1)).mul(4).add(5))).sin().mul(0.0007)
    const maggotTurned = rotate(maggotAt, hash(maggotId.add(2)).sub(0.5).mul(1.2).add(Math.PI / 2))
    const maggotShape = vec2(maggotTurned.x.div(0.0029), maggotTurned.y.add(wriggle).div(0.0011)).length().sub(1).mul(0.0011)
    const maggot = inside(maggotShape).mul(cluster).mul(hash(maggotId.add(3)).lessThan(0.7).select(float(1), float(0)))
    const rings = maggotTurned.x.mul(2400).sin().mul(0.5).add(0.5).mul(visibleDetail(footprint, 0.0006))
    const maggotColor = mix(color('#dccca0'), color('#a8966c'), rings.mul(0.4))
    const bugs = roach.cover.mul(shown)
    const legs = roach.limbs.mul(shown)
    const ground = mix(mix(wood, color('#050302'), bores.max(hole).mul(0.9)), color('#b8a07a'), frass.mul(0.6))
    const shaded = mix(ground, ground.mul(0.45), roach.shadow.mul(shown).mul(0.8).max(holeRim.mul(0.4))).mul(cluster.mul(0.4).oneMinus())
    this.colorNode = mix(mix(mix(shaded, maggotColor, maggot), color('#2a140a'), legs), roachColor, bugs)
    // Chitin is glossy but dark; a full specular share would gray it over in the frames’ bright studio.
    this.specularIntensityNode = float(1).sub(bugs.mul(0.65))
    this.roughnessNode = mix(mix(float(0.85), float(0.35), maggot), float(0.26), bugs)
    this.clearcoatNode = bugs.mul(0.12).add(maggot.mul(0.4)).add(damp.smoothstep(0.7, 0.9).mul(0.1))
    this.normalNode = heightNormal(roach.height.mul(shown).add(legs.mul(0.0002)).add(maggot.mul(0.0007)).sub(bores.max(hole).mul(0.0012)).sub(blocks.mul(0.0003)).sub(tunnels.mul(0.0002)).add(frass.mul(0.00008)).add(grain.mul(0.00004)))
  }
}

import type {FrameSurface} from '#src/lib/materials/frames/frameAttributes.ts'
import type {Metal} from '#src/lib/materials/frames/FrameMetalMaterial.ts'
import type {Node} from 'three/webgpu'

import {color, float, hash, max, mix, mx_noise_float, select, time, vec2, vec3} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {heightNormal, inside, line, visibleDetail} from '#src/lib/materials/filters.ts'
import {band} from '#src/lib/materials/frames/carving.ts'
import {frameSurface} from '#src/lib/materials/frames/frameAttributes.ts'
import FrameMetalMaterial from '#src/lib/materials/frames/FrameMetalMaterial.ts'
import frameStudio from '#src/lib/materials/frames/frameStudio.ts'

import PortraitFrame, {frameBack} from './base/PortraitFrame.ts'
import {along, assembleFrame, corners, place, sweepProfile} from './frameGeometry.ts'
import FrameProfile from './FrameProfile.ts'
import {dome, relief} from './ornaments.ts'

type Float = Node<'float'>
type Vec2 = Node<'vec2'>

const imageDepth = -0.056
const lid = 0
const brass = 1
/** the quilted satin lining round the work, and the bare boards of the lid beyond it */
const satin = {
  from: -0.005,
  to: 0.059,
}
const boards = {
  from: 0.062,
  to: 0.1,
  z: -0.034,
}
/** a puffed cushion of satin from the sight edge, tucked in at the lid’s edge, a step up to the flat boards and a worn round down to the wall */
const profile = FrameProfile.from([satin.from, imageDepth], lid)
  .line(satin.from, -0.047)
  .arc(satin.to - 0.001, -0.047, 0.12, {steps: 10})
  .line(satin.to + 0.001, -0.05)
  .line(boards.from, boards.z)
  .line(boards.to, boards.z)
  .arc(0.112, -0.046, 0.3, {steps: 5})
  .line(0.112, frameBack)
  .line(satin.from, frameBack)
/** the brass corner brackets on the boards, their outer corner at `reach` on both members, and how thick they are */
const bracket = {
  reach: 0.098,
  depth: 0.0025,
  bevel: 0.0008,
}
/** the screw heads along the boards between the brackets: how large, how far apart at least and at most how many */
const screw = {
  radius: 0.0042,
  height: 0.0024,
  spacing: 0.24,
  inset: 0.088,
  limit: 24,
}
/** the bosses on the brackets’ corners */
const boss = {
  radius: 0.0075,
  height: 0.004,
}
/** how long a stretch of the lid each clawing starts in: every scratch stays within it and the next, so a point only needs to look at its own stretch and the two beside it */
const clawCell = 0.1
/** how often the clawing comes in a fit, in seconds, and how long one finger’s scratch takes to draw */
const frenzy = {
  period: 14,
  stroke: 0.5,
}
/** brass gone brown and dull in the damp, green in its hollows */
const tarnishedBrass: Metal = {
  bright: '#7e6634',
  dull: '#3a2c16',
  roughness: 0.55,
  patina: {
    amount: 0.85,
    color: '#3e5a40',
  },
  texture: 0.00002,
}
/** The bracket on the top right corner, its outer corner at the origin: two arms along the members, each ending in a spade. */
function bracketOutline() {
  const arm = [[0, 0], [-0.058, 0], [-0.066, -0.003], [-0.08, -0.014], [-0.066, -0.025], [-0.058, -0.028], [-0.04, -0.022]] as const
  const mirrored = arm.slice(1).toReversed().map(([x, y]) => [y, x] as const)
  return [...arm, [-0.022, -0.022] as const, ...mirrored]
}
/**
 * One fit of clawing in a stretch of the lid, {@link clawCell} along the member: three or four fingers dragged side by side across it in a curve, the middle ones reaching farthest, each scratch deep where the nail dug in and thinning as it dragged on. Some cells were clawed long ago and keep their scratches; the others are clawed anew in some of the fits, the scratch tearing along behind the nail, fresh and bloody, then darkening, and fading out over the next fit unless it is clawed again.
 * Returns how deep the scratches are at the point, how fresh they are, and the broken nails left in some of their ends.
 */
function clawing(surface: FrameSurface, plane: Vec2, index: Float, footprint: Float) {
  const id = index.mul(31.7).add(surface.member.mul(7.3))
  const start = vec2(index.add(hash(id).mul(0.5).add(0.25)).mul(clawCell), hash(id.add(1)).mul(0.09).add(0.002))
  const angle = hash(id.add(2)).mul(Math.PI * 2)
  const direction = vec2(angle.cos(), angle.sin())
  const offset = plane.sub(start)
  const ahead = offset.dot(direction)
  const aside = offset.dot(vec2(direction.y.negate(), direction.x))
  const length = hash(id.add(3)).mul(0.045).add(0.045)
  const bend = hash(id.add(4)).sub(0.5).mul(0.7)
  const fingers = select(hash(id.add(5)).lessThan(0.3), float(3), float(4))
  const spacing = hash(id.add(6)).mul(0.002).add(0.005)
  // The clawing of this fit and of the last, which fades over this one.
  const fit = time.div(frenzy.period)
  const round = fit.floor()
  const within = fit.fract()
  const isLive = hash(id.add(7)).lessThan(0.4)
  const slot = hash(id.add(8)).mul(0.18)
  const now = hash(id.add(round.mul(13.1))).lessThan(0.45).and(isLive)
  const before = hash(id.add(round.sub(1).mul(13.1))).lessThan(0.45).and(isLive)
  const progress = select(now, within.sub(slot).div(frenzy.stroke / frenzy.period).clamp(0, 1), float(0))
  const lingering = select(before, within.smoothstep(0.85, 0.35), float(0))
  const curve = ahead.div(length).clamp(0, 1)
  const drift = curve.mul(curve).mul(bend).mul(length)
  let depth: Float = float(0)
  let nails: Float = float(0)
  for (let finger = 0; finger < 4; finger++) {
    const lane = finger - 1.5
    const reach = length.mul(1 - Math.abs(lane) * 0.12)
    const dragged = ahead.add(Math.abs(lane) * 0.004)
    const width = dragged.div(reach).clamp(0, 1).mul(-0.6).add(1)
    // The nail skips and judders as it drags.
    const judder = mx_noise_float(vec3(dragged.mul(500), id, finger)).mul(0.0004)
    const groove = line(aside.sub(drift).sub(spacing.mul(lane * (1 + finger % 2 * 0.15))).sub(judder), 0.0011).mul(width).mul(dragged.smoothstep(0, 0.002)).mul(dragged.smoothstep(reach, reach.sub(0.004)))
    const tip = progress.mul(reach)
    const drawn = select(progress.greaterThan(0), dragged.smoothstep(tip, tip.sub(0.0015)), float(0))
    const shown = select(isLive, drawn.max(lingering), float(1))
    const exists = finger < 3 ? float(1) : select(fingers.greaterThan(3.5), float(1), float(0))
    depth = depth.max(groove.mul(shown).mul(exists))
    const nail = inside(vec2(dragged.sub(reach), aside.sub(drift).sub(spacing.mul(lane))).length().sub(0.0013)).mul(hash(id.add(9 + finger)).lessThan(0.2).select(float(1), float(0))).mul(exists).mul(select(isLive, lingering, float(1)))
    nails = nails.max(nail)
  }
  const fresh = select(now.and(within.greaterThan(slot)), within.smoothstep(slot.add(0.4), slot.add(frenzy.stroke / frenzy.period)), float(0))
  return {
    depth,
    fresh,
    nails: nails.mul(visibleDetail(footprint, 0.002)),
  }
}

/** One of the Halloween Orb’s frames: the inside of a coffin’s lid, its satin lining quilted round the work and its bare boards clawed all over by someone buried alive, the scratches still tearing open in fits. */
export default class HalloweenCoffinFrame extends PortraitFrame {
  override readonly description = 'The inside of a coffin’s lid: quilted ivory satin buttoned round the work, yellowed and stained, then bare pine boards held by tarnished brass brackets and screws, the satin torn to shreds and the boards scored all over by fingernails, three or four scratches side by side, a broken nail left in the end of some, and every few seconds a fit of clawing tears new scratches open, pale and bloody, as if someone were still in there.'
  override readonly front = boards.z + bracket.depth + boss.height
  override readonly imageDepth = imageDepth
  override readonly impactSound = 'hardwood'
  override readonly reach = profile.reach
  override readonly tint = '#6a4c32'
  override readonly title = 'Buried alive'

  override createGeometry(width: number, height: number) {
    const halfWidth = width / 2
    const halfHeight = height / 2
    const brackets = corners(halfWidth, halfHeight, bracket.reach, boards.z)
    const bosses = corners(halfWidth, halfHeight, bracket.reach - 0.015, boards.z + bracket.depth)
    const screws = along(halfWidth, halfHeight, (boards.from + boards.to) / 2, boards.z, {
      spacing: screw.spacing,
      inset: screw.inset,
      limit: screw.limit,
    })
    return assembleFrame([
      ...sweepProfile(profile, halfWidth, halfHeight),
      [brass, place(relief(bracketOutline(), bracket.depth, {bevel: bracket.bevel}), brackets)],
      [brass, place(dome(boss.radius, boss.height, {
        segments: 10,
        kind: 2,
      }), bosses)],
      [brass, place(dome(screw.radius, screw.height, {
        rings: 2,
        kind: 1,
      }), screws)],
    ])
  }

  protected override createMaterials() {
    return [
      new LidMaterial,
      new FrameMetalMaterial({
        metal: tarnishedBrass,
        finish: surface => {
          // A slot across every screw head, and the brackets dark in their pierced middles.
          const isScrew = surface.member.sub(4).round().equal(1)
          const slot = select(isScrew, line(surface.along.add(surface.across.mul(0.4)), 0.0005), float(0))
          return {
            brightness: slot.oneMinus().mul(0.75),
            height: slot.mul(-0.0004),
            hollow: slot,
          }
        },
      }),
    ]
  }
}
/**
 * The lid: ivory satin quilted in buttoned diamonds round the work, yellowed, stained brown in tide-marked blotches and freckled with mildew, then bare pine boards gone dark and damp. Fingernails have scored both all over, tearing the satin to dark slits with loose threads and gouging the wood, and in every fit new scratches tear open behind the nails, pale and bloody, before they darken.
 */
class LidMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      envMap: frameStudio,
      envMapIntensity: 0.45,
      clearcoat: 0.1,
      clearcoatRoughness: 0.5,
      sheenRoughness: 0.35,
      sheenColor: '#f4ead2',
    })
    const surface = frameSurface()
    const p = surface.position
    const footprint = max(p.x.fwidth(), p.y.fwidth()).max(p.z.fwidth()).toVar('coffinFootprint')
    const plane = vec2(surface.along, surface.reach)
    const onSatin = band(surface, satin.from, satin.to).inside
    const onBoards = surface.reach.greaterThan(satin.to + 0.001).select(float(1), float(0))
    // The satin quilted in diamonds, a covered button where the creases meet.
    const quilt = vec2(surface.along.div(0.03), surface.reach.sub(satin.from).div((satin.to - satin.from) / 2))
    const diagonals = vec2(quilt.x.add(quilt.y), quilt.x.sub(quilt.y))
    const folds = diagonals.fract().sub(0.5).mul(2)
    const pillow = float(1).sub(folds.x.mul(folds.x)).mul(float(1).sub(folds.y.mul(folds.y))).max(0).sqrt()
    const node = diagonals.round()
    const button = vec2(quilt.x.sub(node.x.add(node.y).mul(0.5)).mul(0.03), quilt.y.sub(node.x.sub(node.y).mul(0.5)).mul((satin.to - satin.from) / 2)).length()
    const buttons = inside(button.sub(0.0028)).mul(onSatin)
    const stains = mx_noise_float(p.mul(14).add(vec3(1.7, 0, 0))).mul(0.5).add(0.5).add(mx_noise_float(p.mul(50)).mul(0.1))
    const tide = line(stains.sub(0.68), 0.008).mul(visibleDetail(footprint, 0.002))
    const mildew = mx_noise_float(p.mul(900)).smoothstep(0.5, 0.7).mul(mx_noise_float(p.mul(20).add(3)).smoothstep(0.1, 0.5)).mul(visibleDetail(footprint, 0.001))
    // Grimier toward the lid’s edge and in the creases.
    const aged = surface.reach.smoothstep(0.02, satin.to).mul(0.3).add(pillow.oneMinus().mul(0.5))
    const cloth = mix(mix(color('#d8caa6'), color('#a8946a'), aged.add(stains.smoothstep(0.5, 0.7).mul(0.3))), color('#6a4a2a'), stains.smoothstep(0.66, 0.8).mul(0.6).add(tide.mul(0.4)))
    const lining = mix(mix(cloth, color('#2e3424'), mildew.mul(0.6)), color('#c8bc9c'), buttons.mul(0.7))
    // The boards: pine, grain running along the members, dark with age and damp.
    const grain = mx_noise_float(vec3(surface.along.mul(5), surface.across.mul(300), surface.member)).mul(0.5).add(0.5)
    const lines = line(grain.mul(10).fract().sub(0.5), 0.12).mul(visibleDetail(footprint, 0.0012))
    const damp = mx_noise_float(p.mul(9).add(vec3(0, 2.1, 0))).mul(0.5).add(0.5).smoothstep(0.45, 0.8)
    const pine = mix(mix(mix(color('#6a4c30'), color('#4a3220'), grain), color('#2a1a0e'), lines.mul(0.5)), color('#24180e'), damp.mul(0.5))
    // The clawing, in this cell along the member and the ones on either side, which may reach into it.
    const cell = surface.along.div(clawCell).floor()
    const claws = [-1, 0, 1].map(shift => clawing(surface, plane, cell.add(shift), footprint))
    const depth = claws.reduce<Float>((sum, claw) => sum.max(claw.depth), float(0))
    const fresh = claws.reduce<Float>((sum, claw) => sum.max(claw.fresh.mul(claw.depth.smoothstep(0, 0.4))), float(0))
    const nails = claws.reduce<Float>((sum, claw) => sum.max(claw.nails), float(0))
    // Through the satin a scratch tears a ragged slit with loose threads across it; into the boards it gouges pale wood that darkens with age, bloody while fresh.
    const ragged = mx_noise_float(vec3(plane.mul(600), 2.3)).mul(0.3).add(0.85)
    const torn = depth.mul(ragged).smoothstep(0.15, 0.4).mul(onSatin)
    // Inside a tear, the dark padding and tufts of pale stuffing pulled out of it, and loose threads across it.
    const stuffing = mx_noise_float(vec3(plane.mul(700), 6.3)).smoothstep(0, 0.5).mul(visibleDetail(footprint, 0.0008))
    const threads = line(mx_noise_float(vec3(plane.mul(vec2(900, 300)), 5.1)), 0.05).mul(torn).mul(visibleDetail(footprint, 0.0008))
    const gouge = depth.mul(onBoards)
    const wood = mix(mix(color('#8a6a48'), color('#d0b080'), fresh), color('#5a0c0a'), fresh.mul(0.5))
    const blood = fresh.mul(depth).mul(mx_noise_float(vec3(plane.mul(300), 7.7)).smoothstep(-0.2, 0.4))
    // Old blood soaked into the satin round its tears.
    const soaked = depth.mul(onSatin).mul(mx_noise_float(vec3(plane.mul(120), 3.1)).mul(0.5).add(0.5)).smoothstep(0, 0.3).mul(0.5)
    const scored = mix(mix(mix(lining, color('#5a2a1a'), soaked), mix(mix(color('#1e1610'), color('#b8ac90'), stuffing.mul(0.6)), color('#d8ccb0'), threads), torn), mix(pine, wood, gouge), onBoards)
    const bled = mix(scored, color('#4a0606'), blood.mul(0.8).add(depth.mul(onSatin).mul(fresh).mul(0.5)).min(1))
    this.colorNode = mix(bled, color('#d8b8a0'), nails)
    this.roughnessNode = mix(mix(float(0.42), float(0.85), mildew.max(torn)), mix(float(0.8), float(0.55), damp), onBoards).sub(blood.mul(0.3))
    this.sheenNode = onSatin.mul(torn.oneMinus()).mul(0.9)
    this.normalNode = heightNormal(pillow.mul(0.0025).mul(onSatin).sub(buttons.mul(0.0008)).sub(torn.mul(0.0012)).sub(gouge.mul(0.0006)).sub(lines.mul(0.00004).mul(onBoards)).add(nails.mul(0.0003)).add(threads.mul(0.0002)))
  }
}

import type {FrameSurface} from '../lib/materials/frameAttributes.ts'

import {atan, color, float, max, mix, mx_cell_noise_float, mx_fractal_noise_float, mx_noise_float, mx_worley_noise_float, time, vec2, vec3} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {heightNormal, visibleDetail} from '#src/lib/materials/filters.ts'

import PortraitFrame, {frameBack} from '../base/PortraitFrame.ts'
import {assembleFrame, corners, place, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import {acanthus, band, beadAndReel, legible, repeatPhase} from '../lib/materials/carving.ts'
import {frameSurface} from '../lib/materials/frameAttributes.ts'
import frameStudio from '../lib/materials/frameStudio.ts'
import {turned} from '../lib/ornaments.ts'

const imageDepth = -0.062
/** a bead at the sight edge, a tall ogee of acanthus, a torus and a deep cove to the wall, as a grand salon frame once had them */
const profile = FrameProfile.from([-0.005, imageDepth])
  .line(-0.005, -0.052)
  .arc(0.008, -0.052, 0.5, {steps: 8})
  .line(0.012, -0.055)
  .ogee(0.06, -0.02, {steps: 14})
  .line(0.064, -0.02)
  .arc(0.092, -0.02, 0.5, {steps: 12})
  .arc(0.13, -0.07, -0.25, {steps: 8})
  .line(0.13, frameBack)
  .line(-0.005, frameBack)
/** the rosettes on the corners, over the ogee’s shoulder */
const rosette = {
  r: 0.05,
  z: -0.03,
}
/** the blood seeping out of the top and running down: how wide a run’s lane is and how long a run takes from welling up to drying away */
const runs = {
  lane: 0.013,
  period: [22, 44],
  longest: 1.1,
}
/**
 * Blood welling up along the top of the frame and running down it, in lanes as wide as {@link runs}: some lanes run, each down to its own length, the runs over the work stopping at the sight edge, where a drop gathers. Each run creeps down over half a minute or so and dries, darkening, before it fades and wells up afresh. Returns how much blood covers the point, 0 to 1, and how fresh it is.
 */
function bleeding(surface: FrameSurface) {
  const p = surface.position
  const opening = surface.opening
  const top = opening.y.add(profile.reach)
  const lane = p.x.div(runs.lane).floor()
  /** a random number from 0 to 1 for this lane, another for every `k`; cell noise, as `hash` truncates its seed to an unsigned integer, which would give every lane left of the middle the same */
  const random = (k: number) => mx_cell_noise_float(vec3(lane, k, 0))
  const active = random(0).lessThan(0.6)
  const length = random(1).pow(1.6).mul(runs.longest - 0.04).add(0.04)
  const period = random(2).mul(runs.period[1] - runs.period[0]).add(runs.period[0])
  const progress = time.div(period).add(random(3)).fract()
  const head = top.sub(length.mul(progress.smoothstep(0, 0.75)))
  // Over the work, a run can only reach the sight edge, where its drop hangs.
  const over = p.x.abs().lessThan(opening.x)
  const stop = over.select(opening.y.sub(0.003), float(-1e3))
  const end = head.max(stop)
  const middle = lane.add(0.5).add(random(4).sub(0.5).mul(0.3)).mul(runs.lane)
  const fromTop = top.sub(p.y)
  // The run narrows as it goes, wavers and swells into a drop at its head.
  const width = float(runs.lane * 0.2).mul(fromTop.mul(-4).exp().mul(0.7).add(0.5)).mul(mx_noise_float(vec3(p.y.mul(50), lane, 0.5)).mul(0.3).add(1))
  const drop = vec2(p.x.sub(middle), p.y.sub(end).mul(0.75)).length().sub(runs.lane * 0.3)
  const stream = max(p.x.sub(middle).abs().sub(width), max(end.sub(p.y), p.y.sub(top)))
  const shape = stream.min(drop.max(end.sub(p.y).sub(0.004)))
  const fade = progress.smoothstep(1, 0.88)
  const cover = shape.negate().div(shape.fwidth().max(0.00001)).add(0.5).clamp(0, 1).mul(active.select(fade, float(0))).mul(surface.isOrnament.oneMinus())
  // Blood also pools along the top, where it seeps out of the rotten wood.
  const seep = mx_noise_float(vec3(p.x.mul(30), 3.3, 0)).mul(0.5).add(0.5).mul(0.02).add(0.004)
  const pool = fromTop.smoothstep(seep.add(0.003), seep).mul(surface.isOrnament.oneMinus())
  return {
    cover: cover.max(pool),
    fresh: p.y.sub(end).div(0.06).clamp(0, 1).oneMinus().mul(progress.smoothstep(0.8, 0.6)).mul(cover),
  }
}

/** One of the Horror Orb’s frames: a grand gilt frame gone to rot, its gilding flaking off black, wet wood furred with mold, and blood seeping out of its top and running down it, drop by drop. */
export default class BleedingFrame extends PortraitFrame {
  override readonly description = 'What became of a grand salon frame: its gilding flaking off rotten, wet black wood, white gesso showing at the flakes’ edges and mold furring its hollows, while blood seeps out along its top and runs down it, drop by drop, gathering on the sight edge over the work and down the sides, drying dark before it wells up afresh.'
  override readonly front = profile.front
  override readonly imageDepth = imageDepth
  override readonly reach = profile.reach
  override readonly tint = '#6a4a1a'
  override readonly title = 'Bleeding gilt'

  override createGeometry(width: number, height: number) {
    const halfWidth = width / 2
    const halfHeight = height / 2
    const boss = turned([[0.024, 0], [0.024, 0.004], [0.019, 0.008], [0.016, 0.007], [0.012, 0.011], [0.007, 0.012], [0.004, 0.016], [0, 0.017]], 16, {kind: 1})
    return assembleFrame([
      ...sweepProfile(profile, halfWidth, halfHeight),
      [0, place(boss, corners(halfWidth, halfHeight, rosette.r, rosette.z))],
    ])
  }

  protected override createMaterials() {
    return [new RotMaterial]
  }
}

/**
 * Rotten gilding: patches of worn gold left on a frame whose wood has gone black and wet, the gesso showing white round the flakes’ curling edges, mold blooming pale green in the hollows and blood running over all of it, wet and bright where it is fresh, dark and dull where it dried.
 */
class RotMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      envMap: frameStudio,
      envMapIntensity: 1,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
    })
    const surface = frameSurface()
    const p = surface.position
    const footprint = max(p.x.fwidth(), p.y.fwidth()).max(p.z.fwidth()).toVar('rotFootprint')
    // The carving the gilding still shows.
    const sight = band(surface, -0.005, 0.008)
    const ogee = band(surface, 0.012, 0.06)
    const ornamentAt = vec2(surface.along, surface.across)
    const petals = atan(ornamentAt.y, ornamentAt.x).mul(8).cos().abs().pow(0.5).mul(ornamentAt.length().smoothstep(0.004, 0.012))
    const carving = surface.isOrnament.greaterThan(0.5).select(legible(surface, petals, 0.006).mul(0.003), legible(surface, beadAndReel(repeatPhase(surface, 0.018, 0), sight.t), 0.006).mul(sight.inside).mul(0.003).add(legible(surface, acanthus(repeatPhase(surface, 0.055, 0.036), ogee.t), 0.012).mul(ogee.inside).mul(0.004)))
    const hollow = surface.cavity.smoothstep(0, 0.8)
    // Gold flaked off in small losses, baring the white gesso and the red bole under it; where damp got in, the wood itself has rotted black and wet, and mold furs its hollows.
    const damp = mx_fractal_noise_float(p.mul(5).add(vec3(1.9, 0, 0)), 3).mul(0.5).add(0.5).add(hollow.mul(0.12)).smoothstep(0.55, 0.68)
    const flaking = mx_fractal_noise_float(p.mul(120), 3).mul(0.5).add(0.5).sub(surface.cavity.mul(-0.08))
    const lost = flaking.smoothstep(0.36, 0.34)
    const edge = flaking.smoothstep(0.345, 0.36).mul(flaking.smoothstep(0.375, 0.36))
    const gold = lost.oneMinus().mul(damp.oneMinus())
    const grain = mx_noise_float(vec3(surface.along.mul(8), surface.across.mul(300), surface.member)).mul(0.5).add(0.5).mul(visibleDetail(footprint, 0.003))
    const wood = mix(color('#160d08'), color('#34200f'), grain.mul(0.6))
    const ground = mix(color('#b8a888'), color('#6e2c18'), mx_noise_float(p.mul(200)).smoothstep(-0.6, 0))
    const mold = mx_worley_noise_float(p.mul(90)).smoothstep(0.45, 0.1).mul(damp).mul(hollow.mul(0.7).add(0.3)).clamp(0, 1)
    const fuzz = mx_noise_float(p.mul(1100)).mul(0.5).add(0.5).mul(visibleDetail(footprint, 0.0015))
    const gilt = mix(color('#d8a64c'), color('#5e4018'), hollow.mul(0.7).add(mx_noise_float(p.mul(60)).mul(0.15)))
    const gesso = edge.mul(gold.oneMinus()).mul(damp.oneMinus())
    const {cover, fresh} = bleeding(surface)
    const bared = mix(mix(ground, wood, damp), color('#d8cdb2'), gesso.mul(0.6))
    const decayed = mix(mix(bared, gilt, gold), mix(color('#7f8a5a'), color('#d8dcc0'), fuzz), mold)
    const blood = mix(color('#3a0204'), color('#b0060c'), fresh.mul(0.75).add(0.25))
    this.colorNode = mix(decayed, blood, cover)
    this.metalnessNode = gold.mul(cover.oneMinus()).mul(mold.oneMinus())
    this.roughnessNode = mix(mix(mix(mix(float(0.6), float(0.25), damp), float(0.28), gold), float(0.95), mold), mix(float(0.35), float(0.06), fresh), cover)
    this.clearcoatNode = cover.mul(fresh.mul(0.7).add(0.3))
    this.normalNode = heightNormal(carving.mul(damp.mul(-0.5).add(1)).add(gesso.mul(0.0002)).sub(lost.mul(0.00025)).add(fuzz.mul(mold).mul(0.0002)).add(cover.mul(0.0004)))
  }
}

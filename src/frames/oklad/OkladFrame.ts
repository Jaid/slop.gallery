import type {Placement} from '../lib/frameGeometry.ts'
import type {FrameSurface} from '../lib/materials/frameAttributes.ts'
import type {Claws, Girdle, StoneSize} from './stones.ts'
import type {BufferGeometry, Node} from 'three/webgpu'

import hsl from 'okhsl'
import {float, max, mx_noise_float, select, smoothstep, vec2, vec3} from 'three/tsl'

import PortraitFrame, {frameBack, frameDetail, frameTriangleBudget} from '../base/PortraitFrame.ts'
import {assembleFrame, corners, middles, place, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import {band, carvingByPiece, legible, repeatPhase, ribbon} from '../lib/materials/carving.ts'
import GiltMaterial from '../lib/materials/GiltMaterial.ts'
import {triangles} from '../lib/ornaments.ts'
import GemMaterial from './GemMaterial.ts'
import PearlMaterial from './PearlMaterial.ts'
import {brilliantCrown, brilliantTriangles, collet, colletTriangles, cushionGirdle, octagonGirdle, pearl, pearlTriangles, roundGirdle, stepCrown, stepTriangles} from './stones.ts'

type Float = Node<'float'>

const imageDepth = -0.05
const gold = 0
const spinel = 1
const garnet = 2
const emerald = 3
const sapphire = 4
const nacre = 5
/** the broad panel of repoussé the stones are set in */
const panel = {
  from: 0.008,
  to: 0.1,
  inner: -0.046,
  outer: -0.04,
}
/** a twisted wire at the sight edge, a broad panel of repoussé sloping gently up, a twisted wire at its outer edge and a plain edge to the wall */
const profile = FrameProfile.from([-0.005, imageDepth])
  .line(-0.005, -0.044)
  .arc(0.006, -0.044, 0.5, {steps: 6})
  .line(panel.from, panel.inner)
  .line(panel.to, panel.outer)
  .arc(0.112, panel.outer, 0.5, {steps: 6})
  .line(0.115, -0.05)
  .line(0.115, frameBack)
  .line(-0.005, frameBack)
/** where the stones along the members sit across the panel, about how far apart, which the repoussé’s period is fitted to, and how much room they leave the corners’ settings */
const run = {
  reach: 0.054,
  spacing: 0.1,
  corner: 0.075,
}
/** a stone in its collet: its girdle, its size, how high its crown rises over its girdle and how it is cut, how high its collet holds its girdle over the panel, how thick the collet’s wall is and how its rim rises into claws, if it does */
type Setting = {
  claws?: Claws
  crown: number
  cut: 'brilliant' | 'step'
  girdle: Girdle
  girdleZ: number
  size: StoneSize
  wall: number
}
/** the stones along the members, of each of the colors they take in turn out from the middle of every member: a cushion-cut garnet, an emerald cut emerald lying along its member and a round sapphire */
const runSettings = [
  [garnet, {
    girdle: cushionGirdle,
    size: [0.0102, 0.0102],
    crown: 0.0036,
    cut: 'brilliant',
    girdleZ: 0.0022,
    wall: 0.0021,
  }],
  [emerald, {
    girdle: octagonGirdle(0.3),
    size: [0.0125, 0.0091],
    crown: 0.0032,
    cut: 'step',
    girdleZ: 0.0022,
    wall: 0.0021,
  }],
  [sapphire, {
    girdle: roundGirdle,
    size: [0.0112, 0.0112],
    crown: 0.0038,
    cut: 'brilliant',
    girdleZ: 0.0022,
    wall: 0.0021,
  }],
] as const satisfies ReadonlyArray<readonly [number, Setting]>
/** the great oval spinel over every corner, how far out along both members its middle lies, its six claws and the pearls round it */
const great = {
  at: 0.05,
  pearls: 8,
  setting: {
    girdle: roundGirdle,
    size: [0.021, 0.0151],
    crown: 0.0062,
    cut: 'brilliant',
    girdleZ: 0.0028,
    wall: 0.0027,
    claws: {
      count: 6,
      height: 0.0022,
      reach: 0.003,
    },
  },
} as const satisfies {
  at: number
  pearls: number
  setting: Setting
}
/** the round sapphire in the middle of every member, in four claws turned between the pearls at its four sides */
const middle = {
  pearls: 0.0222,
  setting: {
    girdle: roundGirdle,
    size: [0.0135, 0.0135],
    crown: 0.0046,
    cut: 'brilliant',
    girdleZ: 0.0026,
    wall: 0.0025,
    claws: {
      count: 4,
      height: 0.0014,
      reach: 0.0021,
    },
  },
} as const satisfies {
  pearls: number
  setting: Setting
}
const pearlRadius = 0.0046
/** how many beads of milgrain run round the rim of a collet of the stones along the members, a great stone’s and a middle stone’s, about a millimeter apart */
const milgrain = [66, 104, 80] as const
/** the pieces the collets of the great and the middle stones close round them in within {@link frameTriangleBudget}, five to every claw, which a larger budget multiplies by its {@link frameDetail} */
const settingPieces = {
  great: 30,
  middle: 24,
}
/** how finely the plain collets of the stones along the members and the pearls are made within {@link frameTriangleBudget}, finest first: pieces round a collet, round a pearl and up a pearl, and the sides of a brilliant’s table, the only one a larger budget doesn’t multiply by its {@link frameDetail}, as it makes a different cut. An emerald’s octagonal collet takes a piece to each of its sides for every twelve a round one takes, rounded. */
const runDetails = [
  {
    collet: 20,
    pearl: [16, 4],
    mains: 8,
  },
  {
    collet: 16,
    pearl: [14, 3],
    mains: 8,
  },
  {
    collet: 12,
    pearl: [12, 3],
    mains: 8,
  },
  {
    collet: 12,
    pearl: [12, 2],
    mains: 8,
  },
  {
    collet: 10,
    pearl: [10, 2],
    mains: 6,
  },
  {
    collet: 10,
    pearl: [8, 2],
    mains: 6,
  },
] as const
type RunDetail = {
  collet: number
  mains: number
  pearl: readonly [number, number]
}
/** where the panel lies `r` meters out past the opening */
const panelAt = (r: number) => panel.inner + (panel.outer - panel.inner) * (r - panel.from) / (panel.to - panel.from)
/** where the panel lies under a point near the top right corner, the members meeting in the miter */
const atCorner = (x: number, y: number) => panelAt(Math.max(x, y))
/** where the panel lies under a point near the middle of the top member */
const atMiddle = (_: number, y: number) => panelAt(y)
/** A stone’s crown, lifted onto its collet, and its sides of a brilliant’s table. */
const crownOf = ({crown, cut, girdle, girdleZ, size}: Setting, mains: number) => {
  const part = cut === 'step' ? stepCrown(girdle, size, crown, {kind: 4}) : brilliantCrown(girdle, size, crown, {
    kind: 4,
    mains,
  })
  part.translate(0, 0, girdleZ)
  return part
}
/** A stone’s collet, closing round it in `pieces`, its milgrain one of {@link milgrain}, plain along the members. */
const colletOf = ({claws, girdle, girdleZ, size, wall}: Setting, pieces: number, beads: number) => collet(girdle, size, {
  claws,
  girdleZ,
  pieces,
  wall,
  plain: beads === 0,
  kind: 1 + beads,
})
/** How many pieces the collet of a stone along the members closes round it in, an octagon’s turning on its corners. */
const runPieces = ({cut}: Setting, pieces: number) => (cut === 'step' ? 8 * Math.max(1, Math.round(pieces / 12)) : pieces)
/** How many triangles a stone along the members takes with its collet. */
const settingTriangles = (setting: Setting, {collet: pieces, mains}: RunDetail) => (setting.cut === 'step' ? stepTriangles(2) : brilliantTriangles(mains)) + colletTriangles(runPieces(setting, pieces), true)
/** Copies a part of a setting to every spot, `at` meters from it in the spot’s own turn, as if at the top right corner or on the top member, turned `turn` further, resting on the panel as `rest` finds it there. */
function setOn(part: BufferGeometry, spots: ReadonlyArray<Placement>, [x, y]: readonly [number, number], rest: (x: number, y: number) => number, turn = 0) {
  return place(part, spots.map(({position, angle = 0}) => ({
    position: [position[0] + Math.cos(angle) * x - Math.sin(angle) * y, position[1] + Math.sin(angle) * x + Math.cos(angle) * y, rest(x, y)] as const,
    angle: angle + turn,
  })))
}
/** The repoussé of the panel as a height from 0 to 1: a vine winding along every member, crossing the panel’s middle at every stone, a leaf in every bend and a tendril curling out beside it, raised from a ground stippled all over with the punch. */
function repousse(surface: FrameSurface): Float {
  const {t} = band(surface, panel.from, panel.to)
  // The same period the stones are spaced by, so the stem crosses the middle under every one of them.
  const phase = repeatPhase(surface, run.spacing, run.reach)
  const wave = phase.mul(Math.PI * 2).sin().mul(0.3).add(0.5)
  const stem = smoothstep(0.055, 0.02, t.sub(wave).abs())
  // In every bend a leaf, lying in its hollow along the member, and a tendril curling out of the stem beyond it.
  const bend = phase.mul(2).fract()
  const side = select(phase.lessThan(0.5), float(1), float(-1))
  const across = t.sub(0.5).mul(side)
  const leafAt = vec2(bend.sub(0.5).mul(run.spacing / 2), across.sub(0.12).mul(panel.to - panel.from))
  const leaf = smoothstep(0.0012, 0, vec2(leafAt.x.div(1.9), leafAt.y).length().sub(0.0042))
  const curlAt = vec2(bend.sub(0.18).mul(run.spacing / 2), across.sub(0.36).mul(panel.to - panel.from))
  const curl = smoothstep(0.0011, 0.0003, curlAt.length().sub(0.0045).abs()).mul(select(curlAt.x.lessThan(0.002), float(1), float(0)))
  const stipple = mx_noise_float(vec3(surface.position.mul(1900))).mul(0.5).add(0.5).mul(0.08)
  return max(max(stem, leaf.mul(0.9)), curl).mul(0.75).add(float(0.22).sub(stipple)).clamp(0, 1)
}
/** Milgrain round a collet’s rim as a height from 0 to 1: a row of tiny beads along its crest, `count` of them round it, `at` the share of the way across from its foot to its lip. */
function beading(surface: FrameSurface, count: number, at: number): Float {
  const along = surface.along.mul(count).fract().sub(0.5).mul(2)
  const across = surface.across.sub(at).div(0.2)
  return float(1).sub(along.mul(along)).sub(across.mul(across)).max(0).sqrt()
}
/**
 * The spots of the stones along the members: on the period the repoussé is fitted to, out from either side of the middle setting toward both corners, as far as the corner’s setting leaves room, on every `every`th of them, each with its color, the same on both halves.
 */
function runSpots(halfWidth: number, halfHeight: number, every: number) {
  const spots: Array<{
    material: typeof runSettings[number][0]
    placement: Placement
  }> = []
  for (let member = 0; member < 4; member++) {
    const angle = -member * Math.PI / 2
    const [ox, oy] = [Math.round(Math.sin(-angle)), Math.round(Math.cos(angle))]
    const [rx, ry] = [Math.round(Math.cos(angle)), Math.round(Math.sin(angle))]
    const half = (member % 2 === 0 ? halfWidth : halfHeight) + run.reach
    const period = half / Math.max(1, Math.round(half / run.spacing))
    const distance = (member % 2 === 0 ? halfHeight : halfWidth) + run.reach
    for (const side of [-1, 1]) {
      for (let index = every; index * period <= half - run.corner; index += every) {
        const offset = side * index * period
        spots.push({
          material: runSettings[(index / every - 1) % runSettings.length][0],
          placement: {
            position: [ox * distance + rx * offset, oy * distance + ry * offset, panelAt(run.reach)],
            angle,
          },
        })
      }
    }
  }
  return spots
}

/** One of the golden frames: an oklad, the gilt cover of an Orthodox icon, laid round the work as a frame: a broad panel of repoussé vines between two twisted wires, set with cut garnets, emeralds and sapphires in collets edged with milgrain, a great oval spinel in claws ringed with pearls over every corner and a round sapphire in claws between pearls in the middle of every member. */
export default class OkladFrame extends PortraitFrame {
  override readonly description = 'An oklad, the cover a Russian court jeweler chases for an icon, laid round the work as a frame: a broad panel of silver gilt chased in repoussé with a vine winding along every member, crossing under every stone, a leaf lying in every bend and a tendril curling out beside it, over a ground stippled with the punch, between two twisted wires, set with cushion-cut garnets, emerald-cut emeralds and brilliant sapphires in collets edged with milgrain, a great oval spinel held in six claws and ringed with orient pearls over every corner and a round sapphire held in four claws between four pearls in the middle of every member.'
  override readonly front = Math.max(atCorner(great.at, great.at) + great.setting.girdleZ + great.setting.crown, panelAt(run.reach) + middle.setting.girdleZ + middle.setting.crown)
  override readonly imageDepth = imageDepth
  override readonly impactSound = 'heavy'
  override readonly reach = profile.reach
  override readonly tint = hsl.integer(82, 62, 70)
  override readonly title = 'Jeweled oklad'

  override createGeometry(width: number, height: number, budget = frameTriangleBudget) {
    const halfWidth = width / 2
    const halfHeight = height / 2
    const detail = frameDetail(budget)
    const moulding = sweepProfile(profile, halfWidth, halfHeight)
    const cornerSpots = corners(halfWidth, halfHeight, 0, 0)
    const middleSpots = middles(halfWidth, halfHeight, 0, 0)
    // The great stone lies along the diagonal, the pearls round it.
    const diagonal = Math.PI / 4
    const [greatX, greatY] = great.setting.size
    const ring = great.setting.wall + pearlRadius + 0.0007
    const greatPearls = Array.from({length: great.pearls}, (_, index): readonly [number, number] => {
      const angle = index / great.pearls * Math.PI * 2
      const [x, y] = [Math.cos(angle) * (greatX + ring), Math.sin(angle) * (greatY + ring)]
      return [great.at + Math.cos(diagonal) * x - Math.sin(diagonal) * y, great.at + Math.sin(diagonal) * x + Math.cos(diagonal) * y]
    })
    const middlePearls = [[middle.pearls, 0], [-middle.pearls, 0], [0, middle.pearls], [0, -middle.pearls]] as const
    const pearls = greatPearls.length * 4 + middlePearls.length * 4
    const mouldingTriangles = moulding.values().reduce((sum, part) => sum + triangles(part), 0)
    // The settings of the great and the middle stones, `fineness` times as finely made as within the frame’s own budget.
    const fixed = (fineness: number) => mouldingTriangles + 4 * (brilliantTriangles(8) * 2 + colletTriangles(settingPieces.great * fineness) + colletTriangles(settingPieces.middle * fineness))
    const cost = (spots: ReturnType<typeof runSpots>, entry: RunDetail) => pearls * pearlTriangles(...entry.pearl) + runSettings.reduce((sum, [material, setting]) => sum + spots.filter(spot => spot.material === material).length * settingTriangles(setting, entry), 0)
    // The stones along the members on every spot, or only every second or third of them, as the plainest settings fit the frame’s own budget.
    const plainest = runDetails.at(-1)!
    let every = 1
    let spots = runSpots(halfWidth, halfHeight, every)
    while (spots.length > 0 && cost(spots, plainest) > frameTriangleBudget - fixed(1)) {
      every++
      spots = runSpots(halfWidth, halfHeight, every)
    }
    // Then the finest settings and pearls the triangles left allow.
    const finer = runDetails.map((entry): RunDetail => ({
      collet: entry.collet * detail,
      pearl: [entry.pearl[0] * detail, entry.pearl[1] * detail],
      mains: entry.mains,
    }))
    const finest: RunDetail = [...finer, ...runDetails].find(entry => cost(spots, entry) <= budget - fixed(detail)) ?? plainest
    const pearlPart = () => pearl(pearlRadius, finest.pearl[0], finest.pearl[1], 5)
    // Small works may have no room for any stone along their members, or not for every color.
    const runs = runSettings.flatMap(([material, setting]) => {
      const at = spots.filter(spot => spot.material === material).map(({placement}) => placement)
      return at.length > 0 ? [[material, place(crownOf(setting, finest.mains), at)] as const, [gold, place(colletOf(setting, runPieces(setting, finest.collet), 0), at)] as const] : []
    })
    return assembleFrame([
      ...moulding,
      [gold, setOn(colletOf(great.setting, settingPieces.great * detail, 1), cornerSpots, [great.at, great.at], atCorner, diagonal)],
      [spinel, setOn(crownOf(great.setting, 8), cornerSpots, [great.at, great.at], atCorner, diagonal)],
      ...greatPearls.map(at => [nacre, setOn(pearlPart(), cornerSpots, at, atCorner)] as const),
      [gold, setOn(colletOf(middle.setting, settingPieces.middle * detail, 2), middleSpots, [0, run.reach], atMiddle, Math.PI / 4)],
      [sapphire, setOn(crownOf(middle.setting, 8), middleSpots, [0, run.reach], atMiddle)],
      ...middlePearls.map(([x, y]) => [nacre, setOn(pearlPart(), middleSpots, [x, run.reach + y], atMiddle)] as const),
      ...runs,
    ])
  }

  protected override createMaterials() {
    return [
      new GiltMaterial({
        burnishedReflections: true,
        grime: 0.55,
        roughness: {
          burnished: 0.12,
          matte: 0.3,
        },
        relief: {
          depth: 0.0015,
          height: surface => carvingByPiece(surface, {
            members: footprint => {
              const wires = [band(surface, -0.005, 0.006), band(surface, 0.1, 0.112)]
              const twist = wires.map(wire => legible(surface, ribbon(repeatPhase(surface, 0.004, 0.003), wire.t), 0.002, footprint).mul(wire.inside)).reduce((sum, wire) => sum.add(wire), float(0))
              const flat = band(surface, panel.from, panel.to)
              return twist.mul(0.0012).add(legible(surface, repousse(surface), 0.006, footprint).mul(flat.inside).mul(0.0015))
            },
            // Every gilt ornament is a collet, its kind telling how many beads of milgrain run round it; the plain ones along the members have them on their flat rim.
            ornaments: milgrain.map((count, index) => [1 + index, (footprint: Float) => legible(surface, beading(surface, count, index === 0 ? 0.75 : 0.6), 0.001, footprint).mul(0.0005)] as const),
          }),
        },
      }),
      new GemMaterial({
        body: hsl.integer(20, 95, 52),
        ior: 1.72,
        dispersion: 0.03,
      }),
      new GemMaterial({
        body: hsl.integer(14, 85, 32),
        ior: 1.79,
        dispersion: 0.035,
      }),
      new GemMaterial({
        body: hsl.integer(152, 85, 46),
        ior: 1.58,
        dispersion: 0.025,
      }),
      new GemMaterial({
        body: hsl.integer(264, 90, 44),
        ior: 1.77,
        dispersion: 0.03,
      }),
      new PearlMaterial,
    ]
  }
}

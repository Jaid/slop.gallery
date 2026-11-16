import type {Finish, Joint, Section} from './armor/plating.ts'
import type {LatticePoint} from './curios/lattice.ts'
import type {Vec3} from './types.ts'
import type {BufferGeometry} from 'three/webgpu'

import {Vector3} from 'three/webgpu'

import {mergeParts} from '../geometry.ts'
import {columnsOf, creaseAt, degree, dome, lames, plate, rivetHeads, rollRows, sectionAt, sheetGeometry, squared, steel, steelMask, withEdges} from './armor/plating.ts'
import {gorgetBorderReach} from './curios/helmet/Helmet.ts'
import latticeGeometry from './curios/lattice.ts'
import {suitOfArmor} from './suitOfArmor.ts'

const {collar} = suitOfArmor
/** the plain, dull steel of the skirt under the fauld, which only shows between the tassets */
const skirtSteel: Finish = {polish: 0}

/** a rivet head to set on a plate: where, which way its plate faces there, and how large it is */
type Rivet = {
  normal: Vector3
  position: Vec3
  radius: number
}
const rivet = (position: Joint, normal: Joint, radius = 0.0055): Rivet => {
  const facing = new Vector3(...normal)
  return {
    position: [...position],
    normal: facing.normalize(),
    radius,
  }
}
/** a ring’s reach round a circle of `radius`, to the side and to the front, at `theta` degrees round from straight ahead */
const round = (radius: number) => (theta: number) => [radius * Math.sin(theta * degree), radius * Math.cos(theta * degree)] as const
/** how much lower each of the fauld’s hoops hangs at `theta` degrees round from straight ahead, dipping at the front */
const dip = (theta: number) => 0.02 * Math.max(0, Math.cos(theta * degree)) ** 2
/**
 * The cuirass’ sections, by their height over the floor: pigeon-breasted, its crease down the middle of the breast, broad across the shoulders under the helmet’s gorget, and narrowing to a waist, where it flares into a rolled lip.
 * Its top is level with the border of the gorget at the front, the back and the sides, so the cuirass slopes off from under it.
 */
const chestSections: ReadonlyArray<Section> = [
  {
    at: 1.15,
    side: 0.153,
    front: 0.153,
    back: 0.133,
    square: 2.1,
    crease: 0.004,
  },
  {
    at: 1.2,
    side: 0.162,
    front: 0.166,
    back: 0.14,
    square: 2.15,
    crease: 0.007,
  },
  {
    at: 1.27,
    side: 0.181,
    front: 0.192,
    back: 0.154,
    square: 2.25,
    crease: 0.011,
  },
  {
    at: 1.35,
    side: 0.199,
    front: 0.212,
    back: 0.17,
    square: 2.35,
    crease: 0.013,
  },
  {
    at: 1.43,
    side: 0.21,
    front: 0.216,
    back: 0.183,
    square: 2.45,
    crease: 0.011,
  },
  {
    at: 1.5,
    side: 0.212,
    front: 0.211,
    back: 0.19,
    square: 2.55,
    crease: 0.007,
  },
  {
    at: 1.55,
    side: 0.204,
    front: 0.206,
    back: 0.19,
    square: 2.6,
    crease: 0.003,
  },
  {
    at: 1.585,
    side: 0.188,
    front: 0.201,
    back: 0.184,
    square: 2.6,
    crease: 0,
  },
]
/** where the cuirass’ breast lies at `y` over the floor and `theta` degrees round from straight ahead, `out` further out, held at its lowest section under the waist */
function chest(y: number, theta: number, out = 0) {
  const {back, crease, front, side, square} = sectionAt(chestSections, Math.max(y, chestSections[0].at))
  const [sin, cos] = [Math.sin(theta * degree), Math.cos(theta * degree)]
  const x = side * squared(sin, square)
  const z = (cos > 0 ? front : back) * squared(cos, square) + creaseAt(theta, crease)
  const reach = Math.hypot(x, z)
  return new Vector3(x * (1 + out / reach), y, z * (1 + out / reach))
}
/** the waist, where the cuirass ends in its lip and the fauld’s lames hang from under it */
const waist = chestSections[0]

/**
 * The steel of the suit of armor, see `suitOfArmor`, every plate carrying its `steelMask` for `ForgedSteelMaterial`: only the inside of its empty neck lies in a hole, showing dark.
 * Its plates are open where they lap over each other, so show it from both sides.
 */
export default function suitOfArmorGeometry() {
  const rivets: Array<Rivet> = []
  const parts = [...cuirass(rivets), ...fauld(rivets), ...[1, -1].flatMap(outside => [...leg(outside, rivets), ...arm(outside, rivets)])]
  return mergeParts([...parts, ...rivets.flatMap(({normal, position, radius}) => rivetHeads([{
    normal,
    position,
  }], radius))])
}

/**
 * The breastplate and the backplate in one, and the plackart over the breast: from deep in the dark of its empty neck up over the rolled lip of its collar, out under the helmet’s gorget, sloping off it just under its border all round, so the gorget rests on it, then over the shoulders and down the swelling breast with its crease to the waist, where it flares into a lip; the plackart laps up over the breast from the waist to an ogee point, its edge rolled.
 */
function cuirass(rivets: Array<Rivet>) {
  const thetas = columnsOf(48)
  const ring = (y: number, reach: (theta: number) => readonly [side: number, front: number], finish?: Finish) => thetas.map(theta => {
    const [across, forward] = reach(theta)
    return steel(new Vector3(across, y, forward), finish)
  })
  const rows: Array<Array<LatticePoint>> = [
    ring(collar - 0.07, round(0.066), {hole: 1}),
    ring(collar + 0.012, round(0.07), {hole: 0.6}),
    ring(collar + 0.03, round(0.075)),
    ring(collar + 0.026, round(0.081)),
    ring(collar + 0.014, round(0.086)),
    // The yoke, a low dome under the gorget, down to a hair under its border
    ...[0.66, 0.8, 0.91, 1].map(share => ring(collar - 0.0015 + 0.0215 * (1 - share ** 2), theta => round(share * gorgetBorderReach(theta))(theta))),
  ]
  const breast = [1.585, 1.568, 1.548, 1.524, 1.498, 1.47, 1.44, 1.41, 1.38, 1.35, 1.32, 1.29, 1.26, 1.23, 1.2, 1.177, 1.16]
  for (const y of breast) {
    rows.push(thetas.map(theta => steel(chest(y, theta))))
  }
  // The lip at the waist, rolled out and turned back in under itself
  for (const [y, out] of [[1.151, 0.004], [1.146, 0.0062], [1.141, 0.0035], [1.141, -0.002]] as const) {
    rows.push(thetas.map(theta => steel(chest(y, theta, out), {polish: 0.4})))
  }
  const shell = latticeGeometry(rows, {
    start: steel(new Vector3(0, collar - 0.09, 0), {hole: 1}),
    extra: steelMask,
  })
  // The plackart, from its ogee point down to the waist, a few millimeters proud of the breast
  const span = 74
  const bottom = 1.168
  const top = (theta: number) => 1.215 + 0.135 * (1 - Math.abs(theta) / span) ** 1.7
  const plackartThetas = Array.from({length: 33}, (_, index) => -span + index * span * 2 / 32)
  const plackartRows = [
    ...[[0, 0.0012], [0, 0.0058], [0.003, 0.0068], [0.0085, 0.0045]].map(([down, out]) => ({
      y: (theta: number) => top(theta) - down,
      out,
      polish: out === 0.0045 ? 0.12 : 0.4,
    })),
    ...[0.18, 0.4, 0.62, 0.82, 1].map(share => ({
      y: (theta: number) => top(theta) - 0.0085 - (top(theta) - 0.0085 - bottom) * share,
      out: 0.0045,
      polish: 0.12,
    })),
  ]
  const plackart = sheetGeometry(plackartRows.map(({y, out, polish}) => plackartThetas.map(theta => steel(chest(y(theta), theta, out), {polish}))))
  rivets.push(rivet(chest(top(0) - 0.02, 0, 0.005).toArray(), [0, 0.15, 1], 0.006))
  return [shell, plackart]
}
/**
 * The fauld: three hoops of lames lapping down over the hips from under the cuirass’ waist, each dipping lower at the front and flaring out a little further, most to the sides and least over the rump, their lower edges rolled; under them a plain skirt between the legs, and over the front of the thighs the two tassets of two lames each, hanging from the lowest hoop.
 */
function fauld(rivets: Array<Rivet>) {
  const parts: Array<BufferGeometry> = []
  for (let index = 0; index < 3; index++) {
    const y = waist.at + 0.006 - index * 0.05
    const section = (at: number, out: number): Section => ({
      at,
      side: waist.side + 0.003 + index * 0.013 + out,
      front: waist.front + 0.003 + index * 0.009 + out,
      back: waist.back + 0.003 + index * 0.006 + out * 0.6,
      square: 2.2,
    })
    parts.push(plate([0, y, 0], [0, y - 0.064, 0], [section(0, -0.006), section(0.35, 0.002), section(1, 0.012)], {
      columns: 40,
      rolls: [undefined, 0.0035],
      samples: [0, 0.35, 0.7, 1],
      shift: dip,
    }))
    for (const theta of [-34, 34]) {
      const lame = sectionAt([section(0, -0.006), section(0.35, 0.002), section(1, 0.012)], 0.55)
      const [sin, cos] = [Math.sin(theta * degree), Math.cos(theta * degree)]
      const at = y - 0.064 * 0.55 - dip(theta)
      rivets.push(rivet([lame.side * squared(sin, 2.2) + 0.002 * sin, at, lame.front * squared(cos, 2.2) + 0.002 * cos], [sin, 0.25, cos], 0.0045))
    }
  }
  // The plain skirt under the fauld, between the legs, behind the tassets
  parts.push(plate([0, 1.02, 0], [0, 0.85, 0], [
    {
      at: 0,
      side: 0.16,
      front: 0.135,
      back: 0.14,
    },
    {
      at: 1,
      side: 0.15,
      front: 0.118,
      back: 0.15,
    },
  ], {
    columns: 36,
    finish: skirtSteel,
    samples: [0, 0.5, 1],
  }))
  // The tassets, each a pair of lames curving round the front of a thigh with the fauld, tucked under its lowest hoop and parting from the middle downward like an A over the skirt, the lower lame under the upper, their lower edges rolled
  const hem = waist.at + 0.006 - 2 * 0.05 - 0.064
  const tassetTop = hem + 0.028
  const tassetFoot = 0.818
  for (const outside of [1, -1]) {
    for (const [index, [from, to]] of [[tassetTop, 0.905], [0.915, tassetFoot]].entries()) {
      parts.push(tasset(outside, from, to, index))
    }
    rivets.push(rivet(tassetPoint(18 * outside, tassetTop - 0.016, 0, 0.002).toArray(), [0.3 * outside, 0.2, 1], 0.0048))
  }
  return parts
}
/** where a tasset lies at `theta` degrees round from straight ahead and `y` over the floor, the lower lame `index` 1 a little inside the upper one, `out` further out: on an ellipse like the fauld’s lowest hoop, a little inside its hem, flaring as it hangs */
function tassetPoint(theta: number, y: number, index: number, out = 0) {
  const drop = (waist.at - 0.15 - y) / 0.2
  const side = waist.side + 0.034 + 0.012 * drop - index * 0.004
  const front = waist.front + 0.026 - 0.008 * drop - index * 0.004
  const [sin, cos] = [Math.sin(theta * degree), Math.cos(theta * degree)]
  const x = side * squared(sin, 2.2)
  const z = front * squared(cos, 2.2)
  const reach = Math.hypot(x, z)
  return new Vector3(x * (1 + out / reach), y, z * (1 + out / reach))
}
/** One lame of a tasset, `outside` 1 for the left and -1 for the right, from `from` down to `to` over the floor, parting further from the middle the lower it hangs, its lower edge rolled. */
function tasset(outside: number, from: number, to: number, index: number) {
  const roll = 0.0032
  const columns = 12
  const span = from - to
  const rows = [0, 0.5, ...rollRows(roll, span).map(({u}) => u)]
  const bulges = [0, 0, ...rollRows(roll, span).map(({bulge}) => bulge)]
  const top = waist.at - 0.15 + 0.03
  const sheet = rows.map((u, row) => {
    // Squeezed so the roll takes the last few millimeters
    const y = from - span * Math.min(u, 1)
    const share = (top - y) / (top - 0.818)
    const inner = 1.2 + 9 * share
    const outer = 66 - 4 * share
    return Array.from({length: columns + 1}, (_, column) => {
      const theta = (inner + (outer - inner) * column / columns) * outside
      return steel(tassetPoint(theta, y, index, bulges[row]), bulges[row] ? {polish: 0.4} : undefined)
    })
  })
  // Seen from outside, the points of every row run to the right, from the outside of the right thigh and from the middle over the left one
  return sheetGeometry(outside > 0 ? sheet : sheet.map(row => row.toReversed()))
}
/** One leg, `outside` 1 for the left and -1 for the right: the cuisse down the thigh, the poleyn over the knee with its lame above, its fan of a wing on the outside, the greave down the shin and the calf and the sabaton of lames over the foot, its toes turned a little out. */
function leg(outside: number, rivets: Array<Rivet>) {
  const mirror = ([x, y, z]: Joint): Joint => [x * outside, y, z]
  const hip: Joint = [0.1, 1, 0.005]
  const knee: Joint = [0.11, 0.53, 0.03]
  const ankle: Joint = [0.115, 0.095, 0]
  const parts = [
    plate(mirror(hip), mirror([0.108, 0.6, 0.022]), [
      {
        at: 0,
        side: 0.088,
        front: 0.094,
        back: 0.084,
        crease: 0.004,
      },
      {
        at: 0.3,
        side: 0.087,
        front: 0.092,
        back: 0.087,
        crease: 0.005,
      },
      {
        at: 0.72,
        side: 0.073,
        front: 0.077,
        back: 0.071,
        crease: 0.005,
      },
      {
        at: 1,
        side: 0.064,
        front: 0.068,
        back: 0.062,
        crease: 0.004,
      },
    ], {
      columns: 20,
      rolls: [0.0035, undefined],
      samples: [0, 0.18, 0.36, 0.54, 0.72, 0.88, 1],
    }),
    // The lame between the cuisse and the poleyn
    plate(mirror([0.108, 0.615, 0.022]), mirror([0.109, 0.565, 0.026]), [
      {
        at: 0,
        side: 0.068,
        front: 0.076,
        back: 0.066,
      },
      {
        at: 1,
        side: 0.074,
        front: 0.081,
        back: 0.072,
      },
    ], {
      columns: 28,
      rolls: [undefined, 0.003],
      samples: [0, 1],
    }),
    dome(mirror(knee), mirror([0.1, 0.06, 1]), [0, 1, 0], {
      side: 0.074,
      front: 0.08,
      back: 0.076,
      height: 0.068,
    }, [0.12, 0.25, 0.4, 0.55, 0.7, 0.85, 1], {
      columns: 28,
      rim: () => 100,
      roll: 0.003,
    }),
    // The fan of a wing on the outside of the knee, a thin dished plate notched like a heart at its back
    dome(mirror([0.176, 0.53, 0.012]), mirror([1, 0, 0.35]), [0, 0, -1], {
      side: 0.05,
      front: 0.062,
      back: 0.052,
      height: 0.007,
    }, [0.3, 0.6, 0.85, 1], {
      columns: 20,
      rim: theta => 88 - 26 * Math.exp(-((theta / 26) ** 2)),
      roll: 0.0025,
    }),
    plate(mirror([0.11, 0.49, 0.022]), mirror(ankle), [
      {
        at: 0,
        side: 0.062,
        front: 0.064,
        back: 0.062,
        crease: 0.005,
      },
      {
        at: 0.14,
        side: 0.064,
        front: 0.063,
        back: 0.076,
        crease: 0.005,
      },
      {
        at: 0.3,
        side: 0.064,
        front: 0.06,
        back: 0.088,
        crease: 0.005,
      },
      {
        at: 0.48,
        side: 0.058,
        front: 0.055,
        back: 0.076,
        crease: 0.005,
      },
      {
        at: 0.68,
        side: 0.051,
        front: 0.05,
        back: 0.058,
        crease: 0.004,
      },
      {
        at: 0.88,
        side: 0.047,
        front: 0.048,
        back: 0.05,
        crease: 0.003,
      },
      {
        at: 1,
        side: 0.052,
        front: 0.052,
        back: 0.055,
        crease: 0.002,
      },
    ], {
      columns: 20,
      rolls: [undefined, 0.003],
      samples: [0, 0.14, 0.3, 0.48, 0.68, 0.88, 1],
    }),
  ]
  rivets.push(rivet(mirror([knee[0] + 0.1 * 0.068 * 0.97, knee[1] + 0.06 * 0.068 * 0.97, knee[2] + 0.068 * 0.99]), mirror([0.1, 0.06, 1]), 0.0065))
  // The sabaton, from its heel to its pointed toe, its sole flat on the floor
  const toeOut = 7 * degree
  const heel = -0.085
  const toe = 0.27
  const along = [-0.082, -0.055, -0.02, 0.02, 0.06, 0.1, 0.14, 0.18, 0.215, 0.245, 0.262]
  const widths = [0.04, 0.05, 0.054, 0.056, 0.057, 0.055, 0.05, 0.042, 0.031, 0.019, 0.01]
  const heights = [0.08, 0.112, 0.122, 0.106, 0.092, 0.078, 0.064, 0.05, 0.038, 0.027, 0.018]
  const lameEdges = [0.035, 0.068, 0.101, 0.134, 0.167]
  const interpolate = (values: ReadonlyArray<number>, at: number) => {
    const index = Math.min(along.length - 2, Math.max(0, along.findLastIndex(value => value <= at)))
    const share = (at - along[index]) / (along[index + 1] - along[index])
    return values[index] + (values[index + 1] - values[index]) * share
  }
  const sections = withEdges(along, lameEdges, 0.0015).map((z): Section => {
    const height = interpolate(heights, z) + lames(z, lameEdges, 0.0045)
    return {
      at: (z - heel) / (toe - heel),
      side: interpolate(widths, z) + lames(z, lameEdges, 0.002),
      front: height / 2,
      back: height / 2,
      offset: [0, height / 2],
      square: 2.9,
    }
  })
  const [x, , z] = mirror(ankle)
  const direction = [Math.sin(toeOut) * outside, 0, Math.cos(toeOut)] as const
  parts.push(plate([x + direction[0] * heel, 0, z + direction[2] * heel], [x + direction[0] * toe, 0, z + direction[2] * toe], sections, {
    caps: [true, true],
    columns: 16,
    front: [0, 1, 0],
  }))
  return parts
}
/** One arm, `outside` 1 for the left and -1 for the right, hanging a little away from the body with its elbow a little bent: the pauldron over the shoulder, a broad cap with two lames under it and a rondel guarding the armpit in front, the rerebrace down the upper arm, the couter round the elbow with its fan of a wing, the vambrace down the forearm and the gauntlet, a flared cuff and a mitten of a hand of lames with its thumb, its fingers curling in a little. */
function arm(outside: number, rivets: Array<Rivet>) {
  const mirror = ([x, y, z]: Joint): Joint => [x * outside, y, z]
  const elbow: Joint = [0.296, 1.165, -0.036]
  const wrist: Joint = [0.312, 0.905, 0.03]
  const capCenter: Joint = [0.235, 1.488, -0.008]
  const capCrown: Joint = [0.56, 1, 0]
  const fingerLames = [0.46, 0.6, 0.74, 0.88, 1.02]
  const rondel: Joint = [0.236, 1.365, 0.122]
  const rondelFacing: Joint = [0.4, 0.05, 1]
  const parts = [
    // The cap over the shoulder, its rim rolled
    dome(mirror(capCenter), mirror(capCrown), [0, 0, 1], {
      side: 0.13,
      front: 0.14,
      back: 0.15,
      height: 0.1,
    }, [0.14, 0.28, 0.42, 0.56, 0.7, 0.82, 0.92, 1], {
      columns: 24,
      rim: theta => 112 - 6 * Math.cos(theta * degree),
      roll: 0.0035,
      // flaring out toward its rim like a bell
      swell: share => 1 + 0.15 * share ** 3,
    }),
    // Two lames lapping down the top of the arm from under it, each a little narrower than the one above
    ...[[1.44, 1.385, 0.07, 0.074], [1.4, 1.35, 0.064, 0.07]].map(([from, to, top, bottom]) => plate(mirror([0.262, from, -0.012]), mirror([0.27, to, -0.016]), [
      {
        at: 0,
        side: top,
        front: top + 0.012,
        back: top + 0.016,
      },
      {
        at: 1,
        side: bottom,
        front: bottom + 0.012,
        back: bottom + 0.016,
      },
    ], {
      columns: 20,
      rolls: [undefined, 0.003],
      samples: [0, 1],
    })),
    // The rondel in front of the armpit
    dome(mirror(rondel), mirror(rondelFacing), [0, 1, 0], {
      side: 0.046,
      front: 0.046,
      back: 0.046,
      height: 0.0075,
    }, [0.4, 0.8, 1], {
      columns: 16,
      rim: () => 90,
      roll: 0.0025,
    }),
    plate(mirror([0.268, 1.37, -0.016]), mirror(elbow), [
      {
        at: 0,
        side: 0.056,
        front: 0.058,
        back: 0.056,
      },
      {
        at: 0.6,
        side: 0.052,
        front: 0.053,
        back: 0.052,
      },
      {
        at: 1,
        side: 0.048,
        front: 0.049,
        back: 0.049,
      },
    ], {
      columns: 18,
      samples: [0, 0.35, 0.7, 1],
    }),
    dome(mirror([0.297, 1.16, -0.04]), mirror([0.25, 0, -1]), [0, 1, 0], {
      side: 0.058,
      front: 0.066,
      back: 0.064,
      height: 0.054,
    }, [0.15, 0.3, 0.45, 0.6, 0.75, 0.88, 1], {
      columns: 20,
      rim: () => 100,
      roll: 0.0028,
    }),
    // The fan of a wing on the outside of the elbow
    dome(mirror([0.346, 1.16, -0.032]), mirror([1, 0, -0.4]), [0, 1, 0], {
      side: 0.036,
      front: 0.05,
      back: 0.046,
      height: 0.007,
    }, [0.35, 0.7, 1], {
      columns: 16,
      rim: theta => 88 - 22 * Math.exp(-(((Math.abs(theta) - 180) / 28) ** 2)),
      roll: 0.0022,
    }),
    plate(mirror([0.298, 1.15, -0.031]), mirror(wrist), [
      {
        at: 0,
        side: 0.049,
        front: 0.047,
        back: 0.051,
      },
      {
        at: 0.4,
        side: 0.048,
        front: 0.046,
        back: 0.049,
      },
      {
        at: 1,
        side: 0.039,
        front: 0.036,
        back: 0.038,
      },
    ], {
      columns: 18,
      samples: [0, 0.3, 0.65, 1],
    }),
    // The gauntlet’s cuff, flaring open over the end of the vambrace like an hourglass
    plate(mirror([0.31, 0.95, 0.02]), mirror([0.313, 0.868, 0.04]), [
      {
        at: 0,
        side: 0.06,
        front: 0.058,
        back: 0.059,
      },
      {
        at: 0.25,
        side: 0.053,
        front: 0.051,
        back: 0.052,
      },
      {
        at: 0.7,
        side: 0.045,
        front: 0.043,
        back: 0.044,
      },
      {
        at: 1,
        side: 0.041,
        front: 0.039,
        back: 0.04,
      },
    ], {
      columns: 20,
      rolls: [0.003, undefined],
      samples: [0, 0.3, 0.65, 1],
    }),
    plate(mirror([0.313, 0.876, 0.038]), mirror([0.306, 0.715, 0.078]), withEdges([0, 0.2, 0.38, 0.55, 0.7, 0.85, 1], fingerLames.slice(1, -1), 0.008).map((at): Section => {
      const knuckles = Math.exp(-(((at - 0.38) / 0.24) ** 2))
      const tip = at === 1 ? 0.55 : 1
      const lame = 1 + lames(at, fingerLames, 0.12)
      return {
        at,
        side: (0.024 + 0.008 * knuckles) * tip * lame,
        front: (0.038 + 0.01 * knuckles) * tip,
        back: (0.036 + 0.008 * knuckles) * tip * lame,
        offset: [-0.018 * outside * at ** 2, 0],
        square: 2.4,
      }
    }), {
      caps: [true, true],
      columns: 16,
    }),
    plate(mirror([0.297, 0.835, 0.08]), mirror([0.29, 0.772, 0.104]), [
      {
        at: 0,
        side: 0.015,
        front: 0.016,
        back: 0.016,
      },
      {
        at: 0.7,
        side: 0.013,
        front: 0.013,
        back: 0.013,
      },
      {
        at: 1,
        side: 0.007,
        front: 0.007,
        back: 0.007,
      },
    ], {
      caps: [true, true],
      columns: 10,
    }),
  ]
  const crown = new Vector3(...mirror(capCrown))
  crown.normalize()
  const capTop = new Vector3(...mirror(capCenter))
  capTop.addScaledVector(crown, 0.1 * 0.985)
  const facing = new Vector3(...mirror(rondelFacing))
  facing.normalize()
  const rondelBoss = new Vector3(...mirror(rondel))
  rondelBoss.addScaledVector(facing, 0.0075)
  rivets.push(
    rivet(capTop.toArray(), crown.toArray(), 0.0065),
    rivet(rondelBoss.toArray(), mirror(rondelFacing), 0.007),
  )
  return parts
}

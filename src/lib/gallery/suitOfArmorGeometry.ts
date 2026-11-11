import type {LatticePoint} from './curios/lattice.ts'
import type {BufferGeometry} from 'three/webgpu'

import {Vector3} from 'three/webgpu'

import {mergeParts} from '../geometry.ts'
import {gorgetBorderReach} from './curios/helmet/Helmet.ts'
import latticeGeometry from './curios/lattice.ts'
import {suitOfArmor} from './suitOfArmor.ts'

const degree = Math.PI / 180
/** how freshly polished its steel is all over, see `ForgedSteelMaterial` */
const polish = 0.14
const steelMask = {
  name: 'steelMask',
  size: 2,
}
/** how far round from straight ahead the crease down the front of a plate reaches to either side */
const creaseSpan = 28

/** a cross section of a plate round its axis */
type Section = {
  /** where along the axis it lies, from its first end at 0 to its last at 1 */
  at: number
  back: number
  /** how far the crease down its front stands out */
  crease?: number
  front: number
  /** how far it lies off the axis, to the side and to the front */
  offset?: readonly [side: number, front: number]
  side: number
  /** how square it is, 2 for an ellipse */
  square?: number
  /** how far it curves back toward its sides, by the square of how far out to the side, like a plate wrapped round a limb behind it */
  wrap?: number
}
/** how far a dome reaches from its middle: to either side, to the front, to the back and up to its crown */
type DomeReach = {
  back: number
  front: number
  height: number
  side: number
}
/** a joint of a limb, in the frame of the left one; the right one mirrors it */
type Joint = readonly [x: number, y: number, z: number]

const sign = (value: number) => (value < 0 ? -1 : 1)
/** a superellipse’s coordinate of the direction’s coordinate, squarer the larger `square` is */
const squared = (value: number, square: number) => sign(value) * Math.abs(value) ** (2 / square)
const columnsOf = (count: number) => Array.from({length: count}, (_, index) => -180 + index * 360 / count)
const steel = (position: Vector3, hole = 0, shine = polish): LatticePoint => ({
  position: position.toArray(),
  values: [hole, shine],
})
/** the outward bulge of the crease down a plate’s front at `theta` degrees round from straight ahead */
const creaseAt = (theta: number, crease = 0) => crease * Math.max(0, 1 - Math.abs(theta) / creaseSpan) ** 1.5
/** the sawtooth of lames lapping over each other between the edges: each grows from nothing to `rise` toward the next edge, under which the next one starts again from nothing */
const lames = (value: number, edges: ReadonlyArray<number>, rise: number) => {
  const index = edges.findLastIndex(edge => edge <= value)
  if (index === -1 || index === edges.length - 1) {
    return 0
  }
  return rise * (value - edges[index]) / (edges[index + 1] - edges[index])
}
/** the samples of `values` with every edge stepped across, a tiny step either side of it so it stands crisp */
const withEdges = (values: ReadonlyArray<number>, edges: ReadonlyArray<number>, step: number) => [...values.filter(value => edges.every(edge => Math.abs(value - edge) > step * 2)), ...edges.flatMap(edge => [edge - step, edge + step])].toSorted((a, b) => a - b)
/**
 * A plate wrapped round the axis from `from` to `to` through its sections, its front turned toward `front` as far as the axis lets it, closed flat at the ends asked for.
 * Its rows run from `from` to `to`, see `latticeGeometry`.
 */
function plate(from: Joint, to: Joint, sections: ReadonlyArray<Section>, {caps = [true, true], columns, front = [0, 0, 1], shine = polish}: {
  caps?: readonly [start: boolean, end: boolean]
  columns: number
  front?: Joint
  shine?: number
}) {
  const start = new Vector3(...from)
  const axis = new Vector3(...to)
  axis.sub(start)
  const down = axis.clone().normalize()
  const ahead = new Vector3(...front)
  ahead.addScaledVector(down, -ahead.dot(down)).normalize()
  const side = new Vector3
  side.crossVectors(ahead, down)
  const centerOf = ({at, offset: [across, forward] = [0, 0]}: Section) => start.clone().addScaledVector(axis, at).addScaledVector(side, across).addScaledVector(ahead, forward)
  const thetas = columnsOf(columns)
  const rows = sections.map(section => {
    const center = centerOf(section)
    const {back, crease, front: frontReach, side: sideReach, square = 2, wrap = 0} = section
    return thetas.map(theta => {
      const [sin, cos] = [Math.sin(theta * degree), Math.cos(theta * degree)]
      const depth = cos > 0 ? frontReach : back
      const across = sideReach * squared(sin, square)
      return steel(center.clone().addScaledVector(side, across).addScaledVector(ahead, depth * squared(cos, square) + creaseAt(theta, crease) - wrap * across ** 2), 0, shine)
    })
  })
  return latticeGeometry(rows, {
    start: caps[0] ? steel(centerOf(sections[0]), 0, shine) : undefined,
    end: caps[1] ? steel(centerOf(sections.at(-1)!), 0, shine) : undefined,
    extra: steelMask,
  })
}
/**
 * A dome of plate over `center`, its crown toward `up`, its front turned toward `front` as far as `up` lets it, from its crown down to the last of `phis`, polar angles in degrees from the crown, each scaled out from the middle by `swell` there, open at its rim.
 */
function dome(center: Joint, up: Joint, front: Joint, {back, front: frontReach, height, side: sideReach}: DomeReach, phis: ReadonlyArray<number>, {columns, shine = polish, swell = () => 1}: {
  columns: number
  shine?: number
  swell?: (phi: number) => number
}) {
  const middle = new Vector3(...center)
  const crown = new Vector3(...up)
  crown.normalize()
  const ahead = new Vector3(...front)
  ahead.addScaledVector(crown, -ahead.dot(crown)).normalize()
  const side = new Vector3
  side.crossVectors(crown, ahead)
  const thetas = columnsOf(columns)
  const at = (phi: number, theta: number) => {
    const [sinPhi, cosPhi] = [Math.sin(phi * degree), Math.cos(phi * degree)]
    const [sin, cos] = [Math.sin(theta * degree), Math.cos(theta * degree)]
    const scale = swell(phi)
    return middle.clone()
      .addScaledVector(side, sideReach * sinPhi * sin * scale)
      .addScaledVector(ahead, (cos > 0 ? frontReach : back) * sinPhi * cos * scale)
      .addScaledVector(crown, height * cosPhi * scale)
  }
  return latticeGeometry(phis.map(phi => thetas.map(theta => steel(at(phi, theta), 0, shine))), {
    start: steel(at(0, 0), 0, shine),
    extra: steelMask,
  })
}
/**
 * The breastplate and the backplate in one: from the dark of its empty neck up over a rolled lip, out under the helmet’s gorget, sloping off just under its border all round so the gorget rests on it, then over a high ridge of shoulders and down a swelling breast with a medial crease to a flaring waist.
 */
function cuirass() {
  const {collar} = suitOfArmor
  const thetas = columnsOf(56)
  const ring = (y: number, reach: (theta: number) => readonly [side: number, front: number], hole = 0, shine = polish) => thetas.map(theta => {
    const [across, forward] = reach(theta)
    return steel(new Vector3(across, y, forward), hole, shine)
  })
  const round = (radius: number) => (theta: number) => [radius * Math.sin(theta * degree), radius * Math.cos(theta * degree)] as const
  const rows = [
    ring(collar - 0.09, round(0.07), 1, 0),
    ring(collar - 0.02, round(0.074), 0.55, 0.04),
    ring(collar + 0.006, round(0.076)),
    ring(collar + 0.014, round(0.084), 0, 0.28),
    ring(collar + 0.008, round(0.09), 0, 0.22),
    // The yoke, a low dome under the gorget, down to a hair under its border
    ...[0.62, 0.78, 0.9, 1].map(share => ring(collar - 0.0016 + 0.018 * (1 - share ** 2), theta => round(share * gorgetBorderReach(theta))(theta), 0, 0.2)),
  ]
  const sections = [
    [-0.03, 0.196, 0.228, 0.188, 2.5, 0.006],
    [-0.08, 0.214, 0.244, 0.184, 2.45, 0.012],
    [-0.15, 0.222, 0.252, 0.176, 2.35, 0.016],
    [-0.23, 0.208, 0.232, 0.162, 2.25, 0.014],
    [-0.32, 0.184, 0.198, 0.146, 2.15, 0.01],
    [-0.4, 0.164, 0.168, 0.132, 2.1, 0.006],
    [-0.44, 0.174, 0.178, 0.14, 2.15, 0.004],
    [-0.455, 0.168, 0.172, 0.134, 2.1, 0.002],
  ] as const
  for (const [y, side, front, back, square, crease] of sections) {
    rows.push(ring(collar + y, theta => {
      const [sin, cos] = [Math.sin(theta * degree), Math.cos(theta * degree)]
      return [side * squared(sin, square), (cos > 0 ? front : back) * squared(cos, square) + creaseAt(theta, crease)]
    }, 0, 0.16))
  }
  return latticeGeometry(rows, {
    start: steel(new Vector3(0, collar - 0.11, 0), 1, 0),
    extra: steelMask,
  })
}
/** where the cuirass ends at the waist, under which the fauld’s lames hang, and how far it reaches there to the side, the front and the back */
const waist = [suitOfArmor.collar - 0.455, 0.168, 0.172, 0.134] as const
/**
 * The steel of the suit of armor, see `suitOfArmor`, every plate carrying its `steelMask` for `ForgedSteelMaterial`: only the inside of its empty neck lies in a hole, showing dark. Ridges, rolled edges and the bevels of the lames are polished brighter than the plates.
 * Its plates are open where they lap over each other, so show it from both sides.
 */
export default function suitOfArmorGeometry() {
  return mergeParts([cuirass(), ...fauld(), ...[1, -1].flatMap(outside => [...leg(outside), ...arm(outside)])])
}
/** The fauld: five hoops of lames lapping down over the hips from under the cuirass’ waist, each flaring further, most to the sides, and two tassets of three lames hanging from the lowest over the front of the thighs. */
function fauld() {
  const [top, side, front, back] = waist
  const parts: Array<BufferGeometry> = []
  for (let index = 0; index < 5; index++) {
    const y = top + 0.012 - index * 0.052
    const section = (at: number, out: number): Section => ({
      at,
      side: side + 0.006 + index * 0.014 + out,
      front: front + 0.006 + index * 0.009 + out,
      back: back + 0.004 + index * 0.004 + out * 0.55,
      square: 2.25,
    })
    parts.push(plate([0, y, 0], [0, y - 0.068, 0], [section(0, -0.008), section(0.18, 0), section(0.72, 0.012), section(0.9, 0.016), section(1, 0.01)], {
      caps: [false, false],
      columns: 40,
      shine: 0.18,
    }))
  }
  const hem = top + 0.012 - 4 * 0.052 - 0.068
  for (const x of [-0.1, 0.1]) {
    const lamesDown = [[hem + 0.018, hem - 0.07], [hem - 0.058, hem - 0.15], [hem - 0.136, hem - 0.23]] as const
    for (const [index, [from, to]] of lamesDown.entries()) {
      const forward = (y: number) => 0.198 - (hem + 0.018 - y) * 0.28 - index * 0.006
      const widths = index === 2 ? [0.09, 0.092, 0.09, 0.078, 0.058] : [0.086, 0.09, 0.092, 0.092, 0.09]
      const sections = [0, 0.16, 0.55, 0.84, 1].map((at, row): Section => {
        const y = from + (to - from) * at
        return {
          at,
          side: widths[row],
          front: 0.006,
          back: 0.006,
          offset: [0, forward(y) - forward(from)],
          wrap: 3.2,
        }
      })
      parts.push(plate([x, from, forward(from)], [x, to, forward(from)], sections, {
        columns: 16,
        shine: 0.16,
      }))
    }
  }
  return parts
}
/** One leg, `outside` 1 for the left and -1 for the right: the cuisse down the thigh, the poleyn over the knee with its wing on the outside, the greave down the shin and the calf and the sabaton of lames over the foot, its toes turned a little out. */
function leg(outside: number) {
  const mirror = ([x, y, z]: Joint): Joint => [x * outside, y, z]
  const hip: Joint = [0.1, 1.05, 0.01]
  const knee: Joint = [0.11, 0.52, 0.03]
  const ankle: Joint = [0.115, 0.09, 0.005]
  const parts = [
    plate(mirror(hip), mirror([0.11, 0.58, 0.026]), [
      {
        at: 0,
        side: 0.082,
        front: 0.09,
        back: 0.08,
        crease: 0.004,
      },
      {
        at: 0.3,
        side: 0.086,
        front: 0.094,
        back: 0.084,
        crease: 0.006,
      },
      {
        at: 0.7,
        side: 0.074,
        front: 0.08,
        back: 0.072,
        crease: 0.005,
      },
      {
        at: 1,
        side: 0.064,
        front: 0.068,
        back: 0.064,
        crease: 0.004,
      },
    ], {
      columns: 20,
      shine: 0.16,
    }),
    dome(mirror(knee), mirror([0.14, 0.08, 1]), [0, 1, 0], {
      side: 0.082,
      front: 0.094,
      back: 0.084,
      height: 0.074,
    }, [14, 28, 42, 56, 70, 84, 98], {
      columns: 20,
      shine: 0.22,
    }),
    dome(mirror([0.182, 0.52, 0.01]), mirror([1, 0.05, 0.25]), [0, 1, 0], {
      side: 0.042,
      front: 0.056,
      back: 0.05,
      height: 0.018,
    }, [28, 56, 80, 96], {
      columns: 12,
      shine: 0.24,
    }),
    plate(mirror([0.11, 0.48, 0.024]), mirror(ankle), [
      {
        at: 0,
        side: 0.064,
        front: 0.066,
        back: 0.064,
        crease: 0.005,
      },
      {
        at: 0.14,
        side: 0.068,
        front: 0.066,
        back: 0.082,
        crease: 0.006,
      },
      {
        at: 0.32,
        side: 0.07,
        front: 0.064,
        back: 0.096,
        crease: 0.006,
      },
      {
        at: 0.52,
        side: 0.062,
        front: 0.058,
        back: 0.082,
        crease: 0.005,
      },
      {
        at: 0.74,
        side: 0.054,
        front: 0.054,
        back: 0.062,
        crease: 0.004,
      },
      {
        at: 1,
        side: 0.052,
        front: 0.054,
        back: 0.058,
        crease: 0.003,
      },
    ], {
      columns: 20,
      shine: 0.16,
    }),
  ]
  const toeOut = 9 * degree
  const heel = -0.09
  const toe = 0.26
  const along = [-0.085, -0.055, -0.02, 0.02, 0.055, 0.09, 0.125, 0.16, 0.195, 0.225, 0.248]
  const widths = [0.04, 0.052, 0.058, 0.06, 0.061, 0.06, 0.056, 0.05, 0.04, 0.028, 0.014]
  const heights = [0.08, 0.112, 0.124, 0.108, 0.094, 0.08, 0.066, 0.054, 0.042, 0.032, 0.02]
  const lameEdges = [0.02, 0.055, 0.09, 0.125, 0.16, 0.195]
  const interpolate = (values: ReadonlyArray<number>, at: number) => {
    const index = Math.min(along.length - 2, Math.max(0, along.findLastIndex(value => value <= at)))
    const share = (at - along[index]) / (along[index + 1] - along[index])
    return values[index] + (values[index + 1] - values[index]) * share
  }
  const sections = withEdges(along, lameEdges, 0.0016).map((z): Section => {
    const height = interpolate(heights, z) + lames(z, lameEdges, 0.005)
    return {
      at: (z - heel) / (toe - heel),
      side: interpolate(widths, z) + lames(z, lameEdges, 0.0025),
      front: height / 2,
      back: height / 2,
      offset: [0, height / 2],
      square: 2.9,
    }
  })
  const [x, , z] = mirror(ankle)
  const direction = [Math.sin(toeOut) * outside, 0, Math.cos(toeOut)] as const
  parts.push(plate([x + direction[0] * heel, 0, z + direction[2] * heel], [x + direction[0] * toe, 0, z + direction[2] * toe], sections, {
    columns: 18,
    front: [0, 1, 0],
    shine: 0.2,
  }))
  return parts
}
/** One arm, `outside` 1 for the left and -1 for the right, hanging a little away from the body with its elbow a little bent: a pauldron of lames over the shoulder, the rerebrace, the couter with its wing, the vambrace, and a gauntlet of a flared cuff and a mitten with a thumb. */
function arm(outside: number) {
  const mirror = ([x, y, z]: Joint): Joint => [x * outside, y, z]
  const elbow: Joint = [0.29, 1.18, -0.04]
  const pauldronLames = [0, 64, 80, 96, 112]
  const fingerLames = [0.46, 0.62, 0.76, 0.9, 1.04]
  return [
    dome(mirror([0.16, 1.5, 0.02]), [0.1, 1, 0], [0, 0, 1], {
      side: 0.16,
      front: 0.14,
      back: 0.17,
      height: 0.09,
    }, withEdges([16, 34, 52, 70, 88, 106], pauldronLames.slice(1, -1), 0.5), {
      columns: 24,
      shine: 0.22,
      swell: phi => 1 + lames(phi, pauldronLames, 0.07),
    }),
    plate(mirror([0.225, 1.46, -0.014]), mirror(elbow), [
      {
        at: 0,
        side: 0.056,
        front: 0.058,
        back: 0.056,
      },
      {
        at: 0.55,
        side: 0.054,
        front: 0.055,
        back: 0.054,
      },
      {
        at: 1,
        side: 0.05,
        front: 0.052,
        back: 0.05,
      },
    ], {
      columns: 16,
      shine: 0.16,
    }),
    dome(mirror([0.292, 1.17, -0.046]), mirror([0.2, 0.05, -1]), [0, 1, 0], {
      side: 0.062,
      front: 0.072,
      back: 0.068,
      height: 0.056,
    }, [16, 34, 52, 70, 88, 104], {
      columns: 16,
      shine: 0.22,
    }),
    dome(mirror([0.348, 1.17, -0.038]), mirror([1, 0, -0.35]), [0, 1, 0], {
      side: 0.036,
      front: 0.05,
      back: 0.046,
      height: 0.016,
    }, [30, 58, 82, 96], {
      columns: 12,
      shine: 0.24,
    }),
    plate(mirror([0.292, 1.155, -0.034]), mirror([0.31, 0.92, 0.036]), [
      {
        at: 0,
        side: 0.05,
        front: 0.048,
        back: 0.052,
      },
      {
        at: 0.45,
        side: 0.048,
        front: 0.046,
        back: 0.05,
      },
      {
        at: 1,
        side: 0.04,
        front: 0.038,
        back: 0.04,
      },
    ], {
      columns: 16,
      shine: 0.16,
    }),
    plate(mirror([0.308, 0.95, 0.028]), mirror([0.312, 0.86, 0.052]), [
      {
        at: 0,
        side: 0.06,
        front: 0.058,
        back: 0.058,
      },
      {
        at: 0.18,
        side: 0.056,
        front: 0.054,
        back: 0.054,
      },
      {
        at: 0.7,
        side: 0.046,
        front: 0.044,
        back: 0.045,
      },
      {
        at: 1,
        side: 0.04,
        front: 0.038,
        back: 0.039,
      },
    ], {
      caps: [false, true],
      columns: 16,
      shine: 0.2,
    }),
    plate(mirror([0.312, 0.88, 0.048]), mirror([0.3, 0.72, 0.09]), withEdges([0, 0.18, 0.36, 0.52, 0.68, 0.84, 1], fingerLames.slice(1, -1), 0.01).map((at): Section => {
      const knuckles = Math.exp(-(((at - 0.42) / 0.24) ** 2))
      const tip = at === 1 ? 0.5 : 1
      const lame = 1 + lames(at, fingerLames, 0.14)
      return {
        at,
        side: (0.024 + 0.008 * knuckles) * tip * lame,
        front: (0.04 + 0.01 * knuckles) * tip,
        back: (0.036 + 0.008 * knuckles) * tip * lame,
        offset: [-0.018 * outside * at ** 2, 0],
        square: 2.5,
      }
    }), {
      columns: 12,
      shine: 0.18,
    }),
    plate(mirror([0.296, 0.85, 0.086]), mirror([0.284, 0.78, 0.116]), [
      {
        at: 0,
        side: 0.016,
        front: 0.017,
        back: 0.016,
      },
      {
        at: 0.65,
        side: 0.014,
        front: 0.014,
        back: 0.014,
      },
      {
        at: 1,
        side: 0.008,
        front: 0.008,
        back: 0.008,
      },
    ], {
      columns: 8,
      shine: 0.18,
    }),
  ]
}

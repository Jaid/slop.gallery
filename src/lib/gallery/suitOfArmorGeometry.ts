import type {LatticePoint} from './curios/lattice.ts'
import type {BufferGeometry} from 'three/webgpu'

import {Float32BufferAttribute, Quaternion, SphereGeometry, Vector3} from 'three/webgpu'

import {mergeParts} from '../geometry.ts'
import {gorgetBorderReach} from './curios/helmet/Helmet.ts'
import latticeGeometry from './curios/lattice.ts'
import {suitOfArmor} from './suitOfArmor.ts'

const degree = Math.PI / 180
/** how freshly polished its steel is all over, see `ForgedSteelMaterial` */
const polish = 0.1
const steelMask = {
  name: 'steelMask',
  size: 2,
}
/** how far round from straight ahead the crease down the front of a plate reaches to either side */
const creaseSpan = 24

/** a cross section of a plate round its axis */
type Section = {
  /** where along the axis it lies, from its first end at 0 to its last at 1 */
  at: number
  back: number
  /** how far the crease down its front stands out */
  crease?: number
  front: number
  /** how far this row lies in darkness, for the mail showing between plates */
  hole?: number
  /** how far it lies off the axis, to the side and to the front */
  offset?: readonly [side: number, front: number]
  /** how freshly polished this row is, brighter on rolled edges and trim than on the broad plates */
  polish?: number
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
/** low rivet heads on the surface at the points, facing out along their normals, bright from handling */
function rivets(points: ReadonlyArray<{
  normal: Joint
  position: Joint
}>, radius = 0.0055) {
  const up = new Vector3(0, 1, 0)
  const turn = new Quaternion
  return points.map(({normal, position}) => {
    const head = new SphereGeometry(radius, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2)
    head.deleteAttribute('uv')
    const facing = new Vector3(...normal)
    head.scale(1, 0.55, 1).applyQuaternion(turn.setFromUnitVectors(up, facing.normalize())).translate(...position)
    head.setAttribute('steelMask', new Float32BufferAttribute(Float32Array.from({length: head.getAttribute('position').count * 2}, (_, index) => (index % 2 ? 0.75 : 0)), 2))
    return head
  })
}
/** points on a horizontal plate ring at the given angles round from straight ahead, for rivets along a plate’s edge; only the front and sides carry them, the back stays plain */
const ringPoints = (y: number, side: number, front: number, back: number, thetas: ReadonlyArray<number>): Array<{
  normal: Joint
  position: Joint
}> => thetas.map(theta => {
  const [sin, cos] = [Math.sin(theta * degree), Math.cos(theta * degree)]
  return {
    normal: [sin, 0.2, cos] as Joint,
    position: [side * sin, y, (cos > 0 ? front : back) * cos] as Joint,
  }
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
function plate(from: Joint, to: Joint, sections: ReadonlyArray<Section>, {caps = [true, true], columns, front = [0, 0, 1]}: {
  caps?: readonly [start: boolean, end: boolean]
  columns: number
  front?: Joint
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
    const {back, crease, front: frontReach, hole = 0, side: sideReach, square = 2, wrap = 0, polish: shine = polish} = section
    return thetas.map(theta => {
      const [sin, cos] = [Math.sin(theta * degree), Math.cos(theta * degree)]
      const depth = cos > 0 ? frontReach : back
      const across = sideReach * squared(sin, square)
      return steel(center.clone().addScaledVector(side, across).addScaledVector(ahead, depth * squared(cos, square) + creaseAt(theta, crease) - wrap * across ** 2), hole, shine)
    })
  })
  return latticeGeometry(rows, {
    start: caps[0] ? steel(centerOf(sections[0])) : undefined,
    end: caps[1] ? steel(centerOf(sections.at(-1)!)) : undefined,
    extra: steelMask,
  })
}
/**
 * A dome of plate over `center`, its crown toward `up`, its front turned toward `front` as far as `up` lets it, from its crown down to the last of `phis`, polar angles in degrees from the crown, each scaled out from the middle by `swell` there, open at its rim.
 */
function dome(center: Joint, up: Joint, front: Joint, {back, front: frontReach, height, side: sideReach}: DomeReach, phis: ReadonlyArray<number>, {columns, flutes = 0, swell = () => 1}: {
  columns: number
  /** radial flutes round the dome, as a share of its reach: the shallow channels chased into pauldrons and joint wings */
  flutes?: number
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
    // Seven shallow flutes chased round the dome.
    const fluted = scale * (1 + flutes * Math.sin(theta * degree * 7))
    return middle.clone()
      .addScaledVector(side, sideReach * sinPhi * sin * fluted)
      .addScaledVector(ahead, (cos > 0 ? frontReach : back) * sinPhi * cos * fluted)
      .addScaledVector(crown, height * cosPhi * scale)
  }
  return latticeGeometry(phis.map(phi => thetas.map(theta => steel(at(phi, theta)))), {
    start: steel(at(0, 0)),
    extra: steelMask,
  })
}
/**
 * The breastplate and the backplate in one: a dark empty neck at the very top, ringed by the flat seat the helmet’s
 * gorget rests on at the full height of the body, the seat sloping away under the gorget’s border all round, then
 * over the shoulders and down the swelling, centrally creased breast — a polished plackart band across its lower
 * half — to the waist, where it flares into a lip. Rivets run along the plackart’s edge and the breast’s arm holes.
 */
function cuirass() {
  const {collar} = suitOfArmor
  const thetas = columnsOf(64)
  const ring = (y: number, reach: (theta: number) => readonly [side: number, front: number], hole = 0, shine = polish) => thetas.map(theta => {
    const [across, forward] = reach(theta)
    return steel(new Vector3(across, y, forward), hole, shine)
  })
  const round = (radius: number) => (theta: number) => [radius * Math.sin(theta * degree), radius * Math.cos(theta * degree)] as const
  const rows = [
    ring(collar - 0.09, round(0.06), 1),
    // The flat seat at the top of the body, which the helmet stands on, its rolled inner lip bright from wear.
    ring(collar, round(0.072), 0.35, 0.8),
    ring(collar - 0.013, round(0.079), 0, 0.45),
    ring(collar - 0.027, round(0.086)),
    // The yoke, a low dome under the gorget, down to a hair under its border
    ...[0.55, 0.72, 0.86, 1].map(share => ring(collar - 0.002 - 0.02 * (1 - share ** 2), theta => round(share * gorgetBorderReach(theta))(theta))),
  ]
  const sections = [
    [-0.032, 0.19, 0.202, 0.178, 2.6, 0.005, polish],
    [-0.08, 0.21, 0.214, 0.178, 2.6, 0.01, polish],
    [-0.16, 0.206, 0.214, 0.166, 2.5, 0.02, polish],
    [-0.24, 0.186, 0.197, 0.152, 2.4, 0.02, polish],
    [-0.32, 0.166, 0.174, 0.138, 2.3, 0.014, 0.55],
    [-0.4, 0.15, 0.154, 0.126, 2.2, 0.009, polish],
    [-0.47, 0.147, 0.147, 0.122, 2.1, 0.006, polish],
    [-0.5, 0.152, 0.151, 0.126, 2.1, 0.004, 0.5],
  ] as const
  for (const [y, side, front, back, square, crease, shine] of sections) {
    rows.push(ring(collar + y, theta => {
      const [sin, cos] = [Math.sin(theta * degree), Math.cos(theta * degree)]
      return [side * squared(sin, square), (cos > 0 ? front : back) * squared(cos, square) + creaseAt(theta, crease)]
    }, 0, shine))
  }
  const breast = latticeGeometry(rows, {
    start: steel(new Vector3(0, collar - 0.11, 0), 1),
    extra: steelMask,
  })
  return mergeParts([breast, ...rivets([
    ...ringPoints(collar - 0.335, 0.163, 0.171, 0.135, [-64, -42, -20, 0, 20, 42, 64]),
    ...ringPoints(collar - 0.485, 0.149, 0.149, 0.123, [-58, -34, -12, 12, 34, 58]),
  ])])
}
/** where the cuirass ends at the waist, under which the fauld’s lames hang, and how far it reaches there to the side, the front and the back */
const waist = [suitOfArmor.collar - 0.5, 0.152, 0.151, 0.126] as const
/**
 * The steel of the suit of armor, see `suitOfArmor`, every plate carrying its `steelMask` for `ForgedSteelMaterial`: only the inside of its empty neck lies in a hole, showing dark.
 * Its plates are open where they lap over each other, so show it from both sides.
 */
export default function suitOfArmorGeometry() {
  return mergeParts([cuirass(), ...fauld(), ...[1, -1].flatMap(outside => [...leg(outside), ...arm(outside)])])
}
/** The fauld: five hoops of lames lapping down over the hips from under the cuirass’ waist, each flaring out a little further, most to the sides and least over the rump, and two tassets hanging from the lowest over the front of the thighs, each of three lames with a polished lower edge. */
function fauld() {
  const [top, side, front, back] = waist
  const parts: Array<BufferGeometry> = []
  for (let index = 0; index < 5; index++) {
    const y = top + 0.012 - index * 0.05
    const section = (at: number, out: number): Section => ({
      at,
      side: side + 0.004 + index * 0.01 + out,
      front: front + 0.004 + index * 0.006 + out,
      back: back + 0.004 + index * 0.003 + out * 0.6,
      square: 2.2,
      polish: at === 1 ? 0.4 : polish,
    })
    parts.push(plate([0, y, 0], [0, y - 0.066, 0], [section(0, -0.006), section(0.2, 0), section(0.8, 0.01), section(0.92, 0.012), section(1, 0.008)], {
      caps: [false, false],
      columns: 44,
    }))
  }
  const hem = top + 0.012 - 4 * 0.05 - 0.066
  // A skirt of dark mail under the fauld’s last lame, showing between it and the cuisses and tassets.
  parts.push(plate([0, hem + 0.02, 0], [0, hem - 0.038, 0], [0, 0.45, 1].map((at): Section => ({
    at,
    side: side + 0.02 + at * 0.003,
    front: front + 0.018 + at * 0.002,
    back: back + 0.016 + at * 0.002,
    square: 2.2,
    hole: 1,
    polish: 0,
  })), {
    caps: [false, false],
    columns: 36,
  }))
  for (const x of [-0.098, 0.098]) {
    for (const [index, [from, to]] of [[hem + 0.018, hem - 0.062], [hem - 0.052, hem - 0.128], [hem - 0.118, hem - 0.188]].entries()) {
      const forward = (y: number) => 0.172 - (hem + 0.018 - y) * 0.42 - index * 0.004
      // The lowest lame rounds off at its foot and shines along its edge.
      const widths = index === 2 ? [0.086, 0.087, 0.087, 0.084, 0.07] : [0.082, 0.084, 0.086, 0.087, 0.087]
      const sections = [0, 0.15, 0.6, 0.88, 1].map((at, row): Section => {
        const y = from + (to - from) * at
        return {
          at,
          side: widths[row],
          front: 0.005,
          back: 0.005,
          offset: [0, forward(y) - forward(from)],
          wrap: 3.6,
          polish: index === 2 && row === 4 ? 0.5 : polish,
        }
      })
      parts.push(plate([x, from, forward(from)], [x, to, forward(from)], sections, {columns: 20}))
    }
  }
  return parts
}
/** One leg, `outside` 1 for the left and -1 for the right: the cuisse down the thigh, the poleyn over the knee with its wing on the outside, the greave down the shin and the calf and the sabaton of lames over the foot, its toes turned a little out. */
function leg(outside: number) {
  const mirror = ([x, y, z]: Joint): Joint => [x * outside, y, z]
  const hip: Joint = [0.098, 1.03, 0.005]
  const knee: Joint = [0.108, 0.545, 0.028]
  const ankle: Joint = [0.113, 0.09, 0]
  const parts = [
    plate(mirror(hip), mirror([0.108, 0.575, 0.025]), [
      {
        at: 0,
        side: 0.073,
        front: 0.079,
        back: 0.073,
        crease: 0.003,
      },
      {
        at: 0.35,
        side: 0.074,
        front: 0.08,
        back: 0.075,
        crease: 0.004,
      },
      {
        at: 0.75,
        side: 0.07,
        front: 0.074,
        back: 0.068,
        crease: 0.004,
      },
      {
        at: 1,
        side: 0.062,
        front: 0.066,
        back: 0.062,
        crease: 0.003,
      },
    ], {columns: 28}),
    dome(mirror(knee), mirror([0.12, 0.06, 1]), [0, 1, 0], {
      side: 0.076,
      front: 0.085,
      back: 0.078,
      height: 0.078,
    }, [12, 24, 36, 48, 60, 72, 84, 98, 108], {
      columns: 28,
      flutes: 0.03,
    }),
    // The wing on the outside of the knee
    dome(mirror([0.172, 0.545, 0.01]), mirror([1, 0, 0.3]), [0, 1, 0], {
      side: 0.036,
      front: 0.048,
      back: 0.044,
      height: 0.016,
    }, [25, 50, 75, 90], {
      columns: 16,
      flutes: 0.05,
    }),
    plate(mirror([0.108, 0.51, 0.022]), mirror(ankle), [
      {
        at: 0,
        side: 0.058,
        front: 0.06,
        back: 0.058,
        crease: 0.004,
      },
      {
        at: 0.12,
        side: 0.061,
        front: 0.06,
        back: 0.072,
        crease: 0.004,
      },
      {
        at: 0.27,
        side: 0.062,
        front: 0.058,
        back: 0.084,
        crease: 0.004,
      },
      {
        at: 0.45,
        side: 0.057,
        front: 0.054,
        back: 0.074,
        crease: 0.004,
      },
      {
        at: 0.65,
        side: 0.051,
        front: 0.05,
        back: 0.058,
        crease: 0.004,
      },
      {
        at: 0.85,
        side: 0.046,
        front: 0.047,
        back: 0.05,
        crease: 0.003,
      },
      {
        at: 1,
        side: 0.05,
        front: 0.05,
        back: 0.054,
        crease: 0.002,
      },
    ], {columns: 28}),
  ]
  // The sabaton, from its heel to its toe, its sole flat on the floor
  const toeOut = 8 * degree
  const heel = -0.085
  const toe = 0.262
  const along = [-0.082, -0.055, -0.02, 0.02, 0.05, 0.08, 0.11, 0.14, 0.17, 0.2, 0.225, 0.248]
  const widths = [0.037, 0.047, 0.051, 0.053, 0.054, 0.053, 0.05, 0.045, 0.037, 0.027, 0.017, 0.007]
  const heights = [0.078, 0.108, 0.118, 0.102, 0.09, 0.078, 0.066, 0.054, 0.043, 0.033, 0.024, 0.014]
  const lameEdges = [0.02, 0.05, 0.08, 0.11, 0.14, 0.17, 0.2]
  const interpolate = (values: ReadonlyArray<number>, at: number) => {
    const index = Math.min(along.length - 2, Math.max(0, along.findLastIndex(value => value <= at)))
    const share = (at - along[index]) / (along[index + 1] - along[index])
    return values[index] + (values[index + 1] - values[index]) * share
  }
  const sections = withEdges(along, lameEdges, 0.0015).map((z): Section => {
    const height = interpolate(heights, z) + lames(z, lameEdges, 0.004)
    return {
      at: (z - heel) / (toe - heel),
      side: interpolate(widths, z) + lames(z, lameEdges, 0.002),
      front: height / 2,
      back: height / 2,
      offset: [0, height / 2],
      square: 2.8,
    }
  })
  const [x, , z] = mirror(ankle)
  const direction = [Math.sin(toeOut) * outside, 0, Math.cos(toeOut)] as const
  parts.push(plate([x + direction[0] * heel, 0, z + direction[2] * heel], [x + direction[0] * toe, 0, z + direction[2] * toe], sections, {
    columns: 28,
    front: [0, 1, 0],
  }))
  return parts
}
/** One arm, `outside` 1 for the left and -1 for the right, hanging a little away from the body with its elbow a little bent: the pauldron of lames over the shoulder, the rerebrace down the upper arm, the couter round the elbow with its wing, the vambrace down the forearm and the gauntlet, a flared cuff and a mitten of a hand with its thumb, its fingers curling in a little. */
function arm(outside: number) {
  const mirror = ([x, y, z]: Joint): Joint => [x * outside, y, z]
  const elbow: Joint = [0.278, 1.17, -0.038]
  const pauldronLames = [0, 62, 78, 94, 110, 124]
  const fingerLames = [0.5, 0.64, 0.78, 0.92, 1.06]
  return [
    dome(mirror([0.224, 1.478, -0.005]), mirror([0.42, 1, 0]), [0, 0, 1], {
      side: 0.148,
      front: 0.162,
      back: 0.17,
      height: 0.11,
    }, withEdges([10, 22, 34, 46, 58, 70, 82, 94, 106, 118], pauldronLames.slice(1, -1), 0.4), {
      columns: 36,
      flutes: 0.016,
      swell: phi => 1 + lames(phi, pauldronLames, 0.055),
    }),
    // The besagew: a small fluted disc guarding the front of the armpit.
    dome(mirror([0.132, 1.425, 0.168]), mirror([0.35, 0.2, 1]), [0, 1, 0], {
      side: 0.027,
      front: 0.03,
      back: 0.03,
      height: 0.009,
    }, [28, 55, 82], {
      columns: 16,
      flutes: 0.06,
    }),
    plate(mirror([0.22, 1.415, -0.012]), mirror(elbow), [
      {
        at: 0,
        side: 0.057,
        front: 0.059,
        back: 0.057,
      },
      {
        at: 0.6,
        side: 0.054,
        front: 0.055,
        back: 0.054,
      },
      {
        at: 1,
        side: 0.05,
        front: 0.051,
        back: 0.051,
      },
    ], {columns: 20}),
    dome(mirror([0.278, 1.165, -0.043]), mirror([0.25, 0, -1]), [0, 1, 0], {
      side: 0.054,
      front: 0.062,
      back: 0.06,
      height: 0.05,
    }, [15, 30, 45, 60, 75, 90, 100], {columns: 20}),
    // The wing on the outside of the elbow
    dome(mirror([0.325, 1.165, -0.038]), mirror([1, 0, -0.4]), [0, 1, 0], {
      side: 0.032,
      front: 0.042,
      back: 0.04,
      height: 0.014,
    }, [25, 50, 75, 90], {
      columns: 20,
      flutes: 0.05,
    }),
    plate(mirror([0.28, 1.152, -0.032]), mirror([0.298, 0.945, 0.03]), [
      {
        at: 0,
        side: 0.052,
        front: 0.05,
        back: 0.054,
      },
      {
        at: 0.4,
        side: 0.05,
        front: 0.048,
        back: 0.051,
      },
      {
        at: 1,
        side: 0.042,
        front: 0.039,
        back: 0.041,
      },
    ], {columns: 20}),
    // The gauntlet’s cuff, flaring open over the end of the vambrace
    plate(mirror([0.297, 0.968, 0.024]), mirror([0.3, 0.898, 0.042]), [
      {
        at: 0,
        side: 0.053,
        front: 0.051,
        back: 0.052,
      },
      {
        at: 0.15,
        side: 0.051,
        front: 0.049,
        back: 0.05,
      },
      {
        at: 0.65,
        side: 0.044,
        front: 0.042,
        back: 0.043,
      },
      {
        at: 1,
        side: 0.038,
        front: 0.036,
        back: 0.037,
      },
    ], {
      caps: [false, true],
      columns: 20,
    }),
    plate(mirror([0.3, 0.908, 0.04]), mirror([0.295, 0.768, 0.078]), withEdges([0, 0.2, 0.4, 0.55, 0.7, 0.85, 1], fingerLames.slice(1, -1), 0.008).map((at): Section => {
      const knuckles = Math.exp(-(((at - 0.4) / 0.25) ** 2))
      const tip = at === 1 ? 0.55 : 1
      const lame = 1 + lames(at, fingerLames, 0.12)
      return {
        at,
        side: (0.027 + 0.008 * knuckles) * tip * lame,
        front: (0.04 + 0.01 * knuckles) * tip,
        back: (0.038 + 0.008 * knuckles) * tip * lame,
        offset: [-0.016 * outside * at ** 2, 0],
        square: 2.4,
      }
    }), {columns: 16}),
    plate(mirror([0.288, 0.888, 0.078]), mirror([0.28, 0.822, 0.102]), [
      {
        at: 0,
        side: 0.014,
        front: 0.015,
        back: 0.015,
      },
      {
        at: 0.7,
        side: 0.012,
        front: 0.012,
        back: 0.012,
      },
      {
        at: 1,
        side: 0.007,
        front: 0.007,
        back: 0.007,
      },
    ], {columns: 10}),
  ]
}

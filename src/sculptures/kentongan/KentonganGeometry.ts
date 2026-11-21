import {BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, Vector3} from 'three/webgpu'

type Hull = {
  points: Float32Array
  /** fraction of the sculpture’s stone borne by this part */
  share: number
}
/** radii of a cross section along its frame’s normal and binormal */
type Section = readonly [normal: number, binormal: number]
type TubeOptions = {
  /** rings of each half dome closing a `round` end */
  capRings?: number
  /** `round` closes an end with a half dome of its last section, `pole` lets the section shrink to a point at the end of the curve */
  ends?: readonly ['pole' | 'round', 'pole' | 'round']
  /** the lowest any point may lie, sawing off a flat sole */
  floor?: number
  /** consecutive rings per collision hull */
  hullRings?: number
  /** close the curve into a ring instead */
  loop?: boolean
  rings: number
  section: (t: number) => Section
  sides: number
  /** orient the normal toward this direction instead of transporting it along the curve, for flattened sections */
  up?: Vector3
}

const tau = 2 * Math.PI
/** carving stone, kg/m³ */
export const stoneDensity = 2500
/** the integral base the figure stands on */
export const kentonganBase = {
  /** semi-axes of the superelliptic footprint along x and z */
  radii: [0.64, 0.5],
  exponent: 3,
  height: 0.1,
} as const
/** the drum the watchman’s body is hollowed from, standing on its legs */
export const kentonganDrum = {
  radius: 0.34,
  bottom: 1.15,
  top: 3.24,
  /** the slot of the drum down the belly, whose lips the beater sounds */
  slit: {
    bottom: 1.48,
    top: 2.16,
    halfWidth: 0.022,
    depth: 0.085,
  },
} as const

const vec = (x: number, y: number, z: number) => new Vector3(x, y, z)
const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}
/** a soft dome over an ellipse, 1 at its center and 0 beyond its rim */
const dome = (du: number, dv: number, ru: number, rv: number) => {
  const d = (du / ru) ** 2 + (dv / rv) ** 2
  return d < 1 ? (1 - d) ** 2 : 0
}
/** Piecewise smooth interpolation through [t, value] keys. */
const keyed = (keys: ReadonlyArray<readonly [number, number]>) => (t: number) => {
  if (t <= keys[0][0]) {
    return keys[0][1]
  }
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i]
    if (t <= t1) {
      const [t0, v0] = keys[i - 1]
      return v0 + (v1 - v0) * smoothstep(t0, t1, t)
    }
  }
  return keys.at(-1)![1]
}
/** the arc length fraction where the swept curve through `points` (see `StoneBuilder.tube`) passes closest to `target`, like one of its own control points */
function fractionAt(points: ReadonlyArray<Vector3>, target: Vector3) {
  const curve = new CatmullRomCurve3([...points], false, 'centripetal')
  let best = 0
  let nearest = Infinity
  for (let i = 0; i <= 400; i++) {
    const distance = curve.getPointAt(i / 400).distanceToSquared(target)
    if (!(distance < nearest)) {
      continue
    }
    nearest = distance
    best = i / 400
  }
  return best
}
/**
 * Relief carved into the drum, outward in meters, by arc length `u` from the front and height `y`: the watchman’s face under a lashed headband, the slot of the drum down its belly and a second lashing above the legs.
 */
function relief(u: number, y: number) {
  let h = 0
  // Lashings: a cord band around the brow and one around the hem, as if the drum were still bound to its frame.
  const band = (center: number, halfWidth: number, height: number) => height * (1 - smoothstep(halfWidth * 0.55, halfWidth, Math.abs(y - center)))
  h += band(3.1, 0.032, 0.016) + band(1.32, 0.03, 0.014)
  // Folk carving reads at a distance: one continuous brow, deep sockets with domed eyes and drilled pupils, a long wedge of a nose and a mouth wide open in the call.
  for (const side of [-1, 1]) {
    const eu = u - side * 0.118
    const ey = y - 2.8
    h -= 0.024 * dome(eu, ey, 0.088, 0.064)
    h += 0.042 * Math.sqrt(Math.max(0, 1 - (eu / 0.062) ** 2 - (ey / 0.047) ** 2))
    // Pupils drilled a little toward the nose, so the gaze meets whoever stands in front.
    h -= 0.02 * (1 - smoothstep(0.012, 0.021, Math.hypot(eu + side * 0.008, ey + 0.004)))
    // The brow arches over each eye and dips to meet its twin over the bridge.
    const along = Math.min(1, Math.abs(eu) / 0.11)
    const browY = 2.885 + 0.028 * Math.cos(along * Math.PI / 2) - 0.012 * (Math.abs(u) < 0.06 ? 1 - Math.abs(u) / 0.06 : 0)
    const fade = 1 - smoothstep(0.85, 1.25, Math.abs(eu) / 0.11)
    h = Math.max(h, 0.026 * Math.exp(-(((y - browY) / 0.016) ** 2)) * fade)
    h += 0.011 * dome(u - side * 0.15, y - 2.58, 0.12, 0.1)
    // nostril wings
    h += 0.03 * dome(u - side * 0.032, y - 2.625, 0.026, 0.022)
  }
  // The nose grows from the brow to a rounded tip, then falls straight back to the lip.
  if (y > 2.55 && y < 2.92) {
    const k = Math.min(1, (2.92 - y) / 0.3)
    const prominence = (0.018 + 0.068 * k ** 1.4) * smoothstep(2.555, 2.62, y)
    const halfWidth = 0.02 + 0.024 * k
    const across = Math.min(1, Math.abs(u) / halfWidth)
    h = Math.max(h, prominence * Math.cos(across * Math.PI / 2) ** 2)
  }
  const mouth = Math.hypot(u / 0.052, (y - 2.43) / 0.04)
  h += 0.022 * Math.exp(-(((mouth - 1) / 0.33) ** 2))
  h -= 0.065 * (1 - smoothstep(0.55, 0.86, mouth))
  // a short groove under the lip for the chin
  h -= 0.008 * dome(u, y - 2.335, 0.07, 0.012)
  // The slot is a clean saw cut with rounded ends.
  const {slit} = kentonganDrum
  const slotDistance = Math.hypot(u, y - Math.min(slit.top - slit.halfWidth, Math.max(slit.bottom + slit.halfWidth, y)))
  h -= slit.depth * (1 - smoothstep(slit.halfWidth * 0.7, slit.halfWidth, slotDistance))
  return h
}
/** Places `count` stations along a polyline so they crowd where `density` is high. */
function distribute<T>(samples: ReadonlyArray<T>, density: (sample: T) => number, count: number) {
  const cumulative = [0]
  for (let i = 1; i < samples.length; i++) {
    cumulative.push(cumulative[i - 1] + (density(samples[i - 1]) + density(samples[i])) / 2)
  }
  const total = cumulative.at(-1)!
  const picked: Array<number> = []
  let cursor = 0
  for (let k = 0; k < count; k++) {
    const target = total * k / (count - 1)
    while (cursor < samples.length - 2 && cumulative[cursor + 1] < target) {
      cursor++
    }
    const span = cumulative[cursor + 1] - cumulative[cursor]
    picked.push(cursor + (span > 0 ? (target - cumulative[cursor]) / span : 0))
  }
  return picked
}
/** the drum’s outline from the center of its foot round to the center of its top, sampled every millimeter, as [radius, y] */
function drumProfile() {
  const {radius, bottom, top} = kentonganDrum
  const foot = 0.05
  const rim = 0.06
  const crown = 0.05
  const points: Array<[number, number]> = []
  const line = (r0: number, y0: number, r1: number, y1: number) => {
    const steps = Math.ceil(Math.hypot(r1 - r0, y1 - y0) / 0.001)
    for (let i = 0; i < steps; i++) {
      points.push([r0 + (r1 - r0) * i / steps, y0 + (y1 - y0) * i / steps])
    }
  }
  const arc = (cr: number, cy: number, r: number, from: number, to: number) => {
    const steps = Math.ceil(r * Math.abs(to - from) / 0.001)
    for (let i = 0; i < steps; i++) {
      const angle = from + (to - from) * i / steps
      points.push([cr + r * Math.cos(angle), cy + r * Math.sin(angle)])
    }
  }
  line(0, bottom, radius - foot, bottom)
  arc(radius - foot, bottom + foot, foot, -Math.PI / 2, 0)
  line(radius, bottom + foot, radius, top - rim)
  arc(radius - rim, top - rim, rim, 0, Math.PI / 2)
  // the sawn end, worn into a low dome
  const span = radius - rim
  const steps = Math.ceil(span / 0.001)
  for (let i = 0; i <= steps; i++) {
    const r = span * (1 - i / steps)
    points.push([r, top + crown * (1 - (r / span) ** 2)])
  }
  return points
}
/**
 * A night watchman carved from one stone: his body is a kentongan, the slit log drum that is struck through the streets before dawn in Ramadan to wake everyone for sahur. He stands on thin legs on an oval base, one fist on his hip, the other swinging a beater at the slot in his own belly, with his mouth open in the call.
 */
export default class KentonganGeometry extends BufferGeometry {
  readonly hulls: Array<Hull>
  /** the volume of stone, in m³ */
  readonly volume: number
  constructor() {
    super()
    const stone = new StoneBuilder
    // The base: a superelliptic slab with a rounded arris, flat underneath where it meets the socket.
    {
      const {exponent, height, radii} = kentonganBase
      const sides = 72
      const outline = Array.from({length: sides}, (_, j) => {
        const angle = tau * j / sides
        const point = (a: number) => vec(radii[0] * Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** (2 / exponent), 0, radii[1] * Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) ** (2 / exponent))
        const tangent = point(angle + 0.001).sub(point(angle - 0.001))
        const normal = vec(-tangent.z, 0, tangent.x).normalize()
        return {
          normal,
          point: point(angle),
        }
      })
      // A small chamfer underneath, a generous round on top.
      const foot = 0.012
      const arris = 0.03
      const profile: Array<[offset: number, y: number]> = [[-0.08, 0]]
      for (let k = 0; k <= 2; k++) {
        const angle = -Math.PI / 2 + Math.PI / 2 * k / 2
        profile.push([-foot + foot * Math.cos(angle), foot + foot * Math.sin(angle)])
      }
      for (let k = 0; k <= 6; k++) {
        const angle = Math.PI / 2 * k / 6
        profile.push([-arris + arris * Math.cos(angle), height - arris + arris * Math.sin(angle)])
      }
      profile.push([-0.07, height], [-0.13, height])
      const rows = profile.map(([offset, y]) => outline.map(({normal, point}) => point.clone().addScaledVector(normal, offset).setY(y)))
      stone.revolve(rows, vec(0, 0, 0), vec(0, height, 0), 3)
    }
    // The drum, densest where the face and the slot need it.
    {
      const {radius} = kentonganDrum
      const profile = drumProfile()
      const sides = 90
      // Stations crowd toward the front, where the face is.
      const angles = Array.from({length: sides}, (_, j) => {
        const t = -1 + 2 * j / sides
        return Math.PI * (0.34 * t + 0.66 * t ** 3)
      })
      const density = ([r, y]: readonly [number, number]) => {
        const side = r > radius - 0.001
        if (!side) {
          return 1.4 + 2 * (1 - smoothstep(0.03, 0.2, radius - r))
        }
        let d = 0.45
        d = Math.max(d, 7 * smoothstep(2.28, 2.36, y) * (1 - smoothstep(2.96, 3.02, y)))
        d = Math.max(d, 3.5 * (1 - smoothstep(0.02, 0.06, Math.abs(y - 3.1))))
        d = Math.max(d, 3 * (1 - smoothstep(0.02, 0.06, Math.abs(y - 1.32))))
        d = Math.max(d, 2.6 * smoothstep(1.4, 1.46, y) * (1 - smoothstep(2.18, 2.24, y)))
        return d
      }
      const stations = distribute(profile, density, 96)
      const rows = stations.slice(1, -1).map(station => {
        const i = Math.floor(station)
        const f = station - i
        const [r0, y0] = profile[i]
        const [r1, y1] = profile[Math.min(profile.length - 1, i + 1)]
        const r = r0 + (r1 - r0) * f
        const y = y0 + (y1 - y0) * f
        return angles.map(angle => {
          // The log keeps a little of its own irregular girth.
          const wobble = 1 + 0.012 * Math.sin(2 * angle + 0.7) + 0.007 * Math.sin(3 * angle + 1.3 * y)
          const carved = r > radius - 0.001 ? relief(angle * radius, y) : 0
          const reach = r * wobble + carved
          return vec(reach * Math.sin(angle), y, reach * Math.cos(angle))
        })
      })
      const [, bottomY] = profile[0]
      const [, topY] = profile.at(-1)!
      stone.revolve(rows, vec(0, bottomY, 0), vec(0, topY, 0), 2)
    }
    // A cord loop on the crown, which the drum hangs from in its watch post: two strands laid up into one rope.
    for (const strand of [0, Math.PI]) {
      const loop = Array.from({length: 72}, (_, i) => {
        const angle = tau * i / 72
        const outward = vec(Math.sin(angle), -Math.cos(angle), 0)
        const lay = 7 * angle + strand
        return vec(0, 3.345, 0).addScaledVector(outward, 0.075 + 0.0105 * Math.cos(lay)).add(vec(0, 0, 0.0105 * Math.sin(lay)))
      })
      stone.tube(loop, {
        loop: true,
        rings: 72,
        sides: 8,
        section: () => [0.0135, 0.0135],
        hullRings: 18,
      })
    }
    // the boss the rope is threaded through
    stone.tube([vec(0, 3.255, 0), vec(0, 3.285, 0), vec(0, 3.31, 0)], {
      capRings: 3,
      rings: 4,
      sides: 16,
      section: t => [0.048 - 0.012 * t, 0.048 - 0.012 * t],
    })
    const plinthTop = kentonganBase.height
    for (const side of [-1, 1]) {
      // Legs: thin, with a knee, set into the drum’s foot above and the feet below.
      const legPoints = [vec(side * 0.15, 1.36, 0), vec(side * 0.152, 1.12, 0.005), vec(side * 0.165, 0.68, 0.045), vec(side * 0.172, 0.13, -0.005)]
      const knee = fractionAt(legPoints, legPoints[2])
      const leg = keyed([[0, 0.07], [knee - 0.15, 0.058], [knee, 0.066], [knee + 0.12, 0.057], [knee + 0.25, 0.056], [0.84, 0.044], [0.93, 0.05], [1, 0.058]])
      stone.tube(legPoints, {
        rings: 26,
        sides: 16,
        section: t => [leg(t), leg(t)],
        hullRings: 9,
      })
      // Feet: flat-soled and splayed a little, sawn flush with a sliver sunk into the base.
      const width = keyed([[0, 0.042], [0.25, 0.055], [0.65, 0.076], [1, 0.076]])
      const height = keyed([[0, 0.052], [0.3, 0.064], [0.75, 0.034], [1, 0.026]])
      const heel = vec(side * 0.168, 0.15, -0.09)
      const toe = vec(side * 0.228, 0.12, 0.215)
      stone.tube([heel, heel.clone().lerp(toe, 0.4).setY(0.155), toe], {
        ends: ['pole', 'pole'],
        floor: plinthTop - 0.005,
        rings: 24,
        sides: 18,
        up: vec(0, 1, 0),
        section: t => {
          const round = Math.sqrt(Math.max(0, 1 - ((t - 0.5) * 2) ** 8)) ** 0.5
          return [height(t) * round, width(t) * round]
        },
        hullRings: 24,
      })
      // Five toes along the front of each foot, the big toe on the inside, each a little flatter and thinner toward its tip.
      // The row follows the splay of the foot, so it stays on the forefoot.
      const ahead = toe.clone().sub(heel).setY(0).normalize()
      const outward = vec(ahead.z, 0, -ahead.x).multiplyScalar(side)
      for (let k = 0; k < 5; k++) {
        const r = [0.025, 0.019, 0.017, 0.0155, 0.014][k]
        // Tips fall back along a sloping line from the big toe outward; the roots sink into the rounded forefoot.
        const tip = toe.clone().addScaledVector(outward, -0.05 + [0, 0.04, 0.07, 0.096, 0.119][k]).addScaledVector(ahead, [0.062, 0.05, 0.036, 0.022, 0.006][k])
        tip.y = plinthTop + r - 0.005
        const base = tip.clone().addScaledVector(ahead, -[0.09, 0.08, 0.072, 0.064, 0.056][k]).setY(tip.y + 0.003)
        stone.tube([base, base.clone().lerp(tip, 0.5), tip], {
          capRings: 3,
          floor: plinthTop - 0.005,
          rings: 4,
          sides: 8,
          up: vec(0, 1, 0),
          section: t => [r * (1 - 0.3 * t) * 0.8, r * (1 - 0.2 * t)],
        })
      }
    }
    /** The arms swell into the drum like a shoulder and over the point of the elbow. */
    const arm = (points: ReadonlyArray<Vector3>, elbow: Vector3) => {
      const bend = fractionAt(points, elbow)
      const radius = keyed([[0, 0.09], [0.1, 0.078], [0.22, 0.05], [bend - 0.12, 0.043], [bend, 0.05], [bend + 0.1, 0.041], [1, 0.035]])
      stone.tube(points, {
        rings: 30,
        sides: 16,
        section: t => [radius(t), radius(t)],
        hullRings: 10,
      })
    }
    /** A fist closed around the axis `along`, its knuckles toward `front` and the thumb laid over the top from the end `along` points to. */
    const fist = (center: Vector3, along: Vector3, front: Vector3, up: Vector3) => {
      const half = 0.052
      stone.tube([center.clone().addScaledVector(along, -half), center, center.clone().addScaledVector(along, half)], {
        ends: ['pole', 'pole'],
        rings: 10,
        sides: 14,
        up: front,
        section: t => {
          const round = Math.max(0, 1 - ((t - 0.5) * 2) ** 4) ** 0.5
          return [0.044 * round, 0.04 * round]
        },
      })
      const knuckles = front.clone().multiplyScalar(0.034).addScaledVector(up, 0.016)
      for (let k = 0; k < 4; k++) {
        const knuckle = center.clone().add(knuckles).addScaledVector(along, 0.034 - 0.0225 * k)
        stone.tube([knuckle.clone().addScaledVector(up, 0.012), knuckle, knuckle.clone().addScaledVector(up, -0.012)], {
          capRings: 3,
          rings: 2,
          sides: 8,
          section: () => [0.0145 - 0.001 * k, 0.0145 - 0.001 * k],
        })
      }
      stone.tube([
        center.clone().addScaledVector(along, 0.04).addScaledVector(front, -0.026).addScaledVector(up, 0.02),
        center.clone().addScaledVector(along, 0.05).addScaledVector(up, 0.04),
        center.clone().addScaledVector(along, 0.036).addScaledVector(front, 0.026).addScaledVector(up, 0.032),
      ], {
        capRings: 3,
        rings: 6,
        sides: 10,
        section: t => [0.0155 - 0.003 * t, 0.0155 - 0.003 * t],
      })
    }
    // His left fist rests on his hip, its knuckles against the drum.
    const leftElbow = vec(0.575, 1.9, -0.06)
    const hip = vec(Math.sin(1.3), 0, Math.cos(1.3))
    const hipFist = hip.clone().multiplyScalar(kentonganDrum.radius + 0.042).setY(1.63)
    arm([vec(0.22, 2.33, -0.02), vec(0.355, 2.27, -0.03), vec(0.5, 2.05, -0.07), leftElbow, vec(0.53, 1.8, 0), hipFist.clone().add(vec(0.012, 0.06, 0))], leftElbow)
    const hipUp = vec(0, 1, 0)
    fist(hipFist, hipUp.clone().negate(), hip.clone().negate(), hip.clone().cross(hipUp).negate())
    // His right arm swings the beater at the slot.
    const rightElbow = vec(-0.535, 1.99, 0.13)
    arm([vec(-0.22, 2.33, 0), vec(-0.355, 2.27, 0.005), vec(-0.48, 2.11, 0.05), rightElbow, vec(-0.49, 1.985, 0.24), vec(-0.4, 1.978, 0.405)], rightElbow)
    // The beater: a turned stick swelling into a knob, a hand’s breadth from the lip of the slot.
    const butt = vec(-0.475, 2, 0.412)
    const knob = vec(0.02, 1.86, 0.455)
    const grip = vec(-0.39, 1.976, 0.43)
    const handle = knob.clone().sub(butt).normalize()
    const beater = keyed([[0, 0.021], [0.62, 0.022], [0.8, 0.05], [0.87, 0.056]])
    stone.tube([butt, grip, vec(-0.2, 1.925, 0.445), knob], {
      ends: ['round', 'pole'],
      rings: 30,
      sides: 16,
      section: t => {
        const r = beater(t)
        const end = t > 0.87 ? Math.sqrt(Math.max(0, 1 - ((t - 0.87) / 0.13) ** 2)) : 1
        return [r * end, r * end]
      },
      hullRings: 10,
    })
    const forward = vec(0, 0.45, 1).normalize()
    fist(grip, handle, forward.clone().addScaledVector(handle, -handle.dot(forward)).normalize(), handle.clone().cross(vec(0, 0, 1)).negate().normalize())
    this.setIndex(stone.indices)
    this.setAttribute('position', new Float32BufferAttribute(stone.positions, 3))
    this.computeVertexNormals()
    this.volume = stone.volume
    this.hulls = stone.hulls.map(({points, volume}) => ({
      points,
      share: volume / stone.volume,
    }))
  }
}

class StoneBuilder {
  readonly hulls: Array<Hull & {volume: number}> = []
  readonly indices: Array<number> = []
  readonly positions: Array<number> = []
  /** stone volume of every closed part, in m³ */
  volume = 0

  hull(points: ReadonlyArray<Vector3>, volume: number) {
    this.hulls.push({
      points: new Float32Array(points.flatMap(p => [p.x, p.y, p.z])),
      share: 0,
      volume,
    })
  }
  /** Measures the closed part built since `from` (an index offset) by its signed tetrahedra and adds it to the total. */
  measure(from: number) {
    const p = this.positions
    let volume = 0
    for (let i = from; i < this.indices.length; i += 3) {
      const [a, b, c] = [this.indices[i] * 3, this.indices[i + 1] * 3, this.indices[i + 2] * 3]
      volume += (p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c])) / 6
    }
    this.volume += volume
    return volume
  }
  /** Closes a ring with a fan to a single point, before the ring (`start`) or after it. */
  pole(point: Vector3, ring: ReadonlyArray<number>, start: boolean) {
    const tip = this.vertex(point)
    for (let j = 0; j < ring.length; j++) {
      const k = (j + 1) % ring.length
      if (start) {
        this.indices.push(tip, ring[k], ring[j])
      } else {
        this.indices.push(tip, ring[j], ring[k])
      }
    }
  }
  /** A solid of revolution around the y axis through `profile` rows of [radius scale or offset, y], closed by poles at both ends. */
  revolve(rows: ReadonlyArray<ReadonlyArray<Vector3>>, bottom: Vector3, top: Vector3, hullStride: number) {
    const from = this.indices.length
    const ringIndices = rows.map(points => this.ring(points))
    for (let i = 0; i + 1 < ringIndices.length; i++) {
      this.stitch(ringIndices[i], ringIndices[i + 1])
    }
    this.pole(bottom, ringIndices[0], true)
    this.pole(top, ringIndices.at(-1)!, false)
    const volume = this.measure(from)
    this.hull([bottom, top, ...rows.flatMap(points => points.filter((_, j) => j % hullStride === 0))], volume)
  }
  ring(points: ReadonlyArray<Vector3>) {
    return points.map(p => this.vertex(p))
  }
  /** Quads between two closed rings of equal length, facing out when the rings run counterclockwise around the direction from `a` to `b`. */
  stitch(a: ReadonlyArray<number>, b: ReadonlyArray<number>) {
    for (let j = 0; j < a.length; j++) {
      const k = (j + 1) % a.length
      this.indices.push(a[j], a[k], b[k], a[j], b[k], b[j])
    }
  }

  /** A swept part: rings of `section` along `points`, optionally flattened against `up`, closed at both ends. */
  tube(points: ReadonlyArray<Vector3>, options: TubeOptions) {
    const {capRings = 5, ends = ['round', 'round'], floor = -Infinity, hullRings = options.rings, loop = false, rings, section, sides, up} = options
    const from = this.indices.length
    const curve = new CatmullRomCurve3([...points], loop, 'centripetal')
    const frames = curve.computeFrenetFrames(rings, loop)
    const count = loop ? rings : rings + 1
    const centers = Array.from({length: count}, (_, i) => curve.getPointAt(i / rings))
    const tangents = frames.tangents.slice(0, count)
    const normals = up ? tangents.map(tangent => up.clone().addScaledVector(tangent, -tangent.dot(up)).normalize()) : frames.normals
    const binormals = up ? tangents.map((tangent, i) => tangent.clone().cross(normals[i])) : frames.binormals
    const shape = (center: Vector3, i: number, [rn, rb]: Section) => Array.from({length: sides}, (_, j) => {
      const angle = tau * j / sides
      const p = center.clone().addScaledVector(normals[i], rn * Math.cos(angle)).addScaledVector(binormals[i], rb * Math.sin(angle))
      p.y = Math.max(floor, p.y)
      return p
    })
    const sections: Array<Array<Vector3>> = []
    const first = ends[0] === 'pole' && !loop ? 1 : 0
    const last = ends[1] === 'pole' && !loop ? count - 2 : count - 1
    for (let i = first; i <= last; i++) {
      sections.push(shape(centers[i], i, section(i / rings)))
    }
    // Half domes before the first and after the last ring, made of the end sections shrinking along the tangent.
    const cap = (i: number, direction: number) => {
      const [rn, rb] = section(i / rings)
      return Array.from({length: capRings - 1}, (_, k) => {
        const angle = Math.PI / 2 * (k + 1) / capRings
        const center = centers[i].clone().addScaledVector(tangents[i], direction * Math.sin(angle) * Math.min(rn, rb))
        return shape(center, i, [rn * Math.cos(angle), rb * Math.cos(angle)])
      })
    }
    const startCap = !loop && ends[0] === 'round' ? cap(first, -1).toReversed() : []
    const endCap = !loop && ends[1] === 'round' ? cap(last, 1) : []
    const all = [...startCap, ...sections, ...endCap]
    const ringIndices = all.map(rim => this.ring(rim))
    for (let i = 0; i + 1 < ringIndices.length; i++) {
      this.stitch(ringIndices[i], ringIndices[i + 1])
    }
    if (loop) {
      this.stitch(ringIndices.at(-1)!, ringIndices[0])
    } else {
      const startTip = ends[0] === 'pole' ? centers[0] : centers[first].clone().addScaledVector(tangents[first], -Math.min(...section(first / rings)))
      const endTip = ends[1] === 'pole' ? centers[count - 1] : centers[last].clone().addScaledVector(tangents[last], Math.min(...section(last / rings)))
      startTip.y = Math.max(floor, startTip.y)
      endTip.y = Math.max(floor, endTip.y)
      this.pole(startTip, ringIndices[0], true)
      this.pole(endTip, ringIndices.at(-1)!, false)
    }
    const volume = this.measure(from)
    // Convex lengths of a few rings each follow the bends of the limb, weighed by the rough volume they enclose.
    const chunks: Array<{
      points: Array<Vector3>
      weight: number
    }> = []
    for (let start = 0; start < all.length - 1; start += hullRings) {
      const slice = all.slice(start, Math.min(all.length, start + hullRings + 1))
      const weight = slice.reduce((sum, rim, k) => {
        if (k === 0) {
          return sum
        }
        const a = rim[0].clone().lerp(rim[Math.floor(sides / 2)], 0.5)
        const b = slice[k - 1][0].clone().lerp(slice[k - 1][Math.floor(sides / 2)], 0.5)
        const r1 = rim[0].distanceTo(rim[Math.floor(sides / 2)]) / 2
        const r2 = rim[Math.floor(sides / 4)].distanceTo(rim[Math.floor(3 * sides / 4)]) / 2
        return sum + Math.PI * r1 * r2 * a.distanceTo(b)
      }, 0)
      chunks.push({
        points: slice.flatMap(rim => rim.filter((_, j) => j % 2 === 0)),
        weight,
      })
    }
    const totalWeight = chunks.reduce((sum, chunk) => sum + chunk.weight, 0)
    for (const chunk of chunks) {
      this.hull(chunk.points, volume * chunk.weight / totalWeight)
    }
  }

  vertex(p: Vector3) {
    return this.positions.push(p.x, p.y, p.z) / 3 - 1
  }
}

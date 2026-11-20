import {BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, Vector3} from 'three/webgpu'

// From the shorter bell, around the heel and back up to the taller bell. The two throats cross in elevation, not in space.
const spine = new CatmullRomCurve3([
  [-0.91, 2.65, 0.67],
  [-0.41, 2.43, 0.42],
  [0.27, 1.87, 0.31],
  [0.7, 1.2, 0.17],
  [0.74, 0.7, 0.03],
  [0.5, 0.33, 0],
  [0.17, 0.19, 0],
  [-0.17, 0.19, 0],
  [-0.55, 0.35, -0.04],
  [-0.77, 0.78, -0.21],
  [-0.65, 1.31, -0.33],
  [-0.34, 1.85, -0.41],
  [0.14, 2.27, -0.38],
  [0.42, 2.72, -0.29],
  [0.52, 3.13, -0.09],
  [0.51, 3.48, 0.19],
].map(([x, y, z]) => new Vector3(x, y, z)))
const stations = 128
const sides = 80 // enough to round even the crests of the seven reeds up close
const tau = 2 * Math.PI
const zAxis = new Vector3(0, 0, 1)
const boreLength = 24 // stations bored out from either end
type Hull = {
  points: Float32Array
  /** fraction of the sculpture’s mass borne by this part */
  share: number
}

function section(i: number) {
  const t = i / stations
  const center = spine.getPointAt(t)
  const tangent = spine.getTangentAt(t)
  const across = tangent.clone().cross(zAxis).normalize()
  const deep = tangent.clone().cross(across)
  const end = Math.min(i, stations - i)
  const flare = Math.max(0, 1 - end / (boreLength + 5)) ** 2.5
  const heel = Math.exp(-((center.y / 0.74) ** 4))
  const tall = t > 0.5
  const radius = 0.152 + 0.122 * heel + (tall ? 0.68 : 0.48) * flare
  const width = 1 + (tall ? 0.03 : 0.12) * flare
  const depth = 0.95 + 0.65 * heel - 0.22 * flare
  const bore = Math.sqrt(Math.max(0, 1 - (end / boreLength) ** 4)) * 0.91
  const outer: Array<Vector3> = []
  const inner: Array<Vector3> = []
  for (let j = 0; j < sides; j++) {
    const angle = tau * j / sides
    // Seven reeds run the length of the stone. Nearly lost in the heel, they twist apart and open into broad scallops at the lips.
    const reed = Math.cos(7 * angle + 14 * t)
    const relief = radius * (1 + reed * (0.065 + 0.05 * flare) * (1 - 0.66 * heel))
    const spoke = across.clone().multiplyScalar(width * Math.cos(angle)).addScaledVector(deep, depth * Math.sin(angle))
    // One side of each lip is drawn out like a spout; the opposite side falls away to reveal the bore.
    const lip = (tall ? 1 : -1) * flare * (0.31 * Math.cos(angle - (tall ? 0.2 : 2.5)) + 0.047 * reed)
    const p = center.clone().addScaledVector(spoke, relief).addScaledVector(tangent, lip)
    p.y = Math.max(0, p.y) // the sawn sole under the solid return bend
    outer.push(p)
    if (end <= boreLength) {
      inner.push(center.clone().addScaledVector(spoke, relief * bore).addScaledVector(tangent, lip * bore))
    }
  }
  return {
    // Cross-sectional stone area before fluting and sawing the sole.
    area: Math.PI * radius ** 2 * width * depth * (1 - bore ** 2),
    center,
    inner,
    outer,
    tangent,
  }
}
/** Short convex lengths follow the solid shank. Split the bored lengths into staves instead, so an orb can fall into either cup. */
function stoneHulls(rows: Array<ReturnType<typeof section>>) {
  const hulls: Array<Hull> = []
  const stride = 8 // equal arc-length intervals, landing exactly at the bottom of each bore
  for (let i = 0; i < stations; i += stride) {
    const bored = i < boreLength || i >= stations - boreLength
    const span = bored ? sides / 8 : sides
    const samples = [rows[i], rows[i + stride / 2], rows[i + stride]]
    // Simpson’s rule over the section areas. Every hull spans the same length, so only the share of the section matters here.
    const weight = (samples[0].area + 4 * samples[1].area + samples[2].area) * span / sides
    for (let j = 0; j < sides; j += span) {
      const points: Array<number> = []
      const add = (p: Vector3) => points.push(p.x, p.y, p.z)
      for (const row of samples) {
        for (let s = j; s <= j + span; s += bored ? 2 : 4) {
          const k = s % sides
          add(row.outer[k])
          if (!bored) {
            continue
          }
          add(row.inner[k])
          if (row === rows[0] || row === rows[stations]) {
            add(lipPoint(row, k, row === rows[0] ? -1 : 1, Math.PI / 2))
          }
        }
      }
      hulls.push({
        points: new Float32Array(points),
        share: weight,
      })
    }
  }
  const total = hulls.reduce((sum, hull) => sum + hull.share, 0)
  for (const hull of hulls) {
    hull.share /= total
  }
  return hulls
}
/** Roll the arris back into the bell in a half-circle instead of capping the cut with a flat washer. */
function lipPoint(mouth: ReturnType<typeof section>, j: number, direction: number, angle: number) {
  const outer = mouth.outer[j]
  const inner = mouth.inner[j]
  return outer.clone().lerp(inner, (1 - Math.cos(angle)) / 2).addScaledVector(mouth.tangent, direction * Math.sin(angle) * outer.distanceTo(inner) / 2)
}

/** One continuous stone surface: outside along the bend, over each rounded lip and down inside each bell. */
export default class AntiphonGeometry extends BufferGeometry {
  readonly hulls: Array<Hull>
  constructor() {
    super()
    const rows = Array.from({length: stations + 1}, (_, i) => section(i))
    const positions: Array<number> = []
    const indices: Array<number> = []
    const vertex = (p: Vector3) => positions.push(p.x, p.y, p.z) / 3 - 1
    const ring = (points: Array<Vector3>) => points.map(vertex)
    const join = (a: Array<number>, b: Array<number>) => {
      for (let j = 0; j < sides; j++) {
        const k = (j + 1) % sides
        indices.push(a[j], a[k], b[k], a[j], b[k], b[j])
      }
    }
    const outside = rows.map(row => ring(row.outer))
    for (let i = 0; i < stations; i++) {
      join(outside[i], outside[i + 1])
    }
    for (const direction of [-1, 1]) {
      const end = direction > 0 ? stations : 0
      const mouth = rows[end]
      let last = outside[end]
      const advance = (points: Array<Vector3>) => {
        const next = ring(points)
        if (direction > 0) {
          join(last, next)
        } else {
          join(next, last)
        }
        last = next
      }
      for (let k = 1; k <= 6; k++) {
        const angle = Math.PI * k / 6
        advance(mouth.outer.map((_, j) => lipPoint(mouth, j, direction, angle)))
      }
      for (let k = 1; k < boreLength; k++) {
        advance(rows[end - direction * k].inner)
      }
      const fan = direction > 0 ? last : last.toReversed()
      const tip = vertex(rows[end - direction * boreLength].center)
      for (let j = 0; j < sides; j++) {
        indices.push(fan[j], fan[(j + 1) % sides], tip)
      }
    }
    this.setIndex(indices)
    this.setAttribute('position', new Float32BufferAttribute(positions, 3))
    this.computeVertexNormals()
    this.hulls = stoneHulls(rows)
  }
}

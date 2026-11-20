import {BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, Vector3} from 'three/webgpu'

// The centerline and the two half-widths of the ribbon, in meters, followed by the roll in degrees. Walk from the heel up the forward flank, over the crest and down the rear flank.
const stations = [
  [-0.32, 0.44, 0.02, 0.27, 0.14, -18],
  [0.39, 0.63, 0.16, 0.31, 0.14, -10],
  [0.82, 1.15, 0.46, 0.36, 0.15, 25],
  [0.86, 1.86, 0.55, 0.37, 0.13, 44],
  [0.83, 2.4, 0.36, 0.24, 0.105, 54],
  [0.56, 2.86, 0.06, 0.24, 0.11, 28],
  [0.12, 3, -0.19, 0.28, 0.115, -3],
  [-0.56, 2.62, -0.46, 0.4, 0.125, -25],
  [-0.93, 2.01, -0.51, 0.34, 0.125, -44],
  [-1.02, 1.27, -0.29, 0.245, 0.145, -25],
  [-0.83, 0.68, -0.07, 0.225, 0.15, -10],
] as const
const ringsPerSpan = 16
const ringCount = stations.length * ringsPerSpan
const sides = 64
const hullSpan = ringsPerSpan / 2
const footSides = 96
const footRadii = [1.08, 0.68] as const
// Chamfered foot, from the contact face up to the flat seat that the ribbon meets.
const footCourses = [
  [0.965, 0],
  [0.968, 0.002],
  [0.998, 0.026],
  [1, 0.029],
  [1, 0.181],
  [0.998, 0.184],
  [0.903, 0.243],
  [0.899, 0.245],
] as const
const up = new Vector3(0, 1, 0)
// Face both the Banquet approach and the window into the Lobby.
const turn = -24 * Math.PI / 180
const channelCenter = -0.19
const rollEdge = (x: number) => Math.sign(x) * Math.abs(x) ** 0.46
/** Rounded edges and a scooped channel across the broad face, cut into the solid rather than painted onto it. */
const profile = Array.from({length: sides}, (_, i) => {
  const angle = i / sides * 2 * Math.PI
  const x = Math.cos(angle)
  const y = rollEdge(Math.sin(angle)) + 0.8 * x ** 2 - 0.73 * Math.exp(-(((x - channelCenter) / 0.36) ** 2)) + 0.24 * x
  return [x, y] as const
})
// Split each hull down the flute so the collision skin follows both curved lips instead of bridging the entire channel.
const split = Math.round(Math.acos(channelCenter) / (2 * Math.PI) * sides)
const hullProfiles = [[split, sides - split], [sides - split, sides + split]].map(([start, end]) => {
  const samples = Array.from({length: end - start + 1}, (_, j) => (start + j) % sides)
  const area = samples.reduce((sum, j, i) => {
    const [x, y] = profile[j]
    const [a, b] = profile[samples[(i + 1) % samples.length]]
    return sum + (x * b - y * a) / 2
  }, 0)
  return {
    area,
    samples: samples.filter((_, i) => i % 4 === 0 || i === samples.length - 1),
  }
})
function stoneMesh(positions: Array<number>, indices: Array<number>) {
  const geometry = new BufferGeometry
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}
/** Connect consecutive cross sections with outward winding, wrapping around each section. */
function stitchRings(indices: Array<number>, from: number, to: number, count: number) {
  for (let j = 0; j < count; j++) {
    const next = (j + 1) % count
    indices.push(from + j, to + j, from + next, to + j, to + next, from + next)
  }
}
function ribbon() {
  const path = new CatmullRomCurve3(stations.map(([x, y, z]) => new Vector3(x, y, z)), true)
  const section = new CatmullRomCurve3(stations.map(([, , , width, depth, roll]) => new Vector3(width, depth, roll)), true, 'catmullrom')
  const rings = Array.from({length: ringCount}, (_, i) => {
    const t = i / ringCount
    const center = path.getPoint(t)
    const tangent = path.getTangent(t)
    const {x: width, y: depth, z: roll} = section.getPoint(t)
    const across = new Vector3(tangent.y, -tangent.x, 0)
    across.normalize().applyAxisAngle(tangent, roll * Math.PI / 180)
    const through = new Vector3
    through.crossVectors(across, tangent)
    const points = profile.map(([x, y]) => center.clone().addScaledVector(across, x * width).addScaledVector(through, y * depth).applyAxisAngle(up, turn))
    return {
      scale: width * depth,
      center,
      points,
    }
  })
  const positions = rings.flatMap(({points}) => points.flatMap(point => point.toArray()))
  const indices: Array<number> = []
  for (let i = 0; i < ringCount; i++) {
    const next = (i + 1) % ringCount
    stitchRings(indices, i * sides, next * sides, sides)
  }
  // Each pair spans half a station interval; a midpoint ring follows the bend. Adjacent pairs share an end ring, leaving the eye open.
  const hulls = Array.from({length: ringCount / hullSpan}, (_slot, i) => {
    const start = i * hullSpan
    const ringsAt = [start, start + hullSpan / 2, start + hullSpan].map(j => rings[j % ringCount])
    let volumeScale = 0
    for (let j = start; j < start + hullSpan; j++) {
      const a = rings[j]
      const b = rings[(j + 1) % ringCount]
      volumeScale += (a.scale + b.scale) / 2 * a.center.distanceTo(b.center)
    }
    return hullProfiles.map(({area, samples}) => ({
      vertices: new Float32Array(ringsAt.flatMap(({points}) => samples.flatMap(j => points[j].toArray()))),
      volume: volumeScale * area,
    }))
  }).flat()
  return {
    mesh: stoneMesh(positions, indices),
    hulls,
  }
}
function foot() {
  const [rx, rz] = footRadii
  const rings = footCourses.map(([radius, y]) => Array.from({length: footSides}, (_, i) => {
    const angle = i / footSides * 2 * Math.PI
    const point = new Vector3(rx * radius * Math.cos(angle), y, rz * radius * Math.sin(angle))
    return point.applyAxisAngle(up, turn)
  }))
  const positions = rings.flatMap(points => points.flatMap(point => point.toArray()))
  const top = rings.length - 1
  // Give the bottom chamfer its own octagonal hull for stable planar contact. The upper courses sample more of the curved rim for side impacts.
  const heel = 3
  const hullSections = [rings.slice(0, heel + 1), rings.slice(heel)]
  const volumes = [0, 0]
  const indices: Array<number> = []
  for (let k = 0; k < top; k++) {
    const [r0, y0] = footCourses[k]
    const [r1, y1] = footCourses[k + 1]
    volumes[k < heel ? 0 : 1] += Math.PI * rx * rz * (y1 - y0) * (r0 ** 2 + r0 * r1 + r1 ** 2) / 3
    stitchRings(indices, k * footSides, (k + 1) * footSides, footSides)
  }
  // Duplicate the rim vertices at the caps so their normals stay exactly vertical.
  for (const ring of [0, top]) {
    const start = positions.length / 3
    const center = start + footSides
    for (const [j, point] of rings[ring].entries()) {
      positions.push(...point)
      const next = start + (j + 1) % footSides
      if (ring === 0) {
        indices.push(center, start + j, next)
      } else {
        indices.push(center, next, start + j)
      }
    }
    positions.push(0, footCourses[ring][1], 0)
  }
  return {
    mesh: stoneMesh(positions, indices),
    hulls: hullSections.map((section, i) => {
      const stride = footSides / (i === 0 ? 8 : 24)
      return {
        vertices: new Float32Array(section.flatMap(points => points.filter((_, j) => j % stride === 0).flatMap(point => point.toArray()))),
        volume: volumes[i],
      }
    }),
  }
}

/** The ribbon and its low stone foot, with a compound convex collider sampled from the same surfaces. */
export default class CounterflowGeometry {
  readonly colliders
  readonly foot
  readonly ribbon

  constructor() {
    const base = foot()
    const coil = ribbon()
    this.foot = base.mesh
    this.ribbon = coil.mesh
    const hulls = [...base.hulls, ...coil.hulls]
    const volume = hulls.reduce((sum, hull) => sum + hull.volume, 0)
    this.colliders = hulls.map(hull => ({
      vertices: hull.vertices,
      massFraction: hull.volume / volume,
    }))
  }

  dispose() {
    this.foot.dispose()
    this.ribbon.dispose()
  }
}

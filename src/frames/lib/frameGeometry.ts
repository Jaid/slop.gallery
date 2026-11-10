import type FrameProfile from './FrameProfile.ts'
import type {ProfileVertex} from './FrameProfile.ts'

import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js'
import {BufferGeometry, Float32BufferAttribute, Matrix4, Quaternion, Vector3} from 'three/webgpu'

/**
 * What every part of a frame carries besides its position and normal, which frame materials read:
 *
 * - `uv`: meters along the member from its middle, clockwise round the frame as seen from the front, and meters along the profile from the sight edge; ornaments map their own front face
 * - `frameShape`: the member, 0 to 3 clockwise from the top, or 4 and up for ornaments by their kind; how far out past the opening the point lies; how hollow the surface is round it, from −1 on a sharp ridge to 1 deep in a hollow; and half the side of the opening its member runs along
 */
export const frameShapeAttribute = 'frameShape'
/** the first `frameShape` member index of ornaments, which add their own kind to it */
export const ornamentMember = 4
/** the members clockwise from the top as seen from the front: which way they face out and which way they run */
const members = [
  {
    out: [0, 1],
    run: [1, 0],
  },
  {
    out: [1, 0],
    run: [0, -1],
  },
  {
    out: [0, -1],
    run: [-1, 0],
  },
  {
    out: [-1, 0],
    run: [0, 1],
  },
] as const
const xAxis = new Vector3(1, 0, 0)
const zAxis = new Vector3(0, 0, 1)
/** how far, in meters along the profile, the arrises and hollows of a profile spread their shading */
const cavitySpread = 0.004

type Attributes = {
  frameShape: Array<number>
  normal: Array<number>
  position: Array<number>
  uv: Array<number>
}

const newAttributes = (): Attributes => ({
  position: [],
  normal: [],
  uv: [],
  frameShape: [],
})
/** how an ornament takes the frame’s shading: its kind among the ornaments and how hollow its surface counts as */
export type OrnamentOptions = {
  /** from −1, an exposed ridge, to 1, a deep hollow; by default the faces turning away from the viewer count as more hollow */
  cavity?: ((normal: Vector3, position: Vector3) => number) | number
  /** which ornament it is, so materials can tell them apart; 0 by default */
  kind?: number
  /** whether it keeps the `uv` of its own geometry, like a rod’s round its axis, instead of its front face mapped in meters */
  ownUv?: boolean
}
/** where a copy of an ornament goes: its position and its turn about the frame’s axis, which faces it toward the viewer */
export type Placement = {
  /** turn about z in radians */
  angle?: number
  position: readonly [x: number, y: number, z: number]
  /** a uniform scale, or one per axis */
  scale?: readonly [number, number, number] | number
  /** a turn about x before the turn about z, which tips an ornament lying flat up toward the viewer */
  tilt?: number
}
/**
 * Sweeps the profile round an opening of `halfWidth` × `halfHeight` meters around the frame’s middle, the four members meeting in miters at the corners, and closes the opening’s back with a board. Each run of the profile goes to the group of its material.
 *
 * Every member is a single strip along its length, so the triangles only grow with the profile: two per run and member.
 */
export function sweepProfile(profile: FrameProfile, halfWidth: number, halfHeight: number) {
  const points = refine(profile.points)
  const lengths = [0]
  for (let index = 1; index < points.length; index++) {
    lengths.push(lengths[index - 1] + Math.hypot(points[index].r - points[index - 1].r, points[index].z - points[index - 1].z))
  }
  const cavity = profileCavity(points, lengths)
  // Each run’s own outward normal in the section: the left of travel.
  const runNormals = points.slice(1).map((end, index) => {
    const start = points[index]
    const length = Math.hypot(end.r - start.r, end.z - start.z)
    return length > 1e-9 ? [-(end.z - start.z) / length, (end.r - start.r) / length] as const : null
  })
  const groups = new Map<number, Attributes>
  for (const [memberIndex, {out, run}] of members.entries()) {
    // The member runs from one corner to the next; at offset r, its ends lie on the miters.
    const halfLength = (r: number) => (run[0] === 0 ? halfHeight : halfWidth) + r
    const across = (r: number) => (out[0] === 0 ? halfHeight : halfWidth) + r
    const vertex = (attributes: Attributes, point: number, end: -1 | 1, normal: readonly [number, number]) => {
      const {r, z} = points[point]
      const offset = halfLength(r) * end
      const distance = across(r)
      attributes.position.push(out[0] * distance + run[0] * offset, out[1] * distance + run[1] * offset, z)
      attributes.normal.push(out[0] * normal[0], out[1] * normal[0], normal[1])
      attributes.uv.push(offset, lengths[point])
      attributes.frameShape.push(memberIndex, r, cavity[point], 0)
    }
    for (const [index, own] of runNormals.entries()) {
      if (!own) {
        continue
      }
      const startNormal = points[index].crease ? own : blendNormals(runNormals[index - 1], own)
      const endNormal = points[index + 1].crease ? own : blendNormals(own, runNormals[index + 1])
      const material = points[index].material
      let attributes = groups.get(material)
      if (!attributes) {
        attributes = newAttributes()
        groups.set(material, attributes)
      }
      // Seen from the outside, the quad runs from the start point’s end along the member to its other end, then back along the end point.
      const quad = [[index, -1, startNormal], [index, 1, startNormal], [index + 1, 1, endNormal], [index + 1, -1, endNormal]] as const
      const before = attributes.position.length / 3
      for (const corner of [0, 1, 2, 0, 2, 3]) {
        const [point, end, normal] = quad[corner]
        vertex(attributes, point, end, normal)
      }
      orientTriangles(attributes, before, out, own)
    }
  }
  const {r: backReach, z: back} = points.at(-1)!
  const board = newAttributes()
  const [x, y] = [halfWidth + backReach, halfHeight + backReach]
  for (const [px, py] of [[-x, -y], [-x, y], [x, y], [-x, -y], [x, y], [x, -y]]) {
    board.position.push(px, py, back)
    board.normal.push(0, 0, -1)
    board.uv.push(px, py)
    board.frameShape.push(ornamentMember, backReach, 0, 0)
  }
  const backMaterial = points.at(-2)!.material
  const backAttributes = groups.get(backMaterial) ?? newAttributes()
  for (const key of ['position', 'normal', 'uv', 'frameShape'] as const) {
    backAttributes[key].push(...board[key])
  }
  groups.set(backMaterial, backAttributes)
  return new Map(groups.entries().map(([material, attributes]) => [material, finishMember(toGeometry(attributes), halfWidth, halfHeight)]))
}

/**
 * Prepares a part like a rosette, a boss or a strap for a frame: drops its index, gives it a `frameShape` of an ornament and maps its front face onto its `uv` in meters, its middle at 0, unless it keeps its own.
 */
export function ornament(geometry: BufferGeometry, {kind = 0, cavity, ownUv = false}: OrnamentOptions = {}) {
  const part = geometry.index ? geometry.toNonIndexed() : geometry
  if (part !== geometry) {
    geometry.dispose()
  }
  if (!part.hasAttribute('normal')) {
    part.computeVertexNormals()
  }
  const position = part.getAttribute('position')
  const normal = part.getAttribute('normal')
  if (!ownUv || !part.hasAttribute('uv')) {
    const uv = new Float32Array(position.count * 2)
    for (let index = 0; index < position.count; index++) {
      uv[index * 2] = position.getX(index)
      uv[index * 2 + 1] = position.getY(index)
    }
    part.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  }
  const shape = new Float32Array(position.count * 4)
  const n = new Vector3
  const p = new Vector3
  for (let index = 0; index < position.count; index++) {
    n.fromBufferAttribute(normal, index)
    p.fromBufferAttribute(position, index)
    shape[index * 4] = ornamentMember + kind
    shape[index * 4 + 2] = typeof cavity === 'function' ? cavity(n, p) : cavity ?? (0.35 - n.z) * 0.6
  }
  part.setAttribute(frameShapeAttribute, new Float32BufferAttribute(shape, 4))
  for (const name of Object.keys(part.attributes)) {
    if (![frameShapeAttribute, 'normal', 'position', 'uv'].includes(name)) {
      part.deleteAttribute(name)
    }
  }
  return part
}

/** Copies the ornament, which faces +z with its middle at the origin, to every placement. The original is disposed. */
export function place(part: BufferGeometry, placements: ReadonlyArray<Placement>) {
  const copies = placements.map(({position, angle = 0, scale = 1, tilt = 0}) => {
    const copy = part.clone()
    const scales = typeof scale === 'number' ? [scale, scale, scale] as const : scale
    const turn = new Quaternion
    turn.setFromAxisAngle(zAxis, angle)
    const tip = new Quaternion
    tip.setFromAxisAngle(xAxis, tilt)
    const matrix = new Matrix4
    matrix.compose(new Vector3(...position), turn.multiply(tip), new Vector3(...scales))
    copy.applyMatrix4(matrix)
    // A mirroring scale turns the triangles inside out.
    if (matrix.determinant() < 0) {
      flipWinding(copy)
    }
    return copy
  })
  part.dispose()
  const merged = mergeGeometries(copies)
  for (const copy of copies) {
    copy.dispose()
  }
  return merged
}
/** the four corners of a frame, `reach` meters out past an opening of `halfWidth` × `halfHeight` along both of their members, each turned a quarter further clockwise from the top right one */
export function corners(halfWidth: number, halfHeight: number, reach: number, z: number, extra: Omit<Placement, 'angle' | 'position'> = {}): Array<Placement> {
  return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([sx, sy], index) => ({
    ...extra,
    position: [sx * (halfWidth + reach), sy * (halfHeight + reach), z] as const,
    angle: -index * Math.PI / 2,
  }))
}
/** the middles of the four members, `reach` meters out past the opening, each turned to face outward like the top one */
export function middles(halfWidth: number, halfHeight: number, reach: number, z: number, extra: Omit<Placement, 'angle' | 'position'> = {}): Array<Placement> {
  return members.map(({out}, index) => ({
    ...extra,
    position: [out[0] * (halfWidth + reach), out[1] * (halfHeight + reach), z] as const,
    angle: -index * Math.PI / 2,
  }))
}

/**
 * Copies along every member at `reach` meters out past the opening, spaced as evenly as `spacing` allows between `inset` from either miter, at most `limit` in all, each turned to face outward like those on the top member.
 */
export function along(halfWidth: number, halfHeight: number, reach: number, z: number, {spacing, inset = spacing / 2, limit = Infinity, ...extra}: Omit<Placement, 'angle' | 'position'> & {
  inset?: number
  limit?: number
  spacing: number
}): Array<Placement> {
  const lengths = members.map(({run}) => ((run[0] === 0 ? halfHeight : halfWidth) + reach - inset) * 2)
  const total = lengths.reduce((sum, length) => sum + length, 0)
  // Fewer copies spread wider once the limit is reached, the same spacing on every member; every member keeps one at least.
  const countsAt = (gap: number) => lengths.map(length => Math.max(1, Math.floor(length / gap) + 1))
  let gap = Math.max(spacing, total / Math.max(1, limit - members.length))
  while (countsAt(gap).reduce((sum, count) => sum + count, 0) > Math.max(limit, members.length)) {
    gap *= 1.05
  }
  const counts = countsAt(gap)
  return members.flatMap(({out, run}, index) => {
    const length = lengths[index]
    const count = counts[index]
    const step = count > 1 ? length / (count - 1) : 0
    return Array.from({length: count}, (_, k) => {
      const offset = count > 1 ? -length / 2 + step * k : 0
      const distance = (out[0] === 0 ? halfHeight : halfWidth) + reach
      return {
        ...extra,
        position: [out[0] * distance + run[0] * offset, out[1] * distance + run[1] * offset, z] as const,
        angle: -index * Math.PI / 2,
      }
    })
  })
}

/**
 * Merges a frame’s parts into one geometry with a group per material, in the order of the materials, skipping those without any part. All parts must come from {@link sweepProfile} or {@link ornament}, which gives them the same attributes. The parts are disposed.
 */
export function assembleFrame(parts: ReadonlyArray<readonly [material: number, geometry: BufferGeometry | null | undefined]>) {
  const byMaterial = Map.groupBy(parts.filter((part): part is readonly [number, BufferGeometry] => Boolean(part[1])), ([material]) => material)
  const materials = byMaterial.keys().toArray().toSorted((a, b) => a - b)
  const merged = materials.map(material => mergeGeometries(byMaterial.get(material)!.map(([, geometry]) => geometry)))
  const geometry = mergeGeometries(merged, true)
  // mergeGeometries numbers its groups by position; they must name the materials instead.
  for (const [index, group] of geometry.groups.entries()) {
    group.materialIndex = materials[index]
  }
  for (const geometryPart of new Set([...parts.map(([, part]) => part), ...merged])) {
    geometryPart?.dispose()
  }
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

/** The section normal halfway between two runs meeting smoothly, or the one run there is at an end of the profile. */
function blendNormals(a: readonly [number, number] | null | undefined, b: readonly [number, number] | null | undefined) {
  if (!a || !b) {
    return a ?? b!
  }
  const length = Math.hypot(a[0] + b[0], a[1] + b[1])
  return length > 1e-9 ? [(a[0] + b[0]) / length, (a[1] + b[1]) / length] as const : a
}
function toGeometry(attributes: Attributes) {
  const geometry = new BufferGeometry
  geometry.setAttribute('position', new Float32BufferAttribute(attributes.position, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(attributes.normal, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(attributes.uv, 2))
  geometry.setAttribute(frameShapeAttribute, new Float32BufferAttribute(attributes.frameShape, 4))
  return geometry
}
/** Splits every run long enough to have a middle untouched by the shading of the arrises at its ends, so that middle doesn’t take the shading of an arris just by interpolation: a point {@link cavitySpread} × 2 in from either end. */
function refine(points: ReadonlyArray<ProfileVertex>) {
  const inset = cavitySpread * 2
  return points.flatMap((point, index): Array<ProfileVertex> => {
    if (index === points.length - 1) {
      return [point]
    }
    const next = points[index + 1]
    const length = Math.hypot(next.r - point.r, next.z - point.z)
    if (length < inset * 3) {
      return [point]
    }
    const at = (distance: number) => ({
      r: point.r + (next.r - point.r) * distance / length,
      z: point.z + (next.z - point.z) * distance / length,
      crease: false,
      material: point.material,
    })
    return [point, at(inset), at(length - inset)]
  })
}
/** How hollow the profile is round each of its points, from −1 on a sharp ridge to 1 deep in a hollow: its turns, convex ones negative, blurred along the profile. */
function profileCavity(points: ReadonlyArray<ProfileVertex>, lengths: ReadonlyArray<number>) {
  const turns = points.map((point, index) => {
    if (index === 0 || index === points.length - 1) {
      return 0
    }
    const previous = points[index - 1]
    const next = points[index + 1]
    const a = Math.atan2(point.z - previous.z, point.r - previous.r)
    const b = Math.atan2(next.z - point.z, next.r - point.r)
    let turn = b - a
    while (turn > Math.PI) {
      turn -= Math.PI * 2
    }
    while (turn < -Math.PI) {
      turn += Math.PI * 2
    }
    // Turning left of travel is turning away from the solid: a hollow.
    return turn
  })
  return lengths.map(length => {
    let sum = 0
    for (const [index, turn] of turns.entries()) {
      sum += turn * Math.exp(-((length - lengths[index]) ** 2) / (2 * cavitySpread ** 2))
    }
    return Math.tanh(sum * 0.9)
  })
}
/** Fills in half the side of the opening each vertex’s member runs along, from which materials find the miters: the members are single strips, so only the shader knows where between them a point lies. */
function finishMember(geometry: BufferGeometry, halfWidth: number, halfHeight: number) {
  const shape = geometry.getAttribute(frameShapeAttribute)
  for (let index = 0; index < shape.count; index++) {
    const member = shape.getX(index)
    if (member < ornamentMember) {
      shape.setW(index, member % 2 === 0 ? halfWidth : halfHeight)
    }
  }
  return geometry
}
/** Turns the two triangles last added so their fronts face the outside of the run, whose section normal `own` points out along `out`. */
function orientTriangles(attributes: Attributes, first: number, out: readonly [number, number], own: readonly [number, number]) {
  const p = attributes.position
  const a = new Vector3
  const b = new Vector3
  const c = new Vector3
  const facing = new Vector3(out[0] * own[0], out[1] * own[0], own[1])
  for (let triangle = first; triangle < p.length / 3; triangle += 3) {
    a.fromArray(p, triangle * 3)
    b.fromArray(p, triangle * 3 + 3).sub(a)
    c.fromArray(p, triangle * 3 + 6).sub(a)
    if (b.cross(c).dot(facing) < 0) {
      swapVertices(attributes, triangle + 1, triangle + 2)
    }
  }
}
function swapVertices(attributes: Attributes, i: number, j: number) {
  for (const [key, size] of [['position', 3], ['normal', 3], ['uv', 2], ['frameShape', 4]] as const) {
    const values = attributes[key]
    for (let k = 0; k < size; k++) {
      const swap = values[i * size + k]
      values[i * size + k] = values[j * size + k]
      values[j * size + k] = swap
    }
  }
}
function flipWinding(geometry: BufferGeometry) {
  for (const attribute of Object.values(geometry.attributes)) {
    const size = attribute.itemSize
    for (let triangle = 0; triangle < attribute.count; triangle += 3) {
      for (let k = 0; k < size; k++) {
        const a = attribute.getComponent(triangle + 1, k)
        attribute.setComponent(triangle + 1, k, attribute.getComponent(triangle + 2, k))
        attribute.setComponent(triangle + 2, k, a)
      }
    }
    attribute.needsUpdate = true
  }
}

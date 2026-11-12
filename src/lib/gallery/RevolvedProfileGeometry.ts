import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js'
import {BufferGeometry, Float32BufferAttribute, Vector3} from 'three/webgpu'

/** [distance from the axis to the middle of a side, height] */
export type ProfilePoint = readonly [number, number]

export type RevolvedProfileOptions = {
  /**
   * Which way a segment faces, as [outward, up], when the default — the left of the direction of travel — is wrong for it.
   * A wall that rises straight up has no outward component, so the default cannot tell its outside from its inside.
   */
  front?: (segment: number) => readonly [number, number]
  /** Polygon sides; a turn sharper than `smoothAngle` between neighboring sides becomes a hard, carved arris. */
  sides: number
  /** Creases below this angle, along the profile or around a corner, are shaded smooth (radians). */
  smoothAngle?: number
  /** Per profile point and corner fraction (0–1 around the axis); defaults to corner fraction and profile arc length. */
  uv?: (point: number, around: number) => readonly [number, number]
}

const defaultSmoothAngle = 40 * Math.PI / 180

/**
 * Sweeps a 2D profile around the y axis as a regular polygon with mitered corners.
 *
 * The profile runs from the axis outward, for example along a basin floor, up its inner wall and down its outer wall; a solid lies to the right of the direction of travel. Points measure the apothem, so an octagon’s flat sides stay exactly at the given distance. The first side faces +x and corners are hard or smooth depending on the polygon’s turn, so the same class yields crisp carved octagons and smooth round bowls without redundant rings.
 */
export default class RevolvedProfileGeometry extends BufferGeometry {
  override readonly type = 'RevolvedProfileGeometry'

  constructor(profile: ReadonlyArray<ProfilePoint>, {sides, smoothAngle = defaultSmoothAngle, uv, front}: RevolvedProfileOptions) {
    super()
    if (!Number.isInteger(sides) || sides < 3) {
      throw new RangeError('A revolved profile needs at least three sides.')
    }
    if (profile.length < 2 || profile.some(([radius, y]) => !(radius >= 0) || !Number.isFinite(y))) {
      throw new RangeError('A revolved profile needs at least two finite points that do not cross the axis.')
    }
    const half = Math.PI / sides
    const miter = 1 / Math.cos(half)
    const smoothCorners = 2 * half < smoothAngle
    const lengths = [0]
    for (let i = 1; i < profile.length; i++) {
      lengths.push(lengths[i - 1] + Math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1]))
    }
    const textureAt = uv ?? ((point: number, around: number) => [around, lengths[point] / lengths.at(-1)!] as const)
    // Segment normals point to the left of travel, which is outside the solid.
    const segments = profile.slice(1).map((end, i) => {
      const start = profile[i]
      const length = Math.hypot(end[0] - start[0], end[1] - start[1])
      return length > 1e-9 ? [-(end[1] - start[1]) / length, (end[0] - start[0]) / length] as const : null
    })
    const blend = (a: readonly [number, number] | null, b: readonly [number, number] | null, own: readonly [number, number]) => {
      if (!a || !b || Math.acos(Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1]))) >= smoothAngle) {
        return own
      }
      const length = Math.hypot(a[0] + b[0], a[1] + b[1])
      return [(a[0] + b[0]) / length, (a[1] + b[1]) / length] as const
    }
    const positions: Array<number> = []
    const normals: Array<number> = []
    const uvs: Array<number> = []
    const corner = new Vector3
    const push = (point: number, angle: number, around: number, normal: readonly [number, number], facing: number) => {
      const [radius, y] = profile[point]
      positions.push(radius * miter * Math.cos(angle), y, -radius * miter * Math.sin(angle))
      const direction = smoothCorners ? angle : facing
      corner.set(normal[0] * Math.cos(direction), normal[1], -normal[0] * Math.sin(direction)).normalize()
      normals.push(corner.x, corner.y, corner.z)
      uvs.push(...textureAt(point, around))
    }
    const a = new Vector3
    const b = new Vector3
    const c = new Vector3
    for (let side = 0; side < sides; side++) {
      const facing = side * 2 * half
      const corners = [[facing - half, side / sides], [facing + half, (side + 1) / sides]] as const
      for (const [j, own] of segments.entries()) {
        if (!own) {
          continue
        }
        const startNormal = blend(segments[j - 1] ?? null, own, own)
        const endNormal = blend(own, segments[j + 1] ?? null, own)
        const quad: Array<[number, number, number, readonly [number, number]]> = [
          [j, ...corners[0], startNormal],
          [j, ...corners[1], startNormal],
          [j + 1, ...corners[1], endNormal],
          [j + 1, ...corners[0], endNormal],
        ]
        // A profile point on the axis collapses its edge of the quad into a single vertex.
        let triangles = [[0, 1, 2], [0, 2, 3]]
        if (profile[j][0] === 0) {
          triangles = [[0, 2, 3]]
        } else if (profile[j + 1][0] === 0) {
          triangles = [[0, 1, 2]]
        }
        const outsideOf = front?.(j) ?? own
        for (const triangle of triangles) {
          const [p, q, r] = triangle.map(index => {
            const [point, angle] = quad[index]
            const [radius, y] = profile[point]
            return new Vector3(radius * miter * Math.cos(angle), y, -radius * miter * Math.sin(angle))
          })
          a.subVectors(q, p)
          b.subVectors(r, p)
          c.crossVectors(a, b)
          // Wind every face so that its front matches the profile’s outside.
          const outside = c.x * Math.cos(facing) * outsideOf[0] + c.y * outsideOf[1] - c.z * Math.sin(facing) * outsideOf[0]
          for (const index of outside >= 0 ? triangle : triangle.toReversed()) {
            const [point, angle, around, normal] = quad[index]
            push(point, angle, around, normal, facing)
          }
        }
      }
    }
    const soup = new BufferGeometry
    soup.setAttribute('position', new Float32BufferAttribute(positions, 3))
    soup.setAttribute('normal', new Float32BufferAttribute(normals, 3))
    soup.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
    const welded = mergeVertices(soup, 1e-6)
    soup.dispose()
    this.setIndex(welded.index)
    for (const [name, attribute] of Object.entries(welded.attributes)) {
      this.setAttribute(name, attribute)
    }
    welded.dispose()
    this.computeBoundingBox()
    this.computeBoundingSphere()
  }
}

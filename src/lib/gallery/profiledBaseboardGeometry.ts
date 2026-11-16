import {BufferGeometry, Float32BufferAttribute, ShapeUtils, Vector2, Vector3} from 'three/webgpu'

/** a band of a baseboard: how high its top stands over the floor and how far its front stands out of the wall’s center line */
export type BaseboardBand = {
  front: number
  top: number
}
type Point = readonly [x: number, y: number, z: number]

const a = new Vector3
const b = new Vector3
const c = new Vector3

/**
 * A baseboard of stacked `bands`, from the lowest up, swept along the floor contact `profile` of a wall in its own frame, x along the wall, y up and z out of it, from the wall’s face at `back` out to the bands’ fronts: one closed solid for each stretch of the profile between vertical jumps, which repeated u coordinates mark.
 * Between the profile’s points, the floor runs straight; `slices` adds stations every `step` meters from `origin` along the wall and at its `extra` places, where a curved wall is sliced before it bends, so none of its faces needs cutting again. Its faces are flat-shaded, each triangle wound to face out of the solid; the stations’ rings stand plumb, so the solid’s sides keep their section all along.
 */
export default function profiledBaseboardGeometry(profile: ReadonlyArray<readonly [u: number, y: number]>, bands: ReadonlyArray<BaseboardBand>, back: number, slices?: {
  /** further places along the wall it is sliced at */
  extra?: ReadonlyArray<number>
  origin: number
  step: number
}) {
  if (!bands.length || bands.some(({front, top}, index) => !(front > back) || !(top > (index ? bands[index - 1].top : 0)))) {
    throw new RangeError('A baseboard’s bands stand out of the wall and each rises over the one under it.')
  }
  if (slices && !(slices.step > 0)) {
    throw new RangeError('A baseboard’s slices need a positive step.')
  }
  const stretches: Array<Array<readonly [number, number]>> = [[]]
  for (const point of profile) {
    const stretch = stretches.at(-1)!
    if (stretch.at(-1)?.[0] === point[0]) {
      stretches.push([point])
    } else {
      stretch.push(point)
    }
  }
  // The section round from the wall’s face on the floor, out along the floor, up and out each band’s front and back to the wall’s face over the top.
  const section: Array<readonly [z: number, y: number]> = [[back, 0]]
  for (const [index, {front, top}] of bands.entries()) {
    section.push([front, index ? bands[index - 1].top : 0], [front, top])
  }
  section.push([back, bands.at(-1)!.top])
  // Counterclockwise in the plane of z and y, each edge’s outward normal turns right of it.
  const area = section.reduce((sum, [z, y], index) => {
    const [nextZ, nextY] = section[(index + 1) % section.length]
    return sum + z * nextY - nextZ * y
  }, 0)
  const outwardOf = section.map(([z, y], index): Point => {
    const [nextZ, nextY] = section[(index + 1) % section.length]
    return [0, -(nextZ - z) * Math.sign(area), (nextY - y) * Math.sign(area)]
  })
  const positions: Array<number> = []
  const normals: Array<number> = []
  const uvs: Array<number> = []
  /** Adds the triangle, wound to face the side `outward` points to. */
  const triangle = (p: Point, q: Point, r: Point, outward: Point) => {
    a.set(...p)
    b.set(...q).sub(a)
    c.set(...r).sub(a)
    b.cross(c)
    if (b.lengthSq() < 1e-20) {
      return
    }
    const facing = b.x * outward[0] + b.y * outward[1] + b.z * outward[2] > 0
    b.normalize()
    if (!facing) {
      b.negate()
    }
    for (const corner of facing ? [p, q, r] : [p, r, q]) {
      positions.push(...corner)
      normals.push(b.x, b.y, b.z)
      // Like an extrusion’s: its ends by their place across the section, its sides along the wall.
      uvs.push(...Math.abs(b.x) > 0.5 ? [corner[2], corner[1]] : [corner[0], Math.abs(b.y) > Math.abs(b.z) ? corner[2] : corner[1]])
    }
  }
  const capTriangles = ShapeUtils.triangulateShape(section.map(([z, y]) => new Vector2(z, y)), [])
  for (const stretch of stretches) {
    if (stretch.length < 2) {
      continue
    }
    const [first, last] = [stretch[0][0], stretch.at(-1)![0]]
    const extra = slices ? [...Array.from({length: Math.max(0, Math.ceil((last - slices.origin) / slices.step) - Math.floor((first - slices.origin) / slices.step) + 1)}, (_, k) => slices.origin + (Math.floor((first - slices.origin) / slices.step) + k) * slices.step), ...slices.extra ?? []].filter((u, index, all) => u > first + 1e-7 && u < last - 1e-7 && stretch.every(([pu]) => Math.abs(pu - u) > 1e-7) && all.findIndex(other => Math.abs(other - u) <= 1e-7) === index) : []
    const floorAt = (u: number) => {
      const next = Math.max(1, stretch.findIndex(([pu]) => pu >= u))
      const [[u0, y0], [u1, y1]] = [stretch[next - 1], stretch[next]]
      return y0 + (y1 - y0) * (u - u0) / (u1 - u0)
    }
    const stations = [...stretch, ...extra.map(u => [u, floorAt(u)] as const)].toSorted((p, q) => p[0] - q[0])
    const rings = stations.map(([u, y]) => section.map(([z, up]): Point => [u, y + up, z]))
    for (let station = 0; station < rings.length - 1; station++) {
      const [near, far] = [rings[station], rings[station + 1]]
      for (let corner = 0; corner < section.length; corner++) {
        const next = (corner + 1) % section.length
        triangle(near[corner], far[corner], far[next], outwardOf[corner])
        triangle(near[corner], far[next], near[next], outwardOf[corner])
      }
    }
    for (const [end, cap] of [[0, rings[0]], [1, rings.at(-1)!]] as const) {
      const outward: Point = [end ? 1 : -1, 0, 0]
      for (const [p, q, r] of capTriangles) {
        triangle(cap[p], cap[q], cap[r], outward)
      }
    }
  }
  const geometry = new BufferGeometry
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

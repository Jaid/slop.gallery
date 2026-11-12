import type {BufferGeometry} from 'three/webgpu'

import {ExtrudeGeometry, Matrix4, Shape, Vector2} from 'three/webgpu'

import {circleSegments, mergeParts} from '../geometry.ts'
import {colliderGeometry} from './architecture.ts'

/** a part of a pedestal centered on the wall at `z`: half round, or, with a `length`, running that far straight out of the wall before it rounds off */
export type PedestalLobe = {
  /** its cap’s top over the floor under its middle */
  height: number
  /** how far its flanks run straight out of the wall before its round end */
  length?: number
  /** its body’s, inside the course and the cap */
  radius: number
  z: number
}

export type DisplayPedestalOptions = {
  /** which side of the wall the pedestal stands on, along x */
  direction?: -1 | 1
  /** its parts, north to south, which neighbors overlap so they merge into one */
  lobes: ReadonlyArray<PedestalLobe>
  /** how high the course at the foot is */
  plinth: number
  /** lateral travel along the wall per meter along z; the level caps follow the diagonal bay */
  skew?: number
  /** how far the floor rises per meter along +z; the course follows it, everything over it stays level */
  slope?: number
}

/** how far the course and the caps reach out past the bodies, and the shadow gaps under the caps reach in */
export const pedestalOverhang = 0.05
const revealInset = 0.02
const revealHeight = 0.02
export const pedestalCapHeight = 0.08
/** the least height a body keeps over the course where the floor under it is highest */
const leastBody = 0.04
/** a point beside the wall: how far out of it and where along it */
type WallPoint = readonly [number, number]

/** The lobe’s side grown by `grow`, from where it leaves the wall at its −z end, out along its flank, around its round end and back along its other flank to the wall. */
function lobePath({z, radius, length = 0}: PedestalLobe, grow: number): Array<WallPoint> {
  const round = radius + grow
  const steps = Math.max(4, circleSegments(round) / 2)
  const arc = Array.from({length: steps + 1}, (_, step): WallPoint => {
    const angle = -Math.PI / 2 + Math.PI * step / steps
    return [length + round * Math.cos(angle), z + round * Math.sin(angle)]
  })
  return length > 0 ? [[0, z - round], ...arc, [0, z + round]] : arc
}
/** where the segments cross each other, if they do, off the wall */
function segmentCrossing([a, b]: readonly [WallPoint, WallPoint], [c, d]: readonly [WallPoint, WallPoint]): WallPoint | undefined {
  const denominator = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0])
  if (Math.abs(denominator) < 1e-12) {
    return
  }
  const along = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / denominator
  const across = ((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / denominator
  if (along < 0 || along > 1 || across < 0 || across > 1) {
    return
  }
  const point: WallPoint = [a[0] + along * (b[0] - a[0]), a[1] + along * (b[1] - a[1])]
  return point[0] > 1e-9 ? point : undefined
}
/**
 * The outline of the lobes, which runs along z through the origin, `direction` sides out of it, each grown by `grow`.
 * It follows each lobe’s side from where the one before crosses it to where the next one does, and the wall closes it.
 */
function outline(lobes: ReadonlyArray<PedestalLobe>, grow: number, direction: -1 | 1) {
  let path = lobePath(lobes[0], grow)
  for (const lobe of lobes.slice(1)) {
    const next = lobePath(lobe, grow)
    let joined: Array<WallPoint> | undefined
    // The side so far ends with the last lobe’s, which the next one crosses on its way out of the wall.
    for (let i = path.length - 2; i >= 0 && !joined; i--) {
      for (let j = 0; j < next.length - 1 && !joined; j++) {
        const point = segmentCrossing([path[i], path[i + 1]], [next[j], next[j + 1]])
        if (point) {
          joined = [...path.slice(0, i + 1), point, ...next.slice(j + 1)]
        }
      }
    }
    if (!joined) {
      throw new RangeError('Neighboring pedestal lobes have to overlap without one swallowing the other.')
    }
    path = joined
  }
  // Shape y becomes −z once the extrusion turns upright.
  return new Shape(path.map(([out, along]) => new Vector2(direction * out, -along)))
}
/** The outline extruded upright from `bottom` to `top`, its edges beveled inside it. */
function block(shape: Shape, bottom: number, top: number, bevel: number) {
  const geometry = new ExtrudeGeometry(shape, {
    depth: top - bottom - bevel * 2,
    steps: 1,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    // Keeps the finished silhouette inside the requested outline.
    bevelOffset: -bevel,
    bevelSegments: 2,
  })
  return geometry.rotateX(-Math.PI / 2).translate(0, bottom + bevel, 0)
}
/** Shears the vertices at or under `below` up by the floor’s rise along z from `origin` on, all of them without `below`, and turns their normals along. */
function ground(geometry: BufferGeometry, slope: number, below = Infinity, origin = 0) {
  const positions = geometry.getAttribute('position')
  const normals = geometry.getAttribute('normal')
  for (let i = 0; i < positions.count; i++) {
    if (positions.getY(i) > below) {
      continue
    }
    positions.setY(i, positions.getY(i) + (positions.getZ(i) - origin) * slope)
    // Normals follow the shear’s inverse transpose.
    const x = normals.getX(i)
    const y = normals.getY(i)
    const z = normals.getZ(i) - slope * y
    const length = Math.hypot(x, y, z)
    normals.setXYZ(i, x / length, y / length, z / length)
  }
  return geometry
}

/**
 * A stepped plinth backing onto a display’s wall: one course at its foot following the sloping floor around all its lobes, and on it each lobe’s body, shadow gap and level cap, which reaches out past the body like the course does.
 * Neighboring lobes overlap, so a low one sits against a high one’s flank like a sidecar.
 */
export default class DisplayPedestalGeometry {
  readonly cap: BufferGeometry
  readonly collision: Array<[Float32Array, Uint32Array]>
  readonly reveal: BufferGeometry
  readonly stone: BufferGeometry

  constructor({lobes, plinth, direction = 1, slope = 0, skew = 0}: DisplayPedestalOptions) {
    if (!lobes.length || !(plinth > 0) || ![slope, skew].every(Number.isFinite)) {
      throw new RangeError('A display pedestal needs lobes, a course and a finite slope.')
    }
    for (const [index, lobe] of lobes.entries()) {
      if (!(lobe.radius > 0) || !Number.isFinite(lobe.z) || !(lobe.height > 0)) {
        throw new RangeError('A pedestal lobe needs a positive size.')
      }
      if (index > 0 && !(lobe.z > lobes[index - 1].z)) {
        throw new RangeError('Pedestal lobes go from −z to +z.')
      }
      if (!((lobe.length ?? 0) >= 0)) {
        throw new RangeError('A pedestal lobe’s flanks cannot run into the wall.')
      }
      // Where the floor under it is highest, the course rises closest to its shadow gap.
      if (lobe.height - pedestalCapHeight - revealHeight - plinth - Math.abs(slope) * (lobe.radius + pedestalOverhang) < leastBody) {
        throw new RangeError('A pedestal lobe’s body has to stay taller than the course where the floor is highest.')
      }
    }
    const stone: Array<BufferGeometry> = [ground(block(outline(lobes, pedestalOverhang, direction), -0.02, plinth, 0.012), slope)]
    const reveals: Array<BufferGeometry> = []
    const caps: Array<BufferGeometry> = []
    for (const lobe of lobes) {
      const top = lobe.height + slope * lobe.z
      const capBottom = top - pedestalCapHeight
      const bodyTop = capBottom - revealHeight
      const side = (grow: number) => outline([lobe], grow, direction)
      // The body only follows the floor with its foot, on the course: built over the floor under the lobe’s middle, its foot is sheared along the slope from there, then it is lifted onto that floor.
      stone.push(ground(block(side(0), plinth, bodyTop - slope * lobe.z, 0.006), slope, plinth + 0.012 + 1e-6, lobe.z).translate(0, slope * lobe.z, 0))
      reveals.push(block(side(-revealInset), bodyTop, capBottom, 0.002))
      caps.push(block(side(pedestalOverhang), capBottom, top, 0.01))
    }
    this.stone = mergeParts(stone)
    this.reveal = mergeParts(reveals)
    this.cap = mergeParts(caps)
    if (skew) {
      const transform = new Matrix4
      transform.set(1, 0, skew, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)
      for (const part of [this.stone, this.reveal, this.cap]) {
        part.applyMatrix4(transform)
      }
    }
    this.collision = [this.stone, this.reveal, this.cap].map(colliderGeometry)
  }

  dispose() {
    this.stone.dispose()
    this.reveal.dispose()
    this.cap.dispose()
  }
}

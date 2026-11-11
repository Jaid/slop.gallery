import type {Wall, WallOpening} from '../placement/wallGeometry.ts'

import {ADDITION, Brush, Evaluator, SUBTRACTION} from 'three-bvh-csg'
import {mergeVertices, toCreasedNormals} from 'three/addons/utils/BufferGeometryUtils.js'
import {BoxGeometry, BufferGeometry, ExtrudeGeometry, Matrix4, MeshBasicNodeMaterial, Shape, Vector3} from 'three/webgpu'

import {openingArc, openingCircle} from '../placement/wallGeometry.ts'
import {baseboardBandFront, baseboardCapFront, baseboardCapHeight, corniceBands, defaultBaseboardHeight, openingCasingFronts, wallFace, wallOpeningTrim} from './architectureDimensions.ts'
import {bendGeometry, curveSegments as bendSegments, sliceAlongX} from './CurvedBoxGeometry.ts'

export {wallFace, wallOpeningTrim, wallTop} from './architectureDimensions.ts'

const curveSegments = 64
/** a molded baseboard’s faces bend smoothly round its curves, but break at sharper turns than this, like those at its fillets */
const baseboardCrease = Math.PI / 6
/** how far a straight edge of a curved wall’s face may stand off its curve, in meters: an edge of length l on radius r stands l² / 8r off */
const bendTolerance = 0.0005
/** The opening’s outline in the wall’s plane, `padding` meters further out around its sides and top, like its casing, from `bottom` up, or for a round opening, all round its circle. */
export const openingShape = (hole: WallOpening, padding = 0, bottom = hole.bottom ?? -0.5) => {
  const shape = new Shape
  // A round opening is a circle all round, its casing as wide.
  if (hole.profile === 'round') {
    const {radius, center} = openingCircle(hole)
    shape.absarc(hole.u, center, radius + padding, 0, Math.PI * 2, false)
    return shape
  }
  const halfWidth = hole.width / 2 + padding
  shape.moveTo(hole.u - halfWidth, bottom)
  shape.lineTo(hole.u + halfWidth, bottom)
  if (hole.profile === 'arch') {
    // A padded segmental arch keeps its center, so its casing stays as wide all round.
    const {radius, center} = openingArc(hole)
    const angle = Math.atan2(Math.sqrt(Math.max(0, (radius + padding) ** 2 - halfWidth ** 2)), halfWidth)
    const spring = center + Math.sin(angle) * (radius + padding)
    shape.lineTo(hole.u + halfWidth, spring)
    shape.absarc(hole.u, center, radius + padding, angle, Math.PI - angle, false)
  } else {
    shape.lineTo(hole.u + halfWidth, hole.height + padding)
    shape.lineTo(hole.u - halfWidth, hole.height + padding)
  }
  shape.closePath()
  return shape
}
const extrude = (shape: Array<Shape> | Shape, depth: number, z: number) => {
  const extrudedProfile = new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    steps: 1,
    curveSegments,
  })
  return extrudedProfile.translate(0, 0, z)
}

export type ArchitectureGeometry = ReturnType<typeof createArchitectureGeometry>
type ArchitectureParts = ReturnType<typeof cutArchitecture>
export function colliderGeometry(geometry: BufferGeometry): [Float32Array, Uint32Array] {
  // UV seams and lathe poles are render attributes, not physical cracks. Weld only
  // positions and remove zero-area faces before Rapier builds its contact topology.
  const surface = new BufferGeometry
  surface.setAttribute('position', geometry.getAttribute('position'))
  surface.setIndex(geometry.index)
  const welded = mergeVertices(surface, 1e-6)
  try {
    const positions = welded.getAttribute('position')
    const vertices = Float32Array.from(positions.array)
    const indices: Array<number> = []
    const source = welded.index!
    const origin = new Vector3
    const ab = new Vector3
    const ac = new Vector3
    for (let i = 0; i < source.count; i += 3) {
      const a = source.getX(i)
      const b = source.getX(i + 1)
      const c = source.getX(i + 2)
      origin.fromBufferAttribute(positions, a)
      ab.fromBufferAttribute(positions, b).sub(origin)
      ac.fromBufferAttribute(positions, c).sub(origin)
      if (ab.cross(ac).lengthSq() > 1e-20) {
        indices.push(a, b, c)
      }
    }
    return [vertices, Uint32Array.from(indices)]
  } finally {
    welded.dispose()
    surface.dispose()
  }
}
// CSG runs once per wall layout, never in the animation loop.
function cutArchitecture(wall: Wall) {
  const top = wall.height + 0.3
  const baseboardHeight = wall.baseboardHeight ?? defaultBaseboardHeight
  const capHeight = wall.baseboardCapHeight ?? baseboardCapHeight
  if (!Number.isFinite(capHeight) || capHeight <= 0 || !Number.isFinite(baseboardHeight) || baseboardHeight <= capHeight) {
    throw new RangeError('A baseboard needs a finite height greater than its positive cap height.')
  }
  if (wall.curveRadius && wall.slope) {
    throw new RangeError('Curved walls cannot rake; their baseboards can follow a sloping floor instead.')
  }
  const baseboardSection = wall.baseboardSection
  if (baseboardSection) {
    const [first] = baseboardSection
    const last = baseboardSection.at(-1)
    const descends = (y: number, index: number) => index > 0 && y < baseboardSection[index - 1][1]
    if (wall.baseboardProfile || wall.slope || baseboardSection.length < 2 || first[1] !== 0 || last?.[0] !== wallFace || !(last[1] > 0) || baseboardSection.some(([front, y], index) => !Number.isFinite(front + y) || front < wallFace || descends(y, index))) {
      throw new RangeError('A baseboard’s section runs along a level floor, from its toe on the floor up to the wall’s face, never inside the wall or downward.')
    }
  }
  const box = (width: number, height: number, depth: number, x: number, y: number, z: number) => {
    const bendableBlock = new BoxGeometry(width, height, depth, wall.curveRadius ? bendSegments(width, wall.curveRadius) : 1)
    return bendableBlock.translate(x, y, z)
  }
  // A band running the full width ends on the bisector of an inside corner, through the corner of both wall faces, meeting the adjoining wall’s band.
  const miter = (geometry: BufferGeometry, miters = wall.miters) => {
    if (!miters?.some(Boolean)) {
      return geometry
    }
    const position = geometry.getAttribute('position')
    for (let vertex = 0; vertex < position.count; vertex++) {
      const x = position.getX(vertex)
      const side = Math.sign(x)
      const slant = miters[side < 0 ? 0 : 1]
      if (slant && Math.abs(Math.abs(x) - wall.width / 2) < 1e-6) {
        position.setX(vertex, side * (wall.width / 2 - position.getZ(vertex) * slant))
      }
    }
    geometry.computeVertexNormals()
    return geometry
  }
  const evaluator = new Evaluator
  evaluator.useGroups = false
  const material = new MeshBasicNodeMaterial
  const brushes: Array<Brush> = []
  const retained = new Set<BufferGeometry>
  const brush = (geometry: BufferGeometry) => {
    const result = new Brush(geometry, material)
    result.updateMatrixWorld(true)
    brushes.push(result)
    return result
  }
  const holes = wall.holes ?? []
  const cutters = holes.map(hole => brush(extrude(openingShape(hole), 2, -0.5)))
  const cut = (geometry: Brush | BufferGeometry, through = cutters) => {
    let result = geometry instanceof Brush ? geometry : brush(geometry)
    for (const cutter of through) {
      const target = brush(new BufferGeometry)
      result = evaluator.evaluate(result, cutter, SUBTRACTION, target)
    }
    result.geometry.computeBoundingBox()
    result.geometry.computeBoundingSphere()
    retained.add(result.geometry)
    return result.geometry
  }
  try {
    // Paired room faces meet at z = 0 instead of occupying overlapping solids.
    const surface = cut(box(wall.width, top, wallFace, 0, top / 2, wallFace / 2))
    // Trim starts at the plaster face so their exposed doorway reveals never overlap.
    const trimBox = (width: number, height: number, front: number, x: number, y: number) => brush(box(width, height, front - wallFace, x, y, (front + wallFace) / 2))
    const baseboardBand = (bottom: number, height: number, front: number) => {
      if (!wall.baseboardProfile) {
        return brush(miter(box(wall.width, height, front - wallFace, 0, bottom + height / 2, (front + wallFace) / 2), wall.baseboardMiters ?? wall.miters))
      }
      // Sweep each band along the actual floor contact instead of burying a
      // horizontal molding in the ramp and exposing a tapering triangular stub.
      // Repeated coordinates mark a discontinuity, such as the end of a raised landing. Sweeping one polygon through a vertical
      // jump would cross its own offset edges. Terminate both bands there instead of leaving self-intersecting trim or a tall riser.
      const sections: Array<Array<readonly [number, number]>> = [[]]
      for (const point of wall.baseboardProfile) {
        const section = sections.at(-1)!
        if (section.at(-1)?.[0] === point[0]) {
          sections.push([point])
        } else {
          section.push(point)
        }
      }
      const shapes = sections.filter(section => section.length >= 2).map(section => {
        const shape = new Shape
        for (const [i, [u, y]] of section.entries()) {
          if (i === 0) {
            shape.moveTo(u, y + bottom)
          } else {
            shape.lineTo(u, y + bottom)
          }
        }
        for (const [u, y] of section.toReversed()) {
          shape.lineTo(u, y + bottom + height)
        }
        shape.closePath()
        return shape
      })
      return brush(extrude(shapes, front - wallFace, wallFace))
    }
    /** The baseboard swept along the wall through its {@link Wall.baseboardSection}, between its wall face and the toe and top that meet it. */
    const sectionBand = (points: NonNullable<Wall['baseboardSection']>) => {
      const shape = new Shape
      shape.moveTo(wallFace, 0)
      for (const [front, y] of points) {
        shape.lineTo(front, y)
      }
      shape.closePath()
      // Swept along z, then turned so that it runs along x, the section’s x standing out of the wall.
      const swept = new ExtrudeGeometry(shape, {
        depth: wall.width,
        bevelEnabled: false,
        steps: wall.curveRadius ? bendSegments(wall.width, wall.curveRadius) : 1,
        curveSegments: 1,
      })
      swept.rotateY(-Math.PI / 2).translate(wall.width / 2, 0, 0)
      miter(swept, wall.baseboardMiters ?? wall.miters)
      // Smoothed in centimeters, as the normal utility welds positions closer than 0.01 units, which would merge the section’s small steps.
      const smooth = toCreasedNormals(swept.scale(100, 100, 100), baseboardCrease).scale(0.01, 0.01, 0.01)
      swept.dispose()
      return brush(smooth)
    }
    const trim: Array<BufferGeometry> = []
    if (wall.trimStyle !== 'none') {
      let molding = baseboardSection ? sectionBand(baseboardSection) : baseboardBand(0, baseboardHeight - capHeight, baseboardBandFront)
      const join = (part: Brush) => {
        molding = evaluator.evaluate(molding, part, ADDITION, brush(new BufferGeometry))
      }
      if (!baseboardSection) {
        join(baseboardBand(baseboardHeight - capHeight, capHeight, baseboardCapFront))
      }
      for (const hole of holes) {
        if (hole.casing === false) {
          continue
        }
        const front = openingCasingFronts[wall.trimStyle === 'plain' ? 'plain' : 'classic']
        join(brush(extrude(openingShape(hole, wallOpeningTrim, hole.bottom ? hole.bottom - wallOpeningTrim : 0), front - wallFace, wallFace)))
        if (wall.trimStyle !== 'plain' && !hole.bottom) {
          for (const side of [-1, 1]) {
            join(trimBox(0.3, 0.4, 0.325, hole.u + side * (hole.width / 2 + wallOpeningTrim / 2), 0.2))
          }
        }
      }
      // Cut the assembled solid once, leaving a single reveal instead of coplanar faces
      // from the baseboard, arch and plinth. Rendering and collision share this geometry.
      trim.push(cut(molding))
    }
    const glazing = (wall.holes ?? []).filter(hole => hole.glassThickness).map(hole => {
      const bottom = hole.bottom ?? 0
      const geometry = extrude(openingShape(hole, 0, bottom), hole.glassThickness!, (wallFace - hole.glassThickness!) / 2)
      geometry.computeBoundingBox()
      geometry.computeBoundingSphere()
      retained.add(geometry)
      return geometry
    })
    // Raking bands are sheared with the wall rather than rotated: their ends stay plumb and flush with
    // the wall ends, and their vertical section matches the level cornice they meet at a stair landing.
    // Like the baseboards, both bands start at the plaster face, so their ends never share the wall’s end faces. The lower band
    // stands 1 cm proud of a classic opening casing (0.27 m), which can run up into it in low rooms.
    const corniceBand = (height: number, front: number, y: number) => miter(box(wall.width, height, front - wallFace, 0, y, (front + wallFace) / 2))
    // Bare openings cut through it, so it doesn’t run across them like a lintel.
    const bare = cutters.filter((_, index) => holes[index].casing === false)
    const cornice = wall.trimStyle === 'none' || wall.cornice === false ? [] : corniceBands.map(({height, front, drop}) => {
      const band = corniceBand(height, front, wall.height - drop)
      return bare.length ? cut(band, bare) : band
    })
    for (const part of cornice) {
      retained.add(part)
    }
    if (wall.slope) {
      const shear = new Matrix4
      shear.set(1, 0, 0, 0, wall.slope, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)
      for (const geometry of [surface, ...trim, ...glazing, ...cornice]) {
        geometry.applyMatrix4(shear)
        geometry.computeBoundingBox()
        geometry.computeBoundingSphere()
      }
    }
    for (const part of retained) {
      if (wall.curveRadius) {
        // Cutting the openings and sweeping the baseboards along the floor leave long faces; cut again, they curve with the wall instead of running straight across, and the cut’s T-junctions stay a fraction of a millimeter apart.
        if (wall.holes?.length || wall.baseboardProfile) {
          sliceAlongX(part, Math.min(wall.width / bendSegments(wall.width, wall.curveRadius), Math.sqrt(8 * Math.abs(wall.curveRadius) * bendTolerance)), -wall.width / 2)
        }
        bendGeometry(part, wall.curveRadius)
      }
      part.computeBoundingBox()
      part.computeBoundingSphere()
    }
    const collision = [surface, ...trim, ...glazing].map(colliderGeometry)
    return {
      surface,
      cornice,
      trim,
      glazing,
      collision,
    }
  } catch (error) {
    for (const geometry of retained) {
      geometry.dispose()
    }
    throw error
  } finally {
    for (const createdBrush of brushes) {
      createdBrush.disposeCacheData()
      if (!retained.has(createdBrush.geometry)) {
        createdBrush.geometry.dispose()
      }
    }
    material.dispose()
  }
}
const withDisposal = (parts: ArchitectureParts) => ({
  ...parts,
  dispose() {
    for (const geometry of [parts.surface, ...parts.cornice, ...parts.trim, ...parts.glazing]) {
      geometry.dispose()
    }
  },
})
export function createArchitectureGeometry(wall: Wall) {
  return withDisposal(cutArchitecture(wall))
}

const architectureKey = (wall: Wall) => JSON.stringify([wall.width, wall.height, wall.holes ?? [], wall.slope ?? 0, wall.baseboardProfile ?? null, wall.trimStyle ?? 'classic', wall.cornice ?? true, wall.curveRadius ?? 0, wall.baseboardHeight ?? defaultBaseboardHeight, wall.baseboardCapHeight ?? baseboardCapHeight, wall.baseboardSection ?? null, wall.miters ?? null, wall.baseboardMiters ?? null])
/** Cuts each distinct layout among `walls` once. Called at module level on fixed walls, the build bakes the result for {@link provideArchitecture}. */
export function cutArchitectures(walls: ReadonlyArray<Wall>) {
  const cuts = new Map<string, ArchitectureParts>
  for (const wall of walls) {
    const key = architectureKey(wall)
    if (!cuts.has(key)) {
      cuts.set(key, cutArchitecture(wall))
    }
  }
  return cuts
}
const cache = new Map<string, ArchitectureGeometry>
/** Lets {@link architectureGeometry} hand out walls cut ahead of time. */
export function provideArchitecture(cuts: ReadonlyMap<string, ArchitectureParts>) {
  for (const [key, parts] of cuts) {
    const geometry = withDisposal(parts)
    if (cache.has(key)) {
      geometry.dispose()
    } else {
      cache.set(key, geometry)
    }
  }
}
export function architectureGeometry(wall: Wall) {
  const key = architectureKey(wall)
  let geometry = cache.get(key)
  if (!geometry) {
    geometry = createArchitectureGeometry(wall)
    cache.set(key, geometry)
  }
  return geometry
}

// Bun’s types claim import.meta.hot always exists, but outside the Vite dev server it is undefined.
if (import.meta.hot as ImportMeta['hot'] | undefined) {
  import.meta.hot.dispose(() => {
    for (const geometry of cache.values()) {
      geometry.dispose()
    }
    cache.clear()
  })
}

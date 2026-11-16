import type {Wall} from '../placement/wallGeometry.ts'

import {BufferGeometry, Float32BufferAttribute, ShapeUtils, Vector2} from 'three/webgpu'

import {mergeParts} from '../geometry.ts'
import {baseboardBandFront, baseboardCapFront, wallFace} from './architectureDimensions.ts'

/** A stepped skirting swept through its floor-contact knots and bend stations. Each face is a strip, not a triangulated polygon fan subsequently sliced into thousands of slivers. Built unbent, like the other architecture parts. */
export default class ProfiledBaseboardGeometry extends BufferGeometry {
  constructor(profile: Readonly<NonNullable<Wall['baseboardProfile']>>, height: number, capHeight: number, bendStep?: number, origin = 0) {
    super()
    if (!Number.isFinite(height) || !Number.isFinite(capHeight) || capHeight <= 0 || height <= capHeight || !Number.isFinite(origin) || bendStep !== undefined && (!Number.isFinite(bendStep) || bendStep <= 0) || profile.length < 2 || profile.some(([x, y], i) => !Number.isFinite(x + y) || i > 0 && x < profile[i - 1][0]) || !profile.some(([x], i) => i > 0 && x > profile[i - 1][0])) {
      throw new RangeError('A profiled baseboard needs an ordered finite floor profile with a positive span, a positive cap below its top and a positive bend step if supplied.')
    }
    // Counterclockwise in (front, up), with a hard edge between every face.
    const section = [[wallFace, 0], [baseboardBandFront, 0], [baseboardBandFront, height - capHeight], [baseboardCapFront, height - capHeight], [baseboardCapFront, height], [wallFace, height]] as const
    const runs: Array<Array<readonly [number, number]>> = [[]]
    for (const point of profile) {
      const run = runs.at(-1)!
      if (run.at(-1)?.[0] === point[0]) {
        runs.push([point])
      } else {
        run.push(point)
      }
    }
    const parts: Array<BufferGeometry> = []
    for (const run of runs) {
      if (run.length < 2) {
        continue
      }
      const stations = run.flatMap(([x, y], index) => {
        const next = run.at(index + 1)
        const points: Array<readonly [number, number]> = [[x, y]]
        if (bendStep && next) {
          for (let k = Math.floor((x - origin) / bendStep) + 1; origin + k * bendStep < next[0] - 1e-7; k++) {
            const u = origin + k * bendStep
            if (u > x + 1e-7) {
              points.push([u, y + (next[1] - y) * (u - x) / (next[0] - x)])
            }
          }
        }
        return points
      })
      for (const [face, a] of section.entries()) {
        const b = section[(face + 1) % section.length]
        const strip = new BufferGeometry
        strip.setAttribute('position', new Float32BufferAttribute(stations.flatMap(([x, y]) => [x, y + a[1], a[0], x, y + b[1], b[0]]), 3))
        strip.setAttribute('uv', new Float32BufferAttribute(stations.flatMap(([x, y]) => [x, y + a[1], x, y + b[1]]), 2))
        strip.setIndex(stations.slice(1).flatMap((_, i) => {
          const v = i * 2
          return [v, v + 2, v + 1, v + 1, v + 2, v + 3]
        }))
        strip.computeVertexNormals()
        parts.push(strip)
      }
      const triangles = ShapeUtils.triangulateShape(section.map(([z, y]) => new Vector2(z, y)), [])
      for (const [end, [x, y]] of [stations[0], stations.at(-1)!].entries()) {
        const cap = new BufferGeometry
        cap.setAttribute('position', new Float32BufferAttribute(section.flatMap(([z, up]) => [x, y + up, z]), 3))
        cap.setAttribute('normal', new Float32BufferAttribute(section.flatMap(() => [end ? 1 : -1, 0, 0]), 3))
        cap.setAttribute('uv', new Float32BufferAttribute(section.flatMap(([z, up]) => [z, y + up]), 2))
        cap.setIndex(triangles.flatMap(([a, b, c]) => (end ? [a, c, b] : [a, b, c])))
        parts.push(cap)
      }
    }
    const merged = mergeParts(parts)
    this.copy(merged)
    merged.dispose()
  }
}

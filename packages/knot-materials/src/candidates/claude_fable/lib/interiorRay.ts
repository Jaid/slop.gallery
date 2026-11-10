import type {Node} from 'three/webgpu'

import {float, mx_worley_noise_float, normalLocal, refract, tangentLocal, vec2} from 'three/tsl'

import {cellNoiseVec3} from './cellNoiseVec3.ts'
import {toFloat} from './toFloat.ts'
import {knotLength, tubeCircumference} from './tubeCoordinates.ts'
import {viewerFrame} from './viewerFrame.ts'

export type InteriorRay = ReturnType<typeof interiorRay>
/**
 * The viewer's line of sight refracted into the surface, in object space.
 * Sampling 3D fields at `at(depth)` gives interior layers true parallax: they slide against the surface as the viewer moves,
 * and foreshorten at grazing angles the way things do under real glass, ice or resin.
 */
export function interiorRay(ior: number, normal: Node<'vec3'> = normalLocal.normalize()) {
  const {view, p} = viewerFrame()
  const incident = view.negate()
  const refracted = refract(incident, normal, 1 / ior).normalize()
// Cosine of the refracted angle; the ray always points into the surface.
  const cosRefracted = refracted.dot(normal).negate().clamp(0.08, 1)
  const at = (depth: Node<'float'> | number) => p.add(refracted.mul(toFloat(depth).div(cosRefracted)))
  const tangent = tangentLocal.xyz.normalize()
  const around = normal.cross(tangent).normalize()
// Sliding of a layer at unit depth, in tube-UV units (raw `uv()` along, `uv()` around); useful for patterned interiors.
  const slide = refracted.div(cosRefracted)
  const uvSlide = vec2(slide.dot(tangent).div(knotLength), slide.dot(around).div(tubeCircumference))
  return {
    refracted,
    cosRefracted,
    at,
    uvSlide,
    uvAt: (base: Node<'vec2'>, depth: Node<'float'> | number) => base.add(uvSlide.mul(depth)),
  }
}
/** Schlick's approximation of dielectric reflectance from the cosine between view and normal. */
export function fresnel(cosTheta: Node<'float'>, f0: number) {
  return cosTheta.clamp().oneMinus().pow(5).mul(1 - f0).add(f0)
}
/**
 * Cross-sections of spherical inclusions (bubbles, seeds, pearls) at one depth layer, one per Worley cell.
 * `mask` is the anti-aliased disc, `cap` the height of the sphere above the layer (1 at the center, 0 at the rim).
 */
export function inclusions(position: Node<'vec3'>, radius: number) {
  const distance = mx_worley_noise_float(position, 1, 0)
  const footprint = distance.fwidth().max(0.001)
  const mask = distance.smoothstep(float(radius).sub(footprint), radius).oneMinus().mul(footprint.smoothstep(radius * 0.6, radius * 2.5).oneMinus())
  const cap = distance.div(radius).clamp().pow2().oneMinus().sqrt()
  return {
    distance,
    mask,
    cap,
  }
}
/**
 * Random planar sheets inside a slab, seen face-on through the surface. The refracted ray is intersected with one random
 * plane per lattice cell and the sheet shows where the hit lies inside both the slab and the cell, so it is a polygon that
 * moves with true parallax. `cosIncidence` is the cosine between the ray and the sheet, for Fresnel and total reflection.
 */
export function interiorSheets(ray: InteriorRay, scale: number, depthRange: [number, number], seed: number, keep: number) {
  const entry = ray.at(depthRange[0]).mul(scale)
  const cell = entry.floor()
  const random = cellNoiseVec3(cell.add(seed))
  const random2 = cellNoiseVec3(cell.add(seed + 37.1))
  const planeNormal = random.sub(0.5).normalize()
  const planePoint = cell.add(random2.mul(0.6).add(0.2))
  const direction = ray.refracted
  const along = direction.dot(planeNormal)
  const t = planePoint.sub(entry).dot(planeNormal).div(along.abs().max(0.02)).mul(along.sign())
  const hit = entry.add(direction.mul(t))
  const depthAtHit = t.div(scale).mul(ray.cosRefracted)
  const slab = depthRange[1] - depthRange[0]
  const inSlab = depthAtHit.smoothstep(0, 0.002).mul(depthAtHit.smoothstep(slab - 0.004, slab).oneMinus())
  const local = hit.sub(cell).sub(0.5).abs()
  const edge = local.x.max(local.y).max(local.z)
  const inCell = edge.smoothstep(0.47, 0.5).oneMinus()
  const gate = random2.y.smoothstep(1 - keep, 1 - keep + 0.04)
  return {
    mask: inSlab.mul(inCell).mul(gate),
    planeNormal,
    cosIncidence: along.abs(),
    random,
  }
}
/** A soft gallery reflection for interior mirrors: brighter toward the ceiling, with the horizon strip of a light tent. */
export function interiorSky(direction: Node<'vec3'>) {
  const up = direction.y
  return up.smoothstep(-0.2, 0.8).mul(0.7).add(up.sub(0.1).abs().smoothstep(0.12, 0).mul(0.5)).add(0.12)
}

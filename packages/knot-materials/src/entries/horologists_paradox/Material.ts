import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_atan2, mx_noise_float, negateOnBackSide, normalViewGeometry, time, uv, vec2, vec3} from 'three/tsl'

import {bumpNormal} from '../../candidates/gpt_astra/lib/bumpNormal.ts'
import {filteredWave} from '../../candidates/gpt_astra/lib/filteredWave.ts'
import {viewerFrame} from '../../candidates/gpt_astra/lib/viewerFrame.ts'
import {visibility} from '../../candidates/gpt_astra/lib/visibility.ts'
import {wrapCell} from '../../candidates/gpt_astra/lib/wrapCell.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import knotData from './data.ts'

// Footprints must come from unwrapped coordinates, never from a repeated shape.
function disk(radius: Node<'float'>, size: number, footprint: Node<'float'>) {
  return radius
    .smoothstep(footprint.negate().add(size), footprint.add(size))
    .oneMinus()
}
function annulus(radius: Node<'float'>, inner: number, outer: number, footprint: Node<'float'>) {
  return disk(radius, outer, footprint).mul(disk(radius, inner, footprint).oneMinus())
}
function watchLine(field: Node<'float'>, width: number, footprint: Node<'float'>) {
  return field.abs().smoothstep(width, footprint.add(width)).oneMinus()
}
function watchGear(point: Node<'vec2'>, radius: number, teeth: number, rotation: Node<'float'>, footprint: Node<'float'>) {
  const r = point.length()
  const theta = (mx_atan2(point.y, point.x.add(0.000001)) as unknown as Node<'float'>).sub(rotation)
  const angularFootprint = footprint.div(r.max(radius * 0.2))
  const toothVisibility = visibility(angularFootprint.mul(teeth), 0.7, 2.7)
  const teethWave = theta.mul(teeth).cos().smoothstep(-0.2, 0.2)
  const toothRadius = mix(float(radius * 0.94), float(radius * 1.06), teethWave)
  const edge = mix(float(radius), toothRadius, toothVisibility)
  const silhouette = r
    .smoothstep(edge.sub(footprint), edge.add(footprint))
    .oneMinus()
  const spokeVisibility = visibility(angularFootprint.mul(6), 0.35, 1.8)
  const spokes = mix(float(0.16), theta.mul(6).cos().smoothstep(0.85, 0.96), spokeVisibility)
  const rim = r.smoothstep(radius * 0.64, radius * 0.76)
  const hub = disk(r, radius * 0.23, footprint)
  return {
    r,
    theta,
    mask: silhouette.mul(rim.max(hub).max(spokes)),
    engraving: watchLine(r.sub(radius * 0.84), radius * 0.018, footprint),
  }
}
function watchWave(phase: Node<'float'>, footprint: Node<'float'>) {
  return phase.cos().mul(visibility(footprint, 0.6, 3.2))
}

/** Recessed mechanical watchwork beneath smooth sapphire-like lids. Three depths produce genuine occlusion/parallax at the apertures: a balance spring, a brass wheel, and a counter-rotating idler. All illumination is ordinary PBR; the mechanism does not glow. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.95)
    this.name = knotData.id
    const tube = uv()
    const {p, near, uvSlope} = viewerFrame()
    const modules = vec2(24, 3)
    const q = tube.mul(modules)
    const surfaceFootprint = q.fwidth().length().max(0.00001)
    // The outer bezel ends at 0.472; keep its filter inside the half-cell boundary.
    const surfaceFilter = surfaceFootprint.min(0.025)
    const moduleId = q.floor()
    const local = q.fract().sub(0.5)
    const random = cellNoiseVec3(vec3(wrapCell(moduleId, modules), 41.7))
    const ray = uvSlope.mul(modules)
    const surfaceRadius = local.length()
    const aperture = disk(surfaceRadius, 0.437, surfaceFilter)
    const bezel = annulus(surfaceRadius, 0.416, 0.472, surfaceFilter)
    // Keep each ray inside its original compartment. Wrapping
    // these coordinates would incorrectly expose a neighbouring
    // mechanism through the cavity's side wall.
    // Differentiate the unwrapped parallax coordinates, not the tile-local points.
    const backFootprint = q.sub(ray.mul(0.032)).fwidth().length().max(0.00001)
    const bigFootprint = q.sub(ray.mul(0.017)).fwidth().length().max(0.00001)
    const smallFootprint = q.sub(ray.mul(0.009)).fwidth().length().max(0.00001)
    const backPoint = local.sub(ray.mul(0.032))
    const backVisible = disk(backPoint.length(), 0.421, backFootprint)
    const springPoint = backPoint.sub(vec2(0.025, -0.025))
    const springRadius = springPoint.length()
    const springAngle = mx_atan2(springPoint.y, springPoint.x.add(0.000001)) as unknown as Node<'float'>
    const balanceMotion = time.mul(1.15)
      .add(random.x.mul(TAU))
      .sin()
      .mul(0.16)
    const springPhase = springRadius.mul(TAU * 17)
      .sub(springAngle)
      .sub(balanceMotion)
    const spring = springPhase.cos()
      .smoothstep(0.75, 0.96)
      .mul(visibility(backFootprint.mul(float(TAU * 17).add(springRadius.max(0.065).reciprocal())), 0.5, 3))
      .mul(annulus(springRadius, 0.065, 0.29, backFootprint))
      .mul(near.mul(0.65).add(0.35))
    const wall = color(hsl.integer(247, 37, 9))
    const backplate = color(hsl.integer(217, 30, 24))
      .mul(mx_noise_float(p.mul(38))
        .mul(0.08)
        .add(0.9))
    let interior = mix(wall, mix(backplate, color(hsl.integer(90, 52, 85)), spring.mul(0.85)), backVisible)
    const bigLayer = local.sub(ray.mul(0.017))
    const bigPoint = bigLayer.sub(vec2(-0.1, -0.045))
    const bigRotation = time.mul(0.13)
      .add(random.y.mul(TAU))
    const big = watchGear(bigPoint, 0.265, 18, bigRotation, bigFootprint)
    const bigMask = big.mask.mul(disk(bigLayer.length(), 0.434, bigFootprint))
    const smallLayer = local.sub(ray.mul(0.009))
    const smallPoint = smallLayer.sub(vec2(0.24, 0.145))
    const smallRotation = time.mul(-0.234)
      .add(random.y.mul(-TAU * 1.8))
    const small = watchGear(smallPoint, 0.145, 10, smallRotation, smallFootprint)
    const smallMask = small.mask.mul(disk(smallLayer.length(), 0.434, smallFootprint))
    const brassBrush = watchWave(big.r.mul(360), bigFootprint.mul(360)).mul(near)
    const nickelBrush = watchWave(small.r.mul(430), smallFootprint.mul(430)).mul(near)
    const brass = mix(color(hsl.integer(63, 66, 46)), color(hsl.integer(83, 72, 82.6)), big.r.div(0.265).clamp().mul(0.6).add(0.25))
      .mul(big.engraving.mul(-0.23).add(1))
      .mul(brassBrush.mul(0.07).add(0.94))
    const nickel = color(hsl.integer(203, 18, 75))
      .mul(small.engraving.mul(-0.23).add(1))
      .mul(nickelBrush.mul(0.06).add(0.94))
    interior = mix(interior, brass, bigMask)
    interior = mix(interior, nickel, smallMask)
    const jewel = disk(big.r, 0.033, bigFootprint)
      .mul(disk(bigLayer.length(), 0.434, bigFootprint))
      .mul(smallMask.oneMinus())
    interior = mix(interior, color(hsl.integer(17, 94, 39)), jewel)
    const bridge = watchLine(local.dot(vec2(0.8, -0.6)).sub(0.08), 0.026, surfaceFilter).mul(disk(surfaceRadius, 0.447, surfaceFilter))
    const screwA = local.sub(vec2(0.268, 0.224))
    const screwB = local.sub(vec2(-0.14, -0.32))
    const headA = disk(screwA.length(), 0.042, surfaceFilter)
    const headB = disk(screwB.length(), 0.042, surfaceFilter)
    const screwHeads = headA.max(headB)
    const slots = watchLine(screwA.dot(vec2(0.7071, 0.7071)), 0.006, surfaceFilter).mul(headA).max(watchLine(screwB.dot(vec2(0.7071, -0.7071)), 0.006, surfaceFilter).mul(headB))
    const plateBrush = filteredWave(tube.x.mul(TAU * 950)).mul(near)
    const plate = color(hsl.integer(228, 17, 51))
      .mul(plateBrush.mul(0.04).add(0.96))
    let surface = mix(plate, interior, aperture)
    surface = mix(surface, color(hsl.integer(95, 33, 77)), bezel.mul(0.72))
    surface = mix(surface, color(hsl.integer(233, 32, 23)), bridge)
    surface = mix(surface, color(hsl.integer(143, 15, 83)), screwHeads)
    surface = mix(surface, color(hsl.integer(246, 31, 11)), slots)
    const occluder = bezel.max(bridge).max(screwHeads)
    const interiorVisibility = aperture.mul(occluder.oneMinus())
    const machinery = bigMask.max(smallMask)
      .mul(interiorVisibility)
    const visibleJewel = jewel.mul(interiorVisibility)
    const bigTangent = vec2(bigPoint.y.negate(), bigPoint.x)
      .div(big.r.max(0.001))
    const smallTangent = vec2(smallPoint.y.negate(), smallPoint.x).div(small.r.max(0.001))
    const machiningDirection = mix(bigTangent, smallTangent, smallMask)
    const relief = aperture.oneMinus().mul(0.0015)
      .add(bezel.mul(0.0024))
      .add(bridge.mul(0.003))
      .add(screwHeads.mul(0.0038))
      .add(bigMask.mul(interiorVisibility).mul(0.00075))
      .add(smallMask.mul(interiorVisibility).mul(0.0011))
      .add(visibleJewel.mul(0.0012))
      .sub(slots.mul(0.0006))
    this.envMapIntensity = 1.05
    this.colorNode = surface
    this.metalnessNode = visibleJewel.mul(-0.95)
      .add(1)
      .mul(0.85)
    this.roughnessNode = mix(mix(float(0.32), float(0.22), machinery), float(0.085), visibleJewel)
    this.anisotropy = 0.7
    this.anisotropyNode = mix(vec2(0.24, 0), machiningDirection.mul(0.7), machinery).mul(visibleJewel.oneMinus())
    this.normalNode = negateOnBackSide(bumpNormal(relief))
    this.ior = 1.48
    this.clearcoat = 0.8
    this.clearcoatNode = mix(float(0.18), float(0.8), aperture)
    this.clearcoatRoughnessNode = mix(float(0.18), float(0.045), aperture)
    this.clearcoatNormalNode = normalViewGeometry
    this.aoNode = mix(float(0.47), float(1), aperture.oneMinus()
      .max(bridge)
      .max(bigMask.mul(0.5)))
  }
}

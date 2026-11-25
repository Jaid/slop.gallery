import type {Node} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, max, mix, mx_cell_noise_vec3, mx_noise_float, positionGeometry, select, vec2, vec3} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {heightNormal, insideBy, line, visibleDetail} from '#src/lib/materials/filters.ts'

import {cellRandom} from '../lib/cells.ts'

type Float = Node<'float'>
type Vec3 = Node<'vec3'>

const unit = (node: Float) => node.mul(0.5).add(0.5)
/** how thick the beds lie on average, in meters */
const bedThickness = 0.34
/** One feature per cell of a lattice of `size` meters at a jittered point well inside it, present in `share` of the cells: its offset from that point and three random numbers. */
function scatter(p: Vec3, size: number, share: number, stream: number) {
  const cell = p.div(size).floor()
  const random = cellRandom(cell, stream)
  const center = cell.add(cellRandom(cell, stream + 1).mul(0.5).add(0.25)).mul(size)
  return {
    offset: p.sub(center),
    present: select(random.x.lessThan(share), float(1), float(0)),
    random,
  }
}

/**
 * Weser sandstone, the red Buntsandstein of the hills along the Weser south of Hanover, which the towns of the Weser Renaissance were built and carved from: a fine-grained, iron-red to plum-brown stone, its quartz sand laid down by rivers some 250 million years ago.
 *
 * It lies in beds a hand or two thick, and the currents swept the sand of every bed into sloping foresets that curve down into the bed below, so every face shows sets of thin laminae, each set leaning its own way and ending against the next bed. The laminae differ a little in their iron, a few are bleached pale, and the softer ones are worn back a hair. Pale green-white reduction spots, round wherever a face cuts them, freckle it, rimmed with the iron they pushed out, and near the bottoms of the beds lie flattened galls of gray clay. Dressed smooth but unpolished, it is dry and matte, with a sparkle of quartz up close.
 *
 * Everything lies in the block itself, mapped in the meters of the geometry, so the beds run on round every edge.
 */
export default class WeserStoneMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super({roughness: 0.92})
    this.name = 'Weser sandstone'
    const p = positionGeometry
    const footprint = max(p.x.fwidth(), max(p.y.fwidth(), p.z.fwidth())).toVar('weserFootprint')
    // The distance in meters to the zero set of a field: the field over its screen-space slope in pixels, times the pixel size.
    const meters = (field: Float) => field.div(field.fwidth().max(1e-7)).mul(footprint)
    // The beds, gently undulating and differing in thickness.
    const level = p.y.add(mx_noise_float(vec3(p.x.mul(0.6), 3, p.z.mul(0.6))).mul(0.06)).div(bedThickness)
    // A warp too gentle to fold a bed over makes some thicker and others thinner.
    const phase = level.add(mx_noise_float(vec3(p.x.mul(0.25), level.mul(0.45), p.z.mul(0.25))).mul(0.25)).toVar('weserBedPhase')
    const bed = phase.floor()
    const height = phase.fract().toVar('weserBedHeight')
    const bedRandom = mx_cell_noise_vec3(vec3(bed, 17, 3))
    const bedRandom2 = mx_cell_noise_vec3(vec3(bed, 29, 5))
    // Foresets lean down the current at 15–30° and curve out flat toward the bed’s bottom.
    const azimuth = bedRandom.x.mul(Math.PI * 2)
    const along = p.xz.dot(vec2(azimuth.cos(), azimuth.sin()))
    const dip = bedRandom.y.mul(0.3).add(0.27)
    const curve = height.add(float(1).sub(float(1).sub(height).pow(3)).mul(0.6)).mul(bedThickness)
    const spacing = bedRandom.z.mul(0.005).add(0.0035)
    const foreset = along.mul(dip).sub(curve).add(mx_noise_float(p.mul(4).add(7)).mul(0.012)).div(spacing).toVar('weserForeset')
    const lamina = foreset.floor()
    const laminaRandom = mx_cell_noise_vec3(vec3(lamina, bed, 11))
    // The laminae crowd together toward the bottom of a bed, so they fade by how many of them a pixel spans.
    const fine = foreset.fwidth().smoothstep(0.15, 0.5).oneMinus()
    // Their iron differs a little from one lamina to the next; one in fifteen or so is bleached.
    const iron = mix(float(0.5), laminaRandom.x, fine)
    const bleached = select(laminaRandom.y.greaterThan(0.96), float(1), float(0)).mul(fine).mul(bedRandom2.x.smoothstep(0.4, 0.8))
    const laminaLine = line(meters(foreset.mul(Math.PI * 2).sin()), 0.0003).mul(fine)
    // Thin seams of clay along the bottoms of the beds.
    const seam = line(meters(phase.mul(Math.PI * 2).sin()), 0.0012).mul(unit(mx_noise_float(p.mul(3).add(2))).smoothstep(0.3, 0.6))
    // Broad clouds of richer and paler red through the whole block.
    const cloud = unit(mx_noise_float(p.mul(1.6).add(bedRandom2.y))).mul(0.7).add(unit(mx_noise_float(p.mul(6))).mul(0.3))
    let stone: Vec3 = mix(color(hsl.integer(32, 45, 36)), color(hsl.integer(35, 44, 45)), cloud.smoothstep(0.2, 0.8))
    stone = stone.mul(iron.sub(0.5).mul(0.16).add(1)).mul(float(1).sub(laminaLine.mul(0.08)))
    stone = mix(stone, color(hsl.integer(63, 27, 67)), bleached.mul(0.4))
    stone = mix(stone, color(hsl.integer(31, 52, 26)), seam.mul(0.7))
    // Reduction spots: spheres where the iron was reduced away, a rim of it pushed out round them.
    const spot = scatter(p, 0.2, 0.3, 4)
    const spotRadius = spot.random.y.pow(2).mul(0.028).add(0.006)
    const spotDistance = spot.offset.length().sub(spotRadius)
    const spotPixel = footprint
    const inSpot = insideBy(spotDistance, spotPixel).mul(spot.present)
    const rim = insideBy(spotDistance.abs().sub(0.0012), spotPixel).mul(spot.present).mul(visibleDetail(footprint, 0.002))
    stone = mix(stone, color(hsl.integer(100, 22, 75)), inSpot.mul(0.8))
    stone = mix(stone, color(hsl.integer(35, 60, 31)), rim.mul(0.5))
    // Clay galls: flattened pellets of gray-green clay in the lowest part of a bed.
    const gall = scatter(p, 0.1, 0.45, 7)
    const gallRadii = vec3(0.022, 0.006, 0.016).mul(gall.random.y.mul(0.7).add(0.5))
    const gallDistance = gall.offset.div(gallRadii).length().sub(1).mul(gallRadii.y)
    const inGall = insideBy(gallDistance, footprint).mul(gall.present).mul(height.smoothstep(0.15, 0.3).oneMinus())
    stone = mix(stone, mix(color(hsl.integer(91, 13, 45)), color(hsl.integer(51, 18, 33)), gall.random.z), inGall.mul(0.9))
    // The sand itself, and quartz grains glinting close up.
    const sand = mix(float(0.5), unit(mx_noise_float(p.mul(1100))), visibleDetail(footprint, 0.0006))
    const grit = mix(float(0.5), unit(mx_noise_float(p.mul(260).add(9))), visibleDetail(footprint, 0.002))
    // Dark grains of heavy minerals and specks of mica scattered through the sand.
    const specks = unit(mx_noise_float(p.mul(700).add(23))).smoothstep(0.8, 0.88).mul(visibleDetail(footprint, 0.0012))
    const glint = unit(mx_noise_float(p.mul(2400).add(1))).smoothstep(0.82, 0.92).mul(visibleDetail(footprint, 0.0004))
    this.colorNode = stone.mul(float(1).add(sand.sub(0.5).mul(0.22)).add(grit.sub(0.5).mul(0.14)).add(glint.mul(0.12)).sub(specks.mul(0.35)))
    this.roughnessNode = float(0.92).sub(glint.mul(0.35)).add(inSpot.mul(0.02))
    // The softer, iron-poor laminae and the clay wear back; the grains stand up.
    const relief = sand.mul(0.00007).add(grit.mul(0.00012)).add(iron.mul(0.00008)).sub(laminaLine.mul(0.00006)).sub(seam.mul(0.0004)).sub(inGall.mul(0.0002))
    this.normalNode = heightNormal(relief)
  }
}

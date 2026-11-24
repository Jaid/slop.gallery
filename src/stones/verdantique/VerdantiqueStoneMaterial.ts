import type {Node} from 'three/webgpu'

import {color, float, max, mix, mx_fractal_noise_float, mx_noise_float, mx_noise_vec3, positionGeometry, select, vec3} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {heightNormal, insideBy, line, visibleDetail} from '#src/lib/materials/filters.ts'

import {cellRandom, voronoiCell} from '../lib/cells.ts'

type Float = Node<'float'>

const unit = (node: Float) => node.mul(0.5).add(0.5)
/** the lattice the larger fragments pack on, one at most to each cell, in meters */
const fragmentSpacing = 0.11
/** the lattice of the smaller chips crowding the cement between them */
const chipSpacing = 0.02
/** Serpentine from bottle green (0) through sage to celadon (1). */
const greens = (shade: Float) => vec3(mix(mix(color('#1b3426'), color('#2f5a3f'), shade.smoothstep(0, 0.45)), mix(color('#6f9478'), color('#a3bea6'), shade.smoothstep(0.85, 1)), shade.smoothstep(0.45, 0.85)))

/**
 * Verd antique, the verde antico the Romans quarried in Thessaly for columns and the bases of statues: a breccia of serpentine, crushed in the earth into sharp-edged fragments of every green from bottle to celadon, with a few of white marble, and cemented again in a darker green, almost black, through which later cracks ran full of white calcite. Polished to a deep gloss.
 *
 * The fragments are the cells of a jittered lattice (`voronoiCell`), shrunk by a seam of cement of their own width, so they are angular and keep their outlines round every corner of a block; one cell in five is cement throughout. Smaller chips float in the cement, and the calcite veins cut straight through fragments and cement alike, as they came last.
 */
export default class VerdantiqueStoneMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super({
      roughness: 0.1,
      envMapIntensity: 0.9,
    })
    this.name = 'Verd antique'
    const p = positionGeometry
    const footprint = max(p.x.fwidth(), max(p.y.fwidth(), p.z.fwidth())).toVar('verdantiqueFootprint')
    const meters = (field: Float) => field.div(field.fwidth().max(1e-7)).mul(footprint)
    // A warp makes the fragments differ in size; their edges stay straight enough to read as broken.
    const lattice = p.div(fragmentSpacing).add(mx_noise_vec3(p.mul(5)).mul(0.45)).toVar('verdantiqueLattice')
    const cell = voronoiCell(lattice).toVar('verdantiqueCell')
    const random = cellRandom(cell.xyz).toVar('verdantiqueFragment')
    const random2 = cellRandom(cell.xyz, 1)
    // The cement round each fragment is 2–9 mm wide, and wavers along its edges.
    const cement = random.y.mul(0.1).add(0.03).add(mx_noise_float(p.mul(40)).mul(0.02))
    const isFragment = random.x.lessThan(0.8)
    const fragment = insideBy(cement.sub(cell.w), footprint.div(fragmentSpacing)).mul(select(isFragment, float(1), float(0))).toVar('verdantiqueInFragment')
    // Fragments from bottle green through sage to celadon, and the odd one of white marble, each with its own mottling and streaks.
    const shade = random.z
    const marble = vec3(mix(color('#dfe3d8'), color('#bfcbb9'), random2.x))
    const isMarble = shade.greaterThan(0.97)
    const mottle = unit(mx_fractal_noise_float(p.mul(18).add(random2.mul(50)), 3, 2.2, 0.55)).toVar('verdantiqueMottle')
    const speckle = mix(float(0.5), unit(mx_noise_float(p.mul(160).add(random2.mul(70)))), visibleDetail(footprint, 0.004))
    const streaks = unit(mx_noise_float(p.mul(vec3(9, 40, 12)).add(random2.mul(30)))).smoothstep(0.55, 0.8).mul(visibleDetail(footprint, 0.004))
    const fragmentColor = select(isMarble, mix(marble, color('#6f9478'), streaks.mul(0.5)), mix(greens(shade.pow(1.5)), greens(shade.pow(1.5).add(0.35)), streaks.mul(0.8)).mul(mottle.sub(0.5).mul(0.8).add(1)).mul(speckle.sub(0.5).mul(0.3).add(1)))
    // The cement: near-black green, crowded with smaller chips of every kind.
    const chipLattice = p.div(chipSpacing).add(mx_noise_vec3(p.mul(20)).mul(0.3))
    const chipCell = voronoiCell(chipLattice).toVar('verdantiqueChip')
    const chipRandom = cellRandom(chipCell.xyz, 5)
    const chip = insideBy(chipRandom.y.mul(0.14).add(0.08).sub(chipCell.w), footprint.div(chipSpacing)).mul(select(chipRandom.x.lessThan(0.55), float(1), float(0))).mul(visibleDetail(footprint, chipSpacing * 0.6))
    const chipColor = select(chipRandom.z.greaterThan(0.97), vec3(mix(color('#d3d9cc'), color('#c3ccbb'), chipRandom.y)), greens(chipRandom.z.mul(0.65)).mul(0.85))
    const cloud = unit(mx_noise_float(p.mul(14).add(17)))
    const groundmass = mix(mix(color('#0e1912'), color('#1a2b1f'), cloud), chipColor, chip.mul(0.9))
    const stone = mix(groundmass, fragmentColor, fragment)
    // Calcite veins, last of all: long, straight-ish cracks, a millimeter or two wide, and hairlines between them.
    const veinCourse = mx_noise_float(p.mul(vec3(0.9, 1.7, 1.2)).add(5)).add(mx_noise_float(p.mul(9)).mul(0.04))
    const veinPresence = unit(mx_noise_float(p.mul(1.4).add(21))).smoothstep(0.4, 0.65)
    const vein = line(meters(veinCourse), 0.0011).mul(veinPresence)
    const hairline = line(meters(mx_noise_float(p.mul(vec3(3.5, 2.2, 4.1)).add(31))), 0.0003).mul(unit(mx_noise_float(p.mul(2.6).add(9))).smoothstep(0.5, 0.75)).mul(visibleDetail(footprint, 0.002))
    const calcite = max(vein, hairline.mul(0.7)).toVar('verdantiqueCalcite')
    this.colorNode = mix(stone, color('#eef0e6'), calcite.mul(0.9))
    // Calcite is softer than serpentine and takes the polish a little less.
    this.roughnessNode = float(0.09).add(fragment.oneMinus().mul(0.03)).add(calcite.mul(0.08)).add(cloud.sub(0.5).mul(0.03))
    this.normalNode = heightNormal(calcite.mul(-0.00002).sub(fragment.oneMinus().mul(0.00001)).add(mx_noise_float(p.mul(28)).mul(0.00003)))
  }
}

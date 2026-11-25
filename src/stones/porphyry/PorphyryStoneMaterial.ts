import type {Node} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, max, mix, mx_fractal_noise_float, mx_noise_float, positionGeometry, select, vec3} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {heightNormal, insideBy, visibleDetail} from '#src/lib/materials/filters.ts'

import {cellRandom, cellSeed, voronoiCell} from '../lib/cells.ts'
import {boxDistance, randomTurn} from '../lib/crystals.ts'

type Float = Node<'float'>

const unit = (node: Float) => node.mul(0.5).add(0.5)
/** the lattice the crystals grow on, one at most per cell, in meters */
const crystalSpacing = 0.006
/** the share of the face the crystals cover where they are too small to draw: the share of the stone’s volume they take up, which a Monte Carlo count of their sizes and shapes below gives */
const crystalCover = 0.115

/**
 * Imperial porphyry, porfido rosso antico, which only one mountain in the Eastern Desert of Egypt ever gave and only emperors were let to wear, sit on or be buried in: a dense purple-red groundmass, clouded darker and lighter, strewn with small, sharp-cornered crystals of pale pink plagioclase and the odd black speck of hornblende, now and then a darker inclusion of older rock, all of it polished to a hard gloss.
 *
 * The crystals are tabular boxes, one to each cell of a jittered lattice and turned every way, kept within their cells so they never merge (`voronoiCell`); every face shows the section it cuts through them, so a crystal on a corner carries on round it, and one only grazed shows as a sliver. Mapped in the meters of the geometry. Where the crystals get too small for the pixels, they fade into the pinkish haze they make from afar.
 */
export default class PorphyryStoneMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super({
      roughness: 0.12,
      envMapIntensity: 0.9,
    })
    this.name = 'Imperial porphyry'
    const p = positionGeometry
    const footprint = max(p.x.fwidth(), max(p.y.fwidth(), p.z.fwidth())).toVar('porphyryFootprint')
    // The groundmass: clouded, with a dust of finer crystals too small to make out.
    const cloud = unit(mx_fractal_noise_float(p.mul(2.4), 3, 2, 0.5)).smoothstep(0.2, 0.8)
    const mottle = mix(float(0.5), unit(mx_noise_float(p.mul(45))), visibleDetail(footprint, 1 / 45))
    const dust = mix(float(0.5), unit(mx_noise_float(p.mul(700).add(3))), visibleDetail(footprint, 1 / 700))
    // Inclusions of darker, finer rock the magma tore loose, rounded, rare and a hand or two across, with fewer crystals.
    const inclusion = unit(mx_noise_float(p.mul(2.6).add(19))).add(mx_noise_float(p.mul(11)).mul(0.04)).smoothstep(0.84, 0.88).mul(0.75)
    let ground: Node<'vec3'> = mix(color(hsl.integer(2, 59, 28)), color(hsl.integer(6, 57, 36)), cloud)
    ground = ground.mul(float(1).add(mottle.sub(0.5).mul(0.1)).add(dust.sub(0.5).mul(0.16)))
    ground = mix(ground, color(hsl.integer(7, 46, 19)), inclusion)
    // The crystals, in lattice units.
    const lattice = p.div(crystalSpacing)
    const cell = voronoiCell(lattice).toVar('porphyryCell')
    const random = cellRandom(cell.xyz).toVar('porphyryCrystal')
    const shape = cellRandom(cell.xyz, 1)
    const local = randomTurn(lattice.sub(cellSeed(cell.xyz)), cellRandom(cell.xyz, 2))
    const length = random.x.pow(2).mul(0.4).add(0.27)
    const crystal = boxDistance(local, vec3(length, length.mul(shape.x.mul(0.35).add(0.4)), length.mul(shape.y.mul(0.15).add(0.35))))
    // A few of the cells hold a black hornblende needle instead, most hold nothing big enough to show; none grow in the inclusions.
    const isFeldspar = random.y.lessThan(0.85)
    const isHornblende = random.y.greaterThan(0.93)
    const needle = boxDistance(local, vec3(length.mul(0.55), length.mul(0.14), length.mul(0.14)))
    const solid = select(isFeldspar, crystal, select(isHornblende, needle, float(1)))
    const pixel = footprint.div(crystalSpacing)
    const sharp = visibleDetail(footprint, crystalSpacing * 1.2)
    const covered = insideBy(max(solid, float(0.03).sub(cell.w)), pixel)
    const feldspar = mix(float(crystalCover), covered.mul(select(isFeldspar, float(1), float(0))), sharp).mul(inclusion.oneMinus())
    const hornblende = covered.mul(select(isHornblende, float(1), float(0))).mul(sharp).mul(inclusion.oneMinus())
    // Plagioclase from near white to a rosy pink, clouded a little toward its middle.
    const pink = mix(color(hsl.integer(39, 27, 81)), color(hsl.integer(25, 36, 62)), random.z.pow(1.5))
    const tint = mix(mix(color(hsl.integer(39, 27, 81)), color(hsl.integer(25, 36, 62)), 0.4), pink, sharp)
    let stone = mix(ground, tint, feldspar.mul(0.85))
    stone = mix(stone, color(hsl.integer(4, 11, 9)), hornblende)
    this.colorNode = stone
    // The feldspar polishes as hard as the groundmass; the inclusions take it a little less.
    this.roughnessNode = float(0.11).add(mottle.sub(0.5).mul(0.03)).add(inclusion.mul(0.04)).add(feldspar.mul(0.02))
    this.normalNode = heightNormal(feldspar.mul(0.000015).sub(hornblende.mul(0.00001)).add(mx_noise_float(p.mul(30)).mul(0.00003)))
  }
}

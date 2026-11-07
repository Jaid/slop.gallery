import type {PlankTable} from './plankTable.ts'
import type {GrainMapping} from './woodGrain.ts'
import type {BufferGeometry} from 'three/webgpu'

import {mulberry32} from 'math/random'

import {mergeParts} from '../geometry.ts'
import {place, roundedBox} from './lodgeInterior/place.ts'
import {withWoodGrain} from './woodGrain.ts'

/** the shortest and longest length a plank of the top is cut to, in meters; the last of a course takes what is left, or is joined to the one before it if that would be shorter than the shortest */
const plankLengths = [2.6, 4.4] as const
/** the gap of a butt joint between two planks of a course */
const buttGap = 0.003
/** the grain of a piece built along x, along z or standing up along y, seen from its own middle */
const alongX: GrainMapping = (x, y, z) => [x, z + y * 0.3]
const alongZ: GrainMapping = (x, y, z) => [z, x + y * 0.3]
const alongY: GrainMapping = (x, y, z) => [y, x + z]

/**
 * A table of planks, see {@link PlankTable}: a top of planks with eased edges running its length, each course butt-jointed at its own places, over aprons round its sides and ends and a cross rail at every pair of legs between the ends, on square legs standing a hair back from the aprons’ faces.
 * Every piece has its own grain, see `GrainedWoodMaterial`, drawn by the `seed`. The origin is on the floor under its middle.
 */
export default class PlankTableGeometry {
  readonly timber: BufferGeometry

  constructor({apron: [apronDepth, apronThickness], boards, gap, height, leg, legs, legX, length, overhang, top, width}: PlankTable, seed: number) {
    const state = mulberry32.create(seed)
    const random = () => mulberry32.sample(state)
    let pieceSeed = 0
    /** a rounded box of the size with its grain, its middle at the point */
    const piece = (size: [number, number, number], mapping: GrainMapping, [x, y, z]: readonly [number, number, number], radius = 0.004) => {
      const offset = random() * 40
      const geometry = withWoodGrain(roundedBox(size, radius, 2), (px, py, pz) => {
        const [along, across] = mapping(px, py, pz)
        return [along + offset, across]
      }, pieceSeed++ * 0.618034 % 1)
      return place(geometry, x, y, z)
    }
    const parts: Array<BufferGeometry> = []
    const boardWidth = width / boards
    for (let course = 0; course < boards; course++) {
      const x = -width / 2 + boardWidth * (course + 0.5)
      // Where along the course its planks butt against each other, from its north end on
      const joints: Array<number> = []
      let at = -length / 2 + plankLengths[0] * random()
      while (length / 2 - at > plankLengths[0]) {
        joints.push(at)
        at += plankLengths[0] + (plankLengths[1] - plankLengths[0]) * random()
      }
      const ends = [-length / 2, ...joints.filter(joint => joint - -length / 2 > plankLengths[0] / 2), length / 2]
      for (let index = 0; index < ends.length - 1; index++) {
        const [from, to] = [ends[index], ends[index + 1]]
        parts.push(piece([boardWidth - gap, top, to - from - buttGap], alongZ, [x, height - top / 2, (from + to) / 2], 0.006))
      }
    }
    const underTop = height - top
    const apronY = underTop - apronDepth / 2
    // The aprons along both sides and across both ends, their faces where the top’s overhang ends
    for (const side of [-1, 1]) {
      parts.push(
        piece([apronThickness, apronDepth, length - overhang * 2], alongZ, [side * (width / 2 - overhang - apronThickness / 2), apronY, 0]),
        piece([width - overhang * 2 - apronThickness * 2, apronDepth, apronThickness], alongX, [0, apronY, side * (length / 2 - overhang - apronThickness / 2)]),
      )
    }
    for (const z of legs.slice(1, -1)) {
      parts.push(piece([width - overhang * 2 - apronThickness * 2, apronDepth * 0.8, apronThickness], alongX, [0, underTop - apronDepth * 0.4, z]))
    }
    for (const z of legs) {
      for (const side of [-1, 1]) {
        parts.push(piece([leg, underTop, leg], alongY, [side * legX, underTop / 2, z]))
      }
    }
    this.timber = mergeParts(parts)
  }

  dispose() {
    this.timber.dispose()
  }
}

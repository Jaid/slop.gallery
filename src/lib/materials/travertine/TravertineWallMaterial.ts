import type {TravertineStyle} from './travertine.ts'
import type {Node} from 'three/webgpu'

import hsl from 'okhsl'
import {abs, float, hash, max, mix, normalWorldGeometry, positionWorld, select, vec2, vec3} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {heightNormal, line, visibleDetail} from '../filters.ts'
import {travertine} from './travertine.ts'

/** Honed, filled cross-cut travertine: lighter and calmer than the floor, with fewer and shallower pores. */
export const lobbyWallTravertine: TravertineStyle = {
  palette: {
    base: hsl.integer(83, 30, 84),
    light: hsl.integer(85, 31, 90.4),
    vein: hsl.integer(79, 39, 74),
    gray: hsl.integer(85, 14, 76),
    pore: hsl.integer(79, 27, 52),
  },
  banding: 0.45,
  pores: 0.55,
  poreDepth: 0.0008,
}

/** Cladding slabs laid in running bond, in meters. */
export type TravertineCladding = {
  /** height of one course; courses start at the floor */
  course: number
  /** length of one slab along the wall; every other course is shifted by half a slab */
  length: number
}

export type TravertineWallOptions = {
  /** slab joints for flat walls; without them, the stone runs on as for carved trim */
  cladding?: TravertineCladding
  /** height of the floor the courses are laid from */
  floorY?: number
  seed?: number
  style?: TravertineStyle
}

/** half-width of a cladding joint, in meters */
const jointWidth = 0.0012

/**
 * Honed travertine for walls and trim, with its bedding running level.
 *
 * Vertical faces are mapped along the wall, whichever way it faces, and up from the floor; level faces such as soffits use world x/z. With `cladding`, the wall is laid in slabs: each is cut from another part of the block and the joints between them are hairlines, filled flush. The surface is matte with a soft sheen, so the room’s lighting reads the same as on plaster.
 */
export default class TravertineWallMaterial extends MeshStandardNodeMaterial {
  constructor({cladding, floorY = 0, seed = 0, style = lobbyWallTravertine}: TravertineWallOptions = {}) {
    super({
      roughness: 0.62,
      metalness: 0,
      envMapIntensity: 1,
    })
    if (cladding && !(cladding.course > 0 && cladding.length > 0)) {
      throw new RangeError('Travertine cladding needs a positive course height and slab length.')
    }
    const n = normalWorldGeometry
    const vertical = abs(n.y).lessThan(0.5).toVar('travertineWallVertical')
    // The horizontal direction along the wall.
    const tangent = select(vertical, vec3(n.z, 0, n.x.negate()).normalize(), vec3(1, 0, 0))
    const along = positionWorld.x.mul(tangent.x).add(positionWorld.z.mul(tangent.z))
    const u = select(vertical, along, positionWorld.x).toVar('travertineWallU')
    const v = select(vertical, positionWorld.y.sub(floorY), positionWorld.z).toVar('travertineWallV')
    const footprint = max(u.fwidth(), v.fwidth()).toVar('travertineWallFootprint')
    let stoneU: Node<'float'> = u
    let stoneV: Node<'float'> = v
    let joint: Node<'float'> = float(0)
    if (cladding) {
      const {course, length} = cladding
      const row = v.div(course).floor()
      const shift = row.sub(row.div(2).floor().mul(2)).mul(length / 2)
      const column = u.sub(shift).div(length).floor()
      // Hashes need non-negative seeds below 2²⁴; the offset keeps every slab of a ±500 m wall positive.
      const slab = column.mul(1013).add(row).add(700_001 + seed * 7919).toVar('travertineWallSlab')
      stoneU = u.add(hash(slab).mul(240))
      stoneV = v.add(hash(slab.add(1_048_573)).mul(240))
      const localU = u.sub(shift).sub(column.mul(length))
      const localV = v.sub(row.mul(course))
      const edge = vec2(localU.min(float(length).sub(localU)), localV.min(float(course).sub(localV)))
      // Only flat wall faces are clad; carved trim on the same material keeps running stone.
      joint = select(vertical, line(edge.x.min(edge.y), jointWidth), float(0))
    }
    const stone = travertine({
      footprint,
      seed: 31 + seed,
      style,
      u: stoneU,
      v: stoneV,
    })
    this.colorNode = mix(stone.color, stone.color.mul(0.8), joint)
    this.roughnessNode = float(0.62).sub(stone.bands.mul(0.06)).add(stone.pore.mul(0.3)).add(joint.mul(0.2))
    this.normalNode = heightNormal(stone.height.mul(visibleDetail(footprint, 0.008)))
  }
}

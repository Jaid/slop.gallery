import type {TravertineStyle} from './travertine.ts'

import {color, float, hash, max, mix, mx_noise_float, normalWorldGeometry, positionWorld, select, vec2, vec3} from 'three/tsl'

import {heightNormal, visibleDetail} from '../filters.ts'
import PlanarMirrorMaterial from '../PlanarMirrorMaterial.ts'
import {travertine, travertinePalette} from './travertine.ts'

export type TravertineFloorOptions = {
  /** a corner of the tile grid in world x/z, so tiles line up with the seams laid over them */
  origin: readonly [number, number]
  /** whether the polished floor mirrors the room (heavy mode) */
  reflections?: boolean
  /** decorrelates two floors that share a layout */
  seed?: number
  style?: TravertineStyle
  /** edge length of the square tiles, in meters */
  tile: number
}

/** Coarse, unfilled vein-cut travertine, honed and polished. */
export const lobbyFloorTravertine: TravertineStyle = {
  palette: travertinePalette,
  banding: 0.78,
  pores: 1,
  poreDepth: 0.0015,
}

/** Bedding direction of all tiles, in radians from world x: the slabs come from one block and are laid with their veins running roughly the same way. */
const bedding = 0.2

/**
 * Polished travertine tiles, mapped by world position so the pattern stays put however the floor is split into slabs.
 *
 * Every tile is cut from a different part of the block: its stone is offset far into the pattern and its bedding turned by a few degrees, so neighbors never continue each other’s veins. The polish mirrors the room in heavy mode; the pores stay matte, dark and recessed.
 */
export default class TravertineFloorMaterial extends PlanarMirrorMaterial {
  constructor({origin, reflections = true, seed = 0, style = lobbyFloorTravertine, tile}: TravertineFloorOptions) {
    if (!(tile > 0)) {
      throw new RangeError('Travertine tiles need a positive size.')
    }
    const x = positionWorld.x.sub(origin[0]).toVar('travertineX')
    const z = positionWorld.z.sub(origin[1]).toVar('travertineZ')
    const cell = vec2(x, z).div(tile).floor().toVar('travertineTile')
    // Hashes need non-negative seeds below 2²⁴; the offset keeps every tile of a ±500 m floor positive.
    const tileId = cell.x.mul(1009).add(cell.y).add(600_011 + seed * 7919).toVar('travertineTileId')
    const random = (stream: number) => hash(tileId.add(stream * 1_048_573))
    const local = vec2(x, z).sub(cell.add(0.5).mul(tile))
    const angle = random(1).sub(0.5).mul(0.3).add(bedding)
    const direction = vec2(angle.cos(), angle.sin())
    const u = local.dot(direction).add(random(2).mul(240))
    const v = local.dot(vec2(direction.y.negate(), direction.x)).add(random(3).mul(240))
    const footprint = max(positionWorld.x.fwidth(), positionWorld.z.fwidth()).toVar('travertineFootprint')
    const stone = travertine({
      footprint,
      seed: random(4).mul(50),
      style,
      u,
      v,
    })
    const roughness = reflections ? 0.1 : 0.55
    super(null, {
      color: '#ffffff',
      roughness,
      reflection: reflections ? {
        strength: 0.2,
        grazingStrength: 0,
        // Honed and buffed, not glassed: lights and doors mirror as soft smears.
        loss: 0,
        gaussianBlur: 2,
        // Only the top face mirrors the room; the slab’s edges and underside show through the floor glass from below.
        mask: stone.pore.oneMinus().mul(normalWorldGeometry.y.step(0.5)),
      } : undefined,
    })
    // Tiles are sorted by tone, but each slab is a shade lighter or warmer than the next.
    const tone = random(5).sub(0.5).mul(0.06).add(1)
    // The pattern is laid out on the top face; the slab’s sawn edges, seen through the floor glass, just show its plain body.
    const edge = normalWorldGeometry.y.abs().lessThan(0.5)
    this.colorNode = select(edge, color(style.palette.base), stone.color).mul(tone)
    this.roughnessNode = select(edge, float(0.6), mix(float(roughness).add(stone.bands.mul(0.06)), float(0.85), stone.pore))
    // Hand-buffed stone is never quite flat: a faint waviness bends the mirrored lights.
    const waviness = mx_noise_float(vec3(x.mul(6), z.mul(6), random(6).mul(40))).mul(0.00015).mul(visibleDetail(footprint, 0.05))
    this.normalNode = heightNormal(select(edge, float(0), stone.height.mul(visibleDetail(footprint, 0.008)).add(waviness)))
  }
}

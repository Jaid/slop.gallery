import type {FrameSurface} from './frameAttributes.ts'
import type {Node} from 'three/webgpu'

import {clamp, color, float, max, mix, mx_fractal_noise_float, mx_noise_float, mx_worley_noise_float, select, vec3} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {heightNormal, visibleDetail} from '#src/lib/materials/filters.ts'

import {frameSurface} from './frameAttributes.ts'
import frameStudio from './frameStudio.ts'

/** what a stone looks like */
export type Stone = {
  /** layers of the bedding running along every member, as cut from banded stone, 0 to 1 */
  banding?: number
  /** the body of the stone */
  base: string
  /** the second color the bedding and the clouds swing to */
  cloud: string
  /** crisp crystals or flecks of another mineral, like the glints of regolith, and their color */
  flecks?: {
    amount: number
    color: string
    size: number
  }
  /** pits and voids, like travertine’s or a weathered stone’s, 0 to 1 */
  pits?: number
  /** how polished the stone is, 0 matte to 1 mirror */
  polish: number
  /** the color of the veins, if any, and how many */
  veins?: {
    amount: number
    color: string
  }
}

type Float = Node<'float'>

export const travertine: Stone = {
  base: '#ddd4c3',
  cloud: '#c4b69c',
  banding: 0.3,
  pits: 1,
  polish: 0.35,
}
export const carrara: Stone = {
  base: '#e8e6e1',
  cloud: '#cfcfcc',
  veins: {
    amount: 0.7,
    color: '#6e7277',
  },
  polish: 0.75,
}
export const neroMarquina: Stone = {
  base: '#151516',
  cloud: '#232325',
  veins: {
    amount: 0.55,
    color: '#d8d6d0',
  },
  polish: 0.85,
}
export const regolith: Stone = {
  base: '#8c8b86',
  cloud: '#5b5a56',
  pits: 1,
  flecks: {
    amount: 0.5,
    color: '#f0f2ee',
    size: 1400,
  },
  polish: 0,
}

/** a second stone set into the first where its mask is 1, like the squares of a checker or the shapes of an opus sectile */
export type StoneInlay = {
  mask: (surface: FrameSurface) => Float
  stone: Stone
}

export type FrameStoneOptions = {
  /** other stones set into it, the last on top */
  inlays?: ReadonlyArray<StoneInlay>
  /** relief carved or weathered into it, in meters of height */
  relief?: (surface: FrameSurface) => Float
  stone: Stone
}

/**
 * The color, roughness and relief of a stone at the point; `seed` gives another piece of the same stone.
 * Banded stone is cut as from one block, its bedding level across the whole frame like a wall’s; any other runs its figure along every member, as each was cut from a piece of its own.
 */
function shadeStone(stone: Stone, surface: FrameSurface, footprint: Float, seed = 0) {
  const p = surface.position
  const piece = surface.member.mul(5.31).add(seed * 17.7)
  const along = stone.banding ? p.x.add(seed * 3.1) : surface.along
  const depth = stone.banding ? p.y.add(p.z.mul(0.3)) : select(surface.isOrnament.greaterThan(0.5), surface.across, surface.reach.add(p.z))
  const solid = vec3(along, depth, stone.banding ? float(seed) : piece)
  // Banded stone is stretched along its bedding; any other is as cloudy one way as the other.
  const clouds = mx_fractal_noise_float(solid.mul(stone.banding ? vec3(6, 14, 1) : vec3(11, 11, 1)), 4).mul(0.5).add(0.5)
  let amount: Float = clouds.smoothstep(0.3, 0.8)
  if (stone.banding) {
    const bands = depth.mul(160).add(mx_noise_float(solid.mul(vec3(3, 8, 1))).mul(4)).sin().mul(0.5).add(0.5).pow(5)
    amount = mix(amount.mul(0.5), float(1), bands.mul(stone.banding))
  }
  let stoneColor: Node<'vec3'> = mix(color(stone.base), color(stone.cloud), amount).mul(surface.piece.mul(0.08).add(0.96))
  let height: Float = mx_noise_float(p.mul(300)).mul(0.00002)
  if (stone.veins) {
    const warp = mx_fractal_noise_float(solid.mul(vec3(4, 7, 1)), 3)
    const vein = warp.add(mx_noise_float(solid.mul(vec3(2, 3, 1)).add(7)).mul(0.6)).abs().smoothstep(0, 0.045).oneMinus()
    const fine = mx_noise_float(solid.mul(vec3(18, 30, 1)).add(warp)).abs().smoothstep(0, 0.03).oneMinus().mul(0.4)
    stoneColor = mix(stoneColor, color(stone.veins.color), clamp(vein.add(fine), 0, 1).mul(stone.veins.amount).mul(visibleDetail(footprint, 0.002).mul(0.6).add(0.4)))
  }
  if (stone.flecks) {
    const cell = mx_worley_noise_float(p.mul(stone.flecks.size).add(seed * 3.3))
    const fleck = cell.smoothstep(0, 0.25).oneMinus().mul(mx_noise_float(p.mul(stone.flecks.size * 0.13)).mul(0.5).add(0.5).smoothstep(0.35, 0.6))
    stoneColor = mix(stoneColor, color(stone.flecks.color), fleck.mul(stone.flecks.amount).mul(visibleDetail(footprint, 2 / stone.flecks.size)))
  }
  let pits: Float = float(0)
  if (stone.pits) {
    // Elongated voids along the bedding, darker and rougher inside.
    const voids = mx_worley_noise_float(vec3(along.mul(60), depth.mul(220), piece.add(13))).smoothstep(0, 0.12).oneMinus()
    const crater = mx_worley_noise_float(p.mul(90).add(seed)).smoothstep(0, 0.2).oneMinus()
    pits = clamp(voids.add(crater.mul(0.6)), 0, 1).mul(stone.pits).mul(visibleDetail(footprint, 0.004))
    stoneColor = stoneColor.mul(pits.mul(-0.45).add(1))
    height = height.sub(pits.mul(0.0006))
  }
  return {
    color: stoneColor,
    roughness: float(0.9 - stone.polish * 0.75).add(pits.mul(0.3)) as Float,
    clearcoat: float(stone.polish > 0.5 ? (stone.polish - 0.5) * 2 : 0) as Float,
    height,
  }
}

/**
 * Stone for frames, cut so its bedding runs along every member; veins, clouds, crystals and pits are procedural in the frame’s own meters and fade to their average before they could shimmer. Polished stone takes a clear coat that mirrors the frames’ dim studio, and other stones can be set into it.
 */
export default class FrameStoneMaterial extends MeshPhysicalNodeMaterial {
  constructor({inlays = [], relief, stone}: FrameStoneOptions) {
    super({
      roughness: 0.9 - stone.polish * 0.75,
      envMap: frameStudio,
      envMapIntensity: 0.6,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
    })
    const surface = frameSurface()
    const p = surface.position
    const footprint = max(p.x.fwidth(), p.y.fwidth()).max(p.z.fwidth()).toVar('stoneFootprint')
    let shaded: ReturnType<typeof shadeStone> = shadeStone(stone, surface, footprint)
    for (const [index, inlay] of inlays.entries()) {
      const set = shadeStone(inlay.stone, surface, footprint, index + 1)
      const mask = inlay.mask(surface)
      shaded = {
        color: mix(shaded.color, set.color, mask),
        roughness: mix(shaded.roughness, set.roughness, mask),
        clearcoat: mix(shaded.clearcoat, set.clearcoat, mask),
        height: mix(shaded.height, set.height, mask),
      }
    }
    const height = shaded.height.add(relief?.(surface) ?? float(0))
    const hollow = surface.cavity.smoothstep(0.1, 0.8)
    this.colorNode = shaded.color.mul(float(1).sub(hollow.mul(0.25)))
    this.roughnessNode = shaded.roughness.add(hollow.mul(0.1))
    this.clearcoatNode = shaded.clearcoat
    this.normalNode = heightNormal(height)
  }
}

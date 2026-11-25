import type {FrameSurface} from './frameAttributes.ts'
import type {Node} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, max, mix, mx_noise_float} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {heightNormal, visibleDetail} from '#src/lib/materials/filters.ts'

import {frameSurface as readSurface} from './frameAttributes.ts'
import frameStudio from './frameStudio.ts'

/** what a metal looks like */
export type Metal = {
  /** the reflectance of the bright metal, as packed sRGB */
  bright: number
  /** the darker, duller metal in the hollows and patches, as packed sRGB */
  dull: number
  /** a corrosion in the hollows, like verdigris or rust, which is no metal at all */
  patina?: {
    amount: number
    color: number
  }
  roughness: number
  /** hammer dimples or casting grain, in meters of relief */
  texture?: number
}

type Float = Node<'float'>

export const bronze: Metal = {
  bright: hsl.integer(72, 54, 67),
  dull: hsl.integer(63, 51, 36),
  roughness: 0.34,
  patina: {
    amount: 0.6,
    color: hsl.integer(167, 55, 46),
  },
  texture: 0.00003,
}
export const brass: Metal = {
  bright: hsl.integer(84, 62, 75),
  dull: hsl.integer(79, 60, 47),
  roughness: 0.25,
}
export const blackIron: Metal = {
  bright: hsl.integer(68, 3, 24),
  dull: hsl.integer(68, 3, 10),
  roughness: 0.55,
  patina: {
    amount: 0.35,
    color: hsl.integer(47, 64, 26),
  },
  texture: 0.0003,
}
export const satinSteel: Metal = {
  bright: hsl.integer(248, 5, 76),
  dull: hsl.integer(248, 4, 59),
  roughness: 0.28,
}
export const blackAnodized: Metal = {
  bright: hsl.integer(271, 5, 19),
  dull: hsl.integer(264, 5, 13),
  roughness: 0.4,
}

export type FrameMetalOptions = {
  /** a pattern of its own over the metal, like an etching: how much of the bright metal shows, 0 to 1, and a relief */
  finish?: (surface: FrameSurface) => {
    brightness?: Float
    height?: Float
    hollow?: Float
    roughness?: Float
  }
  metal: Metal
}

/**
 * Metal for frames: wholly metallic, so a lamp’s color can’t flatten it into paint, rubbed bright on its ridges and dull in its hollows, where any patina gathers. It mirrors the frames’ dim studio.
 */
export default class FrameMetalMaterial extends MeshPhysicalNodeMaterial {
  constructor({finish, metal}: FrameMetalOptions) {
    super({
      metalness: 1,
      roughness: metal.roughness,
      envMap: frameStudio,
    })
    const surface = readSurface()
    const p = surface.position
    const footprint = max(p.x.fwidth(), p.y.fwidth()).max(p.z.fwidth())
    const custom = finish?.(surface)
    const ridge = surface.cavity.mul(-1).smoothstep(0, 0.7)
    const hollow = surface.cavity.smoothstep(0.1, 0.8).max(custom?.hollow ?? float(0))
    const patches = mx_noise_float(p.mul(11).add(surface.piece.mul(4))).mul(0.5).add(0.5)
    const brightness = (custom?.brightness ?? float(1)).mul(patches.mul(0.3).add(0.55).add(ridge.mul(0.3)).sub(hollow.mul(0.35)).clamp(0, 1))
    let metalColor: Node<'vec3'> = mix(color(metal.dull), color(metal.bright), brightness)
    let metalness: Float = float(1)
    let roughness: Float = float(metal.roughness).add(hollow.mul(0.15)).sub(ridge.mul(0.06)).add(custom?.roughness ?? float(0))
    if (metal.patina) {
      const crust = hollow.mul(mx_noise_float(p.mul(70)).mul(0.5).add(0.5).smoothstep(0.3, 0.7)).mul(metal.patina.amount)
      metalColor = mix(metalColor, color(metal.patina.color), crust)
      metalness = metalness.sub(crust)
      roughness = mix(roughness, float(0.8), crust)
    }
    const grain = metal.texture ? mx_noise_float(p.mul(metal.texture > 0.0001 ? 140 : 600)).mul(metal.texture).mul(visibleDetail(footprint, metal.texture > 0.0001 ? 0.01 : 0.003)) : float(0)
    this.colorNode = metalColor
    this.metalnessNode = metalness
    this.roughnessNode = roughness
    this.normalNode = heightNormal(grain.add(custom?.height ?? float(0)))
  }
}

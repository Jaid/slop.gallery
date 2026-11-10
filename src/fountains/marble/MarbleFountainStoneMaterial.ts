import type {MarbleStyle} from '#src/lib/materials/marble/index.ts'
import type {BowlLip, WaterSheet} from './config.ts'
import type {Node} from 'three/webgpu'

import {abs, color, float, length, max, min, mix, mx_noise_float, normalGeometry, positionGeometry, smoothstep, vec3} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {heightNormal, inside, visibleDetail} from '#src/lib/materials/filters.ts'

import fountain from './config.ts'

type Float = Node<'float'>

const below = (value: Float, edge: number, softness = 0.003) => float(1).sub(smoothstep(edge - softness, edge + softness, value))
const unit = (node: Float) => node.mul(0.5).add(0.5)
/** Like `line`, for a half-width given as a node. */
const band = (d: Float, halfWidth: Float) => inside(d.abs().sub(halfWidth)).mul(halfWidth.mul(2).div(d.fwidth().max(0.00001)).min(1))

/** Arabescato: white with soft gray clouds and bold, feathered gray veins. */
export const arabescato: MarbleStyle = {
  base: '#f4f0ea',
  cloud: '#bdb3a5',
  halo: '#a39a8e',
  haloStrength: 0.8,
  thread: '#8a827a',
  threadStrength: 0.5,
  vein: '#4a4642',
  veinWidth: 0.005,
  web: 0,
}

/**
 * Marble carved from a solid block: the veins are warped sheets through the stone, and every surface shows where it cuts them.
 *
 * The sheets lie roughly perpendicular to `bedding`, so a block cut on the diagonal shows veins streaming across it, and a turned bowl shows them wrapping it in the curves of its profile. Unlike a pattern mapped onto the surface, the veins continue over every edge, around every corner and through every crease without a seam. Features fade to their average before they are smaller than the pixel `footprint` (meters).
 */
export function solidMarble({bedding, footprint, position, scale = 1, seed, style}: {
  /** direction the vein sheets stack along */
  bedding: readonly [number, number, number]
  footprint: Float
  position: Node<'vec3'>
  /** size of the pattern relative to a block about a meter across */
  scale?: number
  seed: number
  style: MarbleStyle
}) {
  const p = position.div(scale)
  const noise = (frequency: number, offset: number) => mx_noise_float(p.mul(frequency).add(seed * 1.37 + offset))
  // The distance in meters to the zero set of a field: the field over its screen-space slope, in pixels, times the pixel size.
  const meters = (field: Float) => field.div(field.fwidth().max(1e-7)).mul(footprint)
  const n = new Float32Array(bedding)
  const nl = Math.hypot(n[0], n[1], n[2])
  const along = p.dot(vec3(n[0] / nl, n[1] / nl, n[2] / nl))
  // Clouds: broad drifting shade in the body, with finer mottling close up.
  const clouds = unit(noise(0.9, 4)).mul(0.55).add(mix(float(0.5), unit(noise(3.2, 5)), visibleDetail(footprint, 0.06)).mul(0.3)).add(mix(float(0.5), unit(noise(9, 20)), visibleDetail(footprint, 0.02)).mul(0.15)).smoothstep(0.25, 0.8)
  // Main veins: sheets stacked along the bedding, bent by two octaves of warp and crooked by a fine jag.
  const warp = noise(0.55, 1).mul(0.8).add(noise(1.7, 2).mul(0.18))
  const jag = noise(6, 14).mul(0.05).add(noise(19, 15).mul(0.02)).mul(visibleDetail(footprint, 0.02))
  const course = along.mul(2.2).add(warp).mul(Math.PI).sin().mul(0.5)
  const main = meters(course.add(jag))
  // Each vein swells and thins along its course, and breaks off in places; a soft stain bleeds into the stone around it.
  const swell = unit(noise(1.3, 7)).smoothstep(0.15, 0.7)
  const thickness = unit(noise(2.6, 16)).mul(1.1).add(0.25)
  const veins = band(main.div(thickness), float(style.veinWidth)).mul(swell.smoothstep(0.1, 0.6))
  const halo = main.abs().smoothstep(0, 0.07).oneMinus().pow(1.5).mul(swell.mul(0.6).add(0.4))
  // Thinner companion sheets between the main ones, where the stone cracked twice.
  const companion = band(meters(along.mul(3.1).add(warp.mul(1.3)).add(noise(1.2, 8).mul(0.6)).mul(Math.PI).sin().mul(0.5).add(jag)), float(style.veinWidth * 0.5)).mul(unit(noise(0.8, 9)).smoothstep(0.5, 0.85))
  // Loose hairline threads, close up only.
  const threads = band(meters(noise(2.5, 11).add(noise(6.5, 12).mul(0.3)).add(jag)), float(0.0006)).mul(unit(noise(1.5, 13)).smoothstep(0.6, 0.85)).mul(visibleDetail(footprint, 0.01))
  let stone = mix(color(style.base), color(style.cloud), clouds)
  stone = mix(stone, color(style.halo), halo.mul(style.haloStrength))
  stone = mix(stone, color(style.thread), threads.mul(style.threadStrength))
  const vein = veins.max(companion)
  stone = mix(stone, color(style.vein), vein)
  return {
    color: stone,
    vein,
  }
}

/**
 * The fountain’s polished white marble, wet and glossy wherever water stands or pours over it.
 *
 * The stone is Arabescato carved from the solid, its veins stacked on a diagonal so they stream across the basin and wrap the bowls and balusters. Below each pool, inside the bowls and down their overflowing lips, the marble darkens, polishes to a mirror and glistens with a film of running water. The dry stone keeps a honed polish broken by a fine grain.
 */
export default class MarbleFountainStoneMaterial extends MeshPhysicalNodeMaterial {
  constructor({reflections = true}: {reflections?: boolean} = {}) {
    super({
      roughness: 0.3,
      metalness: 0,
      clearcoat: 0,
      clearcoatRoughness: 0.08,
      envMapIntensity: reflections ? 1.1 : 0.7,
      specularIntensity: 0.9,
    })
    this.name = 'Fountain marble'
    const {basinInnerApothem, copingTop, pools, lips, veils} = fountain
    const p = positionGeometry
    const radius = length(p.xz).toVar('fountainRadius')
    // Distance to the axis measured like an octagon’s apothem, for the basin’s flat walls.
    const x = abs(p.x)
    const z = abs(p.z)
    const octagon = max(max(x, z), x.add(z).mul(Math.SQRT1_2)).toVar('fountainOctagon')
    const footprint = max(max(p.x.fwidth(), p.y.fwidth()), p.z.fwidth()).toVar('fountainFootprint')
    const stone = solidMarble({
      bedding: [1, 0.55, 0.3],
      footprint,
      position: p,
      scale: 0.9,
      seed: 3,
      style: arabescato,
    })
    // A bowl’s inside faces up, its dry underside faces down; the stems rising through a pool are wet all around.
    const upturned = smoothstep(-0.15, 0.25, normalGeometry.y).max(below(radius, 0.32, 0.02))
    // The lips pour over: wet from the pool down the outside to a little under the lip’s rim.
    const lipRun = (lip: BowlLip, sheet: WaterSheet) => below(p.y, lip.y + 0.01, 0.01).mul(float(1).sub(below(p.y, lip.y - 0.09, 0.03))).mul(below(radius, sheet.radius + lip.scallop + 0.03, 0.02)).mul(float(1).sub(below(radius, lip.radius - lip.scallop - 0.06, 0.02)))
    const wet = max(
      max(
        max(
          below(p.y, pools.upper).mul(below(radius, lips.upper.radius + lips.upper.scallop + 0.01)),
          below(p.y, pools.lower).mul(below(radius, lips.lower.radius + lips.lower.scallop + 0.01)),
        ).mul(upturned),
        below(p.y, pools.basin).mul(below(octagon, basinInnerApothem + 0.005)),
      ),
      max(lipRun(lips.upper, veils.upper), lipRun(lips.lower, veils.lower)),
    ).toVar('fountainWet')
    // Spray from the jets darkens the splash zone on the basin walls above the water a little.
    const splashed = below(octagon, basinInnerApothem + 0.1, 0.08).mul(below(p.y, copingTop + 0.01, 0.01)).mul(smoothstep(pools.basin - 0.02, pools.basin + 0.1, p.y)).mul(0.35)
    const dampness = max(wet, splashed)
    // Honed grain on dry stone, polished away where water keeps the surface clean.
    const grain = mx_noise_float(p.mul(140)).mul(visibleDetail(footprint, 1 / 140))
    const polish = mx_noise_float(p.mul(5.5).add(3.1)).mul(0.5).add(0.5)
    this.colorNode = stone.color.mul(mix(float(1), float(0.88), dampness))
    this.roughnessNode = mix(float(0.24).add(polish.mul(0.1)).add(stone.vein.mul(0.06)).add(grain.mul(0.04)), float(0.08), wet)
    // Polished stone has a hint of a coated finish; under water it is as glossy as the water film on it. The dry coat stays soft enough that the chandelier does not burn a firefly into the coping.
    this.clearcoatNode = min(float(0.2).add(wet.mul(0.8)), 1)
    this.clearcoatRoughnessNode = mix(float(0.16).add(polish.mul(0.06)), float(0.09), wet)
    this.normalNode = heightNormal(grain.mul(0.00008).mul(float(1).sub(wet)).add(mx_noise_float(vec3(p.x.mul(14), p.y.mul(14), p.z.mul(14))).mul(0.0002)))
  }
}

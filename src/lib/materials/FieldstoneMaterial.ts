import type {Node} from 'three/webgpu'

import hsl from 'okhsl'
import {color, exp, float, hash, max, mix, mx_noise_float, normalWorldGeometry, positionWorld, select, vec2, vec3} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {heightNormal, inside, visibleDetail} from './filters.ts'

type Float = Node<'float'>
type Vec2 = Node<'vec2'>

/** A unique, non-negative integer per cell within ±500 cells, small enough that floats still hold it and its hash streams exactly. */
const cellKey = (cell: Vec2) => cell.x.add(500).mul(1009).add(cell.y.add(500))
/** Nearest and second-nearest jittered cell points of `p`, the nearest cell’s id and `p` relative to the nearest point. */
function voronoi(p: Vec2, jitter: number) {
  const cell = p.floor().toVar()
  const local = p.fract().toVar()
  let f1: Float = float(8)
  let f2: Float = float(8)
  let id: Vec2 = vec2(0)
  let offset: Vec2 = vec2(0)
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      const neighbor = cell.add(vec2(x, y))
      const key = cellKey(neighbor)
      const point = vec2(hash(key), hash(key.add(7_919_000))).sub(0.5).mul(jitter).add(0.5)
      const toPoint = vec2(x, y).add(point).sub(local)
      const distance = toPoint.length()
      const nearer = distance.lessThan(f1)
      f2 = select(nearer, f1, f2.min(distance))
      id = select(nearer, neighbor, id)
      offset = select(nearer, toPoint, offset)
      f1 = select(nearer, distance, f1)
    }
  }
  return {
    f1,
    f2,
    id,
    offset,
  }
}

/**
 * Split fieldstone laid in rubble courses with a recessed lime mortar, for the Lodge’s chimney breast and hearth.
 *
 * Stones are laid out per face from the world position, so every block of a fireplace shares one masonry pattern. A warp bends the cell outlines into irregular, slightly angular stones, and the joints swell and pinch along their run. Every stone is one of four rocks – speckled granite, banded sandstone, dark basalt or pale quartzite – with its own tone, a face that is domed, tilted and chipped into a few broad facets, and a grain of its own; mica flecks in the granite glint. The mortar is sandy, sits back from the stones, which round off into it, and darkens into the gap along every stone. With `soot`, the masonry darkens above that point, where smoke curls out of the firebox. Joints and grain fade to their average before they could shimmer.
 */
export default class FieldstoneMaterial extends MeshStandardNodeMaterial {
  constructor({soot, brightness = 1}: {
    /** overall brightness, for the blackened lining of a firebox */
    brightness?: number
    /** where smoke leaves the firebox, in world space */
    soot?: readonly [number, number, number]
  } = {}) {
    super({
      roughness: 0.9,
      envMapIntensity: 0.15,
    })
    const n = normalWorldGeometry
    const facesY = n.y.abs().greaterThan(0.7)
    const facesX = n.x.abs().greaterThan(n.z.abs())
    const u = select(facesY, positionWorld.x, select(facesX, positionWorld.z, positionWorld.x))
    const v = select(facesY, positionWorld.z, positionWorld.y)
    // Wall stones are coursed wider than tall; hearth flags are broader still.
    const scale = select(facesY, vec2(0.4, 0.34), vec2(0.36, 0.2))
    const raw = vec2(u, v).div(scale)
    // Bends the cells into irregular outlines with a few straight-ish split faces.
    const warp = vec2(mx_noise_float(raw.mul(0.9)), mx_noise_float(raw.mul(0.9).add(31.7))).mul(0.32)
      .add(vec2(mx_noise_float(raw.mul(2.6).add(5.1)), mx_noise_float(raw.mul(2.6).add(12.9))).mul(0.08))
    const p = raw.add(warp)
    const {f1, f2, id, offset} = voronoi(p, 0.86)
    const meanScale = scale.x.add(scale.y).mul(0.5)
    // Approximate distance to the joint in meters.
    const border = f2.sub(f1).mul(0.5).mul(meanScale).toVar('stoneBorder')
    const footprint = max(u.fwidth(), v.fwidth()).toVar('stoneFootprint')
    const detail = visibleDetail(footprint, 0.06)
    const fine = visibleDetail(footprint, 0.01)
    // Joints swell and pinch along their run.
    const joint = mx_noise_float(p.mul(1.7).add(3.3)).mul(0.006).add(0.013)
    const stone = inside(joint.sub(border)).oneMinus().mul(detail).add(detail.oneMinus()).toVar('stoneCoverage')
    const key = cellKey(id)
    const pick = hash(key.add(1_234_567))
    const shade = hash(key.add(2_345_678))
    const tiltAngle = hash(key.add(3_456_789)).mul(Math.PI * 2)
    const tiltAmount = hash(key.add(4_567_890))
    // Stone-local coordinates in meters, so every rock’s grain is its own.
    const local = offset.mul(meanScale).negate()
    const seed = vec2(hash(key.add(5_678_901)), hash(key.add(6_789_012))).mul(100)
    const grainAt = (frequency: number, shift: number) => mx_noise_float(vec3(local.mul(frequency).add(seed), float(shift)))
    // Four rocks: granite (speckled gray), sandstone (banded ochre), basalt (dark, fine) and quartzite (pale, glassy).
    const isGranite = pick.lessThan(0.42)
    const isSandstone = pick.greaterThanEqual(0.42).and(pick.lessThan(0.72))
    const isBasalt = pick.greaterThanEqual(0.72).and(pick.lessThan(0.93))
    const speckle = grainAt(95, 1).mul(0.5).add(0.5).toVar('stoneSpeckle')
    const flecks = speckle.smoothstep(0.78, 0.86).mul(fine)
    const darkFlecks = speckle.smoothstep(0.28, 0.18).mul(fine)
    const bandDirection = vec2(tiltAngle.cos(), tiltAngle.sin())
    const bands = local.dot(bandDirection).mul(38).add(grainAt(6, 2).mul(2.5)).sin().mul(0.5).add(0.5)
    const granite = mix(color(hsl.integer(81, 5, 49)), color(hsl.integer(85, 4, 36)), shade).mul(darkFlecks.mul(-0.45).add(1)).add(vec3(flecks.mul(0.12)))
    const sandstone = mix(mix(color(hsl.integer(68, 41, 48)), color(hsl.integer(63, 40, 34)), shade), mix(color(hsl.integer(69, 39, 54)), color(hsl.integer(65, 40, 39)), shade), bands.mul(detail))
    const basalt = mix(color(hsl.integer(78, 4, 28)), color(hsl.integer(68, 4, 20)), shade).mul(grainAt(40, 3).mul(0.06).add(1))
    const quartzite = mix(color(hsl.integer(83, 15, 64)), color(hsl.integer(82, 15, 52)), shade).mul(grainAt(18, 4).mul(0.08).add(1))
    const tone = select(isGranite, granite, select(isSandstone, sandstone, select(isBasalt, basalt, quartzite)))
    // Broad split facets and a dome toward the middle, tilted per stone, so neighbors catch the light differently.
    const dome = border.sub(joint).div(0.05).clamp(0, 1)
    const facets = grainAt(4.5, 5).abs().mul(0.012)
    const tilt = local.dot(bandDirection).mul(tiltAmount.mul(0.08))
    const pits = grainAt(55, 6).smoothstep(0.55, 0.85).mul(fine).mul(0.0015)
    const relief = dome.sqrt().mul(0.022).add(facets).add(tilt).sub(pits)
    const mineral = grainAt(12, 7).mul(0.5).add(0.5)
    // Edges fall into shadow where the stone rounds off into the joint.
    const faceTone = tone.mul(mineral.mul(0.16).add(0.9)).mul(dome.sqrt().mul(0.28).add(0.72))
    const sand = mx_noise_float(positionWorld.mul(160)).mul(0.5).add(0.5).mul(fine)
    // Lime mortar, darkening into the gap along each stone.
    const cavity = border.div(joint).clamp(0, 1)
    const mortar = mix(color(hsl.integer(81, 12, 42)), color(hsl.integer(79, 12, 49)), sand).mul(cavity.mul(0.4).add(0.6)).mul(mx_noise_float(positionWorld.mul(9)).mul(0.08).add(0.95))
    const average = color(hsl.integer(79, 12, 39))
    let surface: Node<'vec3'> = mix(mortar, faceTone, stone)
    surface = mix(average.mul(mineral.mul(0.12).add(0.94)), surface, detail)
    if (soot) {
      const [x, y, z] = soot
      const rise = positionWorld.y.sub(y)
      const spread = positionWorld.x.sub(x).abs().add(positionWorld.z.sub(z).abs().mul(0.5))
      const smoke = exp(spread.div(rise.max(0).mul(0.45).add(0.4)).pow(2).negate()).mul(exp(rise.abs().div(0.9).negate())).mul(select(rise.greaterThan(-0.3), float(1), float(0)))
      // Soot settles in the joints and pits first.
      surface = surface.mul(float(1).sub(smoke.mul(stone.mul(-0.2).add(0.8))))
    }
    this.colorNode = surface.mul(brightness)
    // Mica flecks in the granite and the glassy quartzite polish smoother than the rest.
    const glint = select(isGranite, flecks, select(isSandstone.or(isBasalt), float(0), float(0.12)))
    this.roughnessNode = mix(float(0.98), mineral.mul(0.12).add(0.78).sub(glint.mul(0.45)), stone)
    // The stone rounds off into the joint over its last centimeter and a half, so the edge catches light as a soft bevel, not a hairline.
    const shoulder = border.sub(joint.mul(0.5)).div(0.015).clamp(0, 1).smoothstep(0, 1)
    const mortarHeight = sand.mul(0.0008).sub(0.006)
    const height = mix(mortarHeight, relief, shoulder).mul(detail)
    this.normalNode = heightNormal(height)
  }
}

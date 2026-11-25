import hsl from 'okhsl'
import {atan, color, float, hash, max, mix, mx_noise_float, positionLocal, select, vec2, vec3} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {wallFace} from '#src/lib/gallery/architectureDimensions.ts'

import {heightNormal, insideBy, visibleDetail} from '../filters.ts'

/** a stretcher and a course, each with its joint, in meters */
const brick = {
  length: 0.25,
  course: 0.09,
  /** half a joint, how far the mortar reaches into each brick’s cell from its edge */
  joint: 0.005,
} as const
/** the glazed courses counted up from the floor: the dado’s oxide band over the baseboard, its biscuit course and its oxide cap, its top course */
const dado = {
  band: 3,
  biscuit: 17,
  cap: 18,
} as const
/** the share of the wall the joints cover, one along every course and one between every two bricks */
const mortarShare = brick.joint * 2 / brick.course + brick.joint * 2 / brick.length

/**
 * Kiln-flashed firebrick in stretcher bond. Below hand height the same courses are faced in bottle-green salt glaze, with a biscuit and oxide border. Joints fade to the share of the wall they cover before they could shimmer.
 * For the round wall of a vestibule, `radius` is that of its center line.
 */
export default class FirebrickMaterial extends MeshStandardNodeMaterial {
  constructor(radius?: number) {
    super({envMapIntensity: 0.48})
    this.name = 'Buff firebrick and glazed dado'
    const p = positionLocal
    // Along its face, which stands a wall face in front of its center line, fit an even number of stretchers around the vestibule. Half a brick then wraps across its seam even in offset courses.
    const face = radius ? radius - wallFace : 0
    const length = radius ? Math.PI * 2 * face / (2 * Math.round(Math.PI * face / brick.length)) : brick.length
    const along = radius ? atan(p.x, float(radius).sub(p.z)).add(Math.PI).mul(face) : p.x
    const row = p.y.div(brick.course).floor()
    const u = along.div(length).add(row.mod(2).mul(0.5))
    const column = radius ? u.floor().mod(Math.round(Math.PI * 2 * face / length)) : u.floor()
    const shade = hash(row.add(400).mul(1867).add(column).add(4096))
    const cell = vec2(0.5).sub(vec2(u.fract(), p.y.div(brick.course).fract()).sub(0.5).abs()).mul(vec2(length, brick.course))
    const edge = cell.x.min(cell.y)
    const pixel = max(p.x.fwidth(), p.y.fwidth(), p.z.fwidth())
    const grain = mx_noise_float(p.mul(43)).mul(visibleDetail(pixel, 0.035))
    const flash = mx_noise_float(p.mul(vec3(3.5, 8, 3.5))).mul(0.18).add(shade.mul(0.65)).add(0.14)
    const arris = edge.add(grain.mul(0.002))
    const brickFace = mix(float(1 - mortarShare), insideBy(float(brick.joint).sub(arris), pixel), visibleDetail(pixel, brick.joint * 6))
    const glazed = row.lessThan(dado.cap + 1)
    const clay = mix(color(hsl.integer(51, 46, 55)).rgb, color(hsl.integer(73, 50, 81)).rgb, flash)
    const green = mix(color(hsl.integer(192, 55, 33)).rgb, color(hsl.integer(176, 33, 50)).rgb, shade.mul(0.68).add(flash.mul(0.32)))
    const glaze = select(row.equal(dado.biscuit), color(hsl.integer(74, 64, 68)).rgb, select(row.equal(dado.cap).or(row.equal(dado.band)), color(hsl.integer(186, 42, 28)).rgb, green))
    const shoulder = arris.smoothstep(0.002, 0.014)
    const fired = clay.mul(shoulder.mul(0.12).add(grain.mul(0.13)).add(0.86))
    this.colorNode = mix(select(glazed, color(hsl.integer(169, 20, 36)).rgb, color(hsl.integer(67, 19, 56)).rgb), select(glazed, glaze, fired), brickFace)
    this.roughnessNode = mix(float(0.94), select(glazed, float(0.2).add(shade.mul(0.12)), float(0.76).add(shade.mul(0.13))), brickFace)
    this.normalNode = heightNormal(shoulder.mul(0.0048).add(grain.mul(select(glazed, float(0.00008), float(0.00036)))).mul(visibleDetail(pixel, 0.045)))
  }
}

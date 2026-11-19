import {atan, color, float, hash, max, mix, mx_noise_float, positionLocal, select, vec2, vec3} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {heightNormal, insideBy, visibleDetail} from '../filters.ts'

/** Kiln-flashed firebrick in stretcher bond. Below hand height the same courses are faced in bottle-green salt glaze, with a biscuit and oxide border. */
export default class FirebrickMaterial extends MeshStandardNodeMaterial {
  constructor(radius?: number) {
    super({envMapIntensity: 0.48})
    this.name = 'Buff firebrick and glazed dado'
    const p = positionLocal
    // Fit an even number of stretchers around the vestibule. Half a brick then wraps across its seam even in offset courses.
    const length = radius ? Math.PI * 2 * radius / (2 * Math.round(Math.PI * radius / 0.38)) : 0.38
    const along = radius ? atan(p.x, float(radius).sub(p.z)).add(Math.PI).mul(radius) : p.x
    const height = 0.14
    const row = p.y.div(height).floor()
    const u = along.div(length).add(row.mod(2).mul(0.5))
    const column = radius ? u.floor().mod(Math.round(Math.PI * 2 * radius / length)) : u.floor()
    const shade = hash(row.add(400).mul(1867).add(column).add(4096))
    const cell = vec2(0.5).sub(vec2(u.fract(), p.y.div(height).fract()).sub(0.5).abs()).mul(vec2(length, height))
    const edge = cell.x.min(cell.y)
    const pixel = max(p.x.fwidth(), p.y.fwidth(), p.z.fwidth())
    const grain = mx_noise_float(p.mul(43)).mul(visibleDetail(pixel, 0.035))
    const flash = mx_noise_float(p.mul(vec3(3.5, 8, 3.5))).mul(0.18).add(shade.mul(0.65)).add(0.14)
    const arris = edge.add(grain.mul(0.002))
    const face = insideBy(float(0.005).sub(arris), pixel)
    const glazed = row.lessThan(12)
    const clay = mix(color('#ac7555').rgb, color('#e5c49b').rgb, flash)
    const green = mix(color('#265654').rgb, color('#578176').rgb, shade.mul(0.68).add(flash.mul(0.32)))
    const glaze = select(row.equal(10), color('#cd9b54').rgb, select(row.equal(11).or(row.equal(2)), color('#274844').rgb, green))
    const shoulder = arris.smoothstep(0.002, 0.014)
    const fired = clay.mul(shoulder.mul(0.12).add(grain.mul(0.13)).add(0.86))
    this.colorNode = mix(select(glazed, color('#455951').rgb, color('#958371').rgb), select(glazed, glaze, fired), face)
    this.roughnessNode = mix(float(0.94), select(glazed, float(0.2).add(shade.mul(0.12)), float(0.76).add(shade.mul(0.13))), face)
    this.normalNode = heightNormal(shoulder.mul(0.0048).add(grain.mul(select(glazed, float(0.00008), float(0.00036)))).mul(visibleDetail(pixel, 0.045)))
  }
}

import type {Node} from 'three/webgpu'

import hsl from 'okhsl'
import {float, max, min, mix, mx_noise_float, normalWorldGeometry, select, uv, vec3} from 'three/tsl'
import {Color, MeshPhysicalNodeMaterial} from 'three/webgpu'

import {inside, visibleDetail, worldNormalToView} from './filters.ts'

const tone = (hex: number): Node<'vec3'> => {
  const {r, g, b} = new Color(hex)
  return vec3(r, g, b)
}
const palette = {
  charcoal: tone(hsl.integer(48, 12, 13)),
  cream: tone(hsl.integer(88, 39, 81)),
  ochre: tone(hsl.integer(73, 77, 56)),
  rust: tone(hsl.integer(33, 85, 34.4)),
  madder: tone(hsl.integer(29, 82, 22)),
  slate: tone(hsl.integer(227, 22, 33)),
}

/**
 * A flat-woven wool rug in the kilim manner, drawn on the top face of a thin box whose UVs span the rug once.
 *
 * Rust field, nested lozenge medallion, diamond chains in the border and a charcoal binding. Every motif edge is filtered against the pixel footprint and the woven texture fades to its average before it can crawl. The box’s edges show the binding.
 */
export default class RugMaterial extends MeshPhysicalNodeMaterial {
  constructor(readonly size: readonly [number, number]) {
    super({
      // Pile scatters back toward the light and looks flatter than a Lambertian surface (EON).
      diffuseRoughness: 1,
      roughness: 0.95,
      envMapIntensity: 0.1,
    })
    const [width, depth] = size
    const x = uv().x.sub(0.5).mul(width).toVar('rugX')
    const z = uv().y.sub(0.5).mul(depth).toVar('rugZ')
    const ax = x.abs()
    const az = z.abs()
    const footprint = max(x.fwidth(), z.fwidth()).toVar('rugFootprint')
    // Distance from the outer edge, and the coordinate running along the nearest edge.
    const edgeX = float(width / 2).sub(ax)
    const edgeZ = float(depth / 2).sub(az)
    const e = min(edgeX, edgeZ).toVar('rugEdge')
    const along = select(edgeX.lessThan(edgeZ), z, x)
    const band = (from: number, to: number) => inside(e.sub(from).negate()).mul(inside(e.sub(to)))
    // Field: a nested, stepped lozenge medallion and four small diamonds near the corners.
    const reachX = width / 2 - 0.62
    const reachZ = depth / 2 - 0.62
    const lozenge = ax.div(reachX).add(az.div(reachZ)).toVar('rugLozenge')
    // Scaled to meters, so the filter sees a true distance.
    const ring = (radius: number) => lozenge.sub(radius).mul(Math.min(reachX, reachZ) * 0.7)
    let field: Node<'vec3'> = palette.rust
    field = mix(field, palette.charcoal, inside(ring(1)))
    field = mix(field, palette.cream, inside(ring(0.93)))
    field = mix(field, palette.madder, inside(ring(0.87)))
    field = mix(field, palette.ochre, inside(ring(0.62)))
    field = mix(field, palette.charcoal, inside(ring(0.56)))
    field = mix(field, palette.slate, inside(ring(0.5)))
    field = mix(field, palette.cream, inside(ring(0.26)))
    field = mix(field, palette.madder, inside(ring(0.17)))
    // Hooked latches on the medallion’s outer rim, like the comb-like edges of woven diamonds.
    const latchPeriod = 0.09
    const latch = along.div(latchPeriod).fract().sub(0.5).abs().mul(latchPeriod).sub(0.018)
    const rim = lozenge.sub(1.035).abs().mul(Math.min(reachX, reachZ) * 0.7).sub(0.03)
    field = mix(field, palette.charcoal, inside(max(latch, rim)).mul(visibleDetail(footprint, 0.03)))
    const corner = (cx: number, cz: number) => ax.sub(cx).abs().add(az.sub(cz).abs())
    const spot = corner(width / 2 - 0.55, depth / 2 - 0.5)
    field = mix(field, palette.ochre, inside(spot.sub(0.17)))
    field = mix(field, palette.charcoal, inside(spot.sub(0.11)))
    field = mix(field, palette.cream, inside(spot.sub(0.05)))
    // Border: a chain of diamonds between cream lines.
    const borderFrom = 0.075
    const borderTo = 0.25
    const borderCenter = (borderFrom + borderTo) / 2
    const borderHalf = (borderTo - borderFrom) / 2 - 0.02
    const period = 0.2
    const q = along.div(period).fract().sub(0.5).abs().mul(period)
    const diamond = q.div(period / 2).add(e.sub(borderCenter).abs().div(borderHalf)).sub(1).mul(borderHalf)
    let border: Node<'vec3'> = palette.madder
    border = mix(border, palette.ochre, inside(diamond))
    border = mix(border, palette.charcoal, inside(diamond.add(0.022)))
    border = mix(border, palette.cream, inside(diamond.add(0.045)))
    let weave: Node<'vec3'> = field
    weave = mix(weave, palette.charcoal, band(0.27, 0.3))
    weave = mix(weave, palette.cream, band(0.25, 0.27))
    weave = mix(weave, border, band(borderFrom, borderTo))
    weave = mix(weave, palette.cream, band(0.06, borderFrom))
    weave = mix(weave, palette.charcoal, inside(e.sub(0.06)))
    // Wool: weft rows, single yarns and dye-lot drift (abrash) in long bands.
    const rows = z.mul(Math.PI * 2 / 0.006).sin().mul(0.5).add(0.5).mul(visibleDetail(footprint, 0.006))
    const yarn = mx_noise_float(vec3(x.mul(260), z.mul(90), 1.3)).mul(visibleDetail(footprint, 0.008))
    const abrash = mx_noise_float(vec3(x.mul(0.6), z.mul(6), 4.7))
    const wool = weave.mul(rows.mul(0.08).add(yarn.mul(0.08)).add(abrash.mul(0.06)).add(0.96))
    const top = normalWorldGeometry.y.greaterThan(0.5)
    const finished = select(top, wool, palette.charcoal.mul(0.8))
    this.colorNode = finished
    this.sheenNode = finished.mul(0.9)
    this.sheenRoughnessNode = float(0.6)
    const pile = vec3(mx_noise_float(vec3(x.mul(180), z.mul(180), 2.1)), 0, mx_noise_float(vec3(x.mul(180), z.mul(180), 6.5))).mul(0.18).mul(visibleDetail(footprint, 0.01))
    const rowTilt = vec3(0, 0, z.mul(Math.PI * 2 / 0.006).cos().mul(0.12).mul(visibleDetail(footprint, 0.006)))
    this.normalNode = worldNormalToView(select(top, normalWorldGeometry.add(pile).add(rowTilt), normalWorldGeometry).normalize())
  }
}

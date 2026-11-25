import type {Node} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, float, max, min, mix, mx_noise_float, normalWorldGeometry, positionGeometry, select, vec2, vec3} from 'three/tsl'
import {MeshPhysicalNodeMaterial, Color as ThreeColor} from 'three/webgpu'

import {inside, line, visibleDetail, worldNormalToView} from './filters.ts'
import {circle, curveDistance, leaf, repeat, rosette, unite} from './sdf.ts'

type Float = Node<'float'>
type Color = Node<'vec3'>

const color = (hex: number): Color => {
  const {r, g, b} = new ThreeColor(hex)
  return vec3(r, g, b)
}
const palette = {
  binding: hsl.integer(24, 86, 16),
  red: hsl.integer(22, 87, 21),
  navy: hsl.integer(276, 38, 13),
  gold: hsl.integer(74, 62, 51),
  cream: hsl.integer(77, 35, 64),
}
/** Width of the border system from the edge to the field, in meters. */
export const rugBorder = 0.6

/**
 * A hand-knotted wool rug in the Persian city manner, drawn on the top face of a thin box centered on its mesh.
 *
 * A crimson field carries an ogee trellis of gilded vines with rosettes at the nodes and buds between them. The lobed navy medallion holds a crimson ring and a navy core around a gold rosette, with a pointed pendant toward each end; navy spandrels fill the field’s corners. The border runs from an overcast binding over a sawtooth guard into a wide navy band of twin vines, alternating palmettes and rosettes, with a rosette square at each corner, and ends in a band of gold beads.
 *
 * Every motif edge is filtered against the pixel footprint, and fine work fades out before it could crawl. The box’s sides show the binding.
 */
export default class PersianRugMaterial extends MeshPhysicalNodeMaterial {
  constructor(readonly size: readonly [number, number]) {
    const [width, depth] = size
    if (!(width > rugBorder * 3 && depth > rugBorder * 3)) {
      throw new RangeError(`A rug needs to be wider than three times its ${rugBorder} m border.`)
    }
    super({
      // Pile scatters back toward the light and looks flatter than a Lambertian surface (EON).
      diffuseRoughness: 1,
      roughness: 0.95,
      envMapIntensity: 0.1,
    })
    // No `toVar()` here: these values feed both branches of the `select`s below, and a variable first assigned inside one branch reads as zero in the other.
    const x = positionGeometry.x
    const z = positionGeometry.z
    const ax = x.abs()
    const az = z.abs()
    const footprint = max(x.fwidth(), z.fwidth())
    // Small motifs fade to the ground before they could sparkle; strokes keep their average coverage instead.
    const fine = visibleDetail(footprint, 0.025)
    const paint = (ink: Color | number) => (typeof ink === 'number' ? color(ink) : ink)
    const draw = (base: Color, ink: Color | number, shape: Float, detail: Float | number = 1): Color => mix(base, paint(ink), inside(shape).mul(detail))
    const stroke = (base: Color, ink: Color | number, distance: Float, halfWidth: number, opacity: Float | number = 1): Color => mix(base, paint(ink), line(distance, halfWidth).mul(opacity))
    // Distance from the outer edge, and the coordinate running along the nearest edge.
    const edgeX = float(width / 2).sub(ax)
    const edgeZ = float(depth / 2).sub(az)
    const e = min(edgeX, edgeZ)
    const along = select(edgeX.lessThan(edgeZ), z, x)
    // The field. The medallion and the spandrels are lobed lozenges.
    const reachX = width * 0.24
    const reachZ = depth * 0.183
    const lozenge = ax.div(reachX).add(az.div(reachZ))
    const angle = atan(az.div(reachZ), ax.div(reachX))
    const lobed = (lobes: number, radius: number, amplitude: number) => lozenge.sub(angle.mul(lobes).cos().abs().mul(amplitude)).sub(radius).mul(Math.min(reachX, reachZ) * 0.85)
    const tip = reachZ * 1.14
    const pendant = unite(leaf(vec2(ax, az), [0, tip], 0.32, 0.24, Math.PI / 2), circle(vec2(ax, az), [0, tip + 0.36], 0.05))
    const fieldX = width / 2 - rugBorder
    const fieldZ = depth / 2 - rugBorder
    const cornerX = float(fieldX).sub(ax)
    const cornerZ = float(fieldZ).sub(az)
    const spandrel = cornerX.div(fieldX * 0.43).add(cornerZ.div(fieldZ * 0.33)).sub(1).mul(0.6).sub(atan(cornerZ, cornerX).mul(9).cos().abs().mul(0.03))
    const navy = min(min(lobed(18, 0.97, 0.05), pendant), spandrel)
    const ring = lobed(12, 0.64, 0.04)
    const core = lobed(8, 0.34, 0.05)
    const onNavy = navy.lessThan(0).and(ring.greaterThanEqual(0).or(core.lessThan(0)))
    const ink = select(onNavy, color(palette.cream), color(palette.gold))
    let field: Color = select(onNavy, color(palette.navy), color(palette.red))
    // The trellis: two mirrored families of waves that meet at the rosettes.
    const trellisX = width * 0.11
    const trellisZ = depth * 0.1
    const wave = Math.PI * 2 / trellisZ
    const trellisU = repeat(ax, trellisX).abs()
    const crest = az.mul(wave).cos().add(1).mul(trellisX / 4)
    const slope = az.mul(wave).sin().mul(trellisX / 4 * wave)
    field = stroke(field, ink, curveDistance(trellisU, crest, slope), 0.007, 0.85)
    const nodeU = repeat(ax, trellisX / 2)
    const nodeV = repeat(az, trellisZ / 2)
    const node = ax.div(trellisX / 2).round().add(az.div(trellisZ / 2).round()).mod(2).lessThan(0.5)
    const bloom = vec2(nodeU, nodeV)
    field = draw(field, select(node, ink, color(palette.cream)), select(node, rosette(bloom, 8, 0.075, 0.5), rosette(bloom, 6, 0.05, 0.5)))
    field = draw(field, select(node, select(onNavy, color(palette.red), color(palette.navy)), color(palette.red)), bloom.length().sub(select(node, float(0.03), float(0.018))), fine)
    // Leaves budding from the vines, mirrored about every node.
    const budV = repeat(az.sub(trellisZ / 4), trellisZ / 2).abs()
    const bud = vec2(trellisU.sub(crest), budV)
    field = draw(field, ink, unite(leaf(bud, [0.03, 0], 0.045, 0.014, 0.6), leaf(bud, [-0.03, 0], 0.04, 0.012, Math.PI - 0.6)), fine)
    // Outlines, the core and the central rosette.
    field = stroke(field, palette.gold, navy, 0.013)
    field = stroke(field, palette.gold, ring, 0.012)
    field = draw(field, palette.navy, core)
    field = stroke(field, palette.gold, core, 0.01)
    const center = vec2(x, z)
    field = draw(field, palette.gold, rosette(center, 8, 0.24, 0.45))
    field = draw(field, palette.red, rosette(center, 8, 0.14, 0.4))
    field = draw(field, palette.gold, center.length().sub(0.045))
    field = draw(field, palette.red, leaf(vec2(ax, az), [0, tip + 0.02], 0.18, 0.1, Math.PI / 2))
    field = draw(field, palette.gold, circle(vec2(ax, az), [0, tip + 0.02], 0.03))
    // The main border: twin vines with palmettes and rosettes in turn.
    const period = 0.48
    const middle = 0.28
    const t = repeat(along, period)
    const y = e.sub(middle)
    // 1 on the palmettes, 0 on the rosettes between them.
    const palmette = along.div(period).round().mul(0.5).fract().mul(2).oneMinus()
    const rosettes = palmette.oneMinus()
    let border: Color = color(palette.navy)
    for (const phase of [0, Math.PI]) {
      border = stroke(border, palette.gold, y.sub(along.mul(Math.PI * 2 / period).add(phase).sin().mul(0.1)), 0.009)
    }
    const flower = vec2(t, y)
    const fan = unite(...[-0.9, -0.45, 0, 0.45, 0.9].map(spread => leaf(flower, [Math.sin(spread) * 0.07, Math.cos(spread) * 0.07 - 0.04], 0.085, 0.03, Math.PI / 2 - spread)))
    border = draw(border, palette.red, fan, palmette)
    border = stroke(border, palette.gold, fan, 0.006, palmette)
    border = draw(border, palette.gold, circle(flower, [0, -0.05], 0.035), palmette)
    border = draw(border, palette.gold, rosette(flower, 8, 0.11, 0.45), rosettes)
    border = draw(border, palette.red, rosette(flower, 8, 0.07, 0.4), rosettes)
    border = draw(border, palette.gold, flower.length().sub(0.025), rosettes)
    // A rosette square where the bands meet in each corner.
    const corner = vec2(edgeX.sub(middle), edgeZ.sub(middle))
    const cornerBlock = draw(draw(draw(color(palette.navy), palette.gold, rosette(corner, 8, 0.13, 0.45)), palette.red, rosette(corner, 8, 0.08, 0.4)), palette.gold, corner.length().sub(0.03))
    border = select(max(edgeX, edgeZ).lessThan(0.46), cornerBlock, border)
    // Guards: a sawtooth between gold lines toward the edge, a band of beads toward the field.
    const sawtooth = repeat(along, 0.05).abs().sub(e.sub(0.03).mul(0.55))
    const outerGuard = draw(draw(color(palette.red), palette.gold, sawtooth, fine.mul(select(e.greaterThan(0.03).and(e.lessThan(0.075)), float(1), float(0)))), palette.gold, e.sub(0.09).abs().sub(0.007))
    const beads = draw(color(palette.red), palette.gold, vec2(repeat(along, 0.07), e.sub(0.53)).length().sub(0.014), fine)
    border = select(e.lessThan(0.1), outerGuard, select(e.greaterThan(0.46), beads, border))
    border = stroke(border, palette.gold, e.sub(0.465), 0.008)
    border = stroke(border, palette.gold, e.sub(rugBorder - 0.01), 0.008)
    border = select(e.lessThan(0.025), color(palette.binding), border)
    const weave = select(e.lessThan(rugBorder), border, field)
    // Wool: knots, single yarns and dye-lot drift (abrash) in long bands.
    const knots = mx_noise_float(vec3(x.mul(260), z.mul(260), 1.3)).mul(visibleDetail(footprint, 0.012))
    const yarn = mx_noise_float(vec3(x.mul(40), z.mul(120), 5.1)).mul(visibleDetail(footprint, 0.04))
    const abrash = mx_noise_float(vec3(x.mul(0.5), z.mul(4), 4.7))
    const wool = weave.mul(knots.mul(0.1).add(yarn.mul(0.06)).add(abrash.mul(0.06)).add(0.97))
    const top = normalWorldGeometry.y.greaterThan(0.5)
    const finished = select(top, wool, color(palette.binding).mul(0.8))
    this.colorNode = finished
    this.sheenNode = finished.mul(0.5)
    this.sheenRoughnessNode = float(0.55)
    const pile = vec3(mx_noise_float(vec3(x.mul(200), z.mul(200), 2.1)), 0, mx_noise_float(vec3(x.mul(200), z.mul(200), 6.5))).mul(0.2).mul(visibleDetail(footprint, 0.01))
    this.normalNode = worldNormalToView(select(top, vec3(0, 1, 0).add(pile), normalWorldGeometry).normalize())
  }
}

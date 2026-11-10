import type {Node} from 'three/webgpu'

import {atan, attribute, color, float, max, mix, mx_cell_noise_float, mx_noise_float, positionLocal, select, vec2, vec3} from 'three/tsl'

import {inside, line, visibleDetail} from '#src/lib/materials/filters.ts'
import {curveDistance} from '#src/lib/materials/sdf.ts'

import {frameShapeAttribute} from '../frameGeometry.ts'

export type BackSurface = ReturnType<typeof backSurface>
type Vec2 = Node<'vec2'>

type Vec3 = Node<'vec3'>
/**
 * What the material of a frame’s back knows about the point it shades, once `withOpening` in `frameBack.ts` handed the back its opening: where it lies as seen from behind, x running to the right of someone looking at the back, and the opening’s half width and half height.
 *
 * Read it inside a material’s constructor: the nodes belong to the material that uses them.
 */
export function backSurface() {
  const shape = attribute<'vec4'>(frameShapeAttribute, 'vec4')
  const point = vec2(positionLocal.x.negate(), positionLocal.y).toVar('backPoint')
  return {
    opening: vec2(shape.w, shape.z),
    point,
    footprint: max(point.x.fwidth(), point.y.fwidth()).toVar('backFootprint'),
  }
}

/**
 * The hanging wire strung across the back between two D-rings screwed on a third of the way down, sagging a little between them: how much the rings, their plates and the wire cover the point, how much is metal and how high it stands.
 */
export function hangingWire({footprint, opening, point}: BackSurface) {
  const ringX = opening.x.mul(0.78)
  const ringY = opening.y.mul(0.42)
  const side = vec2(point.x.abs().sub(ringX), point.y.sub(ringY))
  // A plate with two screws, the ring standing up from it.
  const plate = inside(max(side.x.abs().sub(0.007), side.y.add(0.004).abs().sub(0.009)))
  const screws = inside(vec2(side.x, side.y.add(0.004).abs().sub(0.0055)).length().sub(0.0018))
  const ring = line(vec2(side.x, side.y.sub(0.007)).length().sub(0.0075), 0.0012).mul(side.y.greaterThan(0.004).select(float(1), float(0)))
  // The wire, twisted, running from ring to ring and sagging toward the middle.
  const sag = opening.y.mul(0.08).min(0.04)
  const across = point.x.div(ringX).clamp(-1, 1)
  const wireY = ringY.add(0.012).sub(sag.mul(float(1).sub(across.mul(across))))
  const wire = line(point.y.sub(wireY), 0.0009).mul(point.x.abs().lessThan(ringX).select(float(1), float(0)))
  const twist = point.x.mul(900).sin().mul(0.5).add(0.5).mul(visibleDetail(footprint, 0.001))
  const metal = plate.max(ring).max(wire)
  return {
    cover: metal,
    color: mix(mix(color('#8a8478'), color('#c8c2b4'), twist.mul(wire)), color('#4a4640'), screws.mul(plate)),
    height: plate.mul(0.0008).add(ring.mul(0.0025)).add(wire.mul(0.0015)).sub(screws.mul(0.0003)),
  }
}

/**
 * A gallery label pasted on the back, `size` meters wide and high around `center`, slightly askew: cream card with a ruled border, a bold line of title and lines of small type under it, faded and foxed. Returns how much it covers the point, its color and its height.
 */
export function galleryLabel({footprint, point}: BackSurface, center: Vec2, size: readonly [number, number], tilt = 0.03) {
  const offset = point.sub(center)
  const local = vec2(offset.x.mul(Math.cos(tilt)).add(offset.y.mul(Math.sin(tilt))), offset.y.mul(Math.cos(tilt)).sub(offset.x.mul(Math.sin(tilt))))
  const [halfWidth, halfHeight] = [size[0] / 2, size[1] / 2]
  const card = inside(max(local.x.abs().sub(halfWidth), local.y.abs().sub(halfHeight)))
  const border = line(max(local.x.abs().sub(halfWidth - 0.004), local.y.abs().sub(halfHeight - 0.004)), 0.0003)
  // Rows of type: a bold title, then lines of words of their own lengths.
  const rowHeight = 0.0045
  const fromTop = float(halfHeight - 0.009).sub(local.y)
  const row = fromTop.div(rowHeight).floor()
  const inRow = fromTop.div(rowHeight).fract()
  const isTitle = row.equal(0)
  const word = local.x.add(halfWidth).div(select(isTitle, float(0.012), float(0.007))).floor()
  const hasWord = mx_cell_noise_float(vec3(word, row, 3)).greaterThan(0.22).and(row.greaterThanEqual(0)).and(row.lessThan(Math.floor((size[1] - 0.016) / rowHeight)))
  const lineEnd = mx_cell_noise_float(vec3(row, 5, 0)).mul(0.5).add(0.45).mul(size[0] - 0.012)
  const withinLine = local.x.add(halfWidth - 0.006).greaterThan(0).and(local.x.add(halfWidth - 0.006).lessThan(lineEnd))
  const weight = select(isTitle, float(0.55), float(0.32))
  const type = select(hasWord.and(withinLine), inside(inRow.sub(0.5).abs().sub(weight.mul(0.5)).mul(rowHeight)), float(0))
  const legibleType = mix(float(0.12), type, visibleDetail(footprint, 0.0015))
  const foxing = mx_cell_noise_float(vec3(local.mul(400), 7)).smoothstep(0.93, 1)
  const paper: Vec3 = mix(color('#ece2c8'), color('#c8a878'), foxing.mul(0.6))
  return {
    cover: card,
    color: mix(mix(paper, color('#2a2420'), legibleType.mul(0.85)), color('#6a5a44'), border),
    height: card.mul(0.0002),
  }
}

/**
 * A line of handwriting `length` meters long round `center`, letters `height` tall, like an inventory number in chalk or a joiner’s note in pencil: a looping stroke broken into words, its own for every `seed`. Returns how much it covers the point, fading to a faint average before its strokes could shimmer.
 */
export function scribble({footprint, point}: BackSurface, center: Vec2, length: number, height: number, seed: number) {
  const local = point.sub(center)
  const t = local.x.div(height)
  // Loops of two waves at once, as hands write.
  const f = t.mul(5.1).add(seed).sin().mul(0.3).add(t.mul(12.3).add(seed * 2.7).sin().mul(0.2))
  const slope = t.mul(5.1).add(seed).cos().mul(0.3 * 5.1).add(t.mul(12.3).add(seed * 2.7).cos().mul(0.2 * 12.3))
  const stroke = line(curveDistance(local.y.div(height), f, slope).mul(height), height * 0.05)
  const word = mx_cell_noise_float(vec3(t.div(2.2).floor(), seed, 1.7)).greaterThan(0.22)
  const within = select(local.x.abs().lessThan(length / 2).and(word), float(1), float(0))
  return mix(float(0.08), stroke, visibleDetail(footprint, height * 0.25)).mul(within).mul(select(local.y.abs().lessThan(height), float(1), float(0)))
}

/** A slotted screw head of `radius` at `center`, its slot turned its own way: how much the head and how much the slot cover the point, and how high it stands. */
export function screwHead({point}: BackSurface, center: Vec2, radius: number) {
  const local = point.sub(center)
  const turn = mx_cell_noise_float(vec3(center.mul(97), 3.1)).mul(Math.PI)
  const along = local.x.mul(turn.cos()).add(local.y.mul(turn.sin()))
  const across = local.y.mul(turn.cos()).sub(local.x.mul(turn.sin()))
  const head = inside(local.length().sub(radius))
  const slot = inside(max(across.abs().sub(radius * 0.16), along.abs().sub(radius * 0.85))).mul(head)
  return {
    cover: head,
    slot,
    height: head.mul(float(1).sub(local.length().div(radius).pow(2)).max(0).mul(radius * 0.25)).sub(slot.mul(radius * 0.2)),
  }
}

/** A seal of sealing wax of `radius` pressed at `center`: a puddle with a ragged rim, a raised ring and a crest in its middle. Returns how much it covers the point, its color and its height. */
export function waxSeal({footprint, point}: BackSurface, center: Vec2, radius: number, wax = '#8a1410') {
  const local = point.sub(center)
  const angle = atan(local.y, local.x)
  const rim = mx_noise_float(vec3(angle.cos().mul(3), angle.sin().mul(3), 4.3)).mul(radius * 0.12)
  const puddle = inside(local.length().sub(rim).sub(radius))
  const ring = line(local.length().sub(radius * 0.72), radius * 0.05)
  // The crest: a shield with a bar across it, pressed in.
  const crest = inside(max(local.x.abs().sub(radius * 0.32), local.y.add(local.x.abs().mul(0.4)).abs().sub(radius * 0.4)))
  const bar = inside(local.y.sub(radius * 0.06).abs().sub(radius * 0.06)).mul(crest)
  const relief = mix(float(0.5), ring.add(bar).sub(crest.mul(0.6)).add(0.5), visibleDetail(footprint, radius * 0.2))
  const swell = float(1).sub(local.length().div(radius).pow(2)).max(0)
  return {
    cover: puddle,
    color: color(wax).mul(relief.mul(0.5).add(0.6)),
    height: puddle.mul(swell.mul(0.0015).add(relief.mul(0.0004))),
  }
}

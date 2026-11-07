import type {Node} from 'three/webgpu'

import {attribute, color, float, max, mix, mx_cell_noise_float, positionLocal, select, vec2, vec3} from 'three/tsl'

import {frameShapeAttribute} from '#src/lib/frames/frameGeometry.ts'

import {inside, line, visibleDetail} from '../filters.ts'

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

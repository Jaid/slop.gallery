import {BufferGeometry, CylinderGeometry, ExtrudeGeometry, Float32BufferAttribute, Path, Shape, ShapeGeometry, Vector2} from 'three/webgpu'

import {insetPolygon} from '../geometry.ts'
import vesperCeiling, {vesperCoveTopY as deck, vesperOpeningInset} from './vesperCeiling.ts'

/** The two pierced castings under the deck sit back from the gilt lips of the openings. */
const edge = vesperCeiling.bridgeWidth / 2
const ribZ = edge - 0.09
const ribWidth = 0.14
/** The intrados: a segmental arch with its crown just below the deck, springing where the castings bed into the plaster ledges. */
const crown = deck - 0.28
const spring = vesperCeiling.springY + 0.04
const arch = (t: number) => crown - (crown - spring) * t ** 2
/** From the center to the ledge at the foot of the cove. The ribs continue beyond the glass all the way into their bearings. */
const archSpan = (half: number) => half + vesperOpeningInset - vesperCeiling.ledge
const point = ([x, z]: readonly [number, number]) => new Vector2(x, z)

/** The patinated bronze spandrels with keys at their crowns and an evening-star boss on the soffit. Also used for collision, so the pierced work really is open. */
export function bridgeFrame(half: number) {
  const span = archSpan(half)
  const rib = new Shape
  rib.moveTo(-span, arch(1))
  traceArch(rib, span, 1)
  rib.lineTo(span, deck + 0.01)
  rib.lineTo(-span, deck + 0.01)
  rib.closePath()
  // A spray of raked, leaf-shaped lights in each haunch. Their sills climb with the arch, leaving a continuous lower chord.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const step = 0.173
      const t = 0.07 + i * step
      const x = (u: number) => side * (t + u * step) * span
      // Even the outermost light clears the sloping plaster: its head stays below the quarter ellipse at its far end.
      const alongCove = Math.max(0, 1 - (span - Math.abs(x(1))) / vesperCeiling.cove.run)
      const top = vesperCeiling.springY + vesperCeiling.cove.rise * Math.sqrt(1 - alongCove ** 2) - 0.08
      const low = arch(t + step * 0.82) + 0.145
      const y = (v: number) => top + (low - top) * v
      const light = new Path
      light.moveTo(x(0), top)
      light.quadraticCurveTo(x(0.43), top, x(0.78), y(0.28))
      light.quadraticCurveTo(x(0.98), y(0.54), x(0.83), low)
      light.quadraticCurveTo(x(0.38), low + 0.015, x(0.27), y(0.58))
      light.quadraticCurveTo(x(0.17), y(0.14), x(0), top)
      rib.holes.push(light)
    }
  }
  const north = cast(rib, ribWidth, -ribZ)
  const parts: Array<BufferGeometry> = [north, north.clone().translate(0, 0, 2 * ribZ)]
  const key = new Shape
  key.moveTo(-0.29, deck + 0.015)
  key.lineTo(0.29, deck + 0.015)
  key.lineTo(0.19, arch(0) - 0.09)
  key.lineTo(-0.19, arch(0) - 0.09)
  key.closePath()
  for (const side of [-1, 1]) {
    parts.push(cast(key, ribWidth + 0.035, side * ribZ))
    // A beveled bearing plate binds the feet of both arches into the gilt molding at the base of the cove.
    const seat = new Shape
    seat.moveTo(side * (span - 0.19), spring + 0.07)
    seat.lineTo(side * (span + 0.025), spring + 0.07)
    seat.lineTo(side * (span + 0.025), vesperCeiling.springY + 0.001)
    seat.lineTo(side * (span - 0.14), vesperCeiling.springY + 0.001)
    seat.closePath()
    parts.push(cast(seat, vesperCeiling.bridgeWidth + 0.1))
  }
  const boss = new CylinderGeometry(0.49, 0.42, 0.08, 16)
  parts.push(boss.translate(0, deck - 0.039, 0))
  return parts
}
/** Gilt stringcourses pick out the curve against the sky; they follow each rib into its seat at the base of the cove. */
export function bridgeGilding(half: number): Array<BufferGeometry> {
  const span = archSpan(half)
  const bead = new Shape
  bead.moveTo(-span, arch(1) + 0.025)
  traceArch(bead, span, 1, 0.025)
  bead.lineTo(span, arch(1) + 0.07)
  traceArch(bead, span, -1, 0.07)
  bead.closePath()
  const parts: Array<BufferGeometry> = [-1, 1].map(side => cast(bead, ribWidth + 0.018, side * ribZ))
  parts.push(cartouche(half), eveningStar(deck - 0.078))
  return parts
}

function cast(shape: Shape, depth: number, z = 0) {
  const solid = new ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 6,
    depth,
  })
  return solid.translate(0, 0, z - depth / 2)
}
/** Use the same knots on the arch and its applied bead, independent of the smaller curls pierced in the web. */
function traceArch(shape: Shape, half: number, toSide: number, lift = 0) {
  for (let i = 1; i <= 24; i++) {
    const t = toSide * (2 * i / 24 - 1)
    shape.lineTo(t * half, arch(t) + lift)
  }
}
/** A low, faceted eight-ray evening star, picked out in gold on the underside of the deck. */
function eveningStar(y: number) {
  const star = new BufferGeometry
  const points: Array<number> = []
  const outline = Array.from({length: 16}, (_, i) => {
    const radius = i % 2 ? 0.095 : (i % 4 ? 0.24 : 0.37)
    const angle = i * Math.PI / 8
    return [radius * Math.cos(angle), radius * Math.sin(angle)] as const
  })
  for (const [i, [x, z]] of outline.entries()) {
    const [nextX, nextZ] = outline[(i + 1) % outline.length]
    points.push(0, y - 0.07, 0, x, y, z, nextX, y, nextZ)
  }
  star.setAttribute('position', new Float32BufferAttribute(points, 3))
  star.setAttribute('uv', new Float32BufferAttribute(new Float32Array(points.length / 3 * 2), 2))
  star.computeVertexNormals()
  return star
}
/** A narrow lozenge inlaid in the soffit around the star. Its clipped ends point toward the springing. */
function cartouche(half: number) {
  const tip = half - 0.2
  const outline = [[-tip, -0.07], [-0.64, -0.51], [0.64, -0.51], [tip, -0.07], [tip, 0.07], [0.64, 0.51], [-0.64, 0.51], [-tip, 0.07]] as const
  const shape = new Shape(outline.map(point))
  shape.holes.push(new Path(insetPolygon(outline, 0.03).map(point)))
  const fillet = new ShapeGeometry(shape)
  return fillet.rotateX(Math.PI / 2).translate(0, deck - 0.002, 0)
}

import type {BufferGeometry} from 'three/webgpu'

import {BoxGeometry, Curve, CylinderGeometry, ExtrudeGeometry, MathUtils, Shape, TubeGeometry, Vector3} from 'three/webgpu'

import {mergeParts} from '../geometry.ts'
import {colliderGeometry} from './architecture.ts'
import {wallFace} from './architectureDimensions.ts'
import vesperCeiling, {vesperCoveEnd, vesperCoveSection, vesperCoveTopY, vesperLanternHalf, vesperLanternSillY} from './vesperCeiling.ts'

/** Half the width of the catwalk along z, where it divides the lantern into two equal openings. */
const deckHalf = 0.74
const soffitCrown = vesperCoveTopY - 0.08
const archRise = 0.62
// A shallow threshold at the curb keeps the deck from sharing the ceiling’s top plane.
const deckY = vesperLanternSillY - 0.025
/** enough bearing for each end to sit in the band behind the lantern’s curb */
const bearing = 0.29
function box(x: number, y: number, z: number, width: number, height: number, depth: number) {
  const geometry = new BoxGeometry(width, height, depth)
  return geometry.translate(x, y, z)
}
/** A solid rectangular belt on plan, with either face following the arch in section. */
function belt(halfSpan: number, z: number, depth: number, bottom: (x: number) => number, top: (x: number) => number) {
  const geometry = new BoxGeometry(2 * halfSpan, 1, depth, 32, 1, 1)
  const positions = geometry.getAttribute('position')
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i)
    positions.setY(i, (positions.getY(i) < 0 ? bottom : top)(x))
    positions.setZ(i, positions.getZ(i) + z)
  }
  geometry.computeVertexNormals()
  return geometry
}
function fan(radius: number) {
  const outline = new TubeGeometry(new FanArc(radius), 16, 0.022, 6, false)
  const ribs = Array.from({length: 5}, (_, i) => {
    const angle = (i + 1) * Math.PI / 6
    return box(radius / 2, 0, 0, radius, 0.025, 0.029).rotateZ(angle)
  })
  const hub = new CylinderGeometry(0.056, 0.056, 0.06, 12)
  hub.rotateX(Math.PI / 2)
  return mergeParts([outline, ...ribs, hub])
}
/** A carved, tapering corbel joins the end of the arch to the rib across the cove. */
function corbel(halfSpan: number, coveX: number, springY: number) {
  const outline = new Shape
  outline.moveTo(halfSpan + 0.025, vesperCoveTopY + 0.06)
  outline.lineTo(coveX + 0.08, vesperCoveTopY + 0.06)
  outline.lineTo(coveX + 0.08, vesperCoveTopY - 0.13)
  outline.bezierCurveTo(coveX - 0.16, vesperCoveTopY - 0.13, halfSpan + 0.52, springY - 0.035, halfSpan + 0.23, springY - 0.035)
  outline.lineTo(halfSpan + 0.025, springY - 0.035)
  outline.closePath()
  const depth = deckHalf * 2 + 0.065
  const block = new ExtrudeGeometry(outline, {
    bevelSegments: 1,
    bevelSize: 0.026,
    bevelThickness: 0.026,
    curveSegments: 16,
    depth,
  })
  block.translate(0, 0, -depth / 2)
  // The bearing is as wide as the bridge at the spring, then tapers into the cove rib.
  const positions = block.getAttribute('position')
  for (let i = 0; i < positions.count; i++) {
    const taper = MathUtils.smoothstep(positions.getX(i), halfSpan + bearing, coveX)
    positions.setZ(i, positions.getZ(i) * MathUtils.lerp(1, 0.19, taper))
  }
  block.computeVertexNormals()
  return block
}
/** A raised rib along the east cove, and the fillets that border it. */
function coveRib(faceX: number, width: number, z: number, inset: number, relief: number) {
  const segments = vesperCeiling.cove.segments
  const rib = new BoxGeometry(1, 1, width, segments, 1, 1)
  const positions = rib.getAttribute('position')
  for (let i = 0; i < positions.count; i++) {
    const angle = (0.5 - positions.getX(i)) * Math.PI / 2
    const {point: [along, y], normal: [inward, down]} = vesperCoveSection(angle)
    const offset = positions.getY(i) < 0 ? relief : inset
    positions.setXYZ(i, faceX - along - offset * inward, y + offset * down, positions.getZ(i) + z)
  }
  rib.computeVertexNormals()
  return rib
}
/** The chased brass star at the crown of the arch, looking down into the room. */
function crownStar() {
  const outline = new Shape
  for (let i = 0; i < 16; i++) {
    const angle = i * Math.PI / 8
    const radius = i % 2 ? 0.091 : (i % 4 ? 0.155 : 0.24)
    const x = radius * Math.cos(angle)
    const y = radius * Math.sin(angle)
    if (i === 0) {
      outline.moveTo(x, y)
    } else {
      outline.lineTo(x, y)
    }
  }
  outline.closePath()
  const star = new ExtrudeGeometry(outline, {
    bevelEnabled: false,
    depth: 0.017,
  })
  return star.rotateX(Math.PI / 2).translate(0, soffitCrown - 0.025, 0)
}
/**
 * A limestone segmental arch across the lantern’s short axis, reaching into the ceiling band at both ends.
 * The paired bronze balustrades use the same fan motif as the Vesper’s wall stencil. The two apertures
 * beneath the existing hipped roof stay open to the sun. Coordinates are relative to the room’s center.
 */
export default class VesperBridgeGeometry {
  readonly bronze
  readonly collision
  readonly deck
  readonly gilt

  constructor(size: readonly [width: number, depth: number]) {
    const [halfSpan] = vesperLanternHalf(size)
    const faceX = size[0] / 2 - wallFace
    const reach = halfSpan + bearing
    const radius = (reach ** 2 + archRise ** 2) / (2 * archRise)
    const soffit = (x: number) => soffitCrown - radius + Math.sqrt(radius ** 2 - x ** 2)
    const arch = belt(reach, 0, deckHalf * 2, soffit, () => deckY)
    const bearingBlock = corbel(halfSpan, faceX - vesperCoveEnd, soffit(reach))
    const rib = coveRib(faceX, 0.38, 0, -0.015, 0.064)
    const stone: Array<BufferGeometry> = [arch]
    const boss = new CylinderGeometry(0.264, 0.247, 0.035, 8)
    const bronze: Array<BufferGeometry> = [boss.translate(0, soffitCrown - 0.011, 0)]
    const gilt: Array<BufferGeometry> = [crownStar()]
    const solid: Array<BufferGeometry> = [arch]
    for (const side of [-1, 1]) {
      const turn = side === 1 ? 0 : Math.PI
      const springer = bearingBlock.clone().rotateY(turn)
      const pilaster = rib.clone().rotateY(turn)
      stone.push(springer, pilaster)
      solid.push(springer, pilaster)
      for (const edge of [-1, 1]) {
        gilt.push(coveRib(faceX, 0.022, edge * 0.149, 0.059, 0.075).rotateY(turn))
      }
      const z = side * deckHalf
      // Deep fascia at the deck, with a second, curved molding tracing the stone’s intrados.
      bronze.push(box(0, deckY - 0.09, z, 2 * reach, 0.17, 0.075))
      bronze.push(belt(reach, z, 0.09, x => soffit(x) - 0.038, x => soffit(x) + 0.083))
      gilt.push(belt(reach, z, 0.105, x => soffit(x) - 0.028, x => soffit(x) + 0.002))
      gilt.push(box(0, deckY - 0.065, z, 2 * reach, 0.023, 0.085))
    }
    bearingBlock.dispose()
    rib.dispose()
    // Ties across the soffit join the two arch moldings, outlining five fields of stone.
    for (const fraction of [-0.6, -0.2, 0.2, 0.6]) {
      const x = fraction * halfSpan
      const slope = -x / Math.sqrt(radius ** 2 - x ** 2)
      const tie = new BoxGeometry(0.066, 0.048, 2 * deckHalf)
      bronze.push(tie.rotateZ(Math.atan(slope)).translate(x, soffit(x), 0))
    }
    const railSpan = halfSpan - 0.13
    const bays = Math.max(1, Math.round(2 * railSpan / 0.95))
    const bay = 2 * railSpan / bays
    const fanPanel = fan(Math.min(0.35, bay * 0.39))
    const bottom = deckY + 0.129
    const top = deckY + 0.84
    for (const side of [-1, 1]) {
      const z = side * (deckHalf - 0.025)
      const handrail = box(0, top, z, 2 * railSpan + 0.09, 0.066, 0.111)
      const bottomRail = box(0, bottom, z, 2 * railSpan + 0.09, 0.055, 0.076)
      const frieze = box(0, top - 0.13, z, 2 * railSpan, 0.032, 0.055)
      const rails = [handrail, bottomRail, frieze]
      bronze.push(...rails)
      solid.push(...rails)
      gilt.push(box(0, top + 0.037, z, 2 * railSpan + 0.09, 0.023, 0.088))
      for (let i = 0; i <= bays; i++) {
        const x = i * bay - railSpan
        const postWidth = i === 0 || i === bays ? 0.094 : 0.061
        const post = box(x, (deckY + top) / 2, z, postWidth, top - deckY, postWidth)
        bronze.push(post, box(x, deckY + 0.043, z, postWidth + 0.042, 0.086, postWidth + 0.042))
        gilt.push(box(x, top - 0.235, z, postWidth + 0.019, 0.027, postWidth + 0.019))
        solid.push(post)
        if (i < bays) {
          gilt.push(fanPanel.clone().translate(x + bay / 2, bottom + 0.015, z))
        }
      }
    }
    fanPanel.dispose()
    // The deck, its bearings and the main railing members are solid. Fine ornament cannot snag a prop.
    const collisionMesh = mergeParts(solid.map(part => part.clone()))
    try {
      this.collision = colliderGeometry(collisionMesh)
    } finally {
      collisionMesh.dispose()
    }
    this.deck = mergeParts(stone)
    this.bronze = mergeParts(bronze)
    this.gilt = mergeParts(gilt)
  }

  dispose() {
    this.deck.dispose()
    this.bronze.dispose()
    this.gilt.dispose()
  }
}

/** The arc of a cast fan in the railing. */
class FanArc extends Curve<Vector3> {
  constructor(readonly radius: number) {
    super()
  }

  override getPoint(t: number, point = new Vector3) {
    const angle = Math.PI * t
    return point.set(this.radius * Math.cos(angle), this.radius * Math.sin(angle), 0)
  }
}

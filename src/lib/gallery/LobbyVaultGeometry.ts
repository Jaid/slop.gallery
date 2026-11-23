import {BufferGeometry, CylinderGeometry, ExtrudeGeometry, Float32BufferAttribute, Path, Shape, SphereGeometry, TorusGeometry} from 'three/webgpu'

import {mergeParts} from '../geometry.ts'
import {colliderGeometry} from './architecture.ts'
import ArcSlabGeometry from './ArcSlabGeometry.ts'
import {lobbyBalcony} from './lobbyBalcony.ts'
import lobbyVault, {glazingStart, lobbyChandeliers, vaultBays, vaultCoffers, vaultRibs} from './lobbyVault.ts'
import rosette from './rosette.ts'

/** Height of the rose window’s center above the floor. */
export const roseCenterY = lobbyVault.springY + lobbyVault.rose.rise

/** A slab bent around the vault’s axis, which runs along z at the springing height. */
const arc = (radii: readonly [number, number], angles: readonly [number, number], z: readonly [number, number], segments?: number, detail?: number) => {
  const geometry = new ArcSlabGeometry({
    radii,
    angles,
    z,
    segments,
    detail,
  })
  return geometry.translate(0, lobbyVault.springY, 0)
}
/** Both flanks of the vault: the east one as given, the west one mirrored across the crown. */
const flanks = (radii: readonly [number, number], angles: readonly [number, number], z: readonly [number, number], segments?: number) => [
  arc(radii, angles, z, segments),
  arc(radii, [Math.PI - angles[1], Math.PI - angles[0]], z, segments),
]
/**
 * A curved sheet of glass on the vault’s cylinder of radius `radius`, facing its axis, with metric UVs: u in meters along the arch,
 * v in meters along z.
 */
const glassSheet = (radius: number, angles: readonly [number, number], z: readonly [number, number], segments: number) => {
  const positions: Array<number> = []
  const normals: Array<number> = []
  const uvs: Array<number> = []
  const indices: Array<number> = []
  for (let i = 0; i <= segments; i++) {
    const angle = angles[0] + (angles[1] - angles[0]) * i / segments
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    for (const [j, value] of z.entries()) {
      positions.push(radius * cos, lobbyVault.springY + radius * sin, value)
      normals.push(-cos, -sin, 0)
      uvs.push((angle - angles[0]) * radius, j * (z[1] - z[0]))
    }
    if (i === segments) {
      continue
    }
    const base = i * 2
    indices.push(base, base + 1, base + 3, base, base + 3, base + 2)
  }
  const geometry = new BufferGeometry
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  return geometry
}
/** A flat disc of glass facing +z, with metric UVs. */
const glassDisc = (radius: number, x: number, y: number, z: number, segments: number) => {
  const positions = [x, y, z]
  const uvs = [radius, radius]
  const indices: Array<number> = []
  for (let i = 0; i <= segments; i++) {
    const angle = i / segments * Math.PI * 2
    positions.push(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, z)
    uvs.push(radius + Math.cos(angle) * radius, radius + Math.sin(angle) * radius)
    if (i < segments) {
      indices.push(0, i + 1, i + 2)
    }
  }
  const geometry = new BufferGeometry
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(positions.map((_, i) => (i % 3 === 2 ? 1 : 0)), 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  return geometry
}
/**
 * A gilt ring of the fillets’ profile lying on the soffit of the spine rib at z: a circle of radius `size` along its centerline, or
 * with `sides` a regular polygon of that apothem with flat sides facing along the arch and along the vault.
 */
const soffitRing = (size: number, z: number, sides?: number) => {
  const {bead, depth, fillet} = lobbyVault.rib
  const soffit = lobbyVault.radius - depth
  const outline = (path: Path, apothem: number) => {
    if (!sides) {
      path.absarc(0, 0, apothem, 0, Math.PI * 2)
      return
    }
    const corner = apothem / Math.cos(Math.PI / sides)
    for (let i = 0; i <= sides; i++) {
      const angle = (i + 0.5) * Math.PI * 2 / sides
      path[i === 0 ? 'moveTo' : 'lineTo'](corner * Math.cos(angle), corner * Math.sin(angle))
    }
  }
  const shape = new Shape
  outline(shape, size + bead / 2)
  const hole = new Path
  outline(hole, size - bead / 2)
  shape.holes.push(hole)
  const geometry = new ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 32,
    depth: fillet + 0.01,
  })
  // Bend the flat ring onto the soffit: x runs along the arch, y along the vault and the extrusion inward toward the axis.
  const position = geometry.getAttribute('position')
  for (let i = 0; i < position.count; i++) {
    const distance = soffit + 0.01 - position.getZ(i)
    const angle = Math.PI / 2 - position.getX(i) / soffit
    position.setXYZ(i, distance * Math.cos(angle), lobbyVault.springY + distance * Math.sin(angle), z + position.getY(i))
  }
  geometry.computeVertexNormals()
  return geometry
}
/**
 * A smooth half-cylinder along the vault’s inner face, so thrown things bounce off the coffer frames and the glass instead of
 * disappearing into the vault. Returned as vertices and indices for a triangle mesh collider.
 */
export function lobbyVaultCollision() {
  const {halfLength, radius, springY} = lobbyVault
  const shell = new ArcSlabGeometry({
    radii: [radius, radius + 0.1],
    angles: [0, Math.PI],
    z: [-halfLength, halfLength],
    segments: 32,
  })
  try {
    return colliderGeometry(shell.translate(0, springY, 0))
  } finally {
    shell.dispose()
  }
}

/**
 * Merged meshes of the Lobby’s barrel vault, relative to the room center at floor level, by material: the clad lunettes, the
 * vault’s limestone ribs and coffer frames, the plaster behind the coffers, gilding, bronze glazing bars and the glass of the
 * crown band and the rose window. `curveDetail` multiplies the segments of the glazing bars’ curves and of the rose window’s gilding.
 */
export default class LobbyVaultGeometry {
  readonly bars: BufferGeometry
  readonly clad: BufferGeometry
  readonly glass: BufferGeometry
  readonly gold: BufferGeometry
  readonly plaster: BufferGeometry
  /** clear glass of the north rose window, centered at x = 0 and {@link roseCenterY} in local space */
  readonly roseGlass: BufferGeometry
  readonly stone: BufferGeometry

  constructor(curveDetail = 1) {
    const {coffer, glazing, halfLength, outerRadius, radius, rib, rose, springY} = lobbyVault
    const clad: Array<BufferGeometry> = []
    const stone: Array<BufferGeometry> = []
    const plaster: Array<BufferGeometry> = []
    const gold: Array<BufferGeometry> = []
    const bars: Array<BufferGeometry> = []
    const glass: Array<BufferGeometry> = []
    const roseGlass: Array<BufferGeometry> = []
    const back = radius + coffer.depth
    const fullLength = [-halfLength, halfLength] as const
    // Where a chandelier hangs, the fillets open into a gilt octagon: the spine’s carry on as two of its sides and the arch’s end
    // on its corners.
    const spineBead = lobbyVault.spine / 2 - rib.beadInset
    const archBead = rib.width / 2 - rib.beadInset
    const ringAngle = spineBead / (radius - rib.depth)
    const breaks = [-halfLength, ...lobbyChandeliers.offsets.flatMap(offset => [offset - archBead, offset + archBead]), halfLength]
    const spineSpans = breaks.filter((_, i) => i % 2 === 0).map((start, i) => [start, breaks[i * 2 + 1]] as const)
    for (const offset of lobbyChandeliers.offsets) {
      gold.push(soffitRing(spineBead, offset, 8))
    }
    for (const {z} of vaultRibs()) {
      const z0 = z - rib.width / 2
      const z1 = z + rib.width / 2
      // The arches’ fillets end on the curbs’ inner fillets, so they meet in a T.
      const filletEnd = (rib.width / 2 - rib.beadInset) / (radius - rib.depth)
      const filletSpan = [glazingStart + filletEnd, Math.PI - glazingStart - filletEnd] as const
      const hung = lobbyChandeliers.offsets.some(offset => Math.abs(offset - z) < 0.01)
      const filletSpans = hung ? [[filletSpan[0], Math.PI / 2 - ringAngle], [Math.PI / 2 + ringAngle, filletSpan[1]]] as const : [filletSpan]
      // The ribs span the glazed part between the curbs.
      stone.push(arc([radius - rib.depth, back], [glazingStart, Math.PI - glazingStart], [z0, z1]))
      for (const edge of [-1, 1]) {
        const beadZ = z + edge * (rib.width / 2 - rib.beadInset)
        for (const span of filletSpans) {
          gold.push(arc([radius - rib.depth - rib.fillet, radius - rib.depth + 0.01], span, [beadZ - rib.bead / 2, beadZ + rib.bead / 2]))
        }
      }
    }
    // Longitudinal ribs of the same profile run from end to end and divide the glazed span: curbs along its edges, a purlin on
    // either side and a wider spine along the crown.
    const longitudinalRibs = [
      [glazingStart, rib.width],
      [Math.PI / 2 - glazing.purlin, rib.width],
      [Math.PI / 2, lobbyVault.spine],
      [Math.PI / 2 + glazing.purlin, rib.width],
      [Math.PI - glazingStart, rib.width],
    ] as const
    for (const [angle, width] of longitudinalRibs) {
      const half = width / 2 / radius
      stone.push(arc([radius - rib.depth, back], [angle - half, angle + half], fullLength))
      for (const edge of [-1, 1]) {
        const beadAngle = angle + edge * (width / 2 - rib.beadInset) / (radius - rib.depth)
        const beadWidth = rib.bead / 2 / (radius - rib.depth)
        for (const span of angle === Math.PI / 2 ? spineSpans : [fullLength]) {
          gold.push(arc([radius - rib.depth - rib.fillet, radius - rib.depth + 0.01], [beadAngle - beadWidth, beadAngle + beadWidth], span, 1))
        }
      }
    }
    // The glazed fields between the longitudinal ribs, as angle ranges.
    const fields = longitudinalRibs.slice(1).map(([angle, width], i) => {
      const [previous, previousWidth] = longitudinalRibs[i]
      return [previous + previousWidth / 2 / radius, angle - width / 2 / radius] as const
    })
    // One continuous sheet of glass behind the whole glazed span.
    glass.push(glassSheet(back, [glazingStart, Math.PI - glazingStart], fullLength, 96))
    // The coffered flanks: a row of square coffers on each, sunk behind limestone frames, each lined with a gilt molding and with
    // a gilt rosette in the middle.
    plaster.push(...flanks([back, outerRadius], [0, glazingStart], fullLength))
    const coffers = vaultCoffers()
    const [a0, a1] = coffers.angles
    stone.push(...flanks([radius, back], [0, a0], fullLength), ...flanks([radius, back], [a1, coffers.top], fullLength))
    stone.push(...flanks([radius, back], coffers.angles, [-halfLength, -halfLength + coffer.frame]))
    const template = rosette(coffer.rosette)
    const step = coffer.frame * 0.4
    const stepWidth = step / radius
    const stepRadii = [radius + coffer.depth * 0.45, back] as const
    const moldingRadii = [back - 0.025, back] as const
    const moldingWidth = coffer.molding / back
    const moldingInset = (step + coffer.moldingInset) / back
    for (const [z0, z1] of coffers.z) {
      stone.push(...flanks([radius, back], coffers.angles, [z1, z1 + coffer.frame]))
      // A shallow step lines each field, so the coffer reads as sunk in two stages.
      stone.push(...flanks(stepRadii, [a0, a0 + stepWidth], [z0, z1], 1))
      stone.push(...flanks(stepRadii, [a1 - stepWidth, a1], [z0, z1], 1))
      stone.push(...flanks(stepRadii, [a0 + stepWidth, a1 - stepWidth], [z0, z0 + step]))
      stone.push(...flanks(stepRadii, [a0 + stepWidth, a1 - stepWidth], [z1 - step, z1]))
      // The gilt molding runs around the field a little inside the step.
      const m0 = a0 + moldingInset
      const m1 = a1 - moldingInset
      const n0 = z0 + step + coffer.moldingInset
      const n1 = z1 - step - coffer.moldingInset
      gold.push(...flanks(moldingRadii, [m0, m0 + moldingWidth], [n0, n1], 1), ...flanks(moldingRadii, [m1 - moldingWidth, m1], [n0, n1], 1))
      gold.push(...flanks(moldingRadii, [m0 + moldingWidth, m1 - moldingWidth], [n0, n0 + coffer.molding], 1), ...flanks(moldingRadii, [m0 + moldingWidth, m1 - moldingWidth], [n1 - coffer.molding, n1], 1))
      const angle = (a0 + a1) / 2
      for (const mirrored of [angle, Math.PI - angle]) {
        const flower = template.clone()
        // The rosette’s axis turns from +y toward the vault’s axis, then it moves onto the plaster in the middle of the field.
        flower.rotateZ(mirrored + Math.PI / 2).translate(back * Math.cos(mirrored), springY + back * Math.sin(mirrored), (z0 + z1) / 2)
        gold.push(flower)
      }
    }
    for (const [north, south] of vaultBays()) {
      // Every glazed field of the bay: a heavy bronze rim, a grid of bars into roughly square panes and a ring in the middle.
      const barRadii = [back - glazing.bar.depth, back] as const
      const barWidth = glazing.bar.width / back
      const rimWidth = glazing.rim / back
      for (const [from, to] of fields) {
        bars.push(arc(barRadii, [from, to], [north, north + glazing.rim], undefined, curveDetail), arc(barRadii, [from, to], [south - glazing.rim, south], undefined, curveDetail))
        bars.push(arc(barRadii, [from, from + rimWidth], [north, south], 1), arc(barRadii, [to - rimWidth, to], [north, south], 1))
        const across = Math.max(2, Math.round((to - from) * back / glazing.pane))
        for (let i = 1; i < across; i++) {
          const angle = from + (to - from) * i / across
          bars.push(arc(barRadii, [angle - barWidth / 2, angle + barWidth / 2], [north, south], 1))
        }
        const along = Math.max(2, Math.round((south - north) / glazing.pane))
        for (let i = 1; i < along; i++) {
          const z = north + (south - north) * i / along
          bars.push(arc(barRadii, [from, to], [z - glazing.bar.width / 2, z + glazing.bar.width / 2], undefined, curveDetail))
        }
        const middle = (from + to) / 2
        const ringRadius = back - glazing.bar.depth / 2
        const medallion = new TorusGeometry(glazing.medallion, 0.022, 6 * curveDetail, 16 * curveDetail)
        bars.push(medallion.rotateX(Math.PI / 2).rotateZ(middle - Math.PI / 2).translate(ringRadius * Math.cos(middle), springY + ringRadius * Math.sin(middle), (north + south) / 2))
      }
    }
    template.dispose()
    // The south lunette takes the same arc as the north, but starts above the raised wall with the balcony door.
    const roseY = roseCenterY
    for (const side of [-1, 1]) {
      const windowed = side < 0
      const thickness = windowed ? rose.lunetteThickness : lobbyVault.southLunetteThickness
      const parts = {
        clad: [] as Array<BufferGeometry>,
        stone: [] as Array<BufferGeometry>,
        gold: [] as Array<BufferGeometry>,
        bars: [] as Array<BufferGeometry>,
        roseGlass: [] as Array<BufferGeometry>,
      }
      const lunette = new Shape
      const foot = windowed ? springY : lobbyBalcony.wallTop
      const footAngle = Math.asin((foot - springY) / outerRadius)
      lunette.absarc(0, springY, outerRadius, Math.PI - footAngle, footAngle, true)
      lunette.closePath()
      if (windowed) {
        const opening = new Path
        opening.absarc(0, roseY, rose.radius, 0, Math.PI * 2, true)
        lunette.holes.push(opening)
      }
      const wall = new ExtrudeGeometry(lunette, {
        depth: thickness,
        bevelEnabled: false,
        curveSegments: 96,
      })
      // Built for the north end, facing +z into the room; the south one is the same turned half around.
      parts.clad.push(wall.translate(0, 0, -halfLength - thickness))
      if (windowed) {
        const face = -halfLength
        const middle = face - rose.lunetteThickness / 2
        const ring = (size: number, tube: number, z: number, segments: number, x = 0, y = 0, sides = 6) => {
          const torus = new TorusGeometry(size, tube, sides, segments)
          return torus.translate(x, roseY + y, z)
        }
        // Stepped stone archivolts frame the opening on the lunette’s face, between a gilt ring outside and one lining the opening.
        parts.stone.push(ring(rose.radius + 0.33, 0.16, face - 0.04, 36, 0, 0, 8), ring(rose.radius + 0.12, 0.13, face - 0.01, 36, 0, 0, 8))
        parts.gold.push(ring(rose.radius + 0.49, 0.05, face - 0.01, 36 * curveDetail, 0, 0, 6 * curveDetail), ring(rose.radius - 0.02, 0.06, face - 0.02, 36 * curveDetail, 0, 0, 6 * curveDetail))
        // A gilt hub ring and boss stand proud of the bronze wheel.
        parts.gold.push(ring(rose.hub, 0.07, middle + 0.08, 24 * curveDetail, 0, 0, 6 * curveDetail))
        const boss = new SphereGeometry(0.28, 12 * curveDetail, 8 * curveDetail)
        parts.gold.push(boss.scale(1, 1, 0.48).translate(0, roseY, middle + 0.08))
        // Bronze spokes from the hub ring to the rim, crossed by a wheel, with a small ring between each pair of spokes at the rim.
        const length = rose.radius - rose.hub
        for (let i = 0; i < rose.spokes; i++) {
          const angle = i * Math.PI * 2 / rose.spokes
          const spoke = new CylinderGeometry(rose.bar, rose.bar, length, 6 * curveDetail)
          parts.bars.push(spoke.translate(0, rose.hub + length / 2, middle).rotateZ(angle - Math.PI / 2).translate(0, roseY, 0))
          const between = angle + Math.PI / rose.spokes
          const distance = rose.radius - rose.foil - 0.1
          parts.bars.push(ring(rose.foil, rose.bar * 0.8, middle, 12 * curveDetail, distance * Math.cos(between), distance * Math.sin(between), 6 * curveDetail))
        }
        parts.bars.push(ring(rose.wheel, rose.bar * 1.15, middle, 28 * curveDetail, 0, 0, 6 * curveDetail))
        parts.roseGlass.push(glassDisc(rose.radius, 0, roseY, middle, 96))
      }
      const targets = {
        clad,
        stone,
        gold,
        bars,
        roseGlass,
      }
      for (const [key, list] of Object.entries(parts) as Array<[keyof typeof parts, Array<BufferGeometry>]>) {
        for (const part of list) {
          if (side > 0) {
            part.rotateY(Math.PI)
          }
          targets[key].push(part)
        }
      }
    }
    this.clad = mergeParts(clad)
    this.stone = mergeParts(stone)
    this.plaster = mergeParts(plaster)
    this.gold = mergeParts(gold)
    this.bars = mergeParts(bars)
    this.glass = mergeParts(glass)
    this.roseGlass = mergeParts(roseGlass)
  }

  dispose() {
    for (const geometry of [this.bars, this.clad, this.glass, this.gold, this.plaster, this.roseGlass, this.stone]) {
      geometry.dispose()
    }
  }
}

import type {BufferGeometry} from 'three/webgpu'

import {BoxGeometry, CylinderGeometry, LatheGeometry, Matrix4, Quaternion, SphereGeometry, TorusGeometry, Vector2, Vector3} from 'three/webgpu'

import {mergeParts} from '../geometry.ts'
import {colliderGeometry, wallFace} from './architecture.ts'
import forge, {forgeVestibule} from './forge.ts'
import forgeCeiling, {forgeCupolaApexY, forgeCupolaEavesY, forgeCupolaSection, forgeCupolaSillY, forgeCupolaTopY, forgeDeckRing, forgeMonitorEavesY, forgeMonitorRidgeY, forgeMonitorSillY, forgePendantSpots, forgeRoofSpringHalf, forgeRoofUndersideY, forgeSkylightRoofY, forgeTrussArchY, forgeTrussTieHalfX} from './forgeCeiling.ts'
import TriangleSoup from './TriangleSoup.ts'

type Size = readonly [width: number, depth: number]
type Ring = readonly [hx: number, hz: number, y: number]

const up = new Vector3(0, 1, 0)
const cupolaSegments = 28
/**
 * A welded collision mesh lining the Forge’s main ceiling underside, monitor curb, vertical clerestory glazing, pitched skylight roof and ventilator ridge cap, so thrown props bounce off cleanly.
 */
export function forgeCeilingCollision(size: Size = forge.size) {
  const [sx, sz] = forgeRoofSpringHalf(size)
  const [faceX, faceZ] = [size[0] / 2 - wallFace, size[1] / 2 - wallFace]
  const {baseY, deck, monitor} = forgeCeiling
  const {halfX, halfZ, ventilator} = monitor
  const soup = new TriangleSoup
  const deckRings: Array<Ring> = Array.from({length: deck.segments + 1}, (_, i) => forgeDeckRing(i / deck.segments, size))
  const ventY = forgeSkylightRoofY(ventilator.halfX)
  // Trace inside surface continuously from wall faces -> ledge -> sloped deck -> curb -> vertical clerestory -> pitched skylight -> flat ridge cap
  const rings: Array<Ring> = [
    [faceX, faceZ, baseY],
    [sx, sz, baseY],
    ...deckRings,
    [halfX, halfZ, forgeMonitorSillY],
    [halfX, halfZ, forgeMonitorEavesY],
    [ventilator.halfX, halfZ, ventY],
  ]
  const corners = rings.map(rectCorners)
  for (let i = 0; i < rings.length - 1; i++) {
    for (let side = 0; side < 4; side++) {
      const a = corners[i][side]
      const b = corners[i][(side + 1) % 4]
      const c = corners[i + 1][(side + 1) % 4]
      const d = corners[i + 1][side]
      const n = b.clone().sub(a).cross(d.clone().sub(a)).normalize()
      addRingQuad(soup, a, b, c, d, n, n, [0, 0], [1, 0], [1, 1], [0, 1])
    }
  }
  // Close the narrow ridge ventilator opening at the top
  const top = corners.at(-1)!
  const down = new Vector3(0, -1, 0)
  addRingQuad(soup, top[0], top[1], top[2], top[3], down, down, [0, 0], [1, 0], [1, 1], [0, 1])
  const geometry = soup.toGeometry()
  try {
    return colliderGeometry(geometry)
  } finally {
    geometry.dispose()
  }
}
/** A welded collision surface lining the vestibule’s cupola, oculus curb, glazed lantern drum and conical roof cap. */
export function forgeVestibuleCupolaCollision() {
  const faceR = forgeVestibule.radius - wallFace
  const {baseY, cupola} = forgeCeiling
  const springR = faceR - cupola.ledge
  const domeSteps = 8
  const innerDome = Array.from({length: domeSteps + 1}, (_, i) => forgeCupolaSection(i / domeSteps * Math.PI / 2))
  const profile: Array<readonly [number, number]> = [
    [faceR, baseY],
    [springR, baseY],
    ...innerDome,
    [cupola.oculusRadius, forgeCupolaSillY],
    [cupola.oculusRadius, forgeCupolaEavesY],
    [cupola.capRadius, forgeCupolaApexY],
  ]
  const soup = new TriangleSoup
  const rings = profile.map(([r, y]) => Array.from({length: cupolaSegments}, (_, s) => {
    const angle = s / cupolaSegments * Math.PI * 2
    return new Vector3(Math.cos(angle) * r, y, -Math.sin(angle) * r)
  }))
  for (let i = 0; i < profile.length - 1; i++) {
    for (let s = 0; s < cupolaSegments; s++) {
      const nextS = (s + 1) % cupolaSegments
      const a = rings[i][s]
      const b = rings[i][nextS]
      const c = rings[i + 1][nextS]
      const d = rings[i + 1][s]
      const n = b.clone().sub(a).cross(d.clone().sub(a)).normalize()
      addRingQuad(soup, a, b, c, d, n, n, [0, 0], [1, 0], [1, 1], [0, 1])
    }
  }
  // Close the cap disc cleanly at the apex with a triangle fan so nothing passes through the center.
  const apexRing = rings.at(-1)!
  const down = new Vector3(0, -1, 0)
  const centerIndex = soup.add(new Vector3(0, forgeCupolaApexY, 0), down, [0.5, 0.5])
  for (let s = 0; s < cupolaSegments; s++) {
    const a = soup.add(apexRing[s], down, [0, 0])
    const b = soup.add(apexRing[(s + 1) % cupolaSegments], down, [1, 0])
    soup.triangle(a, b, centerIndex)
  }
  const geometry = soup.toGeometry()
  try {
    return colliderGeometry(geometry)
  } finally {
    geometry.dispose()
  }
}
/** Adds a box centered at `position`, turned by `rotation` if given, into `target`. */
function pushBox(target: Array<BufferGeometry>, size: readonly [number, number, number], position: readonly [number, number, number], rotation?: readonly [number, number, number]) {
  const box = new BoxGeometry(size[0], size[1], size[2])
  if (rotation) {
    box.rotateX(rotation[0]).rotateY(rotation[1]).rotateZ(rotation[2])
  }
  box.translate(position[0], position[1], position[2])
  target.push(box)
}
/** Adds a cylinder (rod or bar) spanning from `from` to `to`, with given radius and radial segments. */
function pushRod(target: Array<BufferGeometry>, from: Vector3, to: Vector3, radius: number, segments = 8) {
  const delta = to.clone().sub(from)
  const length = delta.length()
  if (length < 1e-5) {
    return
  }
  const rod = new CylinderGeometry(radius, radius, length, segments, 1)
  const orientation = new Quaternion
  orientation.setFromUnitVectors(up, delta.divideScalar(length))
  const transform = new Matrix4
  transform.compose(from.clone().add(to).multiplyScalar(0.5), orientation, new Vector3(1, 1, 1))
  rod.applyMatrix4(transform)
  target.push(rod)
}
/** Adds a rectangular-section beam spanning from `from` to `to`, with width along `sideAxis` and depth perpendicular to both. */
function pushBeam(target: Array<BufferGeometry>, from: Vector3, to: Vector3, width: number, depth: number, sideAxis = new Vector3(0, 0, 1)) {
  const delta = to.clone().sub(from)
  const length = delta.length()
  if (length < 1e-5) {
    return
  }
  const yAxis = delta.divideScalar(length)
  const xAxis = sideAxis.clone().sub(yAxis.clone().multiplyScalar(sideAxis.dot(yAxis)))
  if (xAxis.lengthSq() < 1e-8) {
    xAxis.set(1, 0, 0)
  } else {
    xAxis.normalize()
  }
  const zAxis = new Vector3
  zAxis.crossVectors(xAxis, yAxis).normalize()
  const basis = new Matrix4
  basis.makeBasis(xAxis, yAxis, zAxis)
  basis.setPosition(from.clone().add(to).multiplyScalar(0.5))
  const beam = new BoxGeometry(width, length, depth)
  beam.applyMatrix4(basis)
  target.push(beam)
}
/**
 * Adds a quad between four ring corners `[c0, c1, c2, c3]` (two along one ring, two along the next) into `soup`, facing outward along the cross product `(c1 - c0) × (c3 - c0)` (flipped by `outwardSign`).
 */
function addRingQuad(soup: TriangleSoup, a: Vector3, b: Vector3, c: Vector3, d: Vector3, normalA: Vector3, normalB: Vector3, uvA: readonly [number, number], uvB: readonly [number, number], uvC: readonly [number, number], uvD: readonly [number, number]) {
  const ia = soup.add(a, normalA, uvA)
  const ib = soup.add(b, normalA, uvB)
  const ic = soup.add(c, normalB, uvC)
  const id = soup.add(d, normalB, uvD)
  soup.quad(ia, ib, ic, id)
}
/** Corners of a horizontal rectangle `[-hx, +hx] × [-hz, +hz]` at height `y`, ordered CCW viewed from above: SW, SE, NE, NW. */
function rectCorners([hx, hz, y]: Ring): readonly [Vector3, Vector3, Vector3, Vector3] {
  return [
    new Vector3(-hx, y, hz),
    new Vector3(hx, y, hz),
    new Vector3(hx, y, -hz),
    new Vector3(-hx, y, -hz),
  ]
}
/**
 * Lofts a closed profile of horizontal rectangular rings into a watertight solid split across two soups (`plaster` for the vaulted ceiling slopes, `stone` for the perimeter soffit, bluestone curb and outer shell).
 * Walking the profile from `ring[i]` to `ring[i + 1]` keeps the solid’s interior to the left of `(profile_step × ccw_edge)`, so outward normals face into the room on the underside and into the sky on the roof back.
 */
function buildMainShell(size: Size) {
  const [outerX, outerZ] = [size[0] / 2, size[1] / 2]
  const [springX, springZ] = forgeRoofSpringHalf(size)
  const {baseY, deck, monitor, springY} = forgeCeiling
  const {curbThickness, halfX, halfZ} = monitor
  const plaster = new TriangleSoup
  const stone = new TriangleSoup
  // Build the ordered closed ring loop:
  // 0: outer bottom -> 1: ledge inner bottom -> 2: ledge inner top -> 2..2+S: vaulted plaster slope -> curb top -> outer curb -> outer roof -> outer ledge -> outer wall top -> back to 0.
  const deckRings: Array<Ring> = Array.from({length: deck.segments + 1}, (_, i) => forgeDeckRing(i / deck.segments, size))
  // Outer roof shoulder stays well inside x = 5.50 to clear the Lobby vault’s 0.445 m overhang cleanly above y = 5.80.
  const outerShoulderX = Math.min(outerX - 0.5, springX + 0.1)
  const outerShoulderZ = Math.min(outerZ - 0.5, springZ + 0.1)
  const rings: Array<{
    material: 'plaster' | 'stone'
    ring: Ring
    smooth?: boolean
  }> = [
    {
      ring: [outerX, outerZ, baseY],
      material: 'stone',
    },
    {
      ring: [springX, springZ, baseY],
      material: 'stone',
    },
    ...deckRings.map((ring, i) => ({
      ring,
      material: i < deck.segments ? 'plaster' as const : 'stone' as const,
      smooth: i > 0 && i < deck.segments,
    })),
    {
      ring: [halfX, halfZ, forgeMonitorSillY],
      material: 'stone',
    },
    {
      ring: [halfX + curbThickness, halfZ + curbThickness, forgeMonitorSillY],
      material: 'stone',
    },
    {
      ring: [outerShoulderX, outerShoulderZ, springY + deck.shell],
      material: 'stone',
    },
    {
      ring: [outerShoulderX, outerShoulderZ, springY - 0.01],
      material: 'stone',
    },
    {
      ring: [outerX, outerZ, springY - 0.01],
      material: 'stone',
    },
  ]
  const corners = rings.map(({ring}) => rectCorners(ring))
  const total = rings.length
  const faceNormal = (side: number, i: number) => {
    const next = (i + 1) % total
    const a = corners[i][side]
    const b = corners[i][(side + 1) % 4]
    const d = corners[next][side]
    // Along edge (b - a) CCW around the room, crossed with profile step (d - a): points outward from the solid!
    return b.clone().sub(a).cross(d.clone().sub(a)).normalize()
  }
  const travel: Array<number> = [0]
  for (let i = 1; i <= total; i++) {
    const prev = rings[i - 1].ring
    const curr = rings[i % total].ring
    travel.push(travel[i - 1] + Math.hypot(curr[0] - prev[0], curr[2] - prev[2]))
  }
  for (let i = 0; i < total; i++) {
    const next = (i + 1) % total
    const soup = rings[i].material === 'plaster' ? plaster : stone
    for (let side = 0; side < 4; side++) {
      const a = corners[i][side]
      const b = corners[i][(side + 1) % 4]
      const c = corners[next][(side + 1) % 4]
      const d = corners[next][side]
      const segNormal = faceNormal(side, i)
      const nA = rings[i].smooth ? faceNormal(side, (i - 1 + total) % total).add(segNormal).normalize() : segNormal
      const nB = rings[next].smooth ? segNormal.clone().add(faceNormal(side, next)).normalize() : segNormal
      const widthA = a.distanceTo(b)
      const widthB = d.distanceTo(c)
      addRingQuad(soup, a, b, c, d, nA, nB, [0, travel[i]], [widthA, travel[i]], [widthB, travel[i + 1]], [0, travel[i + 1]])
    }
  }
  return {
    plaster: plaster.toGeometry(),
    stone: stone.toGeometry(),
  }
}
/** Adds one open-web parabolic wrought-iron arch truss and its brass bosses & turnbuckle at local `z`. */
function addArchTruss(iron: Array<BufferGeometry>, brass: Array<BufferGeometry>, z: number, size: Size) {
  const [sx] = forgeRoofSpringHalf(size)
  const faceX = size[0] / 2 - wallFace
  const {baseY, monitor, trusses} = forgeCeiling
  const {halfX} = monitor
  const tieHalf = forgeTrussTieHalfX(size)
  // 1. Stepped wrought-iron wall corbel brackets under the arch springings
  for (const side of [-1, 1]) {
    const corbelDepth = faceX - sx
    pushBox(iron, [corbelDepth, 0.28, 0.22], [side * (sx + corbelDepth / 2), baseY - 0.14, z])
    pushBox(iron, [corbelDepth * 0.65, 0.24, 0.18], [side * (faceX - corbelDepth * 0.325), baseY - 0.38, z])
    // Decorative corbel knee brace
    pushBeam(iron, new Vector3(side * faceX, baseY - 0.52, z), new Vector3(side * (sx + 0.04), trusses.springY, z), 0.08, 0.09)
  }
  // 2. Parabolic lower arch chord (14 smooth segments across the span, with inner & outer riveted flanges)
  const archSegments = 14
  for (let i = 0; i < archSegments; i++) {
    const x0 = -sx + 2 * sx * i / archSegments
    const x1 = -sx + 2 * sx * (i + 1) / archSegments
    const p0 = new Vector3(x0, forgeTrussArchY(x0, size), z)
    const p1 = new Vector3(x1, forgeTrussArchY(x1, size), z)
    pushBeam(iron, p0, p1, 0.09, 0.16)
    // Wider bottom flange plate giving an authentic riveted I-beam silhouette
    pushBeam(iron, p0.clone().add(new Vector3(0, -0.075, 0)), p1.clone().add(new Vector3(0, -0.075, 0)), 0.15, 0.028)
  }
  // 3. Sloped principal rafters hugging the limewashed roof underside up to the monitor curb
  for (const side of [-1, 1]) {
    const rafterSteps = forgeCeiling.deck.segments
    for (let i = 0; i < rafterSteps; i++) {
      const [hx0, , y0] = forgeDeckRing(i / rafterSteps, size)
      const [hx1, , y1] = forgeDeckRing((i + 1) / rafterSteps, size)
      pushBeam(iron, new Vector3(side * hx0, y0 - 0.05, z), new Vector3(side * hx1, y1 - 0.05, z), 0.1, 0.12)
    }
    // Short vertical strut connecting the arch shoulder to the monitor curb corner
    pushBeam(iron, new Vector3(side * halfX, forgeTrussArchY(halfX, size), z), new Vector3(side * halfX, forgeCeiling.deck.topY, z), 0.08, 0.09)
  }
  // 4. Three graduated ornamental circular wrought-iron spandrel rings per side between the arch and the sloped rafter
  const ringXs = [sx - 0.65, (sx + halfX) * 0.5, halfX + 0.42] as const
  for (const side of [-1, 1]) {
    for (const rx of ringXs) {
      const t = (sx - rx) / (sx - halfX)
      const roofY = forgeDeckRing(t, size)[2] - 0.09
      const archY = forgeTrussArchY(rx, size) + 0.07
      const radius = (roofY - archY) * 0.5
      if (radius < 0.08) {
        continue
      }
      const ring = new TorusGeometry(radius, 0.024, 6, 14)
      ring.translate(side * rx, (roofY + archY) * 0.5, z)
      iron.push(ring)
    }
  }
  // 5. Horizontal tension tie-rod spanning between the arch shoulders, plus hammered-brass turnbuckle & anchor collars
  pushRod(iron, new Vector3(-tieHalf, trusses.tieY, z), new Vector3(tieHalf, trusses.tieY, z), 0.022, 6)
  // Central brass turnbuckle
  const turnbuckle = new CylinderGeometry(0.052, 0.052, 0.34, 8)
  turnbuckle.rotateZ(Math.PI / 2).translate(0, trusses.tieY, z)
  brass.push(turnbuckle)
  for (const dx of [-0.2, 0.2]) {
    const nut = new CylinderGeometry(0.04, 0.04, 0.05, 6)
    nut.rotateZ(Math.PI / 2).translate(dx, trusses.tieY, z)
    brass.push(nut)
  }
  // Anchor collars where the tie-rod meets the arch and where vertical hangers drop from the monitor curb
  for (const side of [-1, 1]) {
    const anchor = new SphereGeometry(0.058, 8, 6)
    anchor.translate(side * tieHalf, trusses.tieY, z)
    brass.push(anchor)
    // Vertical tension hanger from the monitor curb down to the tie-rod
    pushRod(iron, new Vector3(side * halfX, trusses.tieY, z), new Vector3(side * halfX, forgeCeiling.deck.topY, z), 0.017, 6)
    const collar = new SphereGeometry(0.044, 6, 5)
    collar.translate(side * halfX, trusses.tieY, z)
    brass.push(collar)
  }
  // 6. Vertical king-rod rising from the turnbuckle through the arch crown all the way to the monitor ridge
  pushRod(iron, new Vector3(0, trusses.tieY, z), new Vector3(0, forgeMonitorRidgeY - 0.04, z), 0.02, 6)
  // Hammered-brass boss medallion framing the crown intersection
  const bossRing = new TorusGeometry(0.14, 0.032, 6, 12)
  bossRing.translate(0, trusses.crownY, z)
  brass.push(bossRing)
  const bossCore = new CylinderGeometry(0.075, 0.075, 0.13, 10)
  bossCore.rotateX(Math.PI / 2).translate(0, trusses.crownY, z)
  brass.push(bossCore)
  // 7. Diagonal iron queen-struts fanning from the crown boss up to the monitor eaves, plus horizontal eaves collar tie
  for (const side of [-1, 1]) {
    pushRod(iron, new Vector3(0, trusses.crownY, z), new Vector3(side * halfX, forgeMonitorEavesY, z), 0.02, 6)
  }
  // Small brass boss at the skylight ridge junction
  const ridgeBoss = new SphereGeometry(0.055, 6, 5)
  ridgeBoss.translate(0, forgeMonitorRidgeY - 0.04, z)
  brass.push(ridgeBoss)
}
/** Adds the raised clerestory monitor’s mullions, transoms, gable frames, pitched skylight rafters, ventilator hood and glazing. */
function addMonitor(iron: Array<BufferGeometry>, brass: Array<BufferGeometry>, windowGlass: TriangleSoup, skylightGlass: TriangleSoup) {
  const {endBays, halfX, halfZ, roofRows, sideBays, ventilator} = forgeCeiling.monitor
  const sillY = forgeMonitorSillY
  const eavesY = forgeMonitorEavesY
  const ridgeY = forgeMonitorRidgeY
  const midY = (sillY + eavesY) * 0.5
  const glassX = halfX + 0.06
  const glassZ = halfZ + 0.06
  // Perimeter eaves beam & sill angle-iron frame
  for (const side of [-1, 1]) {
    pushBox(iron, [0.14, 0.14, halfZ * 2 + 0.18], [side * (halfX + 0.05), eavesY, 0])
    pushBox(iron, [0.12, 0.07, halfZ * 2 + 0.16], [side * (halfX + 0.05), sillY + 0.035, 0])
    // Subtle hammered-brass trim fillet along the inner eaves line
    pushBox(brass, [0.035, 0.045, halfZ * 2], [side * (halfX - 0.015), eavesY - 0.055, 0])
    // Horizontal transom along east & west clerestory walls
    pushBox(iron, [0.06, 0.05, halfZ * 2], [side * glassX, midY, 0])
  }
  for (const end of [-1, 1]) {
    pushBox(iron, [halfX * 2 + 0.18, 0.14, 0.14], [0, eavesY, end * (halfZ + 0.05)])
    pushBox(iron, [halfX * 2 + 0.16, 0.07, 0.12], [0, sillY + 0.035, end * (halfZ + 0.05)])
    pushBox(brass, [halfX * 2, 0.045, 0.035], [0, eavesY - 0.055, end * (halfZ - 0.015)])
    pushBox(iron, [halfX * 2, 0.05, 0.06], [0, midY, end * glassZ])
  }
  // Vertical clerestory mullions & skylight rafters along z (sideBays = 8 -> 9 stations from -halfZ to +halfZ)
  for (let i = 0; i <= sideBays; i++) {
    const z = -halfZ + 2 * halfZ * i / sideBays
    const isEnd = i === 0 || i === sideBays
    const isTruss = forgeCeiling.trusses.offsets.some(offset => Math.abs(offset - z) < 0.05)
    const postSize = isEnd ? 0.13 : (isTruss ? 0.105 : 0.055)
    for (const side of [-1, 1]) {
      pushBox(iron, [postSize, eavesY - sillY, postSize], [side * glassX, midY, z])
      // Pitched skylight rafter from eaves up to the ventilator curb
      const rafterW = isEnd ? 0.11 : (isTruss ? 0.085 : 0.048)
      const rafterD = isEnd ? 0.13 : (isTruss ? 0.105 : 0.065)
      pushBeam(iron, new Vector3(side * glassX, eavesY, z), new Vector3(side * ventilator.halfX, forgeSkylightRoofY(ventilator.halfX), z), rafterW, rafterD)
    }
  }
  // End clerestory mullions & triangular gable ironwork at north & south ends
  for (const end of [-1, 1]) {
    const z = end * glassZ
    for (let i = 1; i < endBays; i++) {
      const x = -halfX + 2 * halfX * i / endBays
      const isCenter = i === endBays / 2
      pushBox(iron, [isCenter ? 0.09 : 0.055, eavesY - sillY, isCenter ? 0.09 : 0.055], [x, midY, z])
      // Vertical gable mullion rising from eaves into the pitched gable triangle
      const gableTop = forgeSkylightRoofY(x)
      pushBox(iron, [isCenter ? 0.09 : 0.05, gableTop - eavesY, isCenter ? 0.09 : 0.05], [x, (eavesY + gableTop) * 0.5, z])
    }
    // Gable peak collar & ornamental brass medallion in the center of each gable triangle
    const gableRing = new TorusGeometry(0.24, 0.028, 6, 14)
    gableRing.translate(0, eavesY + 0.45, z)
    brass.push(gableRing)
  }
  // Pitched skylight purlins along z (dividing each roof slope into roofRows panes)
  const ventY = forgeSkylightRoofY(ventilator.halfX)
  for (const side of [-1, 1]) {
    for (let row = 1; row < roofRows; row++) {
      const t = row / roofRows
      const px = side * (glassX + (ventilator.halfX - glassX) * t)
      const py = eavesY + (ventY - eavesY) * t
      pushBox(iron, [0.05, 0.055, halfZ * 2 + 0.08], [px, py, 0])
    }
    // Ventilator curb beam where the skylight glazing meets the raised ridge hood
    pushBox(iron, [0.08, 0.14, halfZ * 2 + 0.18], [side * ventilator.halfX, ventY + 0.05, 0])
  }
  // Sleek wrought-iron ridge beam & hammered-brass cresting crowning the pitched skylight apex without casting a heavy shadow stripe down the hall
  const ridgeLen = halfZ * 2 + 0.22
  pushBox(iron, [ventilator.halfX * 2 + 0.04, 0.14, ridgeLen], [0, ridgeY + 0.02, 0])
  pushBox(brass, [0.07, 0.065, ridgeLen + 0.08], [0, ridgeY + ventilator.rise - 0.03, 0])
  // Brass crest finials at both gable peaks
  for (const end of [-1, 1]) {
    const spike = new CylinderGeometry(0.014, 0.048, 0.22, 8)
    spike.translate(0, ridgeY + ventilator.rise + 0.1, end * (halfZ + 0.08))
    brass.push(spike)
    const orb = new SphereGeometry(0.058, 8, 6)
    orb.translate(0, ridgeY + ventilator.rise + 0.01, end * (halfZ + 0.08))
    brass.push(orb)
  }
  // Clerestory vertical window glass (east, west, north, south) in metric UVs
  const glassH = eavesY - sillY
  for (const side of [-1, 1]) {
    const nx = new Vector3(-side, 0, 0)
    const a = new Vector3(side * glassX, sillY, -glassZ)
    const b = new Vector3(side * glassX, sillY, glassZ)
    const c = new Vector3(side * glassX, eavesY, glassZ)
    const d = new Vector3(side * glassX, eavesY, -glassZ)
    addRingQuad(windowGlass, a, b, c, d, nx, nx, [0, 0], [glassZ * 2, 0], [glassZ * 2, glassH], [0, glassH])
  }
  for (const end of [-1, 1]) {
    const nz = new Vector3(0, 0, -end)
    // Lower rectangular clerestory strip
    const a = new Vector3(-glassX, sillY, end * glassZ)
    const b = new Vector3(glassX, sillY, end * glassZ)
    const c = new Vector3(glassX, eavesY, end * glassZ)
    const d = new Vector3(-glassX, eavesY, end * glassZ)
    addRingQuad(windowGlass, a, b, c, d, nz, nz, [0, 0], [glassX * 2, 0], [glassX * 2, glassH], [0, glassH])
    // Upper triangular glazed gable
    const gl = windowGlass.add(new Vector3(-glassX, eavesY, end * glassZ), nz, [0, 0])
    const gr = windowGlass.add(new Vector3(glassX, eavesY, end * glassZ), nz, [glassX * 2, 0])
    const gt = windowGlass.add(new Vector3(0, ridgeY, end * glassZ), nz, [glassX, ridgeY - eavesY])
    windowGlass.triangle(gl, gr, gt)
  }
  // Pitched skylight roof glazing (both slopes, metric UVs aligned to rafter/purlin grid)
  const slopeRun = Math.hypot(glassX - ventilator.halfX, ventY - eavesY)
  for (const side of [-1, 1]) {
    const a = new Vector3(side * glassX, eavesY, -glassZ)
    const b = new Vector3(side * glassX, eavesY, glassZ)
    const c = new Vector3(side * ventilator.halfX, ventY, glassZ)
    const d = new Vector3(side * ventilator.halfX, ventY, -glassZ)
    const n = new Vector3(-side * (ventY - eavesY), -(glassX - ventilator.halfX), 0)
    n.normalize()
    addRingQuad(skylightGlass, a, b, c, d, n, n, [0, 0], [glassZ * 2, 0], [glassZ * 2, slopeRun], [0, slopeRun])
  }
}
/** Adds longitudinal wrought-iron roof purlins and the four corner hip rafters under the sloped deck. */
function addRoofPurlinsAndHips(iron: Array<BufferGeometry>, size: Size) {
  const [sx, sz] = forgeRoofSpringHalf(size)
  const {halfX, halfZ} = forgeCeiling.monitor
  // Four corner hip rafters following the diagonal creases of the sloped deck
  for (const sideX of [-1, 1]) {
    for (const sideZ of [-1, 1]) {
      const steps = forgeCeiling.deck.segments
      for (let i = 0; i < steps; i++) {
        const [hx0, hz0, y0] = forgeDeckRing(i / steps, size)
        const [hx1, hz1, y1] = forgeDeckRing((i + 1) / steps, size)
        pushBeam(iron, new Vector3(sideX * hx0, y0 - 0.04, sideZ * hz0), new Vector3(sideX * hx1, y1 - 0.04, sideZ * hz1), 0.1, 0.12)
      }
    }
  }
  // Longitudinal purlins along the east & west roof slopes (running cleanly between the north & south hips)
  for (const px of forgeCeiling.trusses.purlinsX) {
    const t = (sx - px) / (sx - halfX)
    const [, hz, y] = forgeDeckRing(t, size)
    for (const side of [-1, 1]) {
      pushBox(iron, [0.08, 0.11, hz * 2], [side * px, y - 0.055, 0])
    }
  }
  // North & south intermediate transverse purlins on the hipped end slopes (above the workbench pendants!)
  const endZ = forgeCeiling.pendants.benchFlankZ
  const tEnd = (sz - endZ) / (sz - halfZ)
  const [endHx, , endY] = forgeDeckRing(tEnd, size)
  for (const end of [-1, 1]) {
    pushBox(iron, [endHx * 2, 0.11, 0.08], [0, endY - 0.055, end * endZ])
  }
}

/**
 * The Forge’s main hall ceiling geometry: limewashed vaulted roof deck (`plaster`), watertight bluestone perimeter fascia, curb & roof backing (`stone`), open-web parabolic wrought-iron arch trusses & clerestory monitor (`iron`), hammered-brass turnbuckles, bosses & cresting (`brass`), drawn clerestory glazing (`windowGlass`) and pitched skylight glazing (`skylightGlass`).
 */
export default class ForgeCeilingGeometry {
  readonly brass: BufferGeometry
  readonly iron: BufferGeometry
  readonly plaster: BufferGeometry
  readonly skylightGlass: BufferGeometry
  readonly stone: BufferGeometry
  readonly windowGlass: BufferGeometry

  constructor(size: Size = forge.size) {
    const shell = buildMainShell(size)
    const ironParts: Array<BufferGeometry> = []
    const brassParts: Array<BufferGeometry> = []
    const windowSoup = new TriangleSoup
    const skylightSoup = new TriangleSoup
    for (const z of forgeCeiling.trusses.offsets) {
      addArchTruss(ironParts, brassParts, z, size)
    }
    addRoofPurlinsAndHips(ironParts, size)
    addMonitor(ironParts, brassParts, windowSoup, skylightSoup)
    this.plaster = shell.plaster
    this.stone = shell.stone
    this.iron = mergeParts(ironParts)
    this.brass = mergeParts(brassParts)
    this.windowGlass = windowSoup.toGeometry()
    this.skylightGlass = skylightSoup.toGeometry()
  }

  dispose() {
    for (const part of [this.plaster, this.stone, this.iron, this.brass, this.windowGlass, this.skylightGlass]) {
      part.dispose()
    }
  }
}

/**
 * The round vestibule’s 8-ribbed wrought-iron and limewashed masonry cupola: watertight dome & ring ledge (`plaster` + `stone`), 8 meridional ribs, ring purlin & octagonal glazed lantern frame (`iron`), hammered-brass compression collar, bosses & finial cap (`brass`) and 8-sided glazed drum & conical cap (`glass`).
 */
export class ForgeVestibuleCupolaGeometry {
  readonly brass: BufferGeometry
  readonly glass: BufferGeometry
  readonly iron: BufferGeometry
  readonly plaster: BufferGeometry
  readonly stone: BufferGeometry

  constructor() {
    const outerR = forgeVestibule.radius
    const faceR = outerR - wallFace
    const {baseY, cupola, springY} = forgeCeiling
    const {capRadius, drumHeight, ledge, oculusRadius, oculusY, ribs, shell} = cupola
    const springR = faceR - ledge
    const plasterSoup = new TriangleSoup
    const stoneSoup = new TriangleSoup
    const domeSteps = 12
    const innerDome = Array.from({length: domeSteps + 1}, (_, i) => forgeCupolaSection(i / domeSteps * Math.PI / 2))
    const outerDome = Array.from({length: domeSteps + 1}, (_, i) => {
      const [r, y] = forgeCupolaSection((domeSteps - i) / domeSteps * Math.PI / 2)
      return [r + shell, y + shell * 0.7] as const
    })
    const profile: Array<{
      material: 'plaster' | 'stone'
      point: readonly [r: number, y: number]
      smooth?: boolean
    }> = [
      {
        point: [outerR, baseY],
        material: 'stone',
      },
      {
        point: [springR, baseY],
        material: 'stone',
      },
      ...innerDome.map((point, i) => ({
        point,
        material: i < domeSteps ? 'plaster' as const : 'stone' as const,
        smooth: i > 0 && i < domeSteps,
      })),
      {
        point: [oculusRadius, forgeCupolaSillY],
        material: 'stone',
      },
      {
        point: [oculusRadius + shell, forgeCupolaSillY],
        material: 'stone',
      },
      ...outerDome.map(point => ({
        point,
        material: 'stone' as const,
      })),
      {
        point: [springR + shell, springY - 0.01],
        material: 'stone',
      },
      {
        point: [outerR, springY - 0.01],
        material: 'stone',
      },
    ]
    const ringPoints = profile.map(({point: [r, y]}) => Array.from({length: cupolaSegments}, (_, s) => {
      const angle = s / cupolaSegments * Math.PI * 2
      return new Vector3(Math.cos(angle) * r, y, -Math.sin(angle) * r)
    }))
    const total = profile.length
    const quadNormal = (i: number, s: number) => {
      const nextI = (i + 1) % total
      const nextS = (s + 1) % cupolaSegments
      const a = ringPoints[i][s]
      const b = ringPoints[i][nextS]
      const d = ringPoints[nextI][s]
      return b.clone().sub(a).cross(d.clone().sub(a)).normalize()
    }
    const vertexNormal = (i: number, s: number, fallback: Vector3) => {
      if (!profile[i].smooth) {
        return fallback
      }
      const prevI = (i - 1 + total) % total
      const prevS = (s - 1 + cupolaSegments) % cupolaSegments
      return quadNormal(prevI, prevS).add(quadNormal(prevI, s)).add(quadNormal(i, prevS)).add(quadNormal(i, s)).normalize()
    }
    for (let i = 0; i < total; i++) {
      const nextI = (i + 1) % total
      const soup = profile[i].material === 'plaster' ? plasterSoup : stoneSoup
      for (let s = 0; s < cupolaSegments; s++) {
        const nextS = (s + 1) % cupolaSegments
        const a = ringPoints[i][s]
        const b = ringPoints[i][nextS]
        const c = ringPoints[nextI][nextS]
        const d = ringPoints[nextI][s]
        const nSeg = quadNormal(i, s)
        const ia = soup.add(a, vertexNormal(i, s, nSeg), [s / cupolaSegments, i])
        const ib = soup.add(b, vertexNormal(i, nextS, nSeg), [(s + 1) / cupolaSegments, i])
        const ic = soup.add(c, vertexNormal(nextI, nextS, nSeg), [(s + 1) / cupolaSegments, i + 1])
        const id = soup.add(d, vertexNormal(nextI, s, nSeg), [s / cupolaSegments, i + 1])
        soup.quad(ia, ib, ic, id)
      }
    }
    const ironParts: Array<BufferGeometry> = []
    const brassParts: Array<BufferGeometry> = []
    const glassSoup = new TriangleSoup
    // 8 wrought-iron meridional ribs (rotated π/8 so they flank the four cardinal arches/windows symmetrically)
    const [midR, midY] = forgeCupolaSection(Math.PI / 4)
    const glassR = oculusRadius + 0.04
    for (let k = 0; k < ribs; k++) {
      const angle = (k + 0.5) * Math.PI * 2 / ribs
      const nextAngle = (k + 1.5) * Math.PI * 2 / ribs
      const dir = new Vector3(Math.cos(angle), 0, Math.sin(angle))
      const tangent = new Vector3(-Math.sin(angle), 0, Math.cos(angle))
      // Wall corbel shoe at the springing of each rib
      pushBeam(ironParts, dir.clone().multiplyScalar(faceR).setY(baseY - 0.34), dir.clone().multiplyScalar(springR + 0.02).setY(springY - 0.06), 0.08, 0.09, tangent)
      // Curved rib hugging the dome underside
      for (let step = 0; step < domeSteps; step++) {
        const [r0, y0] = forgeCupolaSection(step / domeSteps * Math.PI / 2)
        const [r1, y1] = forgeCupolaSection((step + 1) / domeSteps * Math.PI / 2)
        pushBeam(ironParts, dir.clone().multiplyScalar(r0 - 0.02).setY(y0 - 0.03), dir.clone().multiplyScalar(r1 - 0.02).setY(y1 - 0.03), 0.075, 0.1, tangent)
      }
      // Brass boss where each rib meets the compression ring
      const boss = new SphereGeometry(0.055, 8, 6)
      boss.translate(dir.x * (oculusRadius - 0.01), oculusY - 0.03, dir.z * (oculusRadius - 0.01))
      brassParts.push(boss)
      // Lantern corner mullion & radial conical roof hip bar
      const sillPt = dir.clone().multiplyScalar(glassR).setY(forgeCupolaSillY)
      const eavesPt = dir.clone().multiplyScalar(glassR).setY(forgeCupolaEavesY)
      const apexPt = dir.clone().multiplyScalar(capRadius).setY(forgeCupolaApexY)
      pushBeam(ironParts, sillPt, eavesPt, 0.065, 0.065, tangent)
      pushBeam(ironParts, eavesPt, apexPt, 0.055, 0.065, tangent)
      // Glazed vertical drum pane & conical roof pane between angle and nextAngle
      const nextDir = new Vector3(Math.cos(nextAngle), 0, Math.sin(nextAngle))
      const p0 = dir.clone().multiplyScalar(glassR).setY(forgeCupolaSillY)
      const p1 = nextDir.clone().multiplyScalar(glassR).setY(forgeCupolaSillY)
      const p2 = nextDir.clone().multiplyScalar(glassR).setY(forgeCupolaEavesY)
      const p3 = dir.clone().multiplyScalar(glassR).setY(forgeCupolaEavesY)
      const nDrum = p0.clone().add(p1).multiplyScalar(-0.5).setY(0).normalize()
      const paneW = p0.distanceTo(p1)
      addRingQuad(glassSoup, p0, p1, p2, p3, nDrum, nDrum, [0, 0], [paneW, 0], [paneW, drumHeight], [0, drumHeight])
      // Conical roof trapezoid pane
      const c2 = nextDir.clone().multiplyScalar(capRadius).setY(forgeCupolaApexY)
      const c3 = dir.clone().multiplyScalar(capRadius).setY(forgeCupolaApexY)
      const nCone = p2.clone().sub(p3).cross(c3.clone().sub(p3)).normalize()
      if (nCone.y > 0) {
        nCone.negate()
      }
      const slopeH = p3.distanceTo(c3)
      addRingQuad(glassSoup, p3, p2, c2, c3, nCone, nCone, [0, 0], [paneW, 0], [c3.distanceTo(c2), slopeH], [0, slopeH])
    }
    // Intermediate wrought-iron ring purlin, compression ring, lantern eaves ring and hammered-brass inner oculus collar
    const midRing = new TorusGeometry(midR - 0.03, 0.032, 8, cupolaSegments)
    midRing.rotateX(Math.PI / 2).translate(0, midY - 0.02, 0)
    ironParts.push(midRing)
    const compressionRing = new TorusGeometry(oculusRadius + 0.01, 0.05, 8, cupolaSegments)
    compressionRing.rotateX(Math.PI / 2).translate(0, oculusY, 0)
    ironParts.push(compressionRing)
    const eavesRing = new TorusGeometry(glassR, 0.048, 8, ribs)
    eavesRing.rotateX(Math.PI / 2).rotateY(Math.PI / ribs).translate(0, forgeCupolaEavesY, 0)
    ironParts.push(eavesRing)
    const brassCollar = new TorusGeometry(oculusRadius - 0.015, 0.026, 8, cupolaSegments)
    brassCollar.rotateX(Math.PI / 2).translate(0, oculusY - 0.045, 0)
    brassParts.push(brassCollar)
    // Turned brass/bronze finial cap closing the apex of the conical glass lantern
    const finialProfile = [
      new Vector2(0.001, forgeCupolaApexY - 0.04),
      new Vector2(capRadius + 0.05, forgeCupolaApexY - 0.04),
      new Vector2(capRadius + 0.04, forgeCupolaApexY + 0.04),
      new Vector2(0.11, forgeCupolaApexY + 0.1),
      new Vector2(0.065, forgeCupolaApexY + 0.16),
      new Vector2(0.09, forgeCupolaApexY + 0.21),
      new Vector2(0.03, forgeCupolaApexY + 0.27),
      new Vector2(0.001, forgeCupolaTopY),
    ]
    brassParts.push(new LatheGeometry(finialProfile, 16))
    this.plaster = plasterSoup.toGeometry()
    this.stone = stoneSoup.toGeometry()
    this.iron = mergeParts(ironParts)
    this.brass = mergeParts(brassParts)
    this.glass = glassSoup.toGeometry()
  }

  dispose() {
    for (const part of [this.plaster, this.stone, this.iron, this.brass, this.glass]) {
      part.dispose()
    }
  }
}

/**
 * Six industrial spun-enamel & hammered-brass foundry pendant lamps, hung on slender wrought-iron downrods from the sloped roof purlins directly over the four flanking soapstone tables and flanking the south alchemy workbench.
 */
export class ForgePendantsGeometry {
  readonly brass: BufferGeometry
  readonly bulb: BufferGeometry
  readonly enamel: BufferGeometry
  readonly iron: BufferGeometry

  constructor(size: Size = forge.size) {
    const ironParts: Array<BufferGeometry> = []
    const brassParts: Array<BufferGeometry> = []
    const enamelParts: Array<BufferGeometry> = []
    const bulbParts: Array<BufferGeometry> = []
    const {bulbY, rimY, shadeRadius} = forgeCeiling.pendants
    // Revolved profile for the outer flared dark-iron shade (bottom-to-top so LatheGeometry normals face outward!)
    const outerShade = [
      new Vector2(shadeRadius, rimY),
      new Vector2(0.265, rimY + 0.065),
      new Vector2(0.175, rimY + 0.14),
      new Vector2(0.095, rimY + 0.2),
      new Vector2(0.068, rimY + 0.25),
    ]
    // Inner reflective warm-cream enamel cone (top-to-bottom so LatheGeometry normals face inward toward the bulb!)
    const innerShade = [
      new Vector2(0.055, rimY + 0.235),
      new Vector2(0.086, rimY + 0.195),
      new Vector2(0.168, rimY + 0.135),
      new Vector2(0.258, rimY + 0.062),
      new Vector2(shadeRadius - 0.008, rimY + 0.004),
    ]
    // Ventilated hammered-brass socket gallery crowning the shade (bottom-to-top so normals face outward!)
    const gallery = [
      new Vector2(0.062, rimY + 0.248),
      new Vector2(0.072, rimY + 0.248),
      new Vector2(0.066, rimY + 0.29),
      new Vector2(0.052, rimY + 0.34),
      new Vector2(0.045, rimY + 0.39),
      new Vector2(0.018, rimY + 0.41),
    ]
    for (const {x, z} of forgePendantSpots) {
      const mountY = forgeRoofUndersideY(x, z, size) - 0.03
      // Ceiling mounting rosette & slender iron conduit downrod
      const rosette = new CylinderGeometry(0.065, 0.05, 0.055, 10)
      rosette.translate(x, mountY, z)
      ironParts.push(rosette)
      pushRod(ironParts, new Vector3(x, rimY + 0.4, z), new Vector3(x, mountY, z), 0.018, 6)
      // Brass coupling nut halfway up the downrod
      const coupler = new CylinderGeometry(0.022, 0.022, 0.05, 6)
      coupler.translate(x, (rimY + 0.4 + mountY) * 0.5, z)
      brassParts.push(coupler)
      // Outer dark-iron industrial shade + inner warm-cream enameled reflector
      const shade = new LatheGeometry(outerShade, 22)
      shade.translate(x, 0, z)
      ironParts.push(shade)
      const reflector = new LatheGeometry(innerShade, 22)
      reflector.translate(x, 0, z)
      enamelParts.push(reflector)
      // Brass gallery neck, rolled brass rim lip & wire guard ring round the Edison bulb
      const neck = new LatheGeometry(gallery, 14)
      neck.translate(x, 0, z)
      brassParts.push(neck)
      const lip = new TorusGeometry(shadeRadius - 0.003, 0.008, 6, 22)
      lip.rotateX(Math.PI / 2).translate(x, rimY, z)
      brassParts.push(lip)
      const guard = new TorusGeometry(0.095, 0.005, 5, 12)
      guard.rotateX(Math.PI / 2).translate(x, bulbY - 0.025, z)
      brassParts.push(guard)
      // Glowing warm Edison glass globe
      const globe = new SphereGeometry(0.058, 10, 8)
      globe.scale(1, 1.25, 1).translate(x, bulbY, z)
      bulbParts.push(globe)
    }
    this.iron = mergeParts(ironParts)
    this.brass = mergeParts(brassParts)
    this.enamel = mergeParts(enamelParts)
    this.bulb = mergeParts(bulbParts)
  }

  dispose() {
    for (const part of [this.iron, this.brass, this.enamel, this.bulb]) {
      part.dispose()
    }
  }
}

/**
 * Engaged dressed-bluestone and wrought-iron wall pilasters dividing the Forge’s west brick wall into five structural bays beneath the arch trusses and flanking the east wall’s Lobby window.
 */
export class ForgePilastersGeometry {
  readonly brass: BufferGeometry
  readonly iron: BufferGeometry
  readonly stone: BufferGeometry

  constructor(size: Size = forge.size) {
    const faceX = size[0] / 2 - wallFace
    const {depth, eastOffsets, width} = forgeCeiling.pilasters
    const stoneParts: Array<BufferGeometry> = []
    const ironParts: Array<BufferGeometry> = []
    const brassParts: Array<BufferGeometry> = []
    const addPilaster = (side: -1 | 1, z: number) => {
      const inward = -side
      // Main bluestone shaft from baseboard cap (0.25) to cornice underside (5.03)
      pushBox(stoneParts, [depth, 4.78, width], [side * faceX + inward * (depth * 0.5), 2.64, z])
      // Stepped bluestone plinth base & capital
      pushBox(stoneParts, [depth + 0.03, 0.24, width + 0.06], [side * faceX + inward * ((depth + 0.03) * 0.5), 0.37, z])
      pushBox(stoneParts, [depth + 0.04, 0.22, width + 0.07], [side * faceX + inward * ((depth + 0.04) * 0.5), 4.92, z])
      // Vertical wrought-iron face flange carrying the truss load visually down the pier
      pushBox(ironParts, [0.026, 4.32, 0.085], [side * faceX + inward * (depth + 0.013), 2.65, z])
      // Three hammered-brass tie-bands clamping the iron flange
      for (const bandY of [1.45, 2.7, 3.95]) {
        pushBox(brassParts, [0.034, 0.055, width + 0.015], [side * faceX + inward * (depth + 0.008), bandY, z])
      }
    }
    for (const z of forgeCeiling.trusses.offsets) {
      addPilaster(-1, z)
    }
    for (const z of eastOffsets) {
      addPilaster(1, z)
    }
    this.stone = mergeParts(stoneParts)
    this.iron = mergeParts(ironParts)
    this.brass = mergeParts(brassParts)
  }

  dispose() {
    for (const part of [this.stone, this.iron, this.brass]) {
      part.dispose()
    }
  }
}

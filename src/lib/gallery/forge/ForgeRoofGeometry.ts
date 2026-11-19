import type {BufferGeometry} from 'three/webgpu'

import {BoxGeometry, CylinderGeometry, ExtrudeGeometry, Path, Shape, Vector3} from 'three/webgpu'

import {mergeParts} from '#src/lib/geometry.ts'

import {colliderGeometry} from '../architecture.ts'
import forge, {forgeBays, forgePierWidth, forgeRoof, forgeVestibule} from '../forge.ts'
import TriangleSoup from '../TriangleSoup.ts'

/** A roof skin in local meters. The metric UVs run along and up each sheet, including the panes. */
function sheet(corners: Array<Vector3>) {
  const [a, b, c] = corners
  const along = b.clone().sub(a).normalize()
  const normal = along.clone().cross(c.clone().sub(a)).normalize()
  const across = normal.clone().cross(along)
  const soup = new TriangleSoup
  const vertices = corners.map(p => {
    const delta = p.clone().sub(a)
    return soup.add(p, normal, [delta.dot(along), delta.dot(across)])
  })
  for (let i = 2; i < vertices.length; i++) {
    soup.triangle(vertices[0], vertices[i - 1], vertices[i])
  }
  return soup.toGeometry()
}
function box(x: number, y: number, z: number, w: number, h: number, d: number) {
  const geometry = new BoxGeometry(w, h, d)
  return geometry.translate(x, y, z)
}
/** A glazing bar or rafter from one point to the next; its width lies across the pitch. */
function bar(a: Vector3, b: Vector3, width: number, depth: number) {
  const delta = b.clone().sub(a)
  const geometry = new BoxGeometry(width, depth, delta.length())
  geometry.lookAt(delta)
  const {x, y, z} = a.clone().lerp(b, 0.5)
  return geometry.translate(x, y, z)
}
function extrude(shape: Shape, depth: number, z: number) {
  const geometry = new ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 8,
    depth,
  })
  return geometry.translate(0, 0, z - depth / 2)
}
/** A riveted fish-belly plate girder under the ridge: rounded triangular piercings leave diagonal webs between its flanges. */
function girder(width: number, y: number, z: number, frame: Array<BufferGeometry>, brass: Array<BufferGeometry>) {
  const half = width / 2
  const pitch = width / 12
  const belly = (x: number) => y - 0.31 - 0.87 * (1 - (x / half) ** 2)
  // A parabolic edge is a quadratic Bézier with this midpoint tangent intersection.
  const low = belly(0) * 2 - belly(half)
  const band = (top: number, bottom: number) => {
    const shape = new Shape
    shape.moveTo(-half, belly(half) + top)
    shape.quadraticCurveTo(0, low + top, half, belly(half) + top)
    shape.lineTo(half, belly(half) + bottom)
    shape.quadraticCurveTo(0, low + bottom, -half, belly(half) + bottom)
    return shape
  }
  const web = new Shape
  web.moveTo(-half, y)
  web.lineTo(half, y)
  web.lineTo(half, belly(half))
  web.quadraticCurveTo(0, low, -half, belly(half))
  web.closePath()
  const punch = (corners: ReadonlyArray<readonly [number, number]>) => {
    const hole = new Path
    for (let i = 0; i < 3; i++) {
      const [x, h] = corners[i]
      const [px, ph] = corners[(i + 2) % 3]
      const [nx, nh] = corners[(i + 1) % 3]
      const start = [x + (px - x) * 0.13, h + (ph - h) * 0.13] as const
      if (i) {
        hole.lineTo(...start)
      } else {
        hole.moveTo(...start)
      }
      hole.quadraticCurveTo(x, h, x + (nx - x) * 0.13, h + (nh - h) * 0.13)
    }
    hole.closePath()
    web.holes.push(hole)
  }
  for (let i = 0; i < 12; i++) {
    const x = -half + i * pitch
    const mid = x + pitch / 2
    punch([[x + 0.08, y - 0.09], [x + pitch - 0.08, y - 0.09], [mid, belly(mid) + 0.09]])
    if (i < 11) {
      punch([[mid + 0.07, belly(mid) + 0.07], [mid + pitch - 0.07, belly(mid + pitch) + 0.07], [x + pitch, y - 0.17]])
    }
    for (const h of [y - 0.045, belly(mid) + 0.045]) {
      const boss = new CylinderGeometry(0.03, 0.03, 0.096, 10)
      brass.push(boss.rotateX(Math.PI / 2).translate(mid, h, z))
    }
  }
  frame.push(extrude(web, 0.075, z), extrude(band(0.016, -0.05), 0.21, z), box(0, y + 0.02, z, width, 0.07, 0.23))
}
/** Channel columns stand on the west floor. Across the room short posts stand on the box girder over the Lobby window. */
function bearing(parts: Sheets, side: number, half: number, peak: number, foot: number) {
  const shoulder = forgeRoof.ridge - 0.54
  const at = (inset: number) => (half - inset) * side
  parts.frame.push(box(at(0.19), (foot + shoulder) / 2, peak, 0.18, shoulder - foot, 0.11))
  for (const inset of [0.115, 0.3]) {
    parts.frame.push(box(at(inset), (foot + shoulder) / 2, peak, 0.054, shoulder - foot, 0.27))
  }
  parts.frame.push(box(at(0.22), foot + 0.22, peak, 0.27, 0.44, forgePierWidth), box(at(0.27), shoulder + 0.09, peak, 0.44, 0.22, forgePierWidth))
  parts.brass.push(box(at(0.22), foot + 0.45, peak, 0.26, 0.035, forgePierWidth - 0.01))
  // A hollow cast knee transfers the plate girder’s load to the upright.
  const knee = new Shape
  knee.moveTo(at(0.22), shoulder)
  knee.lineTo(at(1.16), shoulder - 0.1)
  knee.quadraticCurveTo(at(0.48), shoulder - 0.4, at(0.26), shoulder - 1.27)
  knee.closePath()
  const eye = new Path
  eye.absellipse(at(0.5), shoulder - 0.24, 0.11, 0.09, 0, 2 * Math.PI, true, 0)
  knee.holes.push(eye)
  parts.frame.push(extrude(knee, 0.14, peak))
}
/** The workshop’s three successive south lights and the triangular cheeks that close their ends over the east and west walls. */
function sawteeth() {
  const parts = new Sheets
  const {eastSetback, eave, panesAcross, ridge} = forgeRoof
  const width = forge.size[0] - eastSetback
  const half = width / 2
  const span = (y: number, z: number) => [new Vector3(-half, y, z), new Vector3(half, y, z)]
  for (const {north, peak, south} of forgeBays) {
    const [a, b] = span(eave, north)
    const [c, d] = span(ridge, peak)
    const [e, f] = span(eave, south)
    parts.deck.push(sheet([a, b, d, c]), sheet([a, c, e]), sheet([b, f, d]))
    parts.glass.push(sheet([c, d, f, e]))
    girder(width, ridge - 0.16, peak, parts.frame, parts.brass)
    bearing(parts, -1, half, peak, 0)
    bearing(parts, 1, half, peak, eave)
    // Rolled gutter at the valley, the glazing’s central transom and three purlins carrying the folded sheets.
    parts.frame.push(box(0, eave - 0.05, south - 0.06, width, 0.16, 0.16), box(0, (eave + ridge) / 2 - 0.035, (peak + south) / 2, width, 0.065, 0.09))
    for (const t of [0.08, 0.45, 0.8]) {
      parts.frame.push(box(0, eave + (ridge - eave) * t - 0.07, north + (peak - north) * t, width, 0.12, 0.09))
    }
    for (let j = 0; j <= panesAcross; j++) {
      const x = (width - 0.1) * (j / panesAcross - 0.5)
      const top = new Vector3(x, ridge - 0.06, peak)
      parts.frame.push(bar(new Vector3(x, eave - 0.045, south), top, 0.064, 0.09))
      if (j % 2 === 0) {
        parts.frame.push(bar(new Vector3(x, eave - 0.14, north), new Vector3(x, ridge - 0.14, peak), 0.1, 0.19))
      }
    }
  }
  // Return from the shortened span’s frame to the floor’s. A deep, flanged bearer closes the setback all the way to the east wall, below the Lobby vault’s springing line.
  for (const group of [parts.brass, parts.deck, parts.frame, parts.glass]) {
    for (const piece of group) {
      piece.translate(-eastSetback / 2, 0, 0)
    }
  }
  const [floorWidth, length] = forge.size
  const lip = eastSetback + 0.41
  parts.frame.push(box((floorWidth - lip) / 2, eave - 0.14, 0, lip, 0.28, length), box((floorWidth - lip - 0.035) / 2, eave - 0.3, 0, lip + 0.035, 0.04, length))
  return parts
}
/** The vestibule’s fluted sheet-metal smoke hood. Each ridge continues across the milky glass to a brass hub like the spoke of a wheel. */
function hood() {
  const parts = new Sheets
  const {radius, crown} = forgeVestibule
  const sides = 32
  const point = (i: number, r: number, y: number) => new Vector3(r * Math.cos(i * 2 * Math.PI / sides), y, r * Math.sin(i * 2 * Math.PI / sides))
  const section = (j: number) => [point(j, radius, 5.53), point(j, 1.42, 5.99 + j % 2 * 0.11), point(j, 1.32, 6.12), point(j, 0.21, crown - 0.08)]
  for (let i = 0; i < sides; i++) {
    const [a, b, c, d] = section(i)
    const [e, f, g, h] = section(i + 1)
    parts.deck.push(sheet([a, e, f, b]))
    parts.frame.push(sheet([b, f, g, c]))
    parts.glass.push(sheet([c, g, h, d]))
    if (i % 2 === 0) {
      parts.frame.push(bar(a, b, 0.046, 0.065), bar(c, d, 0.044, 0.06))
    }
    parts.brass.push(bar(c, g, 0.035, 0.04))
  }
  const hub = new CylinderGeometry(0.28, 0.22, 0.16, sides)
  parts.brass.push(hub.translate(0, crown - 0.08, 0))
  return parts
}
/** One draw per finish, in the frame of the floor below. Even the opaque wired glass stops a thrown object; only the framing and sheeting stop the sun. */
export default class ForgeRoofGeometry {
  readonly collision
  readonly surfaces

  constructor(kind: 'hood' | 'sawtooth') {
    const {deck, frame, brass, glass} = kind === 'hood' ? hood() : sawteeth()
    this.surfaces = {
      deck: mergeParts(deck),
      frame: mergeParts(frame),
      brass: mergeParts(brass),
      glass: mergeParts(glass),
    }
    this.collision = Object.values(this.surfaces).map(colliderGeometry)
  }

  dispose() {
    for (const surface of Object.values(this.surfaces)) {
      surface.dispose()
    }
  }
}

class Sheets {
  readonly brass: Array<BufferGeometry> = []
  readonly deck: Array<BufferGeometry> = []
  readonly frame: Array<BufferGeometry> = []
  readonly glass: Array<BufferGeometry> = []
}

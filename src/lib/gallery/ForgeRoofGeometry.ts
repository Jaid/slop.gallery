import type {RoofTooth, SectionPoint} from './forgeRoof.ts'

import {BoxGeometry, BufferGeometry, ExtrudeGeometry, Matrix4, Shape, TorusGeometry, Vector2, Vector3} from 'three/webgpu'

import {mergeParts} from '../geometry.ts'
import {colliderGeometry, wallFace} from './architecture.ts'
import forge from './forge.ts'
import forgeRoof, {forgeGableOutline, forgePlateBottom, forgeRoofPieces, forgeRoofSpan, forgeRoofTeeth} from './forgeRoof.ts'
import {forgeDomeProfile, forgeVestibuleDome} from './forgeVestibuleDome.ts'
import RevolvedProfileGeometry from './RevolvedProfileGeometry.ts'
import TriangleSoup from './TriangleSoup.ts'

const upward = new Vector3(0, 1, 0)
const alongZ = new Vector3(0, 0, 1)
/** A section polygon across the room, z and y, extruded along x from `x0` to `x1`. */
function extrudeSection(points: ReadonlyArray<SectionPoint>, x0: number, x1: number) {
  const shape = new Shape(points.map(([z, y]) => new Vector2(z, y)))
  const geometry = new ExtrudeGeometry(shape, {
    depth: x1 - x0,
    bevelEnabled: false,
    curveSegments: 1,
    steps: 1,
  })
  // The shape’s x runs along z and its y up; it is extruded toward −x, from x1 back to x0.
  const place = new Matrix4
  place.makeBasis(alongZ, upward, new Vector3(-1, 0, 0)).setPosition(x1, 0, 0)
  return geometry.applyMatrix4(place)
}
/** A bar of the section `[width, depth]` from `from` to `to`, its depth along `up` as far as that lies square to the bar. */
function bar(from: Vector3, to: Vector3, [width, depth]: readonly [number, number], up: Vector3) {
  const axis = to.clone().sub(from)
  const length = axis.length()
  axis.divideScalar(length)
  const side = up.clone().cross(axis).normalize()
  const lift = axis.clone().cross(side)
  const geometry = new BoxGeometry(width, depth, length)
  const place = new Matrix4
  place.makeBasis(side, lift, axis).setPosition(from.clone().add(to).multiplyScalar(0.5))
  return geometry.applyMatrix4(place)
}
/** A plain copy of the geometry, which `mergeParts` may consume; `clone` would build the geometry’s own class again without its arguments. */
const copy = (geometry: BufferGeometry) => {
  const result = new BufferGeometry
  return result.copy(geometry)
}
/** A glazed face’s plane: where a point lies `along` meters up it from its sill at `x`, `inward` meters in front of the glass. */
export function glassPlane(tooth: RoofTooth) {
  const {ridge, sill} = tooth
  const length = Math.hypot(ridge[0] - sill[0], ridge[1] - sill[1])
  const up = [(ridge[0] - sill[0]) / length, (ridge[1] - sill[1]) / length] as const
  // Square to the glass, toward the room: north and down.
  const inward = [-up[1], up[0]] as const
  const toward = new Vector3(0, inward[1], inward[0])
  return {
    length,
    /** the direction square to the glass toward the room */
    toward,
    at: (x: number, along: number, offset = 0) => new Vector3(x, sill[1] + up[1] * along + inward[1] * offset, sill[0] + up[0] * along + inward[0] * offset),
  }
}

/** A surface along the roof’s faces toward the room, its glass and its plate included, so thrown things bounce off it instead of disappearing into it; as vertices and indices for a triangle mesh collider. */
export function forgeRoofCollision() {
  const geometry = new ForgeRoofGeometry
  try {
    const surface = mergeParts([copy(geometry.roof), copy(geometry.gables), copy(geometry.glass), ...plate()])
    try {
      return colliderGeometry(surface)
    } finally {
      surface.dispose()
    }
  } finally {
    geometry.dispose()
  }
}

/** A surface along the dome’s inside and its glass, as vertices and indices for a triangle mesh collider. */
export function forgeDomeCollision() {
  const geometry = new ForgeDomeGeometry(48)
  try {
    const surface = mergeParts([copy(geometry.shell), copy(geometry.glass)])
    try {
      return colliderGeometry(surface)
    } finally {
      surface.dispose()
    }
  } finally {
    geometry.dispose()
  }
}

/** A box between two corners. */
function block([x0, y0, z0]: readonly [number, number, number], [x1, y1, z1]: readonly [number, number, number]) {
  const geometry = new BoxGeometry(x1 - x0, y1 - y0, z1 - z0)
  return geometry.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
}
/** The glazed faces, one quad each between the gables, from the top of the valley piece below to the ridge, facing the room. */
function glazing() {
  const [spanX] = forgeRoofSpan
  const soup = new TriangleSoup
  for (const tooth of forgeRoofTeeth()) {
    const plane = glassPlane(tooth)
    const corner = (x: number, along: number) => soup.add(plane.at(x, along), plane.toward, [x + spanX, along])
    soup.quad(corner(-spanX, 0), corner(spanX, 0), corner(spanX, plane.length), corner(-spanX, plane.length))
  }
  return soup.toGeometry()
}
/** The iron plate round the top of the walls, the east and west runs whole, the north and south ones between them. */
function plate() {
  const [width, depth] = forge.size
  const [spanX, spanZ] = forgeRoofSpan
  const [faceX, faceZ] = [width / 2 - wallFace, depth / 2 - wallFace]
  const {springY} = forgeRoof
  return [-1, 1].flatMap(side => [
    block([side < 0 ? -faceX : spanX, forgePlateBottom, -faceZ], [side < 0 ? -spanX : faceX, springY, faceZ]),
    block([-spanX, forgePlateBottom, side < 0 ? -faceZ : spanZ], [spanX, springY, side < 0 ? -spanZ : faceZ]),
  ])
}
/** The panel points of the girders along x, from gable to gable. */
function panelPoints() {
  const [spanX] = forgeRoofSpan
  const {panels} = forgeRoof.girder
  return Array.from({length: panels + 1}, (_, i) => -spanX + i * spanX * 2 / panels)
}
/** The lattice girder in a glazed face: a chord along its sill and one under its ridge, a post at every panel point and a diagonal across every panel, zigzagging from end to end. */
function girder(tooth: RoofTooth) {
  const plane = glassPlane(tooth)
  const {chord, offset, web} = forgeRoof.girder
  const [spanX] = forgeRoofSpan
  // The bottom chord sits on the valley, the top one just under the slope’s underside, which closes in on the glass at the ridge.
  const bottom = chord[0] / 2 - 0.11
  const top = plane.length - chord[0] / 2 - 0.08
  const parts = [bottom, top].map(along => bar(plane.at(-spanX, along, offset), plane.at(spanX, along, offset), chord, plane.toward))
  const points = panelPoints()
  // The end posts stand against the gables.
  const post = (x: number) => Math.max(-spanX + web[0] / 2, Math.min(spanX - web[0] / 2, x))
  for (const [i, x] of points.entries()) {
    parts.push(bar(plane.at(post(x), bottom, offset), plane.at(post(x), top, offset), web, plane.toward))
    if (i === 0) {
      continue
    }
    const [from, to] = i % 2 ? [bottom, top] : [top, bottom]
    parts.push(bar(plane.at(points[i - 1], from, offset), plane.at(x, to, offset), web, plane.toward))
  }
  return parts
}
/** The sash bars between the panes, right inside the glass, two to every panel of the girder. */
function sashBars(tooth: RoofTooth) {
  const plane = glassPlane(tooth)
  const [spanX] = forgeRoofSpan
  const [width, barDepth] = forgeRoof.sashBar
  const count = forgeRoof.girder.panels * 2
  return Array.from({length: count - 1}, (_, i) => {
    const x = -spanX + (i + 1) * spanX * 2 / count
    return bar(plane.at(x, 0, barDepth / 2 + 0.003), plane.at(x, plane.length, barDepth / 2 + 0.003), [width, barDepth], plane.toward)
  })
}
/** The rafters under a tooth’s slope, from its heel up to its ridge, one under every inner panel point of the girders. */
function rafters(tooth: RoofTooth) {
  const {heel, ridge} = tooth
  const [width, rafterDepth] = forgeRoof.rafter
  const run = Math.hypot(ridge[0] - heel[0], ridge[1] - heel[1])
  // Square to the slope, toward the room: down and south.
  const down = new Vector3(0, -(ridge[0] - heel[0]) / run, (ridge[1] - heel[1]) / run)
  const at = ([z, y]: SectionPoint, x: number) => {
    const point = new Vector3(x, y, z)
    return point.addScaledVector(down, rafterDepth / 2)
  }
  return panelPoints().slice(1, -1).map(x => bar(at(heel, x), at(ridge, x), [width, rafterDepth], down))
}

/**
 * The Forge’s sawtooth roof (see `forgeRoof`), in the room’s frame at its middle on the floor:
 * - `roof`: the boarded, slated pieces between the glazed faces;
 * - `gables`: the brick gables at the east and west ends, from the plate’s face out to the walls’ middle;
 * - `iron`: the wall plate, the lattice girders in the glazed faces, the sash bars and the rafters;
 * - `glass`: the glazed faces, with UVs in meters along x and up the glass from its sill.
 */
export default class ForgeRoofGeometry {
  /** the parapet’s sandstone coping */
  readonly coping: BufferGeometry
  readonly gables: BufferGeometry
  readonly glass: BufferGeometry
  readonly iron: BufferGeometry
  /** the brick parapet over the south wall, as thick as the Forge’s half of it */
  readonly parapet: BufferGeometry
  readonly roof: BufferGeometry

  constructor() {
    const [spanX] = forgeRoofSpan
    const pieces = forgeRoofPieces()
    this.roof = mergeParts(pieces.map(({top, underside}) => extrudeSection([...underside, ...top.toReversed()], -spanX, spanX)))
    const outline = forgeGableOutline()
    const [width] = forge.size
    this.gables = mergeParts([extrudeSection(outline, spanX, width / 2), extrudeSection(outline, -width / 2, -spanX)])
    this.glass = glazing()
    this.iron = mergeParts([...plate(), ...forgeRoofTeeth().flatMap(tooth => [...girder(tooth), ...sashBars(tooth), ...rafters(tooth)])])
    // From the springing, inside the roof’s last piece, up to the coping; the coping overhangs it toward the roof and stops at the wall’s middle.
    const {coping, top} = forgeRoof.parapet
    const south = forge.size[1] / 2
    this.parapet = block([-width / 2, forgeRoof.springY, south - wallFace], [width / 2, top - coping[0], south])
    this.coping = block([-width / 2, top - coping[0], south - coping[1]], [width / 2, top, south])
  }

  dispose() {
    for (const geometry of [this.roof, this.gables, this.glass, this.iron, this.parapet, this.coping]) {
      geometry.dispose()
    }
  }
}

/**
 * The vestibule’s dome (see `forgeVestibuleDome`), in the vestibule’s frame at its middle on the floor:
 * - `shell`: the brick shell from the top of the round wall to the eye, with the eye’s rim;
 * - `iron`: the rings round the eye, top and bottom, and the cross of bars under its glass;
 * - `glass`: the disc of glass over the eye, facing down into the vestibule, with UVs in meters.
 */
export class ForgeDomeGeometry {
  readonly glass: BufferGeometry
  readonly iron: BufferGeometry
  readonly shell: BufferGeometry

  /** `sides` round its axis, more for cinematic graphics */
  constructor(sides = 64) {
    const {oculus, ring} = forgeVestibuleDome
    const {eyeBottom, eyeTop} = forgeDomeProfile
    this.shell = new RevolvedProfileGeometry(forgeDomeProfile.points, {
      sides,
      smoothAngle: Math.PI / 5,
    })
    const radius = oculus + 0.04
    const disc = new TriangleSoup
    const down = new Vector3(0, -1, 0)
    const centerIndex = disc.add(new Vector3(0, eyeTop + 0.002, 0), down, [radius, radius])
    const rim = Array.from({length: 48}, (_, i) => {
      const angle = i / 48 * Math.PI * 2
      const [x, z] = [Math.cos(angle) * radius, Math.sin(angle) * radius]
      return disc.add(new Vector3(x, eyeTop + 0.002, z), down, [x + radius, z + radius])
    })
    for (const [i, index] of rim.entries()) {
      disc.triangle(centerIndex, index, rim[(i + 1) % rim.length])
    }
    this.glass = disc.toGeometry()
    const rings = [eyeBottom, eyeTop - ring].map(y => {
      const torus = new TorusGeometry(oculus - ring * 0.3, ring, 10, 64)
      return torus.rotateX(Math.PI / 2).translate(0, y, 0)
    })
    const cross = [0, Math.PI / 2].map(angle => bar(new Vector3(-oculus * Math.cos(angle), eyeTop - 0.03, -oculus * Math.sin(angle)), new Vector3(oculus * Math.cos(angle), eyeTop - 0.03, oculus * Math.sin(angle)), [0.03, 0.05], upward))
    this.iron = mergeParts([...rings, ...cross])
  }

  dispose() {
    for (const geometry of [this.shell, this.iron, this.glass]) {
      geometry.dispose()
    }
  }
}

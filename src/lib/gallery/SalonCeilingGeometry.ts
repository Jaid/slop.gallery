import {toCreasedNormals} from 'three/addons/utils/BufferGeometryUtils.js'
import {BufferGeometry, CatmullRomCurve3, Color, Float32BufferAttribute, Shape, ShapeGeometry, TubeGeometry, Vector2, Vector3} from 'three/webgpu'

import {mergeParts} from '../geometry.ts'
import {colliderGeometry} from './architecture.ts'
import salon, {salonCeiling, salonSkylight} from './salon.ts'

/** Eight facets across each of the 24 scallops. Multiples of eight also put vertices exactly at the corners of the rectangular eave. */
const flutes = 24
const stations = flutes * 8
const tau = 2 * Math.PI
const [rx, rz] = salonSkylight.radii
const {footY, glassY} = salonSkylight
const flare = 0.045
const base = salonCeiling.underside

type Course = (angle: number) => Vector3

/** Each course of plaster goes once around the room. The flutes die away at both moldings. */
const oval = (radius: number, y: number, relief = 0, scallop = 0): Course => a => {
  const flute = (1 - Math.cos(a * flutes)) / 2
  const reach = radius + flute * scallop
  return new Vector3(rx * reach * Math.cos(a), y + relief * flute, rz * reach * Math.sin(a))
}
const rectangle = (y: number): Course => a => {
  const c = Math.cos(a)
  const s = Math.sin(a)
  const edge = Math.max(Math.abs(c), Math.abs(s))
  return new Vector3(salon.size[0] / 2 * c / edge, y, salon.size[1] / 2 * s / edge)
}
/** Continuous plaster from the cornices up to the glass rebate and back over the roof. No slab across the opening. */
function plasterShell() {
  const chalk = '#ede1c9'
  const ochre = '#c69b58'
  const field = rectangle(base)
  const foot = oval(1.43, base, 0, flare)
  const roll = oval(1.4, footY, 0, flare)
  const spring = oval(1.37, base, 0, flare)
  const cove = Array.from({length: 9}, (_, i) => {
    const t = i / 8
    return oval(1.37 - 0.32 * t, base + 0.77 * (1 - (1 - t) ** 2), 0.145 * Math.sin(Math.PI * t), flare * (1 - t))
  })
  const neck = cove.at(-1)!
  const lip = oval(1, glassY - 0.08)
  const rebate = oval(1, glassY)
  const top = rectangle(base + salonCeiling.thickness)
  return mergeParts([
    band(chalk, field, foot),
    band(ochre, foot, oval(1.42, footY + 0.025, 0, flare), roll),
    band(chalk, roll, oval(1.385, footY + 0.02, 0, flare), spring),
    band('#96b3a6', ...cove),
    band(chalk, neck, oval(1.047, glassY - 0.105), oval(1.023, glassY - 0.095), lip),
    band(ochre, lip, rebate),
    band(chalk, rebate, oval(1.015, glassY + 0.1), oval(1.21, base + 0.95), oval(1.5, base + salonCeiling.thickness), top),
    band(chalk, top, field),
  ])
}
/** Share normals along a carved profile, but not across a quirk or between paint colors. */
function band(pigment: string, ...courses: Array<Course>) {
  const paint = new Color(pigment)
  const positions = []
  const colors = []
  const indices = []
  for (const [row, course] of courses.entries()) {
    for (let i = 0; i < stations; i++) {
      positions.push(...course(tau * i / stations))
      colors.push(...paint)
      if (row === courses.length - 1) {
        continue
      }
      const a = row * stations + i
      const b = row * stations + (i + 1) % stations
      indices.push(a, b, b + stations, a, b + stations, a + stations)
    }
  }
  const geometry = new BufferGeometry
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  const smoothed = toCreasedNormals(geometry, Math.PI / 4)
  geometry.dispose()
  return smoothed
}
const petals = 8
const sector = tau / petals
const hub = 0.16
const border = 0.86
/** Draw in a unit circle, then stretch the whole cartoon onto the long axis of the room. */
const point = (radius: number, angle: number) => new Vector2(rx * radius * Math.cos(angle), rz * radius * Math.sin(angle))
const arc = (radius: number, start: number, end: number, steps: number) => Array.from({length: steps + 1}, (_, i) => point(radius, start + (end - start) * i / steps))
/** The very same contours cut the panes and bend the cames, so there are no unrelated grid joints in the glass. */
function flowerLaylight() {
  const panes: Array<BufferGeometry> = []
  const bars: Array<BufferGeometry> = []
  const perSector = stations / petals
  const edges = Array.from({length: petals}, (_, i) => ({
    left: leafEdge(i * sector, -1),
    right: leafEdge(i * sector, 1),
  }))
  const hubSteps = petals * 6
  panes.push(pane(arc(hub, 0, tau, hubSteps).slice(0, -1), '#eda24f'))
  for (const r of [hub, border, 1]) {
    bars.push(came(arc(r, 0, tau, r === hub ? hubSteps : stations / 2), r === 1 ? 0.065 : 0.042, true))
  }
  for (const [i, {left, right}] of edges.entries()) {
    const from = i * sector
    const to = (i + 1) * sector
    panes.push(pane([...left, ...right.slice(1, -1).toReversed()], '#91cebb'))
    bars.push(came(left, 0.036), came(right, 0.036))
    // Water-white spandrel between two leaves, from the boss right out to the border.
    panes.push(pane([...right, ...arc(border, from, to, perSector).slice(1), ...edges[(i + 1) % petals].left.slice(0, -1).toReversed(), ...arc(hub, to, from, hubSteps / petals).slice(1, -1)], '#f5f1e5'))
    for (const half of [0, 1]) {
      const a = from + half * sector / 2
      const b = a + sector / 2
      panes.push(pane([...arc(border, a, b, perSector / 2), ...arc(1, b, a, perSector / 2)], half ? '#edac62' : '#f4c78a'))
      bars.push(came([point(border, a), point(1, a)], 0.033))
    }
  }
  const glass = mergeParts(panes)
  const bronze = mergeParts(bars)
  return {
    glass,
    bronze,
  }
}
/** A leaf swells out of a point at the boss and tapers to a lance at the outer band. */
function leafEdge(angle: number, side: number) {
  return Array.from({length: 17}, (_, i) => {
    const t = i / 16
    return point(hub + (border - hub) * t, angle + side * sector * 0.41 * Math.sin(Math.PI * t) * (1.3 - 0.6 * t))
  })
}
/** Single-sided, downward-facing cut glass with the body tint of this pane on every vertex. */
function pane(outline: Array<Vector2>, tint: string) {
  const geometry = new ShapeGeometry(new Shape(outline))
  geometry.rotateX(Math.PI / 2).translate(0, glassY, 0)
  const color = new Color(tint)
  const colors = new Float32Array(geometry.getAttribute('position').count * 3)
  for (let i = 0; i < colors.length; i += 3) {
    color.toArray(colors, i)
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  return geometry
}
/** Rounded bronze cames, tangent to the underside of the glass, not printed onto it. The ends are bedded in the hoops. */
function came(path: Array<Vector2>, radius: number, closed = false) {
  const points = (closed ? path.slice(0, -1) : path).map(({x, y: z}) => new Vector3(x, glassY - radius, z))
  return new TubeGeometry(new CatmullRomCurve3(points, closed), path.length - 1, radius, 6, closed)
}

/** Three draws for the whole ceiling: stucco, bronze and transmitting glass. Physics uses the same surfaces in every graphics mode. */
export default class SalonCeilingGeometry {
  readonly laylight = flowerLaylight()
  readonly shell = plasterShell()
  readonly colliders = [this.shell, this.laylight.bronze, this.laylight.glass].map(colliderGeometry)

  dispose() {
    this.shell.dispose()
    this.laylight.bronze.dispose()
    this.laylight.glass.dispose()
  }
}

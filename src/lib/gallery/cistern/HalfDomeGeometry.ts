import {BufferGeometry, Float32BufferAttribute, Vector3} from 'three/webgpu'

import {mergeParts} from '../../geometry.ts'

export type HalfDome = {
  /** the middle of its flat side, in plan, which it turns round, from x toward −z and on to −x */
  center: readonly [x: number, z: number]
  /** how far out it springs from that middle, inside */
  radius: number
  /** how high it rises from its spring to its crown, inside */
  rise: number
  /** how high it springs */
  spring: number
}
export type HalfDomeOptions = {
  /** how many ribs run up it, evenly spaced round it, between its ends */
  ribs: number
  /** how wide a rib is and how far it stands out of the dome */
  ribSection: readonly [width: number, depth: number]
  /** how thick its shell is */
  thickness: number
}

/** how many pieces it is cut into round its half, and from its spring up to its crown at base detail */
const [baseAround, baseUp] = [24, 8] as const
/** how close to the crown its ribs run, where they would crowd into each other */
const ribCrown = 0.35

/**
 * A half dome over a half-round room, springing from its round wall and leaning its crown on its flat one: a quarter of an ellipsoid inside, its shell standing out behind it, with ribs running up it from its spring toward its crown.
 * In the world’s frame; its ends stand on the flat wall’s center line, inside the wall.
 */
export default class HalfDomeGeometry {
  readonly ribs: BufferGeometry
  /** the inside of the dome, facing into the room, its shell behind it and the shell’s foot */
  readonly shell: BufferGeometry
  /** the inside alone, which collides */
  readonly surface: BufferGeometry

  constructor(private readonly dome: HalfDome, {ribs, ribSection: [ribWidth, ribDepth], thickness}: HalfDomeOptions, curveDetail = 1) {
    const [around, up] = [baseAround * curveDetail, baseUp * curveDetail]
    this.surface = this.ellipsoid(0, true, baseAround, baseUp)
    this.shell = mergeParts([this.ellipsoid(0, true, around, up), this.ellipsoid(thickness, false, around, up), this.foot(thickness, around)])
    this.ribs = mergeParts(Array.from({length: ribs}, (_, index) => this.rib(Math.PI * (index + 1) / (ribs + 1), ribWidth, ribDepth, 12 * curveDetail)))
  }

  dispose() {
    for (const geometry of [this.ribs, this.shell, this.surface]) {
      geometry.dispose()
    }
  }

  /** The point `out` meters out of the inside, along its normal, round its half by `azimuth` and up from its spring by `elevation`, and its normal there, facing out. */
  private at(azimuth: number, elevation: number, out = 0) {
    const {center: [x, z], radius, rise, spring} = this.dome
    const [cos, sin] = [Math.cos(elevation), Math.sin(elevation)]
    // the gradient of the ellipsoid, out and up
    const normal = new Vector3(cos / radius * Math.cos(azimuth), sin / rise, -cos / radius * Math.sin(azimuth))
    normal.normalize()
    const point = new Vector3(x + radius * cos * Math.cos(azimuth), spring + rise * sin, z - radius * cos * Math.sin(azimuth))
    return {
      point: point.addScaledVector(normal, out),
      normal,
    }
  }

  /** The ellipsoid `out` meters out of the inside, facing in or out, fanning in to its crown. */
  private ellipsoid(out: number, inward: boolean, around: number, up: number) {
    const positions: Array<number> = []
    for (let row = 0; row < up; row++) {
      for (let column = 0; column <= around; column++) {
        positions.push(...this.at(Math.PI * column / around, Math.PI / 2 * row / up, out).point)
      }
    }
    positions.push(...this.at(0, Math.PI / 2, out).point)
    const crown = up * (around + 1)
    const indices: Array<number> = []
    // Wound round from x toward −z and up, a triangle faces out of the dome.
    const triangle = (a: number, b: number, c: number) => indices.push(...inward ? [a, c, b] : [a, b, c])
    for (let row = 0; row < up; row++) {
      for (let column = 0; column < around; column++) {
        const first = row * (around + 1) + column
        const next = first + 1
        if (row === up - 1) {
          triangle(first, next, crown)
          continue
        }
        const [above, aboveNext] = [first + around + 1, next + around + 1]
        triangle(first, next, above)
        triangle(next, aboveNext, above)
      }
    }
    const geometry = new BufferGeometry
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    return geometry
  }

  /** The shell’s foot over the round wall, from the inside out to its back, facing down. */
  private foot(thickness: number, around: number) {
    const positions: Array<number> = []
    for (let column = 0; column <= around; column++) {
      const azimuth = Math.PI * column / around
      positions.push(...this.at(azimuth, 0).point, ...this.at(azimuth, 0, thickness).point)
    }
    const indices: Array<number> = []
    for (let column = 0; column < around; column++) {
      const [inner, outer, nextInner, nextOuter] = [column * 2, column * 2 + 1, column * 2 + 2, column * 2 + 3]
      indices.push(inner, nextInner, outer, nextInner, nextOuter, outer)
    }
    const geometry = new BufferGeometry
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    return geometry
  }

  /** A rib up the dome round its half by `azimuth`, from its spring to near its crown: a band `width` wide standing `depth` out of the inside, its face and its sides. */
  private rib(azimuth: number, width: number, depth: number, steps: number) {
    const {radius} = this.dome
    const top = Math.acos(ribCrown / radius)
    const across = new Vector3(-Math.sin(azimuth), 0, -Math.cos(azimuth))
    const positions: Array<number> = []
    for (let step = 0; step <= steps; step++) {
      const {point, normal} = this.at(azimuth, top * step / steps)
      const face = point.clone().addScaledVector(normal, -depth)
      // In the shell, its face in the room: left back, left face, right face, right back
      for (const [base, side] of [[point, -1], [face, -1], [face, 1], [point, 1]] as const) {
        positions.push(...base.clone().addScaledVector(across, side * width / 2))
      }
    }
    const indices: Array<number> = []
    for (let step = 0; step < steps; step++) {
      for (let corner = 0; corner < 3; corner++) {
        const first = step * 4 + corner
        const [next, above, aboveNext] = [first + 1, first + 4, first + 5]
        indices.push(first, above, next, next, above, aboveNext)
      }
    }
    const geometry = new BufferGeometry
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    geometry.setIndex(indices)
    // Flat faces, each its own, so the rib’s edges stay crisp
    const faceted = geometry.toNonIndexed()
    geometry.dispose()
    faceted.computeVertexNormals()
    return faceted
  }
}

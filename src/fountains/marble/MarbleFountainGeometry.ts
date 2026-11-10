import type {BowlLip, WaterJet, WaterSheet} from './config.ts'

import {BoxGeometry, BufferGeometry, CylinderGeometry, Float32BufferAttribute, Matrix4, Quaternion, TorusGeometry, Uint32BufferAttribute, Vector3} from 'three/webgpu'

import LobedProfileGeometry from '#src/lib/gallery/LobedProfileGeometry.ts'
import RevolvedProfileGeometry from '#src/lib/gallery/RevolvedProfileGeometry.ts'
import {mergeParts} from '#src/lib/geometry.ts'

import fountain, {jetFlightTime, jetPoint, jetVelocity, sheetFlightTime, sheetPoint} from './config.ts'

const {basinInnerApothem, pools, lips, lobes, profiles, bowls, veils, jet, basinNozzles, lilyJets, panels, gravity} = fountain
const up = new Vector3(0, 1, 0)
/** The lobes’ crests sit on the octagon’s axes, so a trough faces every corner nozzle. */
const lobePhase = 0
/**
 * UV u wraps around the water and v is the water’s age in seconds.
 * `waterFall` is the fraction of a fall already behind the water, which tears a sheet apart; `waterAir` is how much air the water has taken in, which turns it white; `waterLobe` is 1 where a scalloped lip pours in a trough and 0 at its crests; `waterAround` is u as a point on a circle of radius `girth`, so streaks run continuously across the seam and a wide veil gets more of them around it than a thin stream.
 */
function waterPart(geometry: BufferGeometry, {air, fall, girth, lobe}: {
  air: (progress: number) => number
  fall: (progress: number) => number
  /** radius of the circle the azimuth is laid on, about a fifth of the water’s circumference in meters */
  girth: number
  lobe?: (around: number, progress: number) => number
}, duration: number) {
  const uv = geometry.getAttribute('uv')
  const falls = new Float32Array(uv.count)
  const airs = new Float32Array(uv.count)
  const lobesOfWater = new Float32Array(uv.count)
  const arounds = new Float32Array(uv.count * 2)
  for (let i = 0; i < uv.count; i++) {
    const progress = uv.getY(i) / duration
    falls[i] = fall(progress)
    airs[i] = air(progress)
    lobesOfWater[i] = lobe ? lobe(uv.getX(i), progress) : 0.5
    arounds[i * 2] = Math.cos(uv.getX(i) * Math.PI * 2) * girth
    arounds[i * 2 + 1] = Math.sin(uv.getX(i) * Math.PI * 2) * girth
  }
  geometry.setAttribute('waterFall', new Float32BufferAttribute(falls, 1))
  geometry.setAttribute('waterAir', new Float32BufferAttribute(airs, 1))
  geometry.setAttribute('waterLobe', new Float32BufferAttribute(lobesOfWater, 1))
  geometry.setAttribute('waterAround', new Float32BufferAttribute(arounds, 2))
  return geometry
}
/** A veil pouring over a scalloped lip, thickest in the troughs; its scallops merge as it falls. */
function veil(sheet: WaterSheet, lip: BowlLip, lobeCount: number, segmentsPerLobe: number, samples: number) {
  const duration = sheetFlightTime(sheet)
  const ages = Array.from({length: samples + 1}, (_, i) => duration * i / samples)
  // The sheet starts on its pool’s surface; drawing it as a revolved line yields a seamless, double-sided curtain.
  const geometry = new LobedProfileGeometry(ages.map((age, i) => {
    const [radius, y] = sheetPoint(sheet, age)
    const merge = 1 - (i / samples) ** 0.7
    return [radius, y, lip.scallop * merge, -lip.dip * merge]
  }), {
    lobes: lobeCount,
    phase: lobePhase,
    segmentsPerLobe,
    uv: (point, around) => [around, ages[point]],
  })
  return waterPart(geometry, {
    fall: progress => progress,
    air: progress => 0.15 + progress ** 2 * 0.65,
    girth: sheet.radius * 4.4,
    lobe: (around, progress) => (0.5 - Math.cos(lobeCount * (around * Math.PI * 2 - lobePhase)) / 2) * (1 - progress * 0.7) + progress * 0.35,
  }, duration)
}
/** The main jet narrows with height by continuity until it slows, swells and ends in a rounded crown below its apex. */
function jetColumn(samples: number) {
  const rise = jet.speed ** 2 / (2 * gravity)
  const heights = Array.from({length: samples + 1}, (_, i) => rise * jet.solid * (1 - (1 - i / samples) ** 1.6))
  const age = (height: number) => (jet.speed - Math.sqrt(jet.speed ** 2 - 2 * gravity * height)) / gravity
  const radius = (height: number) => jet.radius * Math.sqrt(jet.speed / Math.sqrt(jet.speed ** 2 - 2 * gravity * height))
  const top = heights.at(-1)!
  const crown = radius(top)
  // From the tip down, so that the outside of the column is on the left of travel.
  const points: Array<[number, number, number]> = [
    [0, jet.y + top + crown, age(top)],
    [crown * 0.75, jet.y + top + crown * 0.66, age(top)],
    ...heights.toReversed().map((height): [number, number, number] => [radius(height), jet.y + height, age(height)]),
  ]
  return waterPart(new RevolvedProfileGeometry(points.map(([r, y]) => [r, y]), {
    sides: 10,
    uv: (point, around) => [around, points[point][2]],
  }), {
    fall: () => 0,
    air: progress => 0.45 + progress * 0.35,
    girth: 0.25,
  }, age(top))
}
/** A stream along a jet’s parabola, as a tube that swells a little and frays toward its landing. */
function arc(stream: WaterJet, sides: number, samples: number) {
  const duration = jetFlightTime(stream)
  const positions: Array<number> = []
  const normals: Array<number> = []
  const uvs: Array<number> = []
  const indices: Array<number> = []
  const center = new Vector3
  const direction = new Vector3
  const side = new Vector3
  const binormal = new Vector3
  const vertex = new Vector3
  for (let i = 0; i <= samples; i++) {
    const age = duration * i / samples
    const progress = i / samples
    center.set(...jetPoint(stream, age))
    direction.set(...jetVelocity(stream, age)).normalize()
    // The stream’s frame turns with its velocity; the horizontal side stays horizontal since the parabola lies in a vertical plane.
    side.crossVectors(direction, up).normalize()
    binormal.crossVectors(side, direction)
    const radius = stream.radius * (1 + progress * 0.5)
    for (let s = 0; s <= sides; s++) {
      const angle = s / sides * Math.PI * 2
      vertex.copy(side).multiplyScalar(Math.cos(angle)).addScaledVector(binormal, Math.sin(angle))
      normals.push(vertex.x, vertex.y, vertex.z)
      vertex.multiplyScalar(radius).add(center)
      positions.push(vertex.x, vertex.y, vertex.z)
      uvs.push(s / sides, age)
    }
  }
  const ring = sides + 1
  for (let i = 0; i < samples; i++) {
    for (let s = 0; s < sides; s++) {
      const a = i * ring + s
      const b = a + 1
      const c = a + ring
      const d = c + 1
      indices.push(a, c, b, b, c, d)
    }
  }
  const geometry = new BufferGeometry
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setIndex(new Uint32BufferAttribute(indices, 1))
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return waterPart(geometry, {
    fall: progress => Math.max(0, (progress - 0.45) / 0.55),
    air: progress => 0.12 + progress ** 2 * 0.65,
    girth: stream.radius * 12,
  }, duration)
}
/** Still water surfaces facing up: the basin’s octagon, and the bowls’ scalloped pools tucked `tuck` meters into the lip around them. */
function octagonPool(apothem: number, y: number) {
  return new RevolvedProfileGeometry([[0, y], [apothem, y]], {sides: 8})
}
function lobedPool(lip: BowlLip, lobeCount: number, segmentsPerLobe: number, y: number, tuck: number) {
  return new LobedProfileGeometry([[0, y, 0, 0], [lip.radius + tuck, y, lip.scallop, 0]], {
    lobes: lobeCount,
    phase: lobePhase,
    segmentsPerLobe,
  })
}
const rotation = new Quaternion
const matrix = new Matrix4
const unitScale = new Vector3(1, 1, 1)
/** Places a part built along +y at `base` so that its axis points along `direction`. */
function orient(geometry: BufferGeometry, base: Vector3, direction: Vector3) {
  rotation.setFromUnitVectors(up, direction.clone().normalize())
  geometry.applyMatrix4(matrix.compose(base, rotation, unitScale))
  return geometry
}
/** Raised fielded panels on the basin’s faces and pilasters on its corners, standing proud of the recessed wall. */
function basinRelief() {
  const parts: Array<BufferGeometry> = []
  const wall = profiles.basin.find(([, y]) => y === 0.17)![0]
  const faceWidth = 2 * wall * Math.tan(Math.PI / 8)
  const panelWidth = faceWidth - 2 * panels.margin - panels.pilasterWidth
  const turn = new Matrix4
  const shift = new Matrix4
  /** `geometry` stands on the +x face at `radial` from the axis, turned to the face at `facing`. */
  const place = (geometry: BufferGeometry, facing: number, radial: number, y: number) => {
    turn.makeRotationY(-facing)
    shift.makeTranslation(radial, y, 0)
    geometry.applyMatrix4(turn.multiply(shift))
    parts.push(geometry)
  }
  for (let i = 0; i < 8; i++) {
    const facing = i * Math.PI / 4
    // The panel’s frame, and its field standing a step higher inside it.
    place(new BoxGeometry(panels.relief + 0.03, panels.height, panelWidth), facing, wall + (panels.relief - 0.03) / 2, panels.y)
    place(new BoxGeometry(panels.relief + 0.04, panels.height - 0.09, panelWidth - 0.09), facing, wall + (panels.relief + 0.01 - 0.03) / 2, panels.y)
    // A pilaster on the corner’s bisector reaches into the stone on both sides of the corner.
    place(new BoxGeometry(panels.pilasterRelief + 0.08, panels.pilasterHeight, panels.pilasterWidth), facing + Math.PI / 8, wall / Math.cos(Math.PI / 8) + (panels.pilasterRelief - 0.08) / 2, panels.y)
  }
  return parts
}

/** An octagonal carved basin holding a pedestal with two gadrooned bowls, gilt finial and nozzles, overflowing veils, jets and pools, merged by material. */
export default class MarbleFountainGeometry {
  static readonly profiles = profiles
  readonly gilt: BufferGeometry
  readonly pools: BufferGeometry
  readonly stone: BufferGeometry
  readonly water: BufferGeometry

  constructor() {
    this.stone = mergeParts([
      new RevolvedProfileGeometry(profiles.basin, {sides: 8}),
      ...basinRelief(),
      new RevolvedProfileGeometry(profiles.foot, {sides: 24}),
      // Fluted shafts: the flutes are hollows between the lobes, so the lobes stand where the shaft is plain.
      new LobedProfileGeometry(bowls.column, {
        lobes: lobes.column,
        phase: lobePhase,
        segmentsPerLobe: 3,
      }),
      new LobedProfileGeometry(bowls.lower, {
        lobes: lobes.lower,
        phase: lobePhase,
        segmentsPerLobe: 5,
      }),
      new LobedProfileGeometry(bowls.stem, {
        lobes: lobes.stem,
        phase: lobePhase,
        segmentsPerLobe: 3,
      }),
      new LobedProfileGeometry(bowls.upper, {
        lobes: lobes.upper,
        phase: lobePhase,
        segmentsPerLobe: 6,
      }),
    ])
    // Gilt collars where the fluted shafts meet their plain necks.
    const collar = new TorusGeometry(0.21, 0.022, 10, 28)
    collar.rotateX(Math.PI / 2).translate(0, 1.205, 0)
    const stemCollar = new TorusGeometry(0.12, 0.016, 8, 20)
    stemCollar.rotateX(Math.PI / 2).translate(0, 2.375, 0)
    this.gilt = mergeParts([
      new RevolvedProfileGeometry(profiles.finial, {sides: 24}),
      collar,
      stemCollar,
      ...basinNozzles.map(({jet: stream, foot}) => {
        const mouth = new Vector3(...stream.start)
        return orient(new RevolvedProfileGeometry(profiles.nozzle, {sides: 10}), mouth, mouth.clone().sub(new Vector3(...foot)))
      }),
      ...lilyJets.map(({jet: stream, root, length}) => {
        const mouth = new Vector3(...stream.start)
        const spout = new CylinderGeometry(0.009, 0.012, length, 8)
        spout.translate(0, -length / 2, 0)
        return orient(spout, mouth, mouth.clone().sub(new Vector3(...root)))
      }),
    ])
    this.pools = mergeParts([
      // The basin surface tucks into the stone instead of leaving a sliver at the walls; the bowls brim over their lips.
      octagonPool(basinInnerApothem + 0.004, pools.basin),
      lobedPool(lips.lower, lobes.lower, 5, pools.lower, 0.006),
      lobedPool(lips.upper, lobes.upper, 6, pools.upper, 0.004),
    ])
    this.water = mergeParts([
      veil(veils.lower, lips.lower, lobes.lower, 5, 10),
      veil(veils.upper, lips.upper, lobes.upper, 6, 8),
      jetColumn(12),
      ...basinNozzles.map(({jet: stream}) => arc(stream, 6, 16)),
      ...lilyJets.map(({jet: stream}) => arc(stream, 5, 10)),
    ])
  }

  dispose() {
    this.stone.dispose()
    this.gilt.dispose()
    this.pools.dispose()
    this.water.dispose()
  }
}

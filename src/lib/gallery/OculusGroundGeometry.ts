import {ADDITION, Brush, Evaluator, SUBTRACTION} from 'three-bvh-csg'
import {BoxGeometry, BufferGeometry, ExtrudeGeometry, Float32BufferAttribute, MeshBasicNodeMaterial, Shape, ShapeUtils, Vector2} from 'three/webgpu'

import lowerGallery, {oculusApproach, oculusLowerRamps, oculusPlatform, oculusRampLandings, oculusRamps, rampLandingCorner, rampLandingOutline} from './lowerGallery.ts'
import {apseArcs, apseOutline} from './oculusApse.ts'
import tower, {towerArch, towerBridge, towerBridgeGradient, towerDeck, towerNecks, towerRamp, towerRampGradient, towerRampHalfWidth, towerRampHeight, towerRampSections} from './oculusTower.ts'
import RampGeometry from './RampGeometry.ts'
import SlopedBoxGeometry from './SlopedBoxGeometry.ts'

/** A block standing on the floor of the Oculus over the outline, with its top at `top`. */
function footprintBlock(outline: ReadonlyArray<readonly [number, number]>, top: number) {
  const footprint = new Shape
  for (const [i, [x, z]] of outline.entries()) {
    if (i === 0) {
      footprint.moveTo(x, z)
    } else {
      footprint.lineTo(x, z)
    }
  }
  footprint.closePath()
  const block = new ExtrudeGeometry(footprint, {
    depth: top - lowerGallery.oculus.floorY,
    bevelEnabled: false,
  })
  return block
}
/**
 * Replaces the faceted normals of an extruded shape’s side walls with the true radial normals wherever a vertex lies on one of
 * the given arcs (center x, center y, radius in shape space). The arcs meet their neighboring straight edges tangentially,
 * so the shading stays continuous into the flat faces.
 */
function smoothArcNormals(geometry: BufferGeometry, arcs: ReadonlyArray<readonly [number, number, number]>) {
  const positions = geometry.getAttribute('position')
  const normals = geometry.getAttribute('normal')
  for (let i = 0; i < positions.count; i++) {
    // Caps face along the extrusion axis and stay flat.
    if (Math.abs(normals.getZ(i)) > 0.5) {
      continue
    }
    const x = positions.getX(i)
    const y = positions.getY(i)
    for (const [centerX, centerY, radius] of arcs) {
      const distance = Math.hypot(x - centerX, y - centerY)
      if (Math.abs(distance - radius) < 1e-6) {
        normals.setXYZ(i, (x - centerX) / distance, (y - centerY) / distance, 0)
        break
      }
    }
  }
  normals.needsUpdate = true
}

// One architectural solid supplies both the visible surface and collision.
export default class OculusGroundGeometry extends BufferGeometry {
  constructor() {
    super()
    const evaluator = new Evaluator
    evaluator.useGroups = false
    const material = new MeshBasicNodeMaterial
    const brushes: Array<Brush> = []
    const brush = (geometry: BufferGeometry) => {
      if (geometry.hasAttribute('position') && !geometry.hasAttribute('uv')) {
        geometry.setAttribute('uv', new Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 2), 2))
      }
      const result = new Brush(geometry, material)
      result.updateMatrixWorld(true)
      brushes.push(result)
      return result
    }
    const combine = (left: Brush, right: Brush, operation = ADDITION) => evaluator.evaluate(left, right, operation, brush(new BufferGeometry))
    const block = ({position, size}: typeof oculusPlatform) => {
      const platformBlock = new BoxGeometry(...size)
      return brush(platformBlock.translate(...position))
    }
    try {
      const {floorY} = lowerGallery.oculus
      const slope = new BoxGeometry(towerRamp.width, 1, towerRamp.endZ - towerRamp.startZ, 1, 1, towerRampSections.length - 1)
      const vertices = slope.getAttribute('position')
      for (let i = 0; i < vertices.count; i++) {
        const section = Math.round((vertices.getZ(i) / (towerRamp.endZ - towerRamp.startZ) + 0.5) * (towerRampSections.length - 1))
        const z = towerRampSections[section]
        const fraction = (z - towerRamp.startZ) / (towerRamp.endZ - towerRamp.startZ)
        const height = towerRampHeight(fraction) - floorY
        vertices.setX(i, Math.sign(vertices.getX(i)) * towerRampHalfWidth(z))
        vertices.setY(i, (vertices.getY(i) + 0.5) * height)
        vertices.setZ(i, z - (towerRamp.startZ + towerRamp.endZ) / 2)
      }
      slope.computeVertexNormals()
      const topNormals = slope.getAttribute('normal')
      for (let i = 0; i < vertices.count; i++) {
        if (!(topNormals.getY(i) > 0.5)) {
          continue
        }
        const fraction = vertices.getZ(i) / (towerRamp.endZ - towerRamp.startZ) + 0.5
        const gradient = towerRampGradient(fraction)
        const length = Math.hypot(1, gradient)
        topNormals.setXYZ(i, 0, 1 / length, -gradient / length)
      }
      slope.translate(tower.x, floorY, (towerRamp.startZ + towerRamp.endZ) / 2)
      const roofSlope = (towerArch.height - towerArch.lowHeight) / towerArch.width
      const roofAtBridgeEnd = floorY + towerArch.height - roofSlope * (towerArch.z + towerArch.width / 2 - towerRamp.endZ)
      // Behind its end, the bridge reaches into the tower up to the passage’s roof, so the fillet that rounds the roof down
      // into the tower is carved from one piece and stays flush with the bridge’s sides. It starts well below the fillet but
      // above the floor, whose plane it would otherwise share with the tower.
      const reachBottom = floorY + towerArch.height - towerArch.highCornerRadius * 3
      const reach = new BoxGeometry(towerRamp.width, roofAtBridgeEnd - reachBottom, tower.z - towerRamp.endZ)
      reach.translate(tower.x, (reachBottom + roofAtBridgeEnd) / 2, (towerRamp.endZ + tower.z) / 2)
      // Only the bridge is cut, so the passage ends against the round tower.
      const bridge = combine(combine(brush(slope), brush(reach)), brush(new ArchCutterGeometry), SUBTRACTION)
      // The bridges’ slabs are part of the tower, whose shoulders their undersides close against.
      const deck = tower.floorY + tower.height
      let solid = combine(bridge, brush(new TowerGeometry(towerNecks.map((_, index) => (index ? deck - towerBridge.thickness : roofAtBridgeEnd)))))
      // The platform runs along the side walls’ north ends and fills the apse behind them, under its round wall.
      const {position, size} = oculusPlatform
      const platformTop = position[1] + size[1] / 2
      const platform = footprintBlock([
        [position[0] - size[0] / 2, position[2] + size[2] / 2],
        [position[0] + size[0] / 2, position[2] + size[2] / 2],
        ...apseOutline().toReversed(),
      ], platformTop)
      smoothArcNormals(platform, apseArcs().map(({center, radius}) => [center[0], center[1], radius] as const))
      solid = combine(solid, brush(platform.rotateX(Math.PI / 2).translate(0, platformTop, 0)))
      for (const ramp of oculusRamps) {
        const middleY = ramp.floorY + ramp.rise / 2
        const height = middleY - floorY
        const rampPrism = new SlopedBoxGeometry(ramp.width, height, ramp.run, -ramp.rise / ramp.run, 0)
        solid = combine(solid, brush(rampPrism.translate(ramp.x, floorY + height / 2, ramp.startZ - ramp.run / 2)))
      }
      for (const ramp of oculusLowerRamps) {
        const middleY = ramp.floorY + ramp.rise / 2
        const height = middleY - floorY
        const rampPrism = new SlopedBoxGeometry(ramp.width, height, ramp.run, ramp.rise / ramp.run, 0)
        solid = combine(solid, brush(rampPrism.translate(ramp.x, floorY + height / 2, ramp.startZ + ramp.run / 2)))
      }
      const {x: approachX, width, northZ, southZ, rise, rampWidth, rampRun} = oculusApproach
      solid = combine(solid, block({
        position: [approachX, floorY + rise / 2, (northZ + southZ) / 2],
        size: [width, rise, southZ - northZ],
      }))
      const centerRamp = new RampGeometry(rampWidth, rise, rampRun)
      solid = combine(solid, brush(centerRamp.translate(approachX, floorY, southZ + rampRun)))
      for (const landing of oculusRampLandings) {
        const landingBlock = footprintBlock(rampLandingOutline(landing), landing.position[1] + landing.size[1] / 2)
        const corner = rampLandingCorner(landing)
        smoothArcNormals(landingBlock, [[corner.x, corner.z, landing.cornerRadius]])
        landingBlock.rotateX(Math.PI / 2).translate(0, landing.position[1] + landing.size[1] / 2, 0)
        solid = combine(solid, brush(landingBlock))
      }
      this.copy(solid.geometry)
      // World-scale projection keeps the stone grain consistent across the joined pieces.
      const positions = this.getAttribute('position')
      const normals = this.getAttribute('normal')
      const uv = new Float32Array(positions.count * 2)
      for (let i = 0; i < positions.count; i++) {
        const x = Math.abs(normals.getX(i))
        const y = Math.abs(normals.getY(i))
        const z = Math.abs(normals.getZ(i))
        uv[i * 2] = (x > y && x > z ? positions.getZ(i) : positions.getX(i)) / 8
        uv[i * 2 + 1] = (y >= x && y >= z ? positions.getZ(i) : positions.getY(i)) / 8
      }
      this.setAttribute('uv', new Float32BufferAttribute(uv, 2))
      this.computeBoundingBox()
      this.computeBoundingSphere()
    } finally {
      for (const value of brushes) {
        value.disposeCacheData()
        value.geometry.dispose()
      }
      material.dispose()
    }
  }
}

/**
 * The air of the passage under the bridge, with a sloping roof between two circular fillets: a fixed one into the base’s
 * front face, and one into the round tower’s wall, which follows the wall around. Only the part near the tower is split into
 * sections across the bridge, so the rest of the cut stays as lean as a plain extrusion. Radial normals keep the few chords
 * of both fillets looking round.
 */
class ArchCutterGeometry extends BufferGeometry {
  constructor() {
    super()
    const halfWidth = towerArch.width / 2
    const roofSlope = (towerArch.height - towerArch.lowHeight) / towerArch.width
    const tangent = Math.hypot(1, roofSlope)
    const tangentAngle = Math.atan2(1, roofSlope)
    const lowRadius = towerArch.cornerRadius
    const lowU = halfWidth - lowRadius
    const lowY = towerArch.lowHeight + roofSlope * lowRadius - lowRadius * tangent
    const highRadius = towerArch.highCornerRadius
    // Local u runs from the tower toward the base, in the passage’s cross section.
    const roof = (u: number) => towerArch.height - roofSlope * (u + halfWidth)
    // The lower jamb coincides with the base’s front face. Instead of cutting along that plane, which would leave coplanar
    // faces to the CSG, the cutter reaches into the base volume, which the base block refills afterward.
    const overshoot = 0.2
    const lowSteps = 12
    const highSteps = 14
    const sections = 8
    const bridgeHalfWidth = towerRamp.width / 2
    const reach = bridgeHalfWidth + towerRamp.baseCornerRadius + 1
    type Vertex = {
      arc?: number
      normal?: readonly [number, number, number]
      position: readonly [number, number, number]
    }
    const at = (x: number, u: number, y: number) => [tower.x + x, tower.floorY + y, towerArch.z - u] as const
    const xs = [-reach, ...Array.from({length: sections + 1}, (_, i) => -bridgeHalfWidth + bridgeHalfWidth * 2 * i / sections), reach]
    const walls = xs.map(x => {
      const along = Math.max(-bridgeHalfWidth, Math.min(bridgeHalfWidth, x))
      const depth = Math.sqrt(tower.radius ** 2 - along ** 2)
      // A hair inside the faceted cylinder, so the bridge leaves no sliver standing beside its chords.
      return {
        u: towerArch.z - (tower.z - depth + 0.002),
        radial: [along / tower.radius, -depth / tower.radius] as const,
      }
    })
    // Where the sections begin, a little before the first fillet leaves the roof
    const split = Math.max(...walls.map(({u}) => u)) + highRadius * (1 + Math.cos(tangentAngle)) + 0.05
    const lowChain = (x: number): Array<Vertex> => [
      {position: at(x, halfWidth + overshoot, -0.1)},
      {position: at(x, halfWidth + overshoot, lowY)},
      ...Array.from({length: lowSteps + 1}, (__, k): Vertex => {
        const angle = tangentAngle * k / lowSteps
        return {
          position: at(x, lowU + lowRadius * Math.cos(angle), lowY + lowRadius * Math.sin(angle)),
          normal: [0, Math.sin(angle), -Math.cos(angle)],
          arc: 0,
        }
      }),
    ]
    const highChains = xs.map((x, i): Array<Vertex> => {
      const {u: wallU, radial} = walls[i]
      const highU = wallU + highRadius
      const highY = roof(highU) - highRadius * tangent
      return [
        {position: at(x, split, roof(split))},
        ...Array.from({length: highSteps + 1}, (__, k): Vertex => {
          const angle = tangentAngle + (Math.PI - tangentAngle) * k / highSteps
          // Pointing away from the passage: into the roof, turning into the tower’s wall.
          const wall = Math.max(0, -Math.cos(angle))
          const normal = [-radial[0] * wall, Math.sin(angle), -Math.cos(angle) * (1 - (1 - Math.abs(radial[1])) * wall)]
          const length = Math.hypot(...normal)
          return {
            position: at(x, highU + highRadius * Math.cos(angle), highY + highRadius * Math.sin(angle)),
            normal: normal.map(value => value / length) as unknown as readonly [number, number, number],
            arc: 1,
          }
        }),
        {position: at(x, wallU, -0.1)},
      ]
    })
    const positions: Array<number> = []
    const normals: Array<number> = []
    const face = ([a, b, c]: Array<readonly [number, number, number]>) => {
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
      const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
      const result = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
      const length = Math.hypot(...result)
      return result.map(value => value / length) as unknown as readonly [number, number, number]
    }
    // The cross section is star-shaped around a point inside the passage, which tells every face which way is out.
    const inside = at(0, 0, 2)
    const triangle = (corners: Array<Vertex>, outward?: readonly [number, number, number], smooth = false) => {
      const flat = face(corners.map(({position}) => position))
      const center = [0, 1, 2].map(axis => corners.reduce((sum, {position}) => sum + position[axis], 0) / 3)
      const direction = outward ?? [0, center[1] - inside[1], center[2] - inside[2]]
      const flip = flat[0] * direction[0] + flat[1] * direction[1] + flat[2] * direction[2] < 0
      for (const corner of flip ? [corners[0], corners[2], corners[1]] : corners) {
        positions.push(...corner.position)
        normals.push(...smooth ? corner.normal! : (flip ? flat.map(value => -value) : flat))
      }
    }
    const strip = (left: Array<Vertex>, right: Array<Vertex>) => {
      for (let k = 0; k < left.length - 1; k++) {
        const smooth = left[k].arc !== undefined && left[k].arc === left[k + 1].arc
        triangle([left[k], right[k], left[k + 1]], undefined, smooth)
        triangle([left[k + 1], right[k], right[k + 1]], undefined, smooth)
      }
    }
    const polygon = (vertices: Array<Vertex>, outward: readonly [number, number, number], project: (position: readonly [number, number, number]) => Vector2) => {
      for (const indices of ShapeUtils.triangulateShape(vertices.map(({position}) => project(position)), [])) {
        triangle(indices.map(index => vertices[index]), outward)
      }
    }
    const lowLeft = lowChain(-reach)
    const lowRight = lowChain(reach)
    strip(lowLeft, lowRight)
    for (let i = 0; i < xs.length - 1; i++) {
      strip(highChains[i], highChains[i + 1])
    }
    // The roof between the base’s fillet and the sections, and the floor beneath it all, close the seams without T-junctions.
    polygon([lowLeft.at(-1)!, lowRight.at(-1)!, ...highChains.toReversed().map(chain => chain[0])], [0, 1, 0], ([x, , z]) => new Vector2(x, z))
    polygon([lowLeft[0], lowRight[0], ...highChains.toReversed().map(chain => chain.at(-1)!)], [0, -1, 0], ([x, , z]) => new Vector2(x, z))
    for (const [low, high, facing] of [[lowLeft, highChains[0], -1], [lowRight, highChains.at(-1)!, 1]] as const) {
      polygon([...low, ...high], [facing, 0, 0], position => new Vector2(position[2], position[1]))
    }
    this.setAttribute('position', new Float32BufferAttribute(positions, 3))
    this.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  }
}
/**
 * The tower as one closed solid: a full cylinder whose top flows into the shoulders joining it to the ramp and the bridges, like modeled clay, with the bridges’ slabs out to their walls.
 * Below their rim, the shoulders ease sideways in a smooth S-curve, onto the cylinder or onto the side of the ramp or bridge where that stands in front of it, so nothing flattens the cylinder down to the floor and no ledge is left beneath them.
 * Each neck has a bottom of its own, where its shoulders end and its underside closes behind it: the ramp’s under the passage’s roof, the bridges’ under their slabs. Building the union directly keeps the CSG from fragmenting the shared surfaces.
 */
class TowerGeometry extends BufferGeometry {
  constructor(bottoms: ReadonlyArray<number>) {
    super()
    const top = tower.floorY + tower.height
    const {floorY, radius} = tower
    const rim = 0.2
    const arcStep = 2.64 * Math.PI / 180
    const count = towerDeck.length
    const at = (index: number) => (index + count) % count
    const outline = towerDeck.map(({point}) => point)
    const targets = towerDeck.map(({target}) => target)
    const bottom = (index: number) => bottoms[towerDeck[index].neck]
    // A shoulder that eases far down takes more steps than one under a thin slab.
    const levels = bottoms.map(value => {
      const steps = Math.max(2, Math.ceil((top - rim - value) / 0.14))
      return [value, ...Array.from({length: steps - 1}, (_, k) => value + (top - rim - value) * (k + 1) / steps), top - rim, top]
    })
    // Near a join, a shoulder curve dips a few millimeters inside the circle; there it stands on the ground as it is.
    const grounded = targets.map(([x, z]) => Math.hypot(x, z) < radius + 1e-6)
    const easing = outline.map(([x, z], i) => Math.hypot(x - targets[i][0], z - targets[i][1]) > 1e-9)
    // 0 along the rim, 1 at the bottom, with level tangents at both ends.
    const ease = (index: number, y: number) => {
      const span = top - rim - bottom(index)
      const t = Math.min(1, Math.max(0, (top - rim - y) / span))
      return [t * t * (3 - 2 * t), y > top - rim || y < bottom(index) ? 0 : -6 * t * (1 - t) / span] as const
    }
    // Along a bridge, every level is lifted by as far as the bridge has climbed there.
    const point = (index: number, y: number) => {
      const [x, z] = outline[at(index)]
      const [targetX, targetZ] = targets[at(index)]
      const [eased] = ease(at(index), y)
      return [tower.x + x + (targetX - x) * eased, y + towerDeck[at(index)].lift, tower.z + z + (targetZ - z) * eased] as const
    }
    const normal = (index: number, y: number) => {
      const [targetX, targetZ] = targets[index]
      // Below the shoulders, standing columns are plain cylinder.
      if (y < bottom(index) && grounded[index]) {
        return [targetX / radius, 0, targetZ / radius] as const
      }
      const level = Math.max(y, bottom(index))
      // Sharp corners take their tangent from the side that shows alone, and so do the columns where a bridge’s side meets the
      // cylinder, keeping the creases crisp.
      const {corner} = towerDeck[index]
      const previous = corner === 'after' || grounded[index] && !grounded[at(index - 1)] ? index : index - 1
      const next = corner === 'before' || grounded[index] && !grounded[at(index + 1)] ? index : index + 1
      const a = point(previous, level)
      const b = point(next, level)
      const ring = [b[0] - a[0], 0, b[2] - a[2]]
      const slope = ease(index, level)[1]
      const vertical = [(targetX - outline[index][0]) * slope, 1, (targetZ - outline[index][1]) * slope]
      const result = [vertical[1] * ring[2] - vertical[2] * ring[1], vertical[2] * ring[0] - vertical[0] * ring[2], vertical[0] * ring[1] - vertical[1] * ring[0]]
      // The outline runs counterclockwise in the floor plan, so the outside lies to the right of the ring’s direction.
      const sign = Math.sign(result[0] * ring[2] - result[2] * ring[0]) / Math.hypot(...result)
      return result.map(value => value * sign) as unknown as readonly [number, number, number]
    }
    type Vertex = {
      /** its height before a bridge’s climb lifts it */
      level: number
      normal: readonly [number, number, number]
      position: readonly [number, number, number]
    }
    const columns = outline.map((_, i): Array<Vertex> => {
      const neckLevels = levels[towerDeck[i].neck]
      const band = easing[i] || easing[at(i - 1)] || easing[at(i + 1)] ? neckLevels : [bottom(i), top]
      const heights = grounded[i] ? [floorY, ...band.slice(band === neckLevels ? 0 : 1)] : band
      return heights.map(y => ({
        level: y,
        position: point(i, y),
        normal: normal(i, y),
      }))
    })
    const lower = (index: number) => columns[index].filter(({level}) => level <= bottom(index))
    const upper = (index: number, column = columns[index]) => column.filter(({level}) => level >= bottom(index))
    // Every neck stands in front of the cylinder between the last grounded column before it and the first after it. Below its
    // bottom, the cylinder closes behind its end along its own arc.
    const necks = towerNecks.map((_, neck) => {
      const run = outline.map((__, i) => i).filter(i => towerDeck[i].neck === neck && !grounded[i])
      const first = run.find(i => grounded[at(i - 1)])!
      const last = run.find(i => grounded[at(i + 1)])!
      const left = at(first - 1)
      const right = at(last + 1)
      const leftAngle = Math.atan2(targets[left][1], targets[left][0])
      const span = ((Math.atan2(targets[right][1], targets[right][0]) - leftAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)
      const segments = Math.ceil(span / arcStep)
      const arc = Array.from({length: segments - 1}, (__, k): Array<Vertex> => {
        const theta = leftAngle + span * (k + 1) / segments
        const radial = [Math.cos(theta), 0, Math.sin(theta)] as const
        return [floorY, bottoms[neck]].map(y => ({
          level: y,
          position: [tower.x + Math.cos(theta) * radius, y, tower.z + Math.sin(theta) * radius] as const,
          normal: radial,
        }))
      })
      return {
        left,
        right,
        arc,
      }
    })
    const positions: Array<number> = []
    const normals: Array<number> = []
    const face = ([a, b, c]: Array<readonly [number, number, number]>) => {
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
      const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
      return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    }
    const triangle = (corners: Array<Vertex>, flip: boolean) => {
      for (const corner of flip ? [corners[0], corners[2], corners[1]] : corners) {
        positions.push(...corner.position)
        normals.push(...corner.normal)
      }
    }
    // Every strip runs the same way around the tower, so one plain wall decides the winding for all of them.
    const plain = outline.findIndex((_, i) => grounded[i] && grounded[at(i + 1)] && !easing[i] && !easing[at(i + 1)] && columns[i].length === 2 && columns[at(i + 1)].length === 2)
    const reference = face([columns[plain][0].position, columns[at(plain + 1)][0].position, columns[plain][1].position])
    const flipStrips = reference[0] * outline[plain][0] + reference[2] * outline[plain][1] < 0
    // Zip neighboring columns together level by level, so columns with different levels still share every edge.
    const zip = (left: Array<Vertex>, right: Array<Vertex>) => {
      let l = 0
      let r = 0
      while (l < left.length - 1 || r < right.length - 1) {
        const advanceLeft = r === right.length - 1 || l < left.length - 1 && left[l + 1].level <= right[r + 1].level
        triangle(advanceLeft ? [left[l], right[r], left[l + 1]] : [left[l], right[r], right[r + 1]], flipStrips)
        if (advanceLeft) {
          l++
        } else {
          r++
        }
      }
    }
    // Where a bridge’s flat side meets the tower, the strip between them stays flat, keeping the crease crisp instead of
    // smearing the tower’s curvature across the bridge’s side.
    const flatten = (column: Array<Vertex>, side: Array<Vertex>) => column.map(({level, position}) => ({
      level,
      position,
      normal: side.find(vertex => vertex.level === level)?.normal ?? side[0].normal,
    }))
    for (const [i, left] of columns.entries()) {
      const j = at(i + 1)
      const right = columns[j]
      if (grounded[i] && grounded[j]) {
        zip(left, right)
      } else if (grounded[i] || grounded[j]) {
        zip(upper(i, grounded[i] ? flatten(left, right) : left), upper(j, grounded[i] ? right : flatten(right, left)))
      } else {
        zip(upper(i), upper(j))
      }
    }
    for (const {left, right, arc} of necks) {
      const back = [lower(left), ...arc, lower(right)]
      for (let k = 0; k < back.length - 1; k++) {
        zip(back[k], back[k + 1])
      }
    }
    const cap = (vertices: Array<readonly [number, number, number]>, up: boolean) => {
      for (const indices of ShapeUtils.triangulateShape(vertices.map(([x, , z]) => new Vector2(x, z)), [])) {
        const corners = indices.map(index => vertices[index])
        triangle(corners.map(position => ({
          level: position[1],
          position,
          normal: [0, up ? 1 : -1, 0] as const,
        })), face(corners)[1] > 0 !== up)
      }
    }
    // A bridge’s body climbs, so its floor and its underside run across it from side to side, point by point, instead of joining the level caps. Its first and last points are where it leaves the deck, before it climbs.
    const bodies = towerNecks.map((neck, index) => (neck.wallDistance === undefined ? [] : towerDeck.keys().filter(i => towerDeck[i].neck === index && !towerDeck[i].shoulder && Math.hypot(...towerDeck[i].local) > radius + 1e-6).toArray()))
    const climbing = new Set(bodies.flatMap(body => body.slice(1, -1)))
    /** the normal of a bridge’s floor at a point of its outline, tilted back by its climb, or of its underside */
    const slopeNormal = (index: number, up: boolean) => {
      const {neck, local: [along]} = towerDeck[index]
      const {angle, wallDistance} = towerNecks[neck]
      const gradient = wallDistance === undefined ? 0 : towerBridgeGradient(along, wallDistance)
      const length = Math.hypot(1, gradient) * (up ? 1 : -1)
      return [-gradient * Math.cos(angle) / length, 1 / length, -gradient * Math.sin(angle) / length] as const
    }
    const across = (body: ReadonlyArray<number>, vertex: (index: number) => Vertex, up: boolean) => {
      for (let k = 0; k < body.length / 2 - 1; k++) {
        const quad = [body[k], body[k + 1], body.at(-2 - k)!, body.at(-1 - k)!].map(index => ({
          ...vertex(index),
          normal: slopeNormal(index, up),
        }))
        for (const corners of [[quad[0], quad[1], quad[2]], [quad[0], quad[2], quad[3]]]) {
          triangle(corners, face(corners.map(({position}) => position))[1] > 0 !== up)
        }
      }
    }
    cap(columns.filter((_, i) => !climbing.has(i)).map(column => column.at(-1)!.position), true)
    for (const body of bodies) {
      across(body, index => columns[index].at(-1)!, true)
    }
    // The ground runs round the grounded columns from each neck to the next, and along the arc behind each neck’s end.
    const ground: Array<readonly [number, number, number]> = []
    for (const [k, {right}] of necks.entries()) {
      const next = necks[(k + 1) % necks.length]
      for (let i = right; ; i = at(i + 1)) {
        ground.push(columns[i][0].position)
        if (i === next.left) {
          break
        }
      }
      ground.push(...next.arc.map(column => column[0].position))
    }
    cap(ground, false)
    // The underside behind each neck’s end, between it and the cylinder, continues the passage’s roof or the bridge’s slab.
    for (const [neck, {left, right, arc}] of necks.entries()) {
      const underside: Array<readonly [number, number, number]> = []
      for (let i = right; ; i = at(i - 1)) {
        if (!climbing.has(i)) {
          underside.push(upper(i)[0].position)
        }
        if (i === left) {
          break
        }
      }
      cap([...underside, ...arc.map(column => column[1].position)], false)
      across(bodies[neck], index => upper(index)[0], false)
    }
    this.setAttribute('position', new Float32BufferAttribute(positions, 3))
    this.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  }
}

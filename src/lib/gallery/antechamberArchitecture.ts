import {BoxGeometry, BufferGeometry, ExtrudeGeometry, Float32BufferAttribute, Path, Shape, Vector3} from 'three/webgpu'

import {mergeParts} from '../geometry.ts'
import antechamber, {antechamberEastFlight, antechamberEastLanding} from './antechamber.ts'
import ArcSlabGeometry from './ArcSlabGeometry.ts'
import {stairHandrailBend} from './stairs/StairHandrailGeometry.ts'

/**
 * Semicircular barrel vault spanning a 2 m Antechamber neck along local x (`[-length / 2, length / 2]`), springing from `y = 0` to `y = width / 2`.
 */
export function neckVaultGeometry(innerRadius = antechamber.neck.width / 2, outerRadius = innerRadius + antechamber.neck.vaultThickness, length = antechamber.neck.length): BufferGeometry {
  // ArcSlabGeometry bends around z in the xy plane; rotating +90° around y puts the tunnel axis along x.
  const slab = new ArcSlabGeometry({
    radii: [innerRadius, outerRadius],
    angles: [0, Math.PI],
    z: [-length / 2, length / 2],
    segments: 32,
  })
  return slab.rotateY(Math.PI / 2)
}

/**
 * Burnished brass arch rib lining the middle of a barrel-vaulted neck, continuing down both jamb walls to the floor as slender pilaster strips with crisp impost collars at the springing line (`y = 0` in the geometry’s local space).
 */
export function neckBrassRibGeometry(): BufferGeometry {
  const r = antechamber.neck.width / 2
  const {springY} = antechamber.neck
  const ribWidth = 0.09
  const ribDepth = 0.035
  const arch = new ArcSlabGeometry({
    radii: [r - ribDepth, r + 0.015],
    angles: [0, Math.PI],
    z: [-ribWidth / 2, ribWidth / 2],
    segments: 32,
  })
  arch.rotateY(Math.PI / 2)
  const parts: Array<BufferGeometry> = [arch]
  for (const side of [-1, 1]) {
    // Vertical pilaster strip running down the jamb wall from the springing line to the floor.
    const pilaster = new BoxGeometry(ribWidth, springY, ribDepth + 0.015)
    pilaster.translate(0, -springY / 2, side * (r - (ribDepth - 0.015) / 2))
    parts.push(pilaster)
    // Stepped impost collar marking the springing line where arch and pilaster meet.
    const impost = new BoxGeometry(ribWidth + 0.05, 0.055, ribDepth + 0.035)
    impost.translate(0, 0, side * (r - (ribDepth + 0.015) / 2))
    parts.push(impost)
    // Small base plinth grounding each pilaster at floor level.
    const plinth = new BoxGeometry(ribWidth + 0.04, 0.12, ribDepth + 0.03)
    plinth.translate(0, -springY + 0.06, side * (r - (ribDepth + 0.01) / 2))
    parts.push(plinth)
  }
  return mergeParts(parts)
}

/** Extruded flat ceiling slab for a flanking pavilion (`5 × 6 m`) pierced by a centered circular oculus opening. */
export function pavilionCeilingSlabGeometry(): BufferGeometry {
  const [width, depth] = antechamber.pavilion.size
  const {radius} = antechamber.pavilion.skylight
  const outline = new Shape
  outline.moveTo(-width / 2, -depth / 2)
  outline.lineTo(width / 2, -depth / 2)
  outline.lineTo(width / 2, depth / 2)
  outline.lineTo(-width / 2, depth / 2)
  outline.closePath()
  const opening = new Path
  opening.absarc(0, 0, radius, 0, Math.PI * 2, true)
  outline.holes.push(opening)
  return new ExtrudeGeometry(outline, {
    bevelEnabled: false,
    curveSegments: 96,
    depth: 0.18,
  })
}

/** Cylindrical ultramarine drum rising above a pavilion’s oculus opening up to its skylight lattice. */
export function pavilionDrumGeometry(): BufferGeometry {
  const {radius, drumHeight} = antechamber.pavilion.skylight
  const outer = new Shape
  outer.absarc(0, 0, radius + 0.16, 0, Math.PI * 2, false)
  const hole = new Path
  hole.absarc(0, 0, radius, 0, Math.PI * 2, true)
  outer.holes.push(hole)
  const drum = new ExtrudeGeometry(outer, {
    bevelEnabled: false,
    curveSegments: 96,
    depth: drumHeight,
  })
  return drum.rotateX(-Math.PI / 2)
}

/**
 * Open burnished-brass 12-fold tracery capping each pavilion’s oculus skylight, aligned 1-to-1 with the 12 lead spokes and rosette rings of `StainedGlassMaterial` so brass and lead unify into a single luminous jewel rosette.
 */
export function pavilionLatticeGeometry(): BufferGeometry {
  const {radius, latticeDepth} = antechamber.pavilion.skylight
  const parts: Array<BufferGeometry> = []
  const ring = (outerR: number, innerR: number) => {
    const shape = new Shape
    shape.absarc(0, 0, outerR, 0, Math.PI * 2, false)
    const hole = new Path
    hole.absarc(0, 0, innerR, 0, Math.PI * 2, true)
    shape.holes.push(hole)
    const extruded = new ExtrudeGeometry(shape, {
      bevelEnabled: false,
      curveSegments: 72,
      depth: latticeDepth,
    })
    return extruded.rotateX(-Math.PI / 2)
  }
  // Outer rim, petal-tip ring and inner sun-disc ring aligned with the stained-glass rosette’s 0.30 center and 0.76 petal crown.
  parts.push(
    ring(radius + 0.05, radius - 0.055),
    ring(radius * 0.775, radius * 0.735),
    ring(radius * 0.32, radius * 0.285),
  )
  // Twelve slender radial mullions aligned with the twelve stained-glass petal valleys (0°, 30°, 60°, …).
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6
    const startR = radius * 0.3
    const length = radius - startR
    const bar = new BoxGeometry(length, latticeDepth, 0.032)
    bar.translate(startR + length / 2, latticeDepth / 2, 0).rotateY(angle)
    parts.push(bar)
  }
  return mergeParts(parts)
}

/** Flush brass compass medallion beneath the central dome’s oculus star: outer ring, inner ring and eight slender compass rays. */
export function centralCompassInlayGeometry(): BufferGeometry {
  const parts: Array<BufferGeometry> = [
    floorRing(1.88, 1.82),
    floorRing(0.56, 0.51),
  ]
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4
    const major = i % 2 === 0
    const inner = major ? 0.54 : 0.72
    const outer = major ? 1.84 : 1.56
    const halfWidth = major ? 0.022 : 0.015
    const ray = new Shape
    ray.moveTo(inner, -halfWidth)
    ray.lineTo(outer, -halfWidth * 0.45)
    ray.lineTo(outer, halfWidth * 0.45)
    ray.lineTo(inner, halfWidth)
    ray.closePath()
    const extruded = new ExtrudeGeometry(ray, {
      bevelEnabled: false,
      depth: 0.01,
    })
    parts.push(extruded.rotateX(-Math.PI / 2).rotateY(angle).translate(0, -0.005, 0))
  }
  return mergeParts(parts)
}

/** Flush brass floor ring mirroring a flanking pavilion’s oculus skylight above. */
export function pavilionFloorRingGeometry(): BufferGeometry {
  const r = antechamber.pavilion.skylight.radius
  return floorRing(r + 0.02, r - 0.02)
}

/**
 * Continuous brass handrail along one side (`side = -1` north, `+1` south) of the east ascending staircase, easing smoothly from the bottom threshold up the flight and onto the level top landing.
 * Returned in Antechamber-local coordinates (relative to `[0, 0, 12]`).
 */
export function eastStairHandrailGeometry(side: -1 | 1): BufferGeometry {
  const [originX, originZ] = antechamber.center
  const z = antechamber.eastStairs.z - originZ + side * (antechamber.eastStairs.width / 2 - 0.22)
  const xStart = antechamberEastFlight.end[0] - originX + 0.1
  const xBottomFoot = antechamberEastFlight.end[0] + antechamber.eastStairs.bottomLanding - originX
  const xTopHead = antechamberEastLanding.startX - originX
  const xEnd = antechamberEastLanding.endX - originX - 0.18
  const topY = antechamberEastLanding.floorY
  const slope = topY / (xTopHead - xBottomFoot)
  const half = 0.065 / 2
  const bend = Math.min(stairHandrailBend, 0.5)
  const ease = (distance: number) => {
    if (Math.abs(distance) >= bend) {
      return 0
    }
    return (distance + bend) ** 2 / (4 * bend) - Math.max(distance, 0)
  }
  const heightAt = (x: number) => {
    const base = x <= xBottomFoot ? 0 : (x >= xTopHead ? topY : (x - xBottomFoot) * slope)
    return 1 + base + slope * ease(x - xBottomFoot) - slope * ease(x - xTopHead)
  }
  const sampleXs = new Set<number>([xStart, xEnd])
  const steps = 48
  for (let i = 0; i <= steps; i++) {
    sampleXs.add(xStart + (xEnd - xStart) * i / steps)
  }
  const xs = [...sampleXs].toSorted((a, b) => a - b)
  const stations = xs.map(x => {
    const y = heightAt(x)
    const grade = (heightAt(x + 0.001) - heightAt(x - 0.001)) / 0.002
    const up = new Vector3(-grade, 1, 0)
    up.normalize()
    return {
      point: new Vector3(x, y, z),
      up,
    }
  })
  const rings = stations.map(({point}) => [
    new Vector3(point.x, point.y - half, point.z + half),
    new Vector3(point.x, point.y - half, point.z - half),
    new Vector3(point.x, point.y + half, point.z - half),
    new Vector3(point.x, point.y + half, point.z + half),
  ])
  const positions: Array<number> = []
  const normals: Array<number> = []
  const uvs: Array<number> = []
  const indices: Array<number> = []
  const sideNormal = new Vector3(0, 0, 1)
  const quad = (points: Array<Vector3>, faceNormals: Array<Vector3>, from: number, to: number) => {
    const base = positions.length / 3
    for (let i = 0; i < 4; i++) {
      positions.push(...points[i])
      normals.push(...faceNormals[i])
      uvs.push(i < 2 ? from : to, i === 0 || i === 3 ? 0 : half * 2)
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
  let distance = 0
  for (let i = 1; i < rings.length; i++) {
    const from = rings[i - 1]
    const to = rings[i]
    const nextDistance = distance + stations[i].point.distanceTo(stations[i - 1].point)
    for (let face = 0; face < 4; face++) {
      const next = (face + 1) % 4
      const sign = face < 2 ? -1 : 1
      const fromNormal = (face % 2 ? sideNormal : stations[i - 1].up).clone().multiplyScalar(sign)
      const toNormal = (face % 2 ? sideNormal : stations[i].up).clone().multiplyScalar(sign)
      quad([from[face], from[next], to[next], to[face]], [fromNormal, fromNormal, toNormal, toNormal], distance, nextDistance)
    }
    distance = nextDistance
  }
  quad(rings[0].toReversed(), Array.from({length: 4}, () => new Vector3(-1, 0, 0)), 0, half * 2)
  quad(rings.at(-1)!, Array.from({length: 4}, () => new Vector3(1, 0, 0)), 0, half * 2)
  const rail = new BufferGeometry
  rail.setAttribute('position', new Float32BufferAttribute(positions, 3))
  rail.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  rail.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  rail.setIndex(indices)
  // Anchor the handrail into the wall with brass return brackets along its length and at both ends.
  const wallZ = antechamber.eastStairs.z - originZ + side * (antechamber.eastStairs.width / 2 - 0.105)
  const bracketSpan = Math.abs(wallZ - z)
  const bracketCenterZ = (wallZ + z) / 2
  const parts: Array<BufferGeometry> = [rail]
  for (const bx of [xStart + 0.04, xStart + 1.5, xStart + 3, xStart + 4.5, xEnd - 0.04]) {
    const arm = new BoxGeometry(0.042, 0.042, bracketSpan)
    arm.translate(bx, heightAt(bx) - half - 0.015, bracketCenterZ)
    const rosette = new BoxGeometry(0.09, 0.09, 0.018)
    rosette.translate(bx, heightAt(bx) - half - 0.015, wallZ - side * 0.009)
    parts.push(arm, rosette)
  }
  return mergeParts(parts)
}
/** Flat circular brass inlay ring lying flush on the floor (in xz, thickness `height` centered at y = 0). */
function floorRing(outerRadius: number, innerRadius: number, height = 0.01): BufferGeometry {
  const shape = new Shape
  shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false)
  const hole = new Path
  hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true)
  shape.holes.push(hole)
  const geometry = new ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 96,
    depth: height,
  })
  return geometry.rotateX(-Math.PI / 2).translate(0, -height / 2, 0)
}

import hsl from 'okhsl'
import {Vector3} from 'three/webgpu'

import {bakedBubbles, bakedStrokeBoxes} from './baked.ts'

/** radius outside which the shader skips the paint entirely, in orb radii */
export const strokeBoundRadius = 0.76
/** distance at which the raymarch counts a hit, also included when baking the stroke boxes */
export const strokeSurfaceDistance = 0.002

export type ImpastoStroke = {
  across: Vector3
  along: Vector3
  arc: number
  bend: number
  boxMax: Vector3
  boxMin: Vector3
  folded: number
  lift: number
  normal: Vector3
  pigment: number
  seed: number
  shell: number
  thick: number
  tilt: number
  width: number
}

/** the shape of a dollop, all {@link strokeDistance} needs, without the bounding box its march is clipped to */
export type ImpastoStrokeShape = Omit<ImpastoStroke, 'boxMax' | 'boxMin'>

export type ImpastoBubble = {
  center: Vector3
  radius: number
}

/** Six richly saturated heavy-body oil pigments echoing the Impasto family’s palette, tuned for luminous glass refraction: cadmium yellow, cadmium scarlet, crimson lake, ultramarine blue, emerald green and bright titanium white. */
export const impastoPalette = [hsl.integer(91.3, 100, 85.1), hsl.integer(32, 97.5, 56), hsl.integer(22, 97, 47), hsl.integer(264, 94, 42.3), hsl.integer(161, 98.7, 56), hsl.integer(90, 100, 99)] as const
/** Harmonious wet-on-wet secondary accents that curl cleanly along one swept flank without muddying the dominant pigment. */
const foldedPairings: ReadonlyArray<readonly [number, number]> = [
  [5, 1], // cadmiumYellow ← titaniumWhite / cadmiumScarlet
  [0, 2], // cadmiumScarlet ← cadmiumYellow / crimsonLake
  [0, 1], // crimsonLake ← cadmiumYellow / cadmiumScarlet
  [5, 4], // ultramarineBlue ← titaniumWhite / emeraldGreen
  [0, 5], // emeraldGreen ← cadmiumYellow / titaniumWhite
  [3, 4], // titaniumWhite ← ultramarineBlue / emeraldGreen
]
/** Proper coloring of the 8-vertex square antiprism (top ring on even indices, bottom ring on odd indices) so every outer dollop’s four neighbors hold four distinct hues. */
const outerPigments = [0, 5, 3, 4, 1, 0, 4, 2] as const
const innerPigments = [5, 0, 3, 1] as const
const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/**
 * Signed distance in orb radii from `point` to a thick, heavy-bodied, knife-sculpted impasto paint dollop.
 * Bristle tracks are evaluated in constant physical cross-blade distance (`aShifted`) rather than normalized width so grooves exit cleanly across torn edges instead of pinching into leaf tips.
 * Matches the TSL field in `ImpastoOrbMaterial.ts` term for term.
 */
export function strokeDistance(point: Vector3, stroke: Pick<ImpastoStroke, 'across' | 'along' | 'arc' | 'bend' | 'lift' | 'normal' | 'seed' | 'shell' | 'thick' | 'tilt' | 'width'>): number {
  const x = point.dot(stroke.along)
  const y = point.dot(stroke.across)
  const z = point.dot(stroke.normal)
  const rxz = Math.hypot(x, z)
  const radius = Math.hypot(rxz, y)
  const sRaw = Math.atan2(x, z) * stroke.shell
  const aRaw = Math.atan2(y, Math.max(rxz, 1e-5)) * stroke.shell
  const hRaw = radius - stroke.shell
  const u = Math.max(-1.4, Math.min(1.4, sRaw / stroke.arc))
  const whip = Math.max(0, u - 0.15)
  const hook = stroke.bend * (u * u * 0.7 - 0.18 + 0.85 * whip * whip * stroke.tilt)
  const aBent = aRaw - hook
  // Broad, chunky palette-knife heel at −1 swelling through a plump sculpted belly and whipping asymmetrically into a lifted flame-like peak at +1.
  const heel = 0.44 + 0.56 * smoothstep(-1.02, -0.38, u)
  const tip = smoothstep(1.06, 0.26, u)
  const silhouette = heel * (0.1 + 0.9 * tip ** 0.88)
  const asymShift = stroke.width * 0.34 * stroke.tilt * smoothstep(0.08, 0.96, u)
  const aShifted = aBent - asymShift
  const torn = 0.055 * Math.sin(4.7 * u + stroke.seed) + 0.04 * Math.sin(11.3 * u + 1.9 * stroke.seed) + 0.028 * Math.sin(21.1 * u + 3.4 * stroke.seed)
  const halfWidth = stroke.width * silhouette * (1 + torn)
  const v = Math.max(-1.5, Math.min(1.5, aShifted / Math.max(halfWidth, 0.012)))
  const curl = smoothstep(-0.4, 1, u)
  const v2 = Math.min(1, v * v)
  const hCurl = stroke.lift * (curl * curl * 0.82 + 0.18 * Math.max(0, u)) * (0.65 + 0.35 * (1 - v2))
  // Voluminous, buttery impasto cross-section: plump domed mass carved by a deep concave knife scoop next to a tall sculpted crest ridge and pulled peak.
  const crossDome = Math.max(0, 1 - v2) ** 0.42
  const lengthBody = smoothstep(-1.04, -0.68, u) ** 0.4 * smoothstep(1.06, 0.5, u) ** 0.55
  const body = crossDome * lengthBody
  const scoopArg = (v + 0.26 * stroke.tilt) / 0.44
  const scoop = -0.46 * Math.exp(-scoopArg * scoopArg) * body
  const crestArg = (v - 0.52 * stroke.tilt) / 0.28
  const crestRidge = 0.92 * Math.exp(-crestArg * crestArg) * lengthBody * crossDome ** 0.3
  const backBeadArg = (v + 0.76 * stroke.tilt) / 0.2
  const backBead = 0.42 * Math.exp(-backBeadArg * backBeadArg) * lengthBody * crossDome ** 0.35
  const peakArg = (u - 0.56) / 0.34
  const pulledPeak = 0.72 * Math.exp(-peakArg * peakArg) * crossDome ** 0.45
  // Physical-space dragged bristle tracks & chunky knife-carved facets (never converging into pinched tips).
  const physPhase = aShifted * 52 + 0.55 * Math.sin(sRaw * 10.2 + stroke.seed) + 0.25 * Math.sin(sRaw * 20.5 + 2.1 * stroke.seed)
  const trackBreak = 0.45 + 0.55 * Math.sin(sRaw * 13.5 + aShifted * 10.8 + stroke.seed)
  const ridge1 = 1 - Math.abs(Math.sin(physPhase + stroke.seed))
  const ridge2 = 1 - Math.abs(Math.sin(physPhase * 2.27 + 1.9 * stroke.seed + sRaw * 5))
  const chunk = Math.sin(sRaw * 17.4 + aShifted * 14.5 + stroke.seed) * Math.cos(sRaw * 11.1 - aShifted * 19.6 + 1.7 * stroke.seed)
  const relief = ((ridge1 - 0.5) * 0.14 * trackBreak + (ridge2 - 0.5) * 0.08 + chunk * 0.13) * body
  const hBot = hCurl - stroke.thick * 0.42 * body
  const hTop = hCurl + stroke.thick * (0.82 * body + crestRidge + backBead + pulledPeak + scoop + relief)
  const hMid = 0.5 * (hTop + hBot)
  const hHalf = Math.max(0.5 * (hTop - hBot), 0.0065)
  const heelBreak = stroke.arc * (0.055 * Math.sin(aShifted * 22 + stroke.seed) + 0.03 * Math.cos(aShifted * 44 + 1.7 * stroke.seed))
  const headBreak = stroke.arc * (0.065 * Math.sin(aShifted * 26 + 2.3 * stroke.seed) + 0.035 * Math.cos(aShifted * 52 + stroke.seed))
  const bevel = Math.min(0.01, hHalf * 0.5, halfWidth * 0.35)
  const qx = Math.max(-sRaw - (stroke.arc + heelBreak - bevel), sRaw - (stroke.arc + headBreak - bevel))
  const qy = Math.abs(aShifted) - (halfWidth - bevel)
  const qz = Math.abs(hRaw - hMid) - (hHalf - bevel)
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - bevel
}

const antiprismLat = Math.asin(1 / Math.sqrt(1 + Math.SQRT2))
const cosLat = Math.cos(antiprismLat)
const sinLat = Math.sin(antiprismLat)
const rawAntiprism: Array<readonly [number, number, number]> = []
for (let k = 0; k < 4; k++) {
  const topAngle = k * Math.PI / 2
  rawAntiprism.push([cosLat * Math.cos(topAngle), sinLat, cosLat * Math.sin(topAngle)])
  const bottomAngle = k * Math.PI / 2 + Math.PI / 4
  rawAntiprism.push([cosLat * Math.cos(bottomAngle), -sinLat, cosLat * Math.sin(bottomAngle)])
}
const rawTetrahedron: ReadonlyArray<readonly [number, number, number]> = [
  [1, 1, 1],
  [1, -1, -1],
  [-1, 1, -1],
  [-1, -1, 1],
]
function rotateDirection([x, y, z]: readonly [number, number, number], yaw: number, pitch: number, roll: number) {
  const x1 = x * Math.cos(yaw) - z * Math.sin(yaw)
  const z1 = x * Math.sin(yaw) + z * Math.cos(yaw)
  const y2 = y * Math.cos(pitch) - z1 * Math.sin(pitch)
  const z2 = y * Math.sin(pitch) + z1 * Math.cos(pitch)
  const x3 = x1 * Math.cos(roll) - y2 * Math.sin(roll)
  const y3 = x1 * Math.sin(roll) + y2 * Math.cos(roll)
  const result = new Vector3(x3, y3, z2)
  return result.normalize()
}
/** A gently tilted vortex axis so the massive paint dollops swirl cohesively around the globe from every viewing angle. */
const swirlAxis = new Vector3(0.26, 0.94, 0.22)
swirlAxis.normalize()
function strokeBasis(normal: Vector3, twist: number) {
  let tangent = new Vector3
  tangent.crossVectors(swirlAxis, normal)
  if (tangent.lengthSq() < 1e-4) {
    tangent = new Vector3
    tangent.crossVectors(new Vector3(1, 0, 0), normal)
  }
  tangent.normalize()
  const bitangent = new Vector3
  bitangent.crossVectors(normal, tangent).normalize()
  const along = tangent.clone().multiplyScalar(Math.cos(twist)).addScaledVector(bitangent, Math.sin(twist)).normalize()
  const across = new Vector3
  across.crossVectors(normal, along).normalize()
  return {
    across,
    along,
    normal,
  }
}
const outerStrokes: Array<ImpastoStrokeShape> = rawAntiprism.map((raw, index) => {
  const normal = rotateDirection(raw, 0.38, 0.29, 0.18)
  const twist = 0.44 + Math.sin(index * 2.1 + 0.5) * 0.1
  const basis = strokeBasis(normal, twist)
  const pigment = outerPigments[index]
  const folded = foldedPairings[pigment][index % 2]
  return {
    ...basis,
    arc: 0.274 + Math.sin(index * 2.3) * 0.01,
    bend: (index % 2 === 0 ? 1 : -1) * (0.043 + 0.008 * Math.sin(index * 2.9)),
    folded,
    lift: 0.071 + 0.008 * Math.cos(index * 2.1),
    pigment,
    seed: index * 1.87 + 0.6,
    shell: 0.48 + (index % 2 === 0 ? 0.02 : -0.018),
    thick: 0.079,
    tilt: index % 2 === 0 ? 1 : -1,
    width: 0.173 + Math.cos(index * 1.9) * 0.008,
  }
})
const innerStrokes: Array<ImpastoStrokeShape> = rawTetrahedron.map((raw, index) => {
  const normal = rotateDirection(raw, 1.15, 0.55, 0.35)
  const twist = -0.35 + Math.sin(index * 1.9) * 0.12
  const basis = strokeBasis(normal, twist)
  const pigment = innerPigments[index]
  const folded = foldedPairings[pigment][index % 2]
  return {
    ...basis,
    arc: 0.198 + Math.sin(index * 2.4) * 0.008,
    bend: (index % 2 === 0 ? -1 : 1) * 0.03,
    folded,
    lift: 0.05,
    pigment,
    seed: (index + 8) * 2.03 + 0.4,
    shell: 0.212 + Math.sin(index * 2.2) * 0.008,
    thick: 0.07,
    tilt: index % 2 === 0 ? -1 : 1,
    width: 0.129 + Math.cos(index * 1.7) * 0.007,
  }
})

/** The dollops’ shapes, outer first: what `scripts/bakeImpastoOrb.ts` bakes their bounding boxes and the bubbles from. */
export const impastoStrokeShapes: ReadonlyArray<ImpastoStrokeShape> = [...outerStrokes, ...innerStrokes]

/**
 * A two-layer sculpture of 12 thick, heavy-bodied impasto dollops suspended inside clear glass: 8 sweeping outer waves on a square antiprism over 4 lush inner swirls on a tetrahedron.
 * Ordered outer-first so front dollops shrink ray depth early. Every pair maintains strictly positive 3D clearance so strokes never clip into each other.
 * Each one’s march is clipped to the box `baked.ts` holds for it, in its own `(along, across, normal)` frame.
 */
export const impastoStrokes: ReadonlyArray<ImpastoStroke> = impastoStrokeShapes.map((shape, index) => {
  const [minX, minY, minZ, maxX, maxY, maxZ] = bakedStrokeBoxes[index]
  return {
    ...shape,
    boxMax: new Vector3(maxX, maxY, maxZ),
    boxMin: new Vector3(minX, minY, minZ),
  }
})

/** Effervescent multi-scale air bubbles across the full 360° sphere in the glowing honey-amber oil around and between the impasto dollops, as `baked.ts` holds them. */
export const impastoBubbles: ReadonlyArray<ImpastoBubble> = bakedBubbles.map(([x, y, z, radius]) => ({
  center: new Vector3(x, y, z),
  radius,
}))

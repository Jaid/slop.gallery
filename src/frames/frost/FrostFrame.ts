import hsl from 'okhsl'
import {color, float, max, mix, mx_cell_noise_float, mx_noise_float, normalView, positionViewDirection, pow, select, vec3} from 'three/tsl'
import {BufferGeometry, Float32BufferAttribute, Matrix4, MeshPhysicalNodeMaterial, Quaternion, Vector3} from 'three/webgpu'

import {heightNormal, insideBy, visibleDetail} from '#src/lib/materials/filters.ts'

import PortraitFrame, {frameBack, frameTriangleBudget} from '../base/PortraitFrame.ts'
import {withOpening} from '../lib/frameBack.ts'
import {along, assembleFrame, corners, ornament, place, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import {aroundLoop, aroundOpening, frameSurface, viewBelow} from '../lib/materials/frameAttributes.ts'
import {backSurface, hangingWire} from '../lib/materials/frameBacks.ts'
import frameStudio from '../lib/materials/frameStudio.ts'

const imageDepth = -0.056
const ice = 0
const crystal = 1
const back = 2
/** a deeply sculpted, stepped glacier-ice moulding: frosted inner sight lip dropping into a shadowed glacial hollow, rising steeply to a chiseled crest and stepping cleanly back to the wall */
const profile = FrameProfile.from([-0.005, imageDepth], ice)
  .line(-0.005, -0.043)
  .line(0.008, -0.036)
  .line(0.017, -0.044)
  .line(0.033, -0.038)
  .line(0.055, -0.014)
  .line(0.072, -0.018)
  .line(0.092, -0.032)
  .line(0.106, -0.054)
  .line(0.106, frameBack)
  .line(-0.005, frameBack, {material: back})
/** deterministic scatter 0–1 */
const scatter = (seed: number) => {
  const value = Math.sin(seed * 127.1 + 311.7) * 43_758.5453
  return value - Math.floor(value)
}
/** A cleaved hexagonal glacier-ice prism with an asymmetric chisel tip standing along +y from 0 to `length`, faceted flat so every face catches directional light. Takes 18 triangles. */
function hexSpire(radius: number, length: number, tipShare = 0.34, taper = 0.74, skew = 0) {
  const shoulder = length * (1 - tipShare)
  const positions: Array<number> = []
  const ring = (y: number, r: number, offsetX = 0) => Array.from({length: 6}, (_, index) => {
    const angle = index * Math.PI / 3
    const wobble = 1 + Math.sin(index * 2.1 + skew) * 0.1
    return [Math.cos(angle) * r * wobble + offsetX, y, Math.sin(angle) * r * wobble] as const
  })
  const base = ring(0, radius)
  const top = ring(shoulder, radius * taper, skew * 0.004)
  const apex: readonly [number, number, number] = [skew * 0.007, length, 0]
  const pushTriangle = (a: readonly [number, number, number], b: readonly [number, number, number], c: readonly [number, number, number]) => {
    positions.push(...a, ...b, ...c)
  }
  for (let side = 0; side < 6; side++) {
    const next = (side + 1) % 6
    pushTriangle(base[side], top[side], base[next])
    pushTriangle(base[next], top[side], top[next])
    pushTriangle(top[side], apex, top[next])
  }
  const geometry = new BufferGeometry
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  return geometry
}
/** A broad, low-profile cleaved glacier-ice facet plate running along x (`±halfLen`), beveled on all sides so overlapping plates sculpt an organic chiseled ice silhouette along the frame members. Takes 20 triangles. */
function iceShelfPlate(halfLen: number, halfWidth: number, height: number) {
  const positions: Array<number> = []
  const base: ReadonlyArray<readonly [number, number, number]> = [
    [-halfLen, -halfWidth, 0],
    [halfLen, -halfWidth * 0.85, 0],
    [halfLen * 0.85, halfWidth, 0],
    [-halfLen * 0.9, halfWidth * 0.9, 0],
  ]
  const ridge: ReadonlyArray<readonly [number, number, number]> = [
    [-halfLen * 0.65, -halfWidth * 0.4, height * 0.72],
    [halfLen * 0.6, -halfWidth * 0.35, height],
    [halfLen * 0.55, halfWidth * 0.45, height * 0.85],
    [-halfLen * 0.55, halfWidth * 0.38, height * 0.65],
  ]
  const push = (a: readonly [number, number, number], b: readonly [number, number, number], c: readonly [number, number, number]) => {
    positions.push(...a, ...b, ...c)
  }
  for (let side = 0; side < 4; side++) {
    const next = (side + 1) % 4
    push(base[side], base[next], ridge[next])
    push(base[side], ridge[next], ridge[side])
  }
  push(ridge[0], ridge[1], ridge[2])
  push(ridge[0], ridge[2], ridge[3])
  const geometry = new BufferGeometry
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  return ornament(geometry, {
    kind: 1,
    cavity: -0.35,
  })
}
/** Applies an affine transform to a crystal spire and appends its vertex positions into `into`. */
function appendCrystal(into: Array<number>, spire: BufferGeometry, offset: readonly [number, number, number], axis: readonly [number, number, number], angle: number, spin = 0) {
  const q1 = new Quaternion
  const axisVec = new Vector3(...axis)
  q1.setFromAxisAngle(axisVec.normalize(), angle)
  const q2 = new Quaternion
  q2.setFromAxisAngle(new Vector3(0, 1, 0), spin)
  const matrix = new Matrix4
  matrix.compose(new Vector3(...offset), q1.multiply(q2), new Vector3(1, 1, 1))
  spire.applyMatrix4(matrix)
  const position = spire.getAttribute('position')
  for (let index = 0; index < position.count; index++) {
    into.push(position.getX(index), position.getY(index), position.getZ(index))
  }
  spire.dispose()
}
/** A bold, sculptural cluster of cleaved blue glacier-ice crystals wrapping organically around each mitered corner, built from deeply colored translucent prisms of varied widths and heights. Takes 126 triangles. */
function cornerCluster() {
  const positions: Array<number> = []
  // Primary glacier prism sweeping diagonally outward and forward from the miter.
  appendCrystal(positions, hexSpire(0.022, 0.088, 0.34, 0.72, 0.35), [-0.01, -0.01, -0.008], [1, -1, 0.25], -0.86, 0.2)
  // Two wide cleaved ice blades hugging the adjacent members so the cluster flows seamlessly into the moulding.
  appendCrystal(positions, hexSpire(0.018, 0.082, 0.32, 0.7, -0.25), [-0.026, 0.004, -0.008], [0.1, -0.96, 0.24], -1.28, 0.75)
  appendCrystal(positions, hexSpire(0.017, 0.076, 0.34, 0.68, 0.4), [0.004, -0.028, -0.008], [0.96, -0.1, 0.22], -1.24, 0.15)
  // Forward faceted glacier boss crowning the miter.
  appendCrystal(positions, hexSpire(0.019, 0.044, 0.3, 0.8, -0.15), [-0.016, -0.016, -0.004], [0.7, -0.7, 0], 0.92, 0.5)
  // Secondary tucked ice shards creating natural stepped glacier strata.
  appendCrystal(positions, hexSpire(0.013, 0.052, 0.36, 0.68, 0.5), [-0.042, 0.01, -0.01], [0.22, -0.94, 0.22], -1.12, 1.05)
  appendCrystal(positions, hexSpire(0.012, 0.048, 0.36, 0.66, -0.45), [0.01, -0.042, -0.01], [0.94, -0.22, 0.22], -1.08, 0.6)
  appendCrystal(positions, hexSpire(0.011, 0.036, 0.38, 0.66, 0.2), [0.004, 0.004, -0.011], [0.68, -0.73, 0.12], -0.58, 1.35)
  const geometry = new BufferGeometry
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  return ornament(geometry, {
    cavity: -0.45,
  })
}
const cornerClusterTriangles = 126
const shelfPlateTriangles = 20
/** How far forward the corner clusters and cleaved shelf plates reach at most. */
const maxCrystalFront = (() => {
  const c = cornerCluster()
  c.computeBoundingBox()
  const p = iceShelfPlate(0.11, 0.028, 0.014)
  p.computeBoundingBox()
  const front = Math.max(profile.front, -0.018 + c.boundingBox!.max.z, -0.021 + p.boundingBox!.max.z)
  c.dispose()
  p.dispose()
  return front
})()

/** The Frost Orb’s: a sculpted frame of deep blue glacier ice with layered overlapping cleaved ice shelves, subtle internal parallax strata, velvety hoarfrost clinging to its inner hollow and bold clusters of cleaved sapphire-blue ice crystals embracing all four corners. */
export default class FrostFrame extends PortraitFrame {
  override readonly description = 'Chiseled out of solid blue glacier ice: a steeply stepped moulding overlaid with overlapping cleaved ice shelf plates that break its silhouette into natural glacial facets, deep arctic sapphire within and dusted with powdery hoarfrost along its inner hollow, with bold asymmetric clusters of cleaved hexagonal ice crystals embracing every corner. Turned round, it is dark frosted spruce edged with creeping rime and hung on a cold steel wire.'
  override readonly front = maxCrystalFront
  override readonly imageDepth = imageDepth
  override readonly impactSound = 'heavy'
  override readonly reach = 0.145
  override readonly tint = hsl.integer(226, 62, 40)
  override readonly title = 'Glacier frost'

  override createGeometry(width: number, height: number) {
    const halfWidth = width / 2
    const halfHeight = height / 2
    const moulding = withOpening(sweepProfile(profile, halfWidth, halfHeight), back, halfWidth, halfHeight)
    const mouldingTriangles = moulding.values().reduce((sum, part) => sum + part.getAttribute('position').count / 3, 0)
    const cornerSpots = corners(halfWidth, halfHeight, 0.064, -0.018)
    const leftForPlates = frameTriangleBudget - mouldingTriangles - cornerSpots.length * cornerClusterTriangles
    // Overlapping cleaved glacier-ice shelf plates along the ridge, sharing the same ice material so the moulding reads as organically sculpted blocks of cleaved ice.
    const plateSpots = along(halfWidth, halfHeight, 0.068, -0.021, {
      spacing: 0.155,
      inset: 0.115,
      limit: Math.max(4, Math.floor(leftForPlates / shelfPlateTriangles)),
    }).map((spot, index) => ({
      ...spot,
      angle: (spot.angle ?? 0) + (scatter(index + 1.1) - 0.5) * 0.14,
      scale: [0.85 + scatter(index + 2.3) * 0.45, 0.8 + scatter(index + 3.7) * 0.45, 0.75 + scatter(index + 4.9) * 0.55] as const,
    }))
    return assembleFrame([
      ...moulding,
      [ice, place(iceShelfPlate(0.105, 0.027, 0.013), plateSpots)],
      [crystal, place(cornerCluster(), cornerSpots)],
    ])
  }

  protected override createMaterials() {
    return [new GlacierIceMaterial, new IceCrystalMaterial, new FrostBackMaterial]
  }
}

/** Deep, translucent-looking glacier ice: broad internal glacial blue-to-sapphire strata shifting softly with parallax, fine trapped air bubbles, mirror-clear ice bevels and soft feathery hoarfrost tucked into the recessed cove and corners (zero swimming-pool crackle). */
class GlacierIceMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      envMap: frameStudio,
      envMapIntensity: 1.15,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      ior: 1.31,
    })
    const surface = frameSurface()
    const p = surface.position
    const footprint = max(p.x.fwidth(), p.y.fwidth()).max(p.z.fwidth()).toVar('frostFootprint')
    const at = aroundOpening(p.xy, surface.opening)
    const loop = surface.opening.x.add(surface.opening.y).add(0.14).mul(4).toVar('frostLoop')
    const circle = aroundLoop(at.distance, at.perimeter, loop)
    // Deep, soft layered glacial ice strata & rare micro-bubbles seen with subtle parallax beneath the clear ice surface.
    const below = viewBelow(surface)
    const shallow = below(0.018)
    const deep = below(0.042)
    const strata1 = mx_noise_float(vec3(shallow.x.mul(7), shallow.y.mul(7), shallow.z.mul(22))).mul(0.5).add(0.5)
    const strata2 = mx_noise_float(vec3(deep.x.mul(4.5).add(3.2), deep.y.mul(4.5).sub(1.8), deep.z.mul(16))).mul(0.5).add(0.5)
    const bubbles = mx_cell_noise_float(shallow.mul(190)).smoothstep(0.965, 0.996).mul(visibleDetail(footprint, 0.0015))
    // Delicate feathery hoarfrost settled in the shadowed inner hollow, along exposed faceted ridges and wrapping out of the corners.
    const nearCorner = surface.toCorner.smoothstep(0.24, 0.01)
    const frostCloud = mx_noise_float(vec3(circle.mul(18), surface.reach.mul(26))).mul(0.55).add(mx_noise_float(vec3(circle.mul(72), surface.reach.mul(90))).mul(0.45))
    const ridgeFrost = surface.cavity.negate().smoothstep(0.18, 0.72).mul(frostCloud.mul(0.6).add(0.4)).mul(0.68)
    const rimeMask = max(surface.cavity.mul(0.85).add(nearCorner.mul(0.35)).add(frostCloud.mul(0.34)).smoothstep(0.38, 0.76), ridgeFrost).toVar('frostRime')
    // Cool, refined translucent glacier-blue palette (desaturated arctic ice rather than turquoise plastic) with crisp Fresnel highlights.
    const facing = normalView.dot(positionViewDirection.negate()).clamp(0, 1)
    const fresnel = pow(facing.oneMinus(), float(2.8))
    const deepIce = color(hsl.integer(240, 56, 9))
    const midIce = color(hsl.integer(232, 54, 28))
    const lightIce = color(hsl.integer(220, 62, 68))
    const rimeWhite = color(hsl.integer(220, 18, 93))
    const body = mix(deepIce, midIce, strata1.mul(0.55).add(strata2.mul(0.35)).clamp(0, 1))
    const glazed = mix(body, lightIce, fresnel.mul(0.82).add(bubbles.mul(0.6)).clamp(0, 1))
    this.colorNode = mix(glazed, rimeWhite, rimeMask.mul(0.82))
    this.roughnessNode = mix(float(0.05), float(0.8), rimeMask)
    this.clearcoatNode = rimeMask.oneMinus().mul(0.95)
    // Subtle translucent glacier glow along grazing edges and internal ice strata.
    this.emissiveNode = mix(color(hsl.integer(232, 68, 38)), lightIce, fresnel).mul(fresnel.mul(0.11).add(strata1.mul(0.035)).add(0.015))
    const cleave = mx_noise_float(vec3(circle.mul(24), surface.reach.mul(32))).mul(0.00024).mul(visibleDetail(footprint, 0.003))
    const grain = mx_noise_float(vec3(circle.mul(280), surface.reach.mul(280))).mul(0.0002).mul(rimeMask).mul(visibleDetail(footprint, 0.0012))
    const relief = heightNormal(cleave.add(grain))
    this.normalNode = relief
    this.clearcoatNormalNode = relief
  }
}
/** Cleaved hexagonal glacier-ice corner crystals: deeply colored translucent sapphire-blue ice matching the frame body, with crisp cyan edge reflections rather than chalky white plastic. */
class IceCrystalMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      envMap: frameStudio,
      envMapIntensity: 1.05,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      ior: 1.31,
      roughness: 0.07,
    })
    const surface = frameSurface()
    const facing = normalView.dot(positionViewDirection.negate()).clamp(0, 1)
    const fresnel = pow(facing.oneMinus(), float(3))
    const depthNoise = mx_noise_float(surface.position.mul(22)).mul(0.5).add(0.5)
    const core = color(hsl.integer(240, 58, 12))
    const mid = color(hsl.integer(230, 56, 36))
    const edge = color(hsl.integer(218, 52, 82))
    const body = mix(core, mid, depthNoise.mul(0.5).add(fresnel.mul(0.6)).clamp(0, 1))
    this.colorNode = mix(body, edge, pow(fresnel, float(1.35)).mul(0.88))
    this.emissiveNode = mix(mid, edge, fresnel).mul(fresnel.mul(0.18).add(0.03))
  }
}
/** The back: cold dark spruce dusted with creeping frost along its outer perimeter, with a steel hanging wire. */
class FrostBackMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      envMap: frameStudio,
      envMapIntensity: 0.45,
    })
    const surface = backSurface()
    const {footprint, opening, point} = surface
    const outer = opening.add(profile.reach)
    const inset = outer.sub(point.abs())
    const fromEdge = inset.x.min(inset.y)
    const grain = mx_noise_float(vec3(point.x.mul(3), point.y.mul(220), 2.1)).mul(0.5).add(0.5)
    const wood = mix(color(hsl.integer(234, 18, 16)), color(hsl.integer(230, 16, 24)), grain)
    const creep = mx_noise_float(vec3(point.mul(42), 5.3)).mul(0.022).add(0.028)
    const frost = insideBy(fromEdge.sub(creep), footprint).mul(mx_noise_float(vec3(point.mul(140), 1.9)).mul(0.35).add(0.65))
    const hanger = hangingWire(surface)
    const frosted = mix(wood, color(hsl.integer(216, 48, 86)), frost.mul(0.75))
    this.colorNode = mix(frosted, hanger.color, hanger.cover)
    this.metalnessNode = select(hanger.cover.greaterThan(0.5), float(0.85), float(0))
    this.roughnessNode = mix(mix(float(0.78), float(0.55), frost), float(0.32), hanger.cover)
    this.normalNode = heightNormal(grain.mul(0.00003).add(frost.mul(0.0002)).add(hanger.height))
  }
}

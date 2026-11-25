import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, positionGeometry, texture, time, uv, vec2, vec3} from 'three/tsl'
import {DataTexture, DataUtils, HalfFloatType, LinearFilter, RGBAFormat} from 'three/webgpu'

import {tubeRay} from '../../lib/atelier.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import data from './data.ts'

type Star = readonly [x: number, y: number, radius?: number]
type Point = readonly [number, number]
type Segment = readonly [Point, Point]
type Constellation = {
  eyes: ReadonlyArray<ReadonlyArray<Point>>
  facets: ReadonlyArray<ReadonlyArray<number>>
  name: string
  outline: ReadonlyArray<ReadonlyArray<number>>
  stars: ReadonlyArray<Star>
}

/** Hand-drawn stellar skeletons, not font glyphs or repeated cat-head icons. Coordinates are in a unit square centered at the origin. */
const constellations: ReadonlyArray<Constellation> = [
  {
    name: 'The Watcher',
    stars: [
      [-0.24, 0.22],
      [-0.275, 0.43, 0.012],
      [-0.105, 0.325],
      [0.015, 0.325],
      [0.14, 0.408, 0.012],
      [0.12, 0.215],
      [0.08, 0.077],
      [-0.06, 0.035, 0.01],
      [-0.21, 0.075],
      [-0.065, 0.255, 0.008],
      [-0.065, 0.125, 0.009],
      [-0.16, 0.005],
      [-0.215, -0.16],
      [-0.23, -0.285],
      [-0.15, -0.38, 0.01],
      [0.12, -0.38, 0.01],
      [0.175, -0.245],
      [0.11, -0.085],
      [0.025, 0.005],
      [-0.105, -0.075],
      [-0.115, -0.305],
      [-0.055, -0.35],
      [0.005, -0.07],
      [0.025, -0.325],
      [0.08, -0.37],
      [0.265, -0.335],
      [0.365, -0.25],
      [0.4, -0.12, 0.011],
      [0.36, -0.015],
      [0.285, 0.015],
      [0.24, -0.045],
      [0.27, -0.105, 0.012],
      [-0.365, 0.15, 0.005],
      [-0.37, 0.018, 0.005],
      [0.265, 0.15, 0.005],
      [0.25, 0.055, 0.005],
      [-0.13, -0.22, 0.007],
      [0.045, -0.23, 0.008],
    ],
    outline: [
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 0],
      [8, 11, 12, 13, 14, 15, 16, 17, 18, 6],
      [19, 20, 21],
      [22, 23, 24],
      [15, 25, 26, 27, 28, 29, 30, 31],
      [8, 32],
      [8, 33],
      [6, 34],
      [6, 35],
      [10, 7],
    ],
    facets: [
      [1, 9, 4],
      [0, 9, 5],
      [2, 9, 3],
      [8, 10, 6],
      [9, 10],
      [7, 19, 11],
      [7, 22, 18],
      [12, 19, 36, 13],
      [19, 22, 37, 36, 14],
      [17, 22],
      [16, 37, 15],
      [36, 20],
      [37, 23],
      [14, 20],
      [15, 23],
    ],
    eyes: [
      [[-0.205, 0.206], [-0.157, 0.229], [-0.108, 0.205], [-0.153, 0.183], [-0.205, 0.206]],
      [[-0.022, 0.205], [0.027, 0.229], [0.075, 0.206], [0.023, 0.183], [-0.022, 0.205]],
      [[-0.153, 0.219], [-0.153, 0.192]],
      [[0.025, 0.219], [0.025, 0.192]],
    ],
  },
  {
    name: 'The Wanderer',
    stars: [
      [-0.38, 0.185],
      [-0.39, 0.365, 0.012],
      [-0.285, 0.275],
      [-0.165, 0.315, 0.011],
      [-0.18, 0.16],
      [-0.23, 0.04],
      [-0.34, 0.015],
      [-0.405, 0.085, 0.01],
      [-0.275, 0.19, 0.007],
      [-0.12, 0.125],
      [0.055, 0.09, 0.01],
      [0.235, 0.08],
      [0.305, -0.065],
      [0.24, -0.22],
      [0.28, -0.275],
      [0.3, -0.35],
      [0.205, -0.35, 0.009],
      [0.105, -0.13],
      [-0.06, -0.14],
      [-0.18, -0.11],
      [-0.215, -0.325],
      [-0.25, -0.35],
      [-0.165, -0.35, 0.01],
      [-0.075, -0.09],
      [0.285, 0.145],
      [0.385, 0.24],
      [0.405, 0.345, 0.011],
      [0.33, 0.41],
      [0.245, 0.375],
      [0.265, 0.295, 0.012],
      [-0.435, 0.155, 0.005],
      [-0.44, -0.015, 0.005],
      [-0.255, -0.035, 0.005],
      [0.075, -0.025, 0.009],
      [0.22, -0.095, 0.008],
      [-0.04, 0.025, 0.008],
    ],
    outline: [
      [0, 1, 2, 3, 4, 5, 6, 7, 0],
      [4, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 5],
      [19, 20, 21, 22, 23],
      [11, 24, 25, 26, 27, 28, 29],
      [7, 30],
      [6, 31],
      [6, 32],
    ],
    facets: [
      [1, 8, 3],
      [0, 8, 4],
      [8, 5],
      [9, 35, 18],
      [10, 33],
      [11, 33, 17],
      [12, 34, 11],
      [13, 34, 17],
      [16, 34],
      [9, 23, 19],
      [18, 23, 22],
      [33, 34],
      [5, 9],
    ],
    eyes: [
      [[-0.38, 0.19], [-0.337, 0.212], [-0.295, 0.189], [-0.337, 0.17], [-0.38, 0.19]],
      [[-0.338, 0.202], [-0.338, 0.179]],
    ],
  },
]
function segments(paths: ReadonlyArray<ReadonlyArray<Point>>): Array<Segment> {
  return paths.flatMap(path => path.slice(1).map((point, i) => [path[i], point] as const))
}
function graphSegments(cat: Constellation, paths: Constellation['outline']): Array<Segment> {
  return segments(paths.map(path => path.map(index => [cat.stars[index][0], cat.stars[index][1]] as const)))
}
function segmentDistance(x: number, y: number, [a, b]: Segment): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / lengthSquared))
  return Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t)
}
/** Exact signed distance to a diamond in the positive quadrant, so its halo does not stretch across the atlas gutter. */
function diffractionDistance(x: number, y: number, extent: number) {
  const halfWidth = 0.0025
  const t = Math.max(0, Math.min(1, ((extent - x) * extent + y * halfWidth) / (extent * extent + halfWidth * halfWidth)))
  return Math.hypot(x - extent + extent * t, y - halfWidth * t) * Math.sign(x / extent + y / halfWidth - 1)
}
/** RGBA = primary-link distance, secondary-link distance, signed stellar distance, eye distance. */
function sampleConstellation(cat: Constellation, x: number, y: number, outline = graphSegments(cat, cat.outline), facets = graphSegments(cat, cat.facets), eyes = segments(cat.eyes)): [number, number, number, number] {
  let primary = 1
  let secondary = 1
  let star = 1
  let eye = 1
  for (const line of outline) {
    primary = Math.min(primary, segmentDistance(x, y, line))
  }
  for (const line of facets) {
    secondary = Math.min(secondary, segmentDistance(x, y, line))
  }
  for (const [sx, sy, radius = 0.0075] of cat.stars) {
    const dx = Math.abs(x - sx)
    const dy = Math.abs(y - sy)
    star = Math.min(star, Math.hypot(dx, dy) - radius)
    // The brightest anchors have four tiny diffraction points, not identical round sequins.
    if (radius >= 0.011) {
      star = Math.min(star, diffractionDistance(dx, dy, radius * 2.3), diffractionDistance(dy, dx, radius * 2.3))
    }
  }
  for (const line of eyes) {
    eye = Math.min(eye, segmentDistance(x, y, line))
  }
  return [primary, secondary, star, eye]
}
const atlasCellSize = 512
const atlasWidth = atlasCellSize * constellations.length
const atlasHeight = atlasCellSize
let atlasPixels: Uint16Array | undefined
/** Cached CPU pixels; each material owns its own GPU texture and can be disposed independently. */
function createAtlasPixels(): Uint16Array {
  if (atlasPixels) {
    return atlasPixels
  }
  const pixels = new Uint16Array(atlasWidth * atlasHeight * 4)
  for (const [tile, cat] of constellations.entries()) {
    const outline = graphSegments(cat, cat.outline)
    const facets = graphSegments(cat, cat.facets)
    const eyes = segments(cat.eyes)
    for (let y = 0; y < atlasCellSize; y++) {
      for (let x = 0; x < atlasCellSize; x++) {
        const distances = sampleConstellation(cat, (x + 0.5) / atlasCellSize - 0.5, (y + 0.5) / atlasCellSize - 0.5, outline, facets, eyes)
        const offset = (y * atlasWidth + tile * atlasCellSize + x) * 4
        for (let channel = 0; channel < 4; channel++) {
          pixels[offset + channel] = DataUtils.toHalfFloat(distances[channel])
        }
      }
    }
  }
  atlasPixels = pixels
  return pixels
}
/** Analytic coverage in cell units, including energy conservation once a link is thinner than a pixel. */
function thread(distance: Node<'float'>, width: number, footprint: Node<'float'>) {
  const aa = footprint.mul(0.65).max(0.0005)
  return distance.smoothstep(float(width).sub(aa), aa.add(width)).oneMinus().mul(float(width * 2).div(aa).min(1))
}
/** A sparse, periodic background layer. Its coordinates and identities agree on both torus seams. */
function dust(coordinate: Node<'vec2'>, period: Node<'vec2'>, seed: number) {
  const q = coordinate.mul(period)
  const random = cellNoiseVec3(vec3(wrapCell(q.floor(), period), seed))
  const center = random.xy.mul(0.6).add(0.2)
  const distance = q.fract().sub(center).length()
  const footprint = q.fwidth().length().max(0.001)
  const radius = random.z.mul(0.035).add(0.022)
  const aa = footprint.mul(0.6)
  const core = distance.smoothstep(radius.sub(aa), radius.add(aa)).oneMinus()
    .mul(radius.div(radius.add(aa)).pow2())
  const halo = distance.mul(-24).exp().mul(0.055)
  const gate = random.x.smoothstep(0.58, 0.8)
  const twinkle = time.mul(0.42).add(random.z.mul(40)).sin().mul(0.22).add(0.78)
  return mix(color(hsl.integer(268, 66, 60)), color(hsl.integer(68, 100, 86)), random.y)
    .mul(core.add(halo)).mul(gate).mul(twinkle).mul(footprint.smoothstep(0.6, 1.6).oneMinus())
}
/** Linear half-float distance fields preserve subpixel links without storing a large color illustration. */
class StellarAtlas extends DataTexture {
  constructor() {
    super(createAtlasPixels(), atlasWidth, atlasHeight, RGBAFormat, HalfFloatType)
    this.name = 'Felis Astra – stellar graph distance atlas'
    this.minFilter = LinearFilter
    this.magFilter = LinearFilter
    this.generateMipmaps = false
    this.needsUpdate = true
  }
}

/** A celestial bestiary underneath polished blue obsidian. No geometry changes, external assets or postprocessing are required. */
export default class extends KnotMaterial {
  private readonly atlas = new StellarAtlas

  constructor(environment: Texture) {
    super(environment, 0.2)
    this.name = data.id
    const {view, facing, grazing, intimate, objectDistance} = viewerFrame()
    const ray = tubeRay()
    const tube = uv()
    const modules = vec2(3, 20)
    const coordinate = tube.sub(ray.mul(0.008)).yx.mul(modules)
    const row = coordinate.y.floor().mod(2).add(2).mod(2)
    const q = coordinate.add(vec2(row.mul(0.5), 0))
    const cell = wrapCell(q.floor(), modules)
    const identity = cellNoiseVec3(vec3(cell, 9.17))
    const phase = identity.z.mul(Math.PI * 2)
    const point = q.fract().sub(0.5)
    // A purr expands the chest; the lower constellation drifts a fraction of a star diameter.
    // Both links and their endpoints use this same deformation, so the graph never separates.
    const breath = time.mul(0.8).add(phase).sin()
    const tailRegion = point.x.smoothstep(0.16, 0.34)
    const local = vec2(point.x.mul(1.06).sub(time.mul(0.65).add(phase).sin().mul(tailRegion).mul(0.014)), point.y.mul(1.06).div(breath.mul(0.008).add(1)))
    const variant = cell.x.add(cell.y).mod(2)
    const atlasUV = vec2(local.x.add(0.5).add(variant).div(2), local.y.add(0.5))
    const field = texture(this.atlas, atlasUV)
    // Take derivatives before wrapping. Never differentiate atlasUV across tile boundaries.
    const footprint = coordinate.fwidth().length().max(0.0003)
    const inside = local.x.abs().max(local.y.abs()).smoothstep(0.455, 0.485).oneMinus()
    const approach = objectDistance.smoothstep(1.4, 4.8).oneMinus()
    const outline = thread(field.r, 0.0023, footprint).mul(inside)
    const facets = thread(field.g, 0.001, footprint).mul(inside)
    const starAA = footprint.mul(0.5).max(0.0007)
    const stars = field.b.smoothstep(starAA.negate(), starAA).oneMinus()
      .mul(float(0.009).div(starAA.add(0.009)).pow2()).mul(inside)
    const corona = field.b.max(0).mul(-100).exp().mul(inside)
    const outerCorona = field.b.max(0).mul(-32).exp().mul(inside)
    // Slow, individually phased eye closures, with no discontinuity at the time wrap.
    const eyelid = time.mul(0.46).add(phase).sin().smoothstep(0.982, 0.999).oneMinus()
    const eyes = thread(field.a, 0.0022, footprint).mul(inside).mul(eyelid.mul(0.86).add(0.14))
    const eyeHalo = field.a.mul(-95).exp().mul(inside).mul(eyelid)
    const wave = local.y.mul(7).sub(local.x.mul(5)).sub(time.mul(1.15)).add(phase).sin().mul(0.5).add(0.5)
    const pulse = wave.pow(12)
    const shimmer = local.x.mul(25).add(local.y.mul(19)).add(view.x.mul(4)).add(view.z.mul(3)).add(phase).sin().mul(0.5).add(0.5)
    const catColor = mix(color(hsl.integer(201, 78, 84)), color(hsl.integer(284, 100, 72)), identity.y.mul(0.5).add(grazing.mul(0.4)).clamp())
    const starColor = mix(color(hsl.integer(206, 100, 94)), color(hsl.integer(82, 100, 91.6)), shimmer.pow(3).mul(0.7))
    const graph = catColor.mul(outline).mul(pulse.mul(0.85).add(0.72))
      .add(mix(color(hsl.integer(276, 73, 54)), color(hsl.integer(312, 79, 83)), grazing).mul(facets).mul(approach.mul(0.12).add(0.035)))
      .add(starColor.mul(stars).mul(shimmer.mul(1.5).add(pulse.mul(1.3)).add(2.3)))
      .add(catColor.mul(corona).mul(0.14))
      .add(catColor.mul(outerCorona).mul(0.022))
      .add(color(hsl.integer(77, 99, 86)).mul(eyes).mul(2.1))
      .add(color(hsl.integer(67, 99, 78)).mul(eyeHalo).mul(0.12))
    // Two depths separate as the viewer walks: distant amber dust and closer blue pinpricks.
    const farDust = dust(tube.sub(ray.mul(0.09)), vec2(154, 22), 21.1)
    const nearDust = dust(tube.sub(ray.mul(0.035)), vec2(238, 34), 45.8)
    const interior = positionGeometry.sub(view.mul(0.11))
    const vapor = mx_noise_float(interior.mul(5).add(vec3(0, time.mul(0.012), 0)))
    const wisp = mx_noise_float(interior.mul(14).add(vapor.mul(2)))
    const nebula = vapor.add(wisp.mul(0.22)).smoothstep(0.04, 0.68)
    const nebulaColor = mix(color(hsl.integer(265, 79, 22)), color(hsl.integer(305, 70, 25)), vapor.mul(0.8).add(0.4).clamp())
    // A soft subsurface blue limb defines the knot without washing out its dark negative space.
    const limb = grazing.pow(3).mul(0.28)
    const veil = facing.smoothstep(0.03, 0.32).mul(0.35).add(0.65)
    this.colorNode = mix(color(hsl.integer(263, 55, 4.6)), color(hsl.integer(271, 48, 10)), nebula.mul(0.6))
    this.metalness = 0.42
    this.roughness = 0.34
    this.clearcoat = 0.4
    this.clearcoatRoughness = 0.3
    this.ior = 1.48
    this.emissiveNode = graph.mul(veil)
      .add(farDust.mul(0.65).add(nearDust.mul(intimate.mul(0.8).add(0.4))).mul(outline.mul(0.8).oneMinus()))
      .add(nebulaColor.mul(nebula).mul(0.23))
      .add(mix(color(hsl.integer(262, 72, 33)), color(hsl.integer(246, 51, 56)), grazing).mul(limb))
  }

  override dispose() {
    this.atlas.dispose()
    super.dispose()
  }
}

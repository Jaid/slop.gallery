import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, bitangentLocal, color, mix, mx_noise_float, normalLocal, positionGeometry, texture, time, uv, vec2, vec3} from 'three/tsl'
import {DataTexture, LinearFilter, LinearMipmapLinearFilter, RGBAFormat, UnsignedByteType} from 'three/webgpu'

import {tubeRay} from '../../lib/atelier.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

type Point = readonly [number, number]
type Chain = ReadonlyArray<Point>

// Both drawings are actual star charts: the nodes are the stars, the segments their relationships.
// Keeping their geometry here (rather than embedding a picture) makes every outline editable.
const leaper: ReadonlyArray<Chain> = [
  [[0.13, 0.46], [0.25, 0.51], [0.35, 0.61], [0.48, 0.64], [0.61, 0.62], [0.73, 0.55], [0.76, 0.63], [0.74, 0.81], [0.81, 0.74], [0.85, 0.81], [0.91, 0.7], [0.95, 0.66], [0.91, 0.6], [0.83, 0.57], [0.73, 0.55]],
  [[0.13, 0.46], [0.22, 0.4], [0.35, 0.35], [0.48, 0.34], [0.61, 0.39], [0.72, 0.48], [0.83, 0.57]],
  [[0.13, 0.46], [0.07, 0.51], [0.08, 0.65], [0.14, 0.78], [0.21, 0.84], [0.27, 0.82]],
  [[0.25, 0.4], [0.19, 0.31], [0.11, 0.24], [0.07, 0.22], [0.16, 0.22]],
  [[0.34, 0.35], [0.29, 0.25], [0.22, 0.2], [0.3, 0.2]],
  [[0.6, 0.39], [0.7, 0.34], [0.82, 0.25], [0.94, 0.23]],
  [[0.7, 0.48], [0.8, 0.4], [0.92, 0.36], [0.97, 0.37]],
  [[0.82, 0.67], [0.85, 0.69]],
  [[0.9, 0.63], [0.95, 0.61]],
  [[0.87, 0.58], [0.96, 0.57]],
] as const
const wayfarer: ReadonlyArray<Chain> = [
  [[0.19, 0.44], [0.29, 0.51], [0.42, 0.54], [0.56, 0.54], [0.68, 0.49], [0.73, 0.55], [0.73, 0.66], [0.71, 0.79], [0.79, 0.73], [0.86, 0.8], [0.91, 0.72], [0.91, 0.66], [0.96, 0.61], [0.89, 0.58], [0.8, 0.59], [0.73, 0.55]],
  [[0.19, 0.44], [0.24, 0.37], [0.36, 0.34], [0.48, 0.36], [0.61, 0.35], [0.72, 0.38], [0.8, 0.48], [0.8, 0.59]],
  [[0.19, 0.44], [0.12, 0.44], [0.09, 0.55], [0.11, 0.68], [0.07, 0.72], [0.05, 0.66]],
  [[0.29, 0.36], [0.25, 0.23], [0.2, 0.16], [0.29, 0.16]],
  [[0.39, 0.36], [0.4, 0.22], [0.36, 0.15], [0.45, 0.15]],
  [[0.57, 0.36], [0.57, 0.23], [0.53, 0.15], [0.63, 0.15]],
  [[0.69, 0.38], [0.73, 0.24], [0.72, 0.16], [0.81, 0.16]],
  [[0.77, 0.67], [0.81, 0.69]],
  [[0.86, 0.67], [0.89, 0.68]],
  [[0.89, 0.61], [0.95, 0.59]],
  [[0.89, 0.6], [0.95, 0.55]],
] as const
const width = 1024
const height = 512
const tile = 512
const channels = 4
const random = (seed: number) => {
  let state = seed >>> 0
  return () => {
    state = Math.imul(state ^ state >>> 15, 1 | state)
    state ^= state + Math.imul(state ^ state >>> 7, 61 | state)
    return ((state ^ state >>> 14) >>> 0) / 4_294_967_296
  }
}
/** A tiny additive vector rasterizer: R = silver thread, G = star cores, B = halos, A = etched cartography. */
function createConstellationAtlas() {
  const pixels = new Float32Array(width * height * channels)
  const stamp = (variant: number, x: number, y: number, radius: number, channel: number, energy: number) => {
    const px = variant * tile + x * tile
    const py = y * tile
    const reach = radius * 2.7
    const left = Math.max(variant * tile, Math.ceil(px - reach))
    const right = Math.min((variant + 1) * tile - 1, Math.floor(px + reach))
    const bottom = Math.max(0, Math.ceil(py - reach))
    const top = Math.min(tile - 1, Math.floor(py + reach))
    for (let iy = bottom;iy <= top;iy++) {
      for (let ix = left;ix <= right;ix++) {
        const distance = ((ix - px) ** 2 + (iy - py) ** 2) / (radius * radius)
        const index = (iy * width + ix) * channels + channel
        pixels[index] = Math.max(pixels[index], Math.exp(-distance * 0.5) * energy)
      }
    }
  }
  const segment = (variant: number, a: Point, b: Point, channel: number, radius: number, energy: number) => {
    const distance = Math.hypot((b[0] - a[0]) * tile, (b[1] - a[1]) * tile)
    const steps = Math.ceil(distance / Math.max(0.85, radius * 0.55))
    for (let i = 0;i <= steps;i++) {
      const t = i / steps
      stamp(variant, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, radius, channel, energy)
    }
  }
  for (const [variant, chains] of [leaper, wayfarer].entries()) {
    const next = random(7549 + variant * 419)
    // Concentric but incomplete astrolabe: interrupted arcs remain behind each animal.
    for (const [radius, energy] of [[0.468, 0.27], [0.413, 0.12]] as const) {
      for (let i = 0;i < 360;i++) {
        const t = i / 360 * Math.PI * 2
        const x = 0.5 + Math.cos(t) * radius
        const y = 0.5 + Math.sin(t) * radius * 0.87
        if (i % 103 < 77 && x > 0.025 && x < 0.975) {
          stamp(variant, x, y, 0.76, 3, energy)
        }
      }
    }
    for (const chain of chains) {
      for (let i = 1;i < chain.length;i++) {
        segment(variant, chain[i - 1], chain[i], 0, 1.25, 0.67)
        const a = chain[i - 1]
        const b = chain[i]
        const steps = Math.max(1, Math.ceil(Math.hypot((b[0] - a[0]) * tile, (b[1] - a[1]) * tile) / 11))
        for (let j = 1;j < steps;j++) {
          const t = j / steps
          const x = a[0] + (b[0] - a[0]) * t
          const y = a[1] + (b[1] - a[1]) * t
          stamp(variant, x, y, 2.55, 1, 0.55)
          stamp(variant, x, y, 8.2, 2, 0.23)
        }
      }
      for (const [i, point] of chain.entries()) {
        const prominence = i % 4 === 0 || i === chain.length - 1 ? 1 : 0.73
        stamp(variant, point[0], point[1], prominence * 5.1, 1, i % 4 === 0 ? 1 : 0.66)
        stamp(variant, point[0], point[1], prominence * 13, 2, 0.5)
        if (!(i % 3 === 0)) {
          continue
        }
        segment(variant, [point[0] - 0.016, point[1]], [point[0] + 0.016, point[1]], 3, 0.62, 0.66)
        segment(variant, [point[0], point[1] - 0.016], [point[0], point[1] + 0.016], 3, 0.62, 0.66)
      }
    }
    for (let i = 0;i < 47;i++) {
      const x = 0.025 + next() * 0.95
      const y = 0.025 + next() * 0.95
      const magnitude = 0.32 + next() * 0.68
      stamp(variant, x, y, 1 + magnitude * 1.5, 3, 0.27 + magnitude * 0.53)
      if (i % 9 === 0) {
        stamp(variant, x, y, 7, 2, 0.1)
      }
    }
    // Navigational ticks: the cats belong to a larger imaginary celestial instrument.
    for (let i = 0;i < 15;i++) {
      const x = 0.09 + i * 0.058
      segment(variant, [x, 0.042], [x, 0.042 + (i % 5 === 0 ? 0.024 : 0.012)], 3, 0.72, 0.53)
      segment(variant, [x, 0.958], [x, 0.958 - (i % 5 === 0 ? 0.024 : 0.012)], 3, 0.72, 0.53)
    }
  }
  const bytes = new Uint8Array(pixels.length)
  for (let i = 0;i < bytes.length;i++) {
    bytes[i] = Math.round(Math.min(1, pixels[i]) * 255)
  }
  const atlas = new DataTexture(bytes, width, height, RGBAFormat, UnsignedByteType)
  atlas.name = 'Felidae Nocturne – illustrated stellar atlas'
  atlas.magFilter = LinearFilter
  atlas.minFilter = LinearMipmapLinearFilter
  atlas.generateMipmaps = true
  atlas.needsUpdate = true
  return atlas
}

/** An engraved nocturne, not a star field: two hand-drawn cat asterisms alternate along the tube. */
export default class extends KnotMaterial {
  private readonly atlas = createConstellationAtlas()
  constructor(environment: Texture) {
    super(environment, 0.2)
    this.name = knotData.id
    const {rim, near, intimate, facing, view, objectDistance} = viewerFrame()
    // Follow the audience around the tube: a whole animal occupies the visible hemisphere.
    // The apparent turn is a deliberate piece of anamorphic, angle-dependent art.
    const front = atan(view.dot(vec3(bitangentLocal as unknown as Node<'vec3'>)), view.dot(normalLocal)).div(Math.PI)
    const coordinates = vec2(uv().x.mul(16), front.negate().add(0.5))
    const nearFigure = coordinates.x.floor().mod(2)
    const chart = vec2(coordinates.x.fract().add(nearFigure).mul(0.5), coordinates.y.fract())
    // At gallery distance the sky resolves into eight monumental beasts; close up it divides into sixteen.
    const distanceDetail = objectDistance.smoothstep(3.05, 4.15).oneMinus()
    const distantU = uv().x.mul(8)
    const distantFigure = distantU.floor().mod(2)
    const figure = mix(distantFigure, nearFigure, distanceDetail)
    const distantChart = vec2(distantU.fract().add(distantFigure).mul(0.5), coordinates.y.fract())
    const ink = mix(texture(this.atlas, distantChart), texture(this.atlas, chart), distanceDetail)
    // A spectral copy lies underneath the silver inlay. Walking past makes it slip out of register.
    const ray = tubeRay()
    const deepChart = vec2(chart.x.add(ray.x.mul(0.085)), chart.y.add(ray.y.mul(0.018)))
    const reflection = texture(this.atlas, deepChart)
    const p = positionGeometry
    const glassGrain = mx_noise_float(p.mul(17)).mul(0.5).add(0.5)
    const slowTide = time.mul(0.52).sub(coordinates.x.mul(0.67)).add(coordinates.y.mul(2.1))
    const traveling = slowTide.sin().mul(0.5).add(0.5).pow(6)
    const scintillation = coordinates.x.mul(41).add(coordinates.y.mul(79)).add(time.mul(2.7)).sin().mul(0.23).add(0.79)
    const cool = mix(color(hsl.integer(226, 100, 82)), color(hsl.integer(308, 89, 74)), figure.mul(0.63).add(glassGrain.mul(0.19)))
    const silver = mix(cool, color(hsl.integer(87, 48, 94)), 0.32)
    const stars = mix(color(hsl.integer(65, 66, 74)), color(hsl.integer(79, 60, 89.5)), figure.mul(0.3).add(traveling.mul(0.4)))
    const line = ink.r.mul(0.34).add(ink.r.mul(traveling).mul(0.28))
    const dots = ink.g.mul(scintillation).mul(near.mul(0.24).add(1.25))
    const aura = ink.b.mul(0.31).mul(near.mul(0.4).add(0.75))
    const etching = ink.a.mul(intimate.mul(0.95).add(0.13))
    const reflectionGlow = reflection.g.mul(0.28).add(reflection.r.mul(0.1)).mul(rim.mul(0.7).add(0.13)).mul(distanceDetail)
    const enamel = mix(color(hsl.integer(260, 48, 12)), color(hsl.integer(254, 42, 31)), glassGrain.mul(0.38).add(rim.mul(0.36)))
    this.colorNode = enamel.add(color(hsl.integer(257, 62, 22)).mul(ink.b).mul(0.14))
    this.metalness = 0.14
    this.roughnessNode = glassGrain.mul(0.08).add(0.32)
    this.clearcoat = 0.42
    this.clearcoatRoughness = 0.19
    this.iridescence = 0.2
    this.iridescenceIOR = 1.33
    this.iridescenceThicknessNode = glassGrain.mul(110).add(facing.mul(130)).add(220)
    this.emissiveNode = silver.mul(line.mul(distanceDetail.mul(0.5).add(0.58)).add(aura)).add(stars.mul(dots).mul(1.15))
      .add(color(hsl.integer(208, 66, 80)).mul(etching).mul(0.25))
      .add(color(hsl.integer(282, 91, 54)).mul(reflectionGlow))
      .add(vec3(0.008, 0.015, 0.044).mul(rim.pow(2)))
  }
  override dispose() {
    this.atlas.dispose()
    super.dispose()
  }
}

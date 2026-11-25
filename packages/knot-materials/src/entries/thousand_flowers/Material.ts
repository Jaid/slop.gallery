import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, float, mix, mx_noise_float, positionGeometry, select, time, uv, vec2, vec3} from 'three/tsl'

import {rgb} from '../../candidates/claude_sonnet/lib/rgb.ts'
import {knotCircumference, knotLength, tubeCells, tubeMetric} from '../../candidates/claude_sonnet/lib/tubeMetric.ts'
import {tubeRay} from '../../lib/atelier.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const rows = 6
const palette = [hsl.integer(265.5, 95.7, 34.6), hsl.integer(86, 47, 94.6), hsl.integer(25, 95.4, 49), hsl.integer(79, 91, 77), hsl.integer(162, 97, 49), hsl.integer(351, 77, 64), hsl.integer(209, 95, 66), hsl.integer(302, 79, 36.6)].map(rgb)
/** One of eight glass colors, chosen by a random number in [0, 1). */
const pick = (u: Node<'float'>) => {
  let glass: Node<'vec3'> = palette[0]
  for (let index = 1;index < palette.length;index++) {
    glass = select(u.greaterThanEqual(index / palette.length), palette[index], glass)
  }
  return glass
}
/** A layer of murrine: slices of a glass cane that was pulled from a stack of colored rods. Cells sit on a staggered lattice; every cane gets its own petal count, ring colors, rotation and slow color breath. */
function murrine(tube: Node<'vec2'>, columns: number, seed: number, footprintScale: Node<'float'>) {
  const cells = tubeCells(tube, columns, rows)
  const row = cells.y.floor()
  const stagger = row.mod(2).mul(0.5)
  const shifted = cells.x.add(stagger)
  const column = shifted.floor()
  const id = vec2(column.mod(columns), row.mod(rows))
  const width = knotLength / columns
  const height = knotCircumference / rows
  const local = vec2(shifted.fract().sub(0.5).mul(width), cells.y.fract().sub(0.5).mul(height))
  const a = cellNoiseVec3(vec3(id, seed))
  const b = cellNoiseVec3(vec3(id, seed + 7.3))
  const c = cellNoiseVec3(vec3(id, seed + 19.1))
  const center = vec2(a.x, a.y).sub(0.5).mul(0.012)
  const q = local.sub(center)
  const reach = float(Math.min(width, height) * 0.47).mul(a.z.mul(0.16).add(0.86))
  const r = q.length().div(reach)
  const angle = atan(q.y, q.x.add(1e-6)).add(b.x.mul(TAU)).add(time.mul(b.y.sub(0.5)).mul(0.22))
  const petals = b.z.mul(4).floor().add(5)
  const lobe = angle.mul(petals).cos()
  const star = angle.mul(petals.mul(2)).cos().mul(0.5).add(0.5)
  const breath = time.mul(c.x.mul(0.25).add(0.12)).add(c.y.mul(TAU)).sin().mul(0.5).add(0.5)
  const edge = footprintScale.max(0.004)
  const disc = r.smoothstep(float(1).sub(edge), float(1).add(edge)).oneMinus()
  const rim = pick(a.x)
  const wall = pick(b.x)
  const petal = pick(a.y)
  const gap = pick(c.z)
  const heart = mix(pick(b.y), pick(c.y), breath)
  const eye = pick(c.x)
  const rimMask = r.smoothstep(0.9, 0.93)
  const petalEdge = lobe.mul(0.17).add(0.66)
  const petalMask = r.smoothstep(petalEdge.sub(0.02), petalEdge.add(0.02)).oneMinus()
  const starMask = r.smoothstep(0.3, 0.33).oneMinus().mul(star.smoothstep(0.4, 0.6))
  let glass: Node<'vec3'> = wall
  glass = select(r.lessThan(0.92), mix(gap, petal, petalMask), glass)
  glass = select(r.lessThan(0.52), mix(petal, wall, star.smoothstep(0.45, 0.55)), glass)
  glass = select(r.lessThan(0.31), mix(heart, gap, starMask), glass)
  glass = select(r.lessThan(0.11), eye, glass)
  glass = mix(glass, rim, rimMask)
// Thick lens of glass: each slice darkens toward its rim and brightens at the heart.
  const lens = r.pow(2).oneMinus().mul(0.38).add(0.62)
  return {
    color: glass.mul(lens),
    coverage: disc.mul(a.z.smoothstep(0.03, 0.08)),
  }
}
/** A hand-blown millefiori paperweight: three depths of glass flowers under a wavering dome, with aventurine in the matrix. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.25)
    this.name = knotData.id
    const {view, facing, grazing, near, intimate} = viewerFrame()
    const tube = uv()
    const ray = tubeRay()
    const footprint = tubeCells(tube, 42, rows).fwidth().x.max(0.0005)
    const layers = [{
      depth: 0.085,
      columns: 36,
      seed: 3.1,
      tone: rgb(hsl.integer(228, 84, 30)),
      mist: 0.42,
    }, {
      depth: 0.045,
      columns: 40,
      seed: 11.7,
      tone: rgb(hsl.integer(177, 93, 33)),
      mist: 0.22,
    }, {
      depth: 0,
      columns: 44,
      seed: 27.4,
      tone: rgb(hsl.integer(0, 0, 0)),
      mist: 0,
    }]
    const mistScale = footprint.mul(14)
    let surface: Node<'vec3'> = rgb(hsl.integer(219, 80, 9))
    let glow: Node<'vec3'> = rgb(hsl.integer(0, 0, 0))
    for (const layer of layers) {
      const slice = murrine(tube.sub(ray.mul(layer.depth)), layer.columns, layer.seed, mistScale)
      const tinted = mix(slice.color, layer.tone, layer.mist)
      surface = mix(surface, tinted, slice.coverage)
      glow = mix(glow, tinted, slice.coverage)
    }
// Aventurine flakes in the clear matrix glint only when their facet faces the eye.
    const p = positionGeometry
    const flakes = cellularPoints(p.mul(70), 0.02, 0.11, 0.74)
    const flakeNormal = cellNoiseVec3(p.mul(70).floor().add(4.4)).sub(0.5).mul(2).normalize()
    const flash = flakeNormal.dot(view).saturate().pow(18).mul(time.mul(1.3).add(p.x.mul(50)).sin().mul(0.3).add(0.7))
    this.colorNode = surface
    this.metalness = 0
    this.roughnessNode = float(0.3)
    this.ior = 1.5
    this.clearcoat = 1
    this.clearcoatRoughness = 0.02
    this.specularIntensity = 1
// Hand-blown glass is never flat: a slow swell in the dome bends the reflected softboxes.
    const swell = mx_noise_float(p.mul(5.5).add(vec3(0, time.mul(0.03), 0))).mul(0.0022).add(mx_noise_float(p.mul(17)).mul(0.0005))
    const dome = proceduralNormal(swell, 1)
    this.normalNode = dome
    this.clearcoatNormalNode = dome
// A lantern wave travels along the knot and lights the flowers one stretch at a time.
    const lantern = tubeMetric(tube).x.mul(TAU * 3 / knotLength).sub(time.mul(0.8)).sin().mul(0.5).add(0.5).pow(3)
    this.emissiveNode = glow.mul(lantern.mul(0.5).add(0.18)).mul(near.mul(0.3).add(0.85))
      .add(rgb(hsl.integer(85, 100, 88.5)).mul(flakes).mul(flash).mul(2.4).mul(intimate.mul(0.6).add(0.4)))
      .add(rgb(hsl.integer(218, 73, 48)).mul(grazing.pow(3)).mul(0.07))
      .add(rgb(hsl.integer(0, 0, 100)).mul(facing.pow(24)).mul(0.03))
  }
}

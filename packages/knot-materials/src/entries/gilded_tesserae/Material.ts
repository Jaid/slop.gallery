import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {bitangentLocal, color, float, mix, negateOnBackSide, normalLocal, select, tangentLocal, time, transformNormalToView, uv, vec2, vec3} from 'three/tsl'

import {tubeCells} from '../../candidates/claude_sonnet/lib/tubeMetric.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const tilesAlong = 246
const tilesAround = 28
const medallionsAlong = 16
const medallionsAround = 2
const gold = color(1, 0.77, 0.32)
/** Medallion rings from the outside in: outer radius in tiles, tint per lattice and whether the ring is colored glass rather than gold leaf. */
const rings = [{
  radius: 4.9,
  blue: color(hsl.integer(265, 94, 24.5)),
  green: color(hsl.integer(161, 97, 32)),
  glass: 1,
}, {
  radius: 4,
  blue: gold,
  green: gold,
  glass: 0,
}, {
  radius: 3.2,
  blue: color(hsl.integer(87, 40, 91.5)),
  green: color(hsl.integer(87, 40, 91.5)),
  glass: 1,
}, {
  radius: 2.4,
  blue: color(hsl.integer(264, 94, 41)),
  green: color(hsl.integer(159, 98, 54)),
  glass: 1,
}, {
  radius: 1.5,
  blue: gold,
  green: gold,
  glass: 0,
}, {
  radius: 0.7,
  blue: color(hsl.integer(31, 93, 43)),
  green: color(hsl.integer(31, 93, 43)),
  glass: 1,
}]
/** Hand-set smalti: gold leaf under glass, a few colored glass medallions, dark grout and a candle that follows the eye. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.05)
    this.name = knotData.id
    const {p, view, near, intimate, facing} = viewerFrame()
    const cells = tubeCells(uv(), tilesAlong, tilesAround)
    const row = cells.y.floor()
    const stagger = row.mod(2).mul(0.5)
    const shifted = cells.x.add(stagger)
    const column = shifted.floor()
    const id = vec2(column.mod(tilesAlong), row.mod(tilesAround))
    const local = vec2(shifted.fract(), cells.y.fract()).sub(0.5)
    const random = cellNoiseVec3(vec3(id, 3.7))
    const random2 = cellNoiseVec3(vec3(id, 11.1))
    const random3 = cellNoiseVec3(vec3(id, 23.9))
// Each tile is a rounded box with its own inset and drift, like a tessera pressed into wet mortar.
    const half = random.x.mul(0.03).add(0.43)
    const drift = vec2(random.y, random.z).sub(0.5).mul(0.05)
    const q = local.sub(drift)
    const radius = 0.08
    const box = q.abs().sub(half.sub(radius))
    const distance = box.max(0).length().add(box.x.max(box.y).min(0)).sub(radius)
    const aa = distance.fwidth().max(0.0008)
    const resolved = cells.fwidth().x.max(cells.fwidth().y).smoothstep(0.25, 0.8).oneMinus()
    const tile = mix(float(0.72), distance.smoothstep(aa.negate(), aa).oneMinus(), resolved)
// The design: two interleaved lattices of medallions, measured from each tile’s own center in whole tiles.
    const center = vec2(column.add(0.5).sub(stagger), row.add(0.5))
    const spacing = vec2(tilesAlong / medallionsAlong, tilesAround / medallionsAround)
    const offsetA = center.div(spacing)
    const offsetB = offsetA.sub(0.5)
    const distanceA = offsetA.sub(offsetA.add(0.5).floor()).mul(spacing).length()
    const distanceB = offsetB.sub(offsetB.add(0.5).floor()).mul(spacing).length()
    const radial = distanceA.min(distanceB)
    const isA = distanceA.lessThan(distanceB)
    let tint: Node<'color'> = gold
    let glass: Node<'float'> = float(0)
    for (const ring of rings) {
      const inRing = radial.lessThan(ring.radius)
      tint = select(inRing, select(isA, ring.blue, ring.green), tint)
      glass = select(inRing, float(ring.glass), glass)
    }
// Gold varies tile to tile: paler, richer, rosier.
    const paleGold = mix(gold, color(0.95, 0.86, 0.58), random3.x.smoothstep(0.55, 1).mul(0.6))
    const roseGold = mix(paleGold, color(1, 0.58, 0.27), random3.y.smoothstep(0.7, 1).mul(0.5))
    const leaf = mix(roseGold, tint, glass)
// Every tile leans its own way and domes slightly, so each one is a small lens.
    const normal = normalLocal.normalize()
    const tangent = vec3(tangentLocal).normalize()
    const bitangent = vec3(bitangentLocal as unknown as Node<'vec3'>).normalize()
    const scatter = vec3(random2.x, random2.y, random2.z).sub(0.5).mul(2)
    const lean = scatter.sub(normal.mul(scatter.dot(normal)))
    const dome = q.mul(0.4).add(q.div(half).clamp(-1, 1).pow3().mul(0.9))
    const tileNormal = normal.add(lean.mul(0.3).mul(resolved)).add(tangent.mul(dome.x).add(bitangent.mul(dome.y)).mul(resolved)).normalize()
    const viewNormal = negateOnBackSide(transformNormalToView(tileNormal))
    this.normalNode = viewNormal
    this.clearcoatNormalNode = viewNormal
    this.colorNode = mix(color(hsl.integer(61, 21, 7)), leaf, tile)
    this.metalnessNode = tile.mul(glass.oneMinus())
    this.roughnessNode = mix(float(0.92), mix(float(0.25), float(0.1), glass), tile)
    this.clearcoatNode = tile.mul(glass.mul(-0.55).add(0.55))
    this.clearcoatRoughnessNode = float(0.08)
    this.aoNode = mix(float(0.3), float(1), tile.smoothstep(0, 0.9))
// Two lamps: one follows the eye, and a candle drifts around the knot so the glitter sweeps even when nobody moves.
    const orbit = time.mul(0.21)
    const candle = vec3(orbit.cos().mul(1.1), orbit.mul(0.63).sin().mul(0.7), orbit.sin().mul(1.1))
    const candleHalf = view.add(candle.sub(p).normalize()).normalize()
    const sharp = mix(float(24), float(90), intimate)
    const eyeGlint = tileNormal.dot(view).saturate().pow(sharp)
    const candleGlint = tileNormal.dot(candleHalf).saturate().pow(sharp.mul(1.6))
    const catchLight = eyeGlint.mul(0.7).add(candleGlint.mul(1.6))
// Each tile flickers on its own clock.
    const flicker = time.mul(random.x.mul(5).add(3)).add(random.y.mul(6.283)).sin().mul(0.22).add(0.78)
    const flare = time.mul(random2.z.mul(0.7).add(0.3)).add(random3.z.mul(40)).sin().smoothstep(0.93, 1).mul(0.9)
    const lantern = leaf.mul(catchLight.mul(flicker.add(flare))).mul(tile).mul(near.mul(0.9).add(0.55)).mul(facing.mul(0.6).add(0.4))
    this.emissiveNode = lantern.mul(1.5).add(glass.mul(tile).mul(leaf).mul(0.06).mul(flicker))
  }
}

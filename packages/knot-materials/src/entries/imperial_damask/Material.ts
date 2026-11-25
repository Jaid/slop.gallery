import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, color, float, luminance, mix, mx_noise_float, time, uv, vec2, vec3} from 'three/tsl'

import {environmentRadiance} from '../../candidates/claude_opus/lib/environmentRadiance.ts'
import {coverage, pixelFootprint} from '../../candidates/claude_opus/lib/footprint.ts'
import {knotArc, knotCircumference, knotLength} from '../../candidates/claude_opus/lib/knotArc.ts'
import {knotFrame} from '../../candidates/claude_opus/lib/knotFrameOpus55.ts'
import {tubeRelief} from '../../candidates/claude_opus/lib/tubeRelief.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** pattern repeats along and around the tube; a half-drop offsets alternate columns */
const repeats: [number, number] = [18, 2]
/** threads along and around the tube, stylized coarser than real silk so the weave reads up close; multiples of the five-harness satin step keep the UV seams closed */
const threads: [number, number] = [3440, 390]
/** A slender leaf whose half-width tapers to both tips. */
function leaf(q: Node<'vec2'>, center: [number, number], angle: number, length: number, width: number) {
  const d = q.sub(vec2(...center))
  const along = d.x.mul(Math.cos(angle)).add(d.y.mul(Math.sin(angle)))
  const across = d.y.mul(Math.cos(angle)).sub(d.x.mul(Math.sin(angle)))
  const taper = along.div(length).pow(2).oneMinus().max(0).mul(width)
  return across.abs().sub(taper).max(along.abs().sub(length))
}
/** The damask figure: pomegranate blossoms, tapering leaves and sprigs, as a signed distance in tile units. */
function ornament(tube: Node<'vec2'>) {
  const tile = vec2(knotArc(tube.x), tube.y).mul(vec2(...repeats))
  const column = tile.x.floor()
  const dropped = vec2(tile.x, tile.y.add(column.mod(2).mul(0.5)))
  const q = dropped.fract().sub(0.5)
  const radius = q.length()
  const angle = atan(q.y, q.x)
// blossom: scalloped petals split by ground-colored veins, a ring and a seeded heart
  const petals = radius.sub(angle.mul(6).cos().mul(0.035).add(0.165))
  const veins = angle.mul(3).sin().abs().mul(radius).sub(0.009).negate().max(radius.sub(0.2)).max(float(0.07).sub(radius))
  const ring = radius.sub(0.085).abs().sub(0.008).negate()
  const heart = radius.sub(0.052)
  const seeds = q.mul(48).fract().sub(0.5).length().sub(0.23).div(48).max(radius.sub(0.045))
  const blossom = petals.max(veins).max(ring).min(heart.max(seeds.negate()))
// four leaves curling from the blossom, and sprigs where tiles meet
  let foliage: Node<'float'> = float(1)
  for (const [x, y, leafAngle] of [[0.27, 0.2, 0.9], [-0.27, -0.2, 0.9], [0.27, -0.2, -0.9], [-0.27, 0.2, -0.9]] as const) {
    foliage = foliage.min(leaf(q, [x, y], leafAngle, 0.13, 0.045))
  }
  const midrib = leaf(q, [0.27, 0.2], 0.9, 0.11, 0.004).min(leaf(q, [-0.27, -0.2], 0.9, 0.11, 0.004)).min(leaf(q, [0.27, -0.2], -0.9, 0.11, 0.004)).min(leaf(q, [-0.27, 0.2], -0.9, 0.11, 0.004))
  const corner = q.abs().sub(0.5).length()
  const sprig = corner.sub(angle.mul(5).cos().mul(0.012).add(0.05))
  return {
    figure: blossom.min(foliage.max(midrib.negate())).min(sprig),
    tile: dropped,
  }
}
/** Silk damask. Crimson warp and golden weft are woven into one satin cloth: the ground is warp-faced, the pomegranate figure weft-faced. Their threads run at right angles, so each catches the light along a different axis — circling the knot, the pattern flares, vanishes and inverts against its ground. A slow draught moves through the cloth, sliding the sheen along its folds. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.05)
    this.name = knotData.id
    const tube = uv()
    const {objectDistance} = viewerFrame()
    const near = objectDistance.smoothstep(0.9, 2.2).oneMinus()
    const tileSize = vec2(knotLength / repeats[0], knotCircumference / repeats[1])
    const figureDistance = ornament(tube).figure
    const pixel = pixelFootprint().balanced
    const figure = coverage(figureDistance.mul(tileSize.x), pixel)
// satin weave: in each crossing one thread floats on top; five-harness satin steps by two
    const cloth = vec2(knotArc(tube.x), tube.y).mul(vec2(...threads))
    const crossing = cloth.floor()
    const step = crossing.x.add(crossing.y.mul(2)).mod(5)
    const tacked = step.lessThan(0.5).select(float(1), float(0))
// ground: warp on top except at tacking points; figure: the reverse
// tacking points hide beneath their neighbours' floats, so they only half show
    const warpOnTop = mix(tacked.mul(-0.12).add(1), tacked.mul(0.12), figure)
    const weave = pixel.mul(threads[1] / knotCircumference).smoothstep(0.2, 0.55).oneMinus()
// round thread profiles: lengthwise shading across each float
    const within = cloth.fract().sub(0.5)
    const warpProfile = within.y.mul(Math.PI).cos()
    const weftProfile = within.x.mul(Math.PI).cos()
    const threadShade = mix(weftProfile, warpProfile, warpOnTop).mul(0.25).add(0.75)
    const onTop = mix(figure.oneMinus(), warpOnTop, weave)
// a draught ripples through the cloth
    const draught = (at: Node<'vec2'>) => {
      const along = knotArc(at.x).mul(TAU * 9)
      const around = at.y.mul(TAU)
      return along.sub(time.mul(0.55)).add(around.sin().mul(1.4)).sin().mul(0.0055)
        .add(along.mul(0.43).add(time.mul(0.31)).add(around.cos().mul(0.8)).sin().mul(0.0028))
    }
    const rest = knotFrame(tube)
    this.positionNode = rest.position.add(rest.normal.mul(draught(tube)))
    this.normalNode = tubeRelief(draught).viewNormal
    const crimson = color(hsl.integer(19, 90, 17))
    const crimsonLight = color(hsl.integer(20, 94, 32.6))
    const gold = color(hsl.integer(71, 81, 28))
    const goldLight = color(hsl.integer(87, 73, 81))
// every thread was dyed a touch differently; identities wrap with the thread counts
    const warpSlub = cellNoiseVec3(vec3(crossing.y.mod(threads[1]), 3.3, 0)).x
    const weftSlub = cellNoiseVec3(vec3(crossing.x.mod(threads[0]), 7.1, 0)).x
    const drift = mx_noise_float(rest.position.mul(9)).mul(0.5).add(0.5)
    const slub = mix(weftSlub, warpSlub, onTop).mul(weave).add(drift.mul(0.5))
    const warpColor = mix(crimson, crimsonLight, slub.mul(0.35))
    const weftColor = mix(gold, goldLight, slub.mul(0.35))
    const threadColor = mix(weftColor, warpColor, onTop).mul(mix(float(1), threadShade, weave.mul(near)))
    this.colorNode = threadColor
    this.metalness = 0
    this.roughnessNode = mix(float(0.5), float(0.44), onTop)
    this.specularIntensity = 0.12
    this.specularColorNode = mix(mix(gold, goldLight, 0.5), mix(crimsonLight, color(hsl.integer(11, 100, 76)), 0.4), onTop)
// each float scatters light across its own axis
    this.anisotropyNode = mix(vec2(0.85, 0), vec2(0, 0.85), onTop)
// fibre sheen: each thread mirrors the gallery along a cone around its own axis
// velvet-like grazing light, added by hand: a sheenNode would add divergent branches (see pixelFootprint)
    const {view, grazing} = viewerFrame()
    const reflected = view.negate().reflect(rest.normal)
    const fibreSheen = (axis: Node<'vec3'>) => {
      const cosine = axis.dot(view)
      const ring = reflected.sub(axis.mul(reflected.dot(axis))).normalize().mul(cosine.mul(cosine).oneMinus().max(0).sqrt()).sub(axis.mul(cosine))
      const light = luminance(environmentRadiance(environment, ring, 0.42)).pow(1.5)
// soft-clip, so a softbox makes silk glow rather than blow out
      return light.div(light.add(1.2)).mul(2.2)
    }
    const warpSheen = fibreSheen(rest.tangent)
    const weftSheen = fibreSheen(rest.normal.cross(rest.tangent).normalize())
    const sheenLight = mix(goldLight.mul(weftSheen), color(hsl.integer(22, 96, 48)).mul(warpSheen).mul(1.3), onTop)
    const grazingSheen = mix(color(hsl.integer(85, 100, 88.5)), color(hsl.integer(18, 100, 65)), onTop).mul(grazing.pow(3)).mul(0.12)
    this.emissiveNode = sheenLight.mul(0.7).add(grazingSheen)
  }
}

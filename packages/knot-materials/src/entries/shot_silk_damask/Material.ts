import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, color, float, mix, positionGeometry, positionViewDirection, select, tangentView, time, uv, vec2, vec3} from 'three/tsl'

import {tubeCells} from '../../candidates/claude_sonnet/lib/tubeMetric.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const warps = 120
const wefts = 1050
const motifsAlong = 52
const motifsAround = 6
/** Signed field of the brocade: an ogee lozenge ring, an eight-petal rosette and corner buds. Negative inside. */
function motifField(threadPosition: Node<'vec2'>) {
  const motif = threadPosition.mul(vec2(motifsAlong / wefts, motifsAround / warps))
// Half-drop repeat: odd rows slide half a repeat, which wraps cleanly because the row count is even.
  const shifted = vec2(motif.x.add(motif.y.floor().mod(2).mul(0.5)), motif.y)
  const q = shifted.fract().sub(0.5).mul(2)
  const lozenge = q.x.abs().mul(0.92).add(q.y.abs()).sub(0.66).abs().sub(0.1)
  const petals = q.length().sub(atan(q.y, q.x.add(1e-6)).mul(8).cos().mul(0.12).add(0.28))
  const buds = q.abs().sub(1).length().sub(0.3)
  return lozenge.min(petals).min(buds)
}
/** Five-harness satin jacquard in shot silk: warp-faced ground, weft-faced gold brocade, both anisotropic. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const {facing, grazing, near, intimate} = viewerFrame()
    const thread = tubeCells(uv(), wefts, warps)
    const index = thread.floor()
    const inside = thread.fract()
    const resolved = thread.fwidth().x.max(thread.fwidth().y).smoothstep(0.3, 0.75).oneMinus()
// Brocade: decided per thread when resolved, per pixel with a filtered edge once threads are too fine to count.
    const field = motifField(index.add(0.5))
    const smoothField = motifField(thread)
    const fieldAA = smoothField.fwidth().max(0.002)
    const faceMotif = select(field.lessThan(0), float(1), float(0))
    const motif = mix(smoothField.smoothstep(fieldAA.negate(), fieldAA).oneMinus(), faceMotif, resolved)
    const interlace = select(index.x.add(index.y.mul(2)).mod(5).equal(0), float(1), float(0))
    const warpUp = mix(float(1).sub(interlace), interlace, faceMotif)
    const across = inside.y.mul(2).sub(1)
    const lengthwise = inside.x.mul(2).sub(1)
    const warpRound = float(1).sub(across.mul(across)).max(0).sqrt()
    const weftRound = float(1).sub(lengthwise.mul(lengthwise)).max(0).sqrt()
    const round = mix(weftRound, warpRound, warpUp)
    const fibers = cellNoiseVec3(vec3(index, 1.3)).x.mul(0.22).add(0.89)
    const crimson = color(hsl.integer(24, 97, 28))
    const teal = color(hsl.integer(209, 97, 36))
    const gold = color(hsl.integer(80, 85, 78.6))
    const weft = mix(teal, gold, faceMotif)
// Shot silk: warp threads run along the knot and weft threads around it. Looking across the tube the warp faces the
// eye; looking down its length the weft takes over. The tube keeps turning, so stretches of cloth flip color one after
// another as you walk around, and the silhouettes flip first.
    const alongTube = positionViewDirection.dot(tangentView.normalize()).abs()
    const shot = alongTube.smoothstep(0.1, 0.62).mul(0.85).add(grazing.pow(2).mul(0.3)).clamp(0, 0.95)
    const silk = mix(mix(weft, crimson, warpUp), mix(crimson, weft, warpUp), shot).mul(fibers)
// Far away the weave averages: four parts of the facing thread system to one of the other.
    const warpShare = float(0.82).sub(shot.mul(0.64))
    const average = mix(crimson.mul(warpShare).add(teal.mul(warpShare.oneMinus())), gold.mul(warpShare).add(crimson.mul(warpShare.oneMinus())), motif)
    this.colorNode = mix(average, silk, resolved).mul(mix(float(1), round.mul(0.35).add(0.65), resolved))
// Cloth drapes: a slow wave of gentle folds sweeps past, so highlights glide across the weave like a breeze.
    const p = positionGeometry
    const fold = p.dot(vec3(5.1, 3.3, -4.2)).sub(time.mul(0.9)).sin().mul(0.014).add(p.dot(vec3(-3.7, 6.4, 2.9)).add(time.mul(0.5)).sin().mul(0.009))
    const weave = mix(float(0.5), round, resolved).mul(0.0011)
    this.normalNode = proceduralNormal(fold.add(weave), 1)
    this.metalnessNode = mix(float(0.22), float(0.9), motif)
    this.roughnessNode = mix(float(0.3), float(0.24), motif).add(round.oneMinus().mul(0.12).mul(resolved))
    this.anisotropyNode = vec2(float(1).sub(motif), motif).mul(0.9)
    this.aoNode = mix(float(1), round.mul(0.45).add(0.55), resolved)
    this.sheen = 0.45
    this.sheenColor.set(hsl.integer(85, 100, 88.5))
    this.sheenRoughness = 0.42
    this.specularIntensity = 0.85
// Warp highlights hug the silk while the gold answers the eye at close range.
    this.emissiveNode = gold.mul(motif).mul(grazing.pow(3)).mul(0.08).add(crimson.mul(facing.pow(6)).mul(near).mul(0.03)).add(gold.mul(motif).mul(intimate).mul(0.02))
  }
}

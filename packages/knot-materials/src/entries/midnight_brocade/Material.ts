import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {float, mix, mx_noise_float, normalLocal, positionGeometry, tangentLocal, transformNormalToView, vec2, vec3} from 'three/tsl'

import {environmentHighlight} from '../../candidates/claude_fable/lib/environmentHighlight.ts'
import {rgb} from '../../candidates/claude_fable/lib/rgb.ts'
import {knotLength, tubeCircumference, tubeCoordinates} from '../../candidates/claude_fable/lib/tubeCoordinates.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {filteredRibbon} from '../../lib/filteredRibbon.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Pattern repeats along and around the knot – integers keep the brocade seamless. */
const tilesAlong = 24
const tilesAround = 3
/** Thread counts: warp runs along the knot, weft around it, both ~6.5 thousandths of an object unit apart. */
const warpThreads = 1104
const weftThreads = 126
const tileAlong = knotLength / tilesAlong
const tileAround = tubeCircumference / tilesAround
/** An embroidered ornament in a tile centered on (0, 0), in object units. Two motifs alternate like a damask. */
function ornament(x: Node<'float'>, y: Node<'float'>, rosette: Node<'bool'>) {
  const r = vec2(x, y).length().max(1e-5)
  const angle = y.atan(x)
// Rosette: a six-petaled outline with a filled inner flower and a bud at the heart.
  const petalRadius = angle.mul(6).cos().mul(0.032).add(0.098)
  const petalOutline = filteredRibbon(r.sub(petalRadius), 0.0032)
  const innerRadius = angle.mul(6).add(Math.PI).cos().mul(0.018).add(0.05)
  const innerFlower = r.sub(innerRadius).smoothstep(0.003, -0.003)
  const bud = r.smoothstep(0.014, 0.01)
  const rosetteMask = petalOutline.max(innerFlower).max(bud)
// Lozenge: a diamond with four leaves inside, each a stretched ellipse pointing at a corner.
  const diamond = filteredRibbon(x.abs().add(y.abs()).sub(0.112), 0.0032)
  const leaf = (dx: number, dy: number, sx: number, sy: number) => {
    const lx = x.sub(dx)
    const ly = y.sub(dy)
    return vec2(lx.mul(sx), ly.mul(sy)).length().sub(1).smoothstep(0.12, -0.12)
  }
  const leaves = leaf(0.045, 0, 28, 60).max(leaf(-0.045, 0, 28, 60)).max(leaf(0, 0.045, 60, 28)).max(leaf(0, -0.045, 60, 28))
  const lozengeMask = diamond.max(leaves)
  return rosette.select(rosetteMask, lozengeMask)
}
/** Satin brocade: shot silk whose color turns with the view, gold-thread ornament in relief and true anisotropic sheen. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {view, facing, grazing, near, intimate} = viewerFrame()
    const {along, around} = tubeCoordinates()
    const n = normalLocal.normalize()
    const alongDirection = tangentLocal.normalize()
    const aroundDirection = n.cross(alongDirection).normalize()
// Physical tile coordinates, centered, with the around axis wrapped into the tile.
    const tileU = along.mul(tilesAlong)
    const tileV = around.mul(tilesAround)
    const tileIndex = vec2(tileU.floor(), tileV.floor())
    const x = tileU.fract().sub(0.5).mul(tileAlong)
    const y = tileV.fract().sub(0.5).mul(tileAround)
    const rosette = tileIndex.x.add(tileIndex.y).mod(2).lessThan(0.5)
    const motif = ornament(x, y, rosette)
// Vines along the tile borders, meandering between the ornaments.
    const vineX = tileU.fract().sub(0.5).mul(tileAlong)
    const vineAlong = filteredRibbon(y.abs().sub(tileAround / 2).add(vineX.mul(TAU / tileAlong * 2).sin().mul(0.012).add(0.02)), 0.0025)
    const vineAround = filteredRibbon(x.abs().sub(tileAlong / 2).add(y.mul(TAU / tileAround * 2).sin().mul(0.012).add(0.02)), 0.0025)
    const gold = motif.max(vineAlong).max(vineAround).clamp()
// Weave: warp floats cover the silk ground, weft floats carry the gold. Both settle to flat color when unresolved.
    const warpPhase = around.mul(weftThreads * TAU)
    const weftPhase = along.mul(warpThreads * TAU)
    const warpBump = opticalBands(warpPhase)
    const weftBump = opticalBands(weftPhase)
    const warpIndex = around.mul(weftThreads).floor()
    const weftIndex = along.mul(warpThreads).floor()
// Satin binding points: every fifth crossing, staggered, where a warp thread dips under the weft.
    const binding = warpIndex.add(weftIndex.mul(2)).mod(5).lessThan(0.5).select(float(1), float(0)).mul(warpBump.mul(weftBump)).mul(warpPhase.fwidth().smoothstep(1.2, 0.4))
    const threadBump = mix(warpBump, weftBump, gold)
    const wear = mx_noise_float(positionGeometry.mul(13)).mul(0.5).add(0.5)
    const thread = cellNoiseVec3(vec3(warpIndex, weftIndex.mul(gold), 1))
// Relief: embroidery sits proud of the ground, threads ripple at a finer scale, bindings dimple.
    const height = gold.mul(0.0045).add(threadBump.mul(0.0012)).sub(binding.mul(0.0008))
    const heightDx = height.dFdx()
    const heightDy = height.dFdy()
    const dx = positionGeometry.dFdx()
    const dy = positionGeometry.dFdy()
// Surface gradient of the height in the tangent frame, resolved from screen-space derivatives.
    const du = vec2(dx.dot(alongDirection), dy.dot(alongDirection))
    const dv = vec2(dx.dot(aroundDirection), dy.dot(aroundDirection))
    const determinant = du.x.mul(dv.y).sub(du.y.mul(dv.x))
    const safeDeterminant = determinant.sign().mul(determinant.abs().max(1e-10))
    const slopeU = heightDx.mul(dv.y).sub(heightDy.mul(dv.x)).div(safeDeterminant)
    const slopeV = heightDy.mul(du.x).sub(heightDx.mul(du.y)).div(safeDeterminant)
    const reliefNormal = n.sub(alongDirection.mul(slopeU)).sub(aroundDirection.mul(slopeV)).normalize()
    const reliefNormalView = transformNormalToView(reliefNormal)
    this.normalNode = reliefNormalView
// Shot silk: midnight warp and wine weft read differently as the view grazes the threads.
    const warpColor = rgb(hsl.integer(268, 85, 14))
    const weftColor = rgb(hsl.integer(353, 75, 22))
    const shot = grazing.pow(1.6).mul(0.75).add(view.dot(aroundDirection).abs().mul(0.25))
    const silk = mix(warpColor, weftColor, shot).mul(wear.mul(0.3).add(0.85)).mul(thread.x.mul(0.1).add(0.95))
    const goldColor = mix(rgb(hsl.integer(76, 81, 64)), rgb(hsl.integer(87, 81, 82.4)), thread.y.mul(0.5).add(wear.mul(0.5)))
    this.colorNode = mix(silk, goldColor, gold)
    this.metalnessNode = gold.mul(0.95)
    this.roughnessNode = mix(float(0.46), float(0.3), gold).add(binding.mul(0.15)).add(intimate.mul(wear).mul(0.08))
// Anisotropy follows the threads: along the knot on silk, around it on the gold floats.
    this.anisotropyNode = mix(vec2(0.85, 0), vec2(0, 0.7), gold)
    this.sheenNode = mix(rgb(hsl.integer(273, 100, 68.4)).mul(0.5), rgb(hsl.integer(87, 100, 91)).mul(0.2), gold)
    this.sheenRoughness = 0.45
    const goldFlash = environmentHighlight(environment, reliefNormal, 0.3).mul(goldColor).mul(gold).mul(0.5)
    const sparkle = glints(reliefNormalView, 160).mul(gold).mul(thread.z.smoothstep(0.55, 0.95)).mul(near.mul(0.8).add(0.2))
    const silkGlow = mix(rgb(hsl.integer(270, 88, 41)), rgb(hsl.integer(351, 71, 46.3)), shot).mul(facing.oneMinus().pow(3)).mul(0.05)
    this.emissiveNode = goldFlash.add(rgb(hsl.integer(92, 100, 95)).mul(sparkle).mul(0.5)).add(silkGlow)
  }
}

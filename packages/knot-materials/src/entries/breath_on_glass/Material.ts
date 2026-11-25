import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, normalLocal, time, uv, vec2, vec3} from 'three/tsl'

import {filteredBox} from '../../candidates/claude_opus/lib/filteredBox.ts'
import {glitter} from '../../candidates/claude_opus/lib/glitter.ts'
import {tubeCells} from '../../candidates/claude_opus/lib/tubeMetric.ts'
import {beads} from '../../lib/beads.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

/** Coverage of a single line of variable half-width around a distance of 0; below a pixel it keeps one pixel of width and fades by the width it lost, so it never vanishes or blooms. */
function inkLine(distance: Node<'float'>, halfWidth: Node<'float'>, footprint: Node<'float'>) {
  const aa = footprint.max(0.00001)
  return distance.abs().sub(halfWidth).smoothstep(aa.negate().mul(0.5), aa.mul(0.5)).oneMinus().mul(halfWidth.mul(2).div(aa).min(1))
}
/** Fern seeds around the tube; with 106 along, cells are within 1% of square. */
const around = 12
const along = 106
/** tan(30°): barbs leave the spine at 60°, the angle at which ice dendrites branch. */
const barbSlope = Math.tan(Math.PI / 6)
/**
 * One frost fern: a tapering spine with barbs at ±60°, and barblets at ±60° to each barb, all shrinking toward the tip.
 * `growth` (0–1) scales its reach, so a melting fern retreats toward its seed and regrows from it.
 * All widths are filtered against the pixel footprint, so a distant fern settles into a soft gray veil instead of shimmering.
 */
function fern(d: Node<'vec2'>, random: Node<'vec3'>, growth: Node<'float'>, footprint: Node<'float'>) {
  const angle = random.x.mul(TAU)
  const c = angle.cos()
  const s = angle.sin()
  const x = d.x.mul(c).add(d.y.mul(s))
  const y = d.y.mul(c).sub(d.x.mul(s)).abs()
  const length = random.y.mul(0.6).add(0.95).mul(growth).max(0.0001)
  const t = x.div(length)
  const body = t.smoothstep(-0.02, 0.02).mul(t.smoothstep(0.96, 1).oneMinus())
  const spineWidth = t.oneMinus().max(0).mul(0.014).add(0.004)
// The spine is a single line, not a lattice: a sub-pixel spine keeps one pixel of width and dims by the width it lost.
  const spine = inkLine(y, spineWidth, footprint).mul(body)
// Barbs: the barb through this point joins the spine at x0.
  const x0 = x.sub(y.div(barbSlope).mul(0.5))
  const spacing = random.z.mul(0.025).add(0.05)
  const barbPhase = x0.div(spacing)
  const barbReach = length.sub(x0).max(0).mul(0.55).min(x0.max(0).mul(1.8))
  const barbAlong = y.div(0.866)
  const barbFootprint = footprint.div(spacing)
  const barbMask = barbAlong.sub(barbReach).smoothstep(barbFootprint.mul(-0.01), barbFootprint.mul(0.01).add(0.0005)).oneMinus().mul(x0.smoothstep(0, 0.02)).mul(body)
  const barb = filteredBox(barbPhase.fract().sub(0.5), barbAlong.div(barbReach.max(0.0001)).oneMinus().mul(0.09).add(0.05), barbFootprint).mul(barbMask)
// Barblets: a finer comb along each barb, with the same 60° geometry in the barb’s own frame.
  const barbX = barbAlong
  const barbY = barbPhase.fract().sub(0.5).mul(spacing).mul(0.866).abs()
  const x1 = barbX.sub(barbY.div(barbSlope).mul(0.5))
  const fine = spacing.mul(0.32)
  const barbletReach = barbReach.sub(x1).max(0).mul(0.35).min(spacing.mul(0.42))
  const barblet = filteredBox(x1.div(fine).fract().sub(0.5), 0.16, footprint.div(fine)).mul(barbY.sub(barbletReach).smoothstep(-0.001, 0.001).oneMinus()).mul(barbMask)
  return spine.max(barb).max(barblet.mul(0.85))
}
/** A frosted cabin window: ice ferns that melt back from their tips as a visitor’s warmth draws near, leaving a beaded clearing through which a fire glows on the other side. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.75)
    this.name = knotData.id
    const tube = uv()
    const {p, view, facing, grazing, intimate} = viewerFrame()
    const n = normalLocal.normalize()
    const cells = tubeCells(tube, along, around)
    const footprint = cells.fwidth().length().max(0.0005)
// Warmth: the visitor melts a clearing where they face the glass, and every slow breath fogs it a little before it clears again.
    const breath = time.mul(TAU / 5.5).sin().mul(0.5).add(0.5).pow(3)
    const warmth = intimate.mul(facing.pow(2)).mul(0.95).clamp()
// Ferns grow from a jittered lattice; each pixel takes the brightest of the nine nearest.
    const base = cells.floor()
    const local = cells.fract()
    let frost: Node<'float'> = float(0)
    for (const j of [-1, 0, 1]) {
      for (const i of [-1, 0, 1]) {
        const offset = vec2(i, j)
        const id = wrapCell(base.add(offset), vec2(along, around))
        const random = cellNoiseVec3(vec3(id, 4.2))
        const seed = offset.add(cellNoiseVec3(vec3(id, 9.7)).xy.mul(0.8).add(0.1))
// Ferns closer to the visitor’s warmth have retreated further; each melts with its own resistance.
        const resistance = random.z.mul(0.5).add(0.6)
        const growth = warmth.mul(resistance).oneMinus().clamp().pow(0.7)
        frost = frost.max(fern(local.sub(seed), random, growth, footprint))
      }
    }
// Rime: a sugary undercoat of tiny crystals that fills between the ferns and melts first.
    const rimeCoverage = mx_fractal_noise_float(p.mul(9), 3, 2, 0.5).mul(0.5).add(0.5).smoothstep(0.25, 0.75)
    const rimeGrains = cellularPoints(p.mul(260), 0.04, 0.2, 0.35).mul(footprint.smoothstep(0.004, 0.012).oneMinus()).max(footprint.smoothstep(0.004, 0.012).mul(0.35))
    const rime = rimeCoverage.mul(rimeGrains).mul(warmth.mul(1.6).oneMinus().clamp()).mul(0.65)
// Fog from breath condenses as a pale veil over the clearing and evaporates again.
    const fog = breath.mul(intimate).mul(facing).mul(mx_noise_float(p.mul(14).add(vec3(0, time.mul(0.05), 0))).mul(0.25).add(0.75)).mul(0.5)
    const ice = frost.max(rime).clamp()
// Meltwater beads where the frost has gone, each a tiny lens.
    const meltZone = warmth.smoothstep(0.15, 0.6)
    const drops = beads(p.mul(70), 3.1)
    const wet = drops.mask.mul(meltZone).mul(ice.oneMinus())
// Beyond the glass: a dark room lit by a fire whose glow shifts with your viewpoint and flickers on its own.
    const room = p.sub(view.mul(0.35))
    const fireShape = room.y.mul(-2.2).add(0.3).add(mx_noise_float(room.mul(vec3(3, 1.6, 3)).add(vec3(0, time.mul(-0.6), 0))).mul(0.7))
    const flicker = mx_noise_float(vec3(time.mul(2.3), 0, 0)).mul(0.18).add(mx_noise_float(vec3(time.mul(7.1), 3, 0)).mul(0.08)).add(1)
    const fire = mix(color(hsl.integer(39, 86, 10)), mix(color(hsl.integer(39, 100, 63)), color(hsl.integer(76, 99, 83)), fireShape.smoothstep(0.4, 1.1)), fireShape.smoothstep(-0.4, 0.5)).mul(flicker)
    const glassView = facing.mul(0.75).add(0.25)
    const interior = fire.mul(glassView).mul(0.55).add(color(hsl.integer(262, 60, 11)).mul(0.3))
// Ice carries a cold blue in its thick spines and scatters the firelight warmly where it is thin.
    const thick = frost.smoothstep(0.6, 1)
    const iceColor = mix(color(hsl.integer(248, 45, 87)), color(hsl.integer(252, 100, 98)), thick)
    const albedo = mix(mix(color(hsl.integer(259, 29, 5)), iceColor, ice), color(hsl.integer(248, 45, 96)), fog)
    this.colorNode = albedo
    this.metalness = 0
    this.roughnessNode = mix(float(0.04), float(0.55).sub(thick.mul(0.2)), ice.max(fog))
    this.clearcoatNode = ice.max(fog).oneMinus()
    this.clearcoatRoughness = 0.01
    this.sheenNode = color(hsl.integer(258, 99, 91)).mul(ice.mul(0.6))
    this.sheenRoughness = 0.35
// Ice ferns stand proud of the glass; water beads bulge as lenses.
    const height = frost.mul(0.0007).add(rime.mul(0.00025)).add(drops.cap.mul(drops.mask).mul(meltZone).mul(0.0012))
    this.normalNode = proceduralNormal(height, 1)
// Every ice facet is a mirror: they wink as the visitor moves.
    const sparkle = glitter(p.mul(420), n, {
      density: 0.5,
      spread: 0.55,
      sharpness: 700,
    })
    const transmitted = interior.mul(ice.mul(0.75).oneMinus()).mul(fog.oneMinus())
    const scattered = fire.mul(ice).mul(0.12).mul(glassView)
    const beadGlints = fire.mul(wet).mul(drops.cap.pow(4)).mul(0.9)
    this.emissiveNode = transmitted.add(scattered).add(color(hsl.integer(0, 0, 100)).mul(sparkle.flash).mul(ice).mul(0.8)).add(beadGlints).add(color(hsl.integer(260, 99, 78)).mul(grazing.pow(4)).mul(ice).mul(0.12))
  }
}

import type StairRunner from '../gallery/stairs/StairRunner.ts'
import type {Node} from 'three/webgpu'

import {cameraViewMatrix, clamp, exp, float, max, mix, mx_noise_float, mx_noise_vec3, normalWorldGeometry, positionWorld, select, sqrt, vec2, vec3, vec4} from 'three/tsl'
import {Color, MeshPhysicalNodeMaterial} from 'three/webgpu'

type Float = Node<'float'>

const tone = (hex: string): Node<'vec3'> => {
  const {r, g, b} = new Color(hex)
  return vec3(r, g, b)
}
const palette = {
  binding: tone('#b0823c'),
  navy: tone('#121a33'),
  borderGround: tone('#1a2646'),
  gold: tone('#c99c4e'),
  cream: tone('#e6cf98'),
  crimson: tone('#7c111b'),
  wine: tone('#470911'),
  oakLight: tone('#a06c3c'),
  oakDark: tone('#6a4022'),
  oakRing: tone('#43260f'),
  brass: tone('#d1aa5f'),
  brassPatina: tone('#7d5c2c'),
}
/** Pixel-filtered coverage of the region where the signed distance `d` (meters) is negative. */
const inside = (d: Float) => clamp(float(0.5).sub(d.div(d.fwidth().max(0.00001))), 0, 1)
/** Filtered coverage of a band of half-width `halfWidth` around the zero set of the distance `d`; bands thinner than a pixel fade instead of crawling. */
const line = (d: Float, halfWidth: number) => inside(d.abs().sub(halfWidth)).mul(float(halfWidth * 2).div(d.fwidth().max(0.00001)).min(1))
/** Derivative of a smoothstep that rises from 0 to 1 over `width` meters, used for analytic relief slopes. */
const smoothSlope = (t: Float, width: number) => t.mul(t.oneMinus()).mul(6 / width)

/**
 * Oiled oak treads with a woven runner, brass stair rods and rounded nosings, all shaded per pixel.
 *
 * The material is driven purely by world position, so it is shared by every block of a flight: plain boxes become carpeted treads, risers and landings without any extra meshes. Every pattern edge is filtered against its own pixel footprint and fine detail fades to its average before it can shimmer.
 */
export default class StairRunnerMaterial extends MeshPhysicalNodeMaterial {
  constructor(readonly runner: StairRunner) {
    super({
      roughness: 0.5,
      envMapIntensity: 0.3,
    })
    const {flight, halfWidth} = runner
    const {run, rise, count, entryLanding, start, heading: [hx, hz]} = flight
    // Down the flight and across it to the right, whichever way it runs.
    const downhill = vec3(hx, 0, hz)
    const across = vec3(-hz, 0, hx)
    const up = vec3(0, 1, 0)
    const geometryNormal = normalWorldGeometry
    const along = positionWorld.x.sub(start[0]).mul(hx).add(positionWorld.z.sub(start[2]).mul(hz)).sub(entryLanding).toVar('stairAlong')
    const downhillFacing = geometryNormal.dot(downhill).toVar('stairDownhill')
    // Step index from a point just inside the block, so faces on a block boundary belong to their own block.
    const step = along.sub(downhillFacing.mul(0.004)).div(run).floor().clamp(-1, count).toVar('stairStep')
    const s = along.sub(step.mul(run)).toVar('stairS')
    const top = float(start[1]).sub(step.add(1).min(count).mul(rise))
    const h = top.sub(positionWorld.y).toVar('stairH')
    const u = positionWorld.z.sub(start[2]).mul(hx).sub(positionWorld.x.sub(start[0]).mul(hz)).toVar('stairU')
    const uAbs = u.abs().toVar('stairUAbs')
    const uSign = u.sign()
    const isTop = geometryNormal.y.greaterThan(0.5)
    const isRiser = downhillFacing.greaterThan(0.5)
    // One tread’s depth of whatever the flight starts from, in front of its first riser, is laid as a tread too, the runner starting under its rod.
    const entry = step.equal(-1).and(s.greaterThanEqual(0))
    const tread = step.greaterThanEqual(0).and(step.lessThan(count)).or(entry)
    const rodded = step.greaterThanEqual(0).or(entry)
    const t = step.mul(runner.stepLength).add(select(isTop, s, h.add(run))).toVar('stairPath')
    const footprint = max(u.fwidth(), t.fwidth()).toVar('stairFootprint')
    const fineDetail = footprint.smoothstep(0.0012, 0.005).oneMinus()
    const relief = footprint.smoothstep(0.004, 0.016).oneMinus()
    // Coverage of the runner: whole treads and risers, plus a short tail tucked under the last rod on the exit landing.
    const edgeCoverage = inside(uAbs.sub(halfWidth))
    const tail = select(step.equal(count), inside(s.sub(runner.rodCenter + runner.rodRadius + 0.012)), float(0))
    const carpet = edgeCoverage.mul(select(isTop, select(tread, float(1), tail), select(isRiser.and(tread), float(1), float(0)))).toVar('stairCarpet')
    // Woven design, from the binding inward: navy guard, gold line, lozenge border, gold line, wine guard and the trellis field.
    const e = float(halfWidth).sub(uAbs)
    let weave: Node<'vec3'> = palette.crimson
    const fieldEdge = 0.24
    // Three diamond columns whose outer vertices meet the guard stripes.
    const latticeU = (halfWidth - fieldEdge) / 1.5
    // One repeat per step, with its rosette centered on the tread, so every step reads the same from the landing.
    const latticeT = runner.stepLength
    const phase = t.sub(run / 2)
    const cellU = u.div(latticeU).add(0.5).fract().sub(0.5).abs().mul(latticeU)
    const cellT = phase.div(latticeT).add(0.5).fract().sub(0.5).abs().mul(latticeT)
    const trellis = float(1).sub(cellU.div(latticeU / 2)).sub(cellT.div(latticeT / 2)).div(Math.hypot(2 / latticeU, 2 / latticeT)).abs()
    weave = mix(weave, palette.wine, line(trellis, 0.0075))
    weave = mix(weave, palette.gold, line(trellis, 0.0016).mul(0.8))
    const radius = vec2(cellU, cellT).length()
    const angle = cellT.atan(cellU)
    const rosette = radius.sub(angle.mul(8).cos().mul(0.014).add(0.05))
    weave = mix(weave, palette.gold, inside(rosette))
    weave = mix(weave, palette.wine, inside(radius.sub(0.036)).mul(inside(radius.sub(0.03)).oneMinus()))
    weave = mix(weave, palette.navy, inside(radius.sub(0.026)))
    weave = mix(weave, palette.cream, inside(radius.sub(0.01)))
    const vertex = vec2(cellU.sub(latticeU / 2), cellT).length().min(vec2(cellU, cellT.sub(latticeT / 2)).length())
    weave = mix(weave, palette.navy, inside(vertex.sub(0.014)))
    weave = mix(weave, palette.cream, inside(vertex.sub(0.005)).mul(fineDetail))
    const band = (from: number, to: number) => inside(e.sub(from).negate()).mul(inside(e.sub(to)))
    // From afar the motifs give way to their woven average instead of crawling; the long stripes stay crisp.
    const motifs = footprint.smoothstep(0.005, 0.018).oneMinus()
    weave = mix(mix(palette.crimson, palette.wine, 0.32), weave, motifs)
    weave = mix(weave, palette.wine, band(0.202, fieldEdge))
    weave = mix(weave, palette.gold, band(0.19, 0.202))
    // Lozenge chain in the border, four per step and in phase with the field.
    const borderCenter = 0.126
    const borderPeriod = runner.stepLength / 4
    const q = phase.div(borderPeriod).add(0.5).fract().sub(0.5).abs().mul(borderPeriod)
    const v = e.sub(borderCenter).abs()
    const lozenge = q.div(0.062).add(v.div(0.046)).sub(1).mul(0.034)
    let border: Node<'vec3'> = mix(palette.borderGround, palette.cream, inside(lozenge))
    border = mix(border, palette.crimson, inside(lozenge.add(0.011)))
    border = mix(border, palette.gold, inside(lozenge.add(0.022)))
    const link = vec2(q.sub(borderPeriod / 2), v).length()
    border = mix(border, palette.gold, inside(link.sub(0.01)))
    border = mix(border, palette.borderGround, inside(link.sub(0.004)).mul(fineDetail))
    border = mix(mix(palette.borderGround, palette.gold, 0.3), border, motifs)
    weave = mix(weave, border, band(0.062, 0.19))
    weave = mix(weave, palette.gold, band(0.05, 0.062))
    weave = mix(weave, palette.navy, band(runner.binding, 0.05))
    weave = mix(weave, palette.binding, inside(e.sub(runner.binding)))
    // Wool: individual tufts, dye-lot drift and a softly worn tread center.
    const fibers = mx_noise_float(vec3(u.mul(240), t.mul(240), 0.5)).mul(fineDetail)
    const tufts = mx_noise_float(vec3(u.mul(55), t.mul(55), 4.2)).mul(footprint.smoothstep(0.004, 0.02).oneMinus())
    const abrash = mx_noise_float(vec3(u.mul(0.7), t.mul(0.22), 9.1))
    const wear = select(isTop.and(tread), exp(s.sub(run * 0.58).div(0.13).pow(2).negate()).mul(uAbs.smoothstep(0.35, 0.95).oneMinus()), float(0))
    const nosingStretch = select(isTop, s.smoothstep(run - 0.025, run), h.smoothstep(0, 0.025).oneMinus())
    let wool = weave.mul(fibers.mul(0.1).add(tufts.mul(0.06)).add(abrash.mul(0.05)).add(1))
    wool = wool.mul(wear.mul(0.1).add(1)).mul(nosingStretch.mul(0.09).add(1))
    // Oak: one board per tread and riser with its grain running across the flight.
    const grainAcross = select(isTop, s, h)
    // Flat-sawn figure: rings wander and bunch along the board instead of running as even flutes.
    const meander = mx_noise_float(vec3(u.mul(1.4), grainAcross.mul(6), step.mul(3.1))).mul(16).add(mx_noise_float(vec3(u.mul(7), grainAcross.mul(20), step.mul(1.3).add(7))).mul(2.5))
    const ringPhase = grainAcross.mul(70).add(meander)
    const rings = mix(ringPhase.sin().mul(0.5).add(0.5).pow(6), float(0.17), ringPhase.fwidth().smoothstep(0.8, 2.4))
    const figure = mx_noise_float(vec3(u.mul(1.2), grainAcross.mul(9), step.mul(1.7).add(5))).mul(0.5).add(0.5)
    const pores = mix(mx_noise_float(vec3(u.mul(5), grainAcross.mul(360), step.add(11))).mul(0.5).add(0.5), float(0.5), grainAcross.mul(360).fwidth().smoothstep(0.6, 2))
    const boardTone = mx_noise_float(vec3(step.mul(0.37), 1.7, 0.3)).mul(0.12).add(1)
    const nosingWear = select(isTop, s.smoothstep(run - 0.012, run), h.smoothstep(0, 0.012).oneMinus())
    const wood = mix(mix(palette.oakDark, palette.oakLight, figure), palette.oakRing, rings.mul(0.4)).mul(pores.mul(0.18).add(0.91)).mul(boardTone).mul(nosingWear.mul(0.1).add(1))
    // Baked contact shading: the corner under each riser, the runner’s edge roll and the rod’s shadow line.
    // The entry tread lies flush with the floor behind it, without a riser to cast a corner.
    const cornerTop = select(entry, float(1), s.smoothstep(0, 0.05).mul(0.45).add(0.55))
    const cornerRiser = h.sub(rise).negate().smoothstep(0, 0.045).mul(0.4).add(0.6)
    const runnerShadow = select(tread.or(step.equal(count)), uAbs.sub(halfWidth).smoothstep(0, 0.022).mul(0.3).add(0.7), float(1))
    const rodShadow = s.sub(runner.rodCenter + runner.rodRadius).smoothstep(-0.002, 0.016).mul(0.5).add(0.5)
    const rodReach = inside(uAbs.sub(halfWidth + runner.rodOverhang))
    // Each finial pins a soft, round occlusion to the oak, darkest right under its point of contact.
    const finialShadow = vec2(s.sub(runner.rodCenter + 0.003), uAbs.sub(runner.finialOffset)).length().smoothstep(runner.finialRadius * 0.7, runner.finialRadius * 2.1).mul(0.6).add(0.4)
    const contactTop = cornerTop.mul(mix(float(1), rodShadow, select(rodded, rodReach, float(0)))).mul(select(rodded, finialShadow, float(1)))
    const contact = select(isTop, contactTop, select(isRiser, cornerRiser, float(1)))
    const surface = mix(wood.mul(runnerShadow), wool, carpet).mul(contact)
    // Brass rods across the tread/riser corner, ending in ball finials beyond the runner.
    const rodOffset = s.sub(runner.rodCenter)
    const rod = line(rodOffset, runner.rodRadius).mul(rodReach)
    const finialDelta = vec2(rodOffset, uAbs.sub(runner.finialOffset))
    const finial = inside(finialDelta.length().sub(runner.finialRadius))
    const metal = select(isTop.and(rodded), rod.max(finial), float(0)).toVar('stairBrass')
    const patina = mx_noise_float(vec3(u.mul(9), s.mul(40), step.mul(2.3))).mul(0.5).add(0.5).smoothstep(0.45, 0.9)
    const brass = mix(palette.brass, palette.brassPatina, patina.mul(0.55))
    // Analytic relief normals in world space: pile edge roll, rounded nosings, rods, finials and pile tufts.
    const roll = 0.012
    const rollT = e.div(roll).clamp(0, 1)
    const slopeU = smoothSlope(rollT, roll).mul(runner.thickness).mul(uSign).negate().mul(carpet.min(edgeCoverage.mul(select(tread, float(1), float(0))))).mul(relief)
    const nosing = mix(float(runner.nosingRadius), float(runner.nosingRadius + runner.thickness), carpet)
    const nosingSlope = (offset: Float) => {
      const qn = nosing.sub(offset).max(0)
      return qn.div(sqrt(nosing.mul(nosing).sub(qn.mul(qn)).max(0.000004))).min(5).mul(relief)
    }
    const nosingTop = select(tread, nosingSlope(float(run).sub(s)), float(0))
    const nosingRiser = select(tread, nosingSlope(h), float(0))
    const rodSigma = rodOffset.div(runner.rodRadius).clamp(-1, 1)
    const rodNormal = downhill.mul(rodSigma).add(up.mul(rodSigma.mul(rodSigma).oneMinus().max(0).sqrt()))
    const finialSigma = finialDelta.div(runner.finialRadius)
    const finialNormal = downhill.mul(finialSigma.x).add(across.mul(finialSigma.y.mul(uSign))).add(up.mul(float(1).sub(finialSigma.dot(finialSigma)).max(0).sqrt()))
    let topNormal: Node<'vec3'> = up.sub(downhill.mul(nosingTop.negate())).sub(across.mul(slopeU)).normalize()
    // Curved metal turns into a flat average before its highlights could break into single pixels.
    topNormal = mix(topNormal, rodNormal, select(rodded, rod.mul(finial.oneMinus()).mul(relief), float(0)))
    topNormal = mix(topNormal, finialNormal, select(rodded, finial.mul(relief), float(0)))
    const riserNormal = downhill.add(up.mul(nosingRiser)).sub(across.mul(slopeU)).normalize()
    const pile = mx_noise_vec3(vec3(u.mul(160), t.mul(160), 2.7)).mul(carpet.mul(fineDetail).mul(0.22))
    const shaded = select(isTop, topNormal, select(isRiser, riserNormal, geometryNormal)).add(pile).normalize()
    this.normalNode = cameraViewMatrix.mul(vec4(shaded, 0)).xyz.normalize()
    this.colorNode = mix(surface, brass, metal)
    this.metalnessNode = metal
    // The pile scatters back toward the light and looks flatter than a Lambertian surface (EON); the wood stays Lambertian.
    this.diffuseRoughnessNode = carpet
    this.roughnessNode = mix(mix(pores.mul(0.12).add(rings.mul(0.06)).add(0.4), wear.mul(-0.06).add(0.93), carpet), patina.mul(0.16).add(0.32), metal)
    // Velvet-like retroreflection of the pile, flattened where feet wear it down.
    this.sheenNode = wool.mul(1.6).mul(carpet.mul(metal.oneMinus()).mul(wear.mul(-0.4).add(1)))
    this.sheenRoughnessNode = float(0.5)
  }
}

import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, color, float, Fn, mix, mx_fractal_noise_float, mx_noise_float, normalViewGeometry, select, time, transformNormalToView, uv, varying, vec2, vec3} from 'three/tsl'

import {detailNormal} from '../../candidates/gemini_argon/lib/detailNormal.ts'
import {panelSky, proceduralEnvironment} from '../../candidates/gemini_argon/lib/environment.ts'
import {tubeCells} from '../../candidates/gemini_argon/lib/tubeMetric.ts'
import {tubeRay} from '../../lib/atelier.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cosinePalette} from '../../lib/cosinePalette.ts'
import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

const columns = 22
const rows = 3
const fanRadius = 0.68
const fanAspect = 1.12
// Fan centers of the staggered Seigaiha lattice relative to a cell, ordered front-most first: lower rows overlap higher rows, and within a row the left scale overlaps the right one. Every cell applies the same global order, so overlapping scales meet without seams at cell edges.
const fanCenters = [[0.5, -0.5], [0, 0], [1, 0], [-0.5, 0.5], [0.5, 0.5], [1.5, 0.5], [0, 1], [1, 1]] as const
// The vertex domes also need the scale above the cell, which is always hidden behind a nearer fan but still reaches into the cell.
const domeCenters = [...fanCenters, [0.5, 1.5]] as const
// Peak height of each scale’s smooth vertex dome, in meters.
const domeHeight = 0.0015
// Height of the hand-piped gold bead relief, in meters. It is drawn per pixel only: the beads are far narrower than the 1.3–2.8 cm vertex spacing.
const beadHeight = 0.0028
// Bead half-widths in normalized fan radius: the crest along the rim, the ribs on the arch joints (a fifth of the radius apart).
const crestWidth = 0.03
const ribWidth = 0.042 / 5
/** Gaussian bead widened to at least the pixel footprint while keeping its area, so a bead thinner than a pixel fades instead of breaking into a dotted line. */
function filteredBead(distance: Node<'float'>, width: number, footprint: Node<'float'>) {
  const filteredWidth = footprint.mul(1.2).pow2().add(width ** 2).sqrt()
  return distance.div(filteredWidth).pow2().negate().exp().mul(float(width).div(filteredWidth))
}
/** Seigaiha (blue ocean wave) overlapping concentric fan scales on a seamless tube lattice. Includes generous Ro-iro mirror-black resting zones (Yohaku/Ma) and hand-placed Kiri-Raden shell mosaic tiles. */
function seigaihaField(cells: Node<'vec2'>) {
  const period = vec2(columns, rows)
  const baseCell = cells.floor()
  const local = cells.fract()
  let chosenR: Node<'float'> = float(2)
  let chosenQ: Node<'vec2'> = vec2(0, 1)
  let chosenCell: Node<'vec2'> = baseCell
  let chosenHit: Node<'float'> = float(0)
  for (const [ox, oy] of fanCenters) {
    const q = local.sub(vec2(ox, oy)).mul(vec2(1, fanAspect))
    const r = q.length()
    const inside = r.lessThan(fanRadius).and(chosenHit.lessThan(0.5))
    chosenR = select(inside, r, chosenR)
    chosenQ = select(inside, q, chosenQ)
    // Identity on the doubled lattice (fan centers sit on half cells), so every cell names the same scale alike.
    chosenCell = select(inside, baseCell.add(vec2(ox, oy)).mul(2), chosenCell)
    chosenHit = select(inside, float(1), chosenHit)
  }
  const normR = chosenR.div(fanRadius).clamp(0, 1)
  const wrapped = wrapCell(chosenCell, period.mul(2))
  const rnd = cellNoiseVec3(vec3(wrapped, 13.7))
  const angle = atan(chosenQ.y, chosenQ.x.add(1e-6))
// Five concentric arches inside each fan scale, giving broad, serene Ro-iro black channels (Ma).
  const ringCoord = normR.mul(5)
  const ringIndex = ringCoord.floor()
  const ringFract = ringCoord.fract()
  const nearestRingEdge = ringCoord.round()
  const borderDist = float(1).sub(normR)
// Pixel footprint in normalized fan radius, from the continuous cell coordinate so fan overlaps don’t spike it.
  const footprint = cells.fwidth().mul(vec2(1, fanAspect)).length().div(fanRadius)
// Compositional negative space (Yohaku): ~38% of scales are serene unadorned Ro-iro mirror-black lacquer with only a crisp outer gold crest.
  const isQuietScale = rnd.z.lessThan(0.38)
  const isNacreScale = rnd.x.greaterThan(0.32).and(isQuietScale.not())
  const isNacreBand = ringIndex.equal(1).or(ringIndex.equal(3)).and(isNacreScale)
// Kiri-Raden: hand-cut mosaic shell segments along each arch, separated by hairline lacquer joints.
  const mosaicCount = ringIndex.mul(6).add(10)
  const mosaicCoord = angle.div(TAU).mul(mosaicCount).add(rnd.y.mul(7))
// Wrapped by the shard count, so the shard cut by atan’s branch at the scale’s side keeps one identity.
  const tileId = mosaicCoord.floor().mod(mosaicCount)
  const tileFract = mosaicCoord.fract()
// Two independent cell hashes per mosaic shard so every individual tile has a strongly distinct phase, brightness, and planar tilt.
  const tileSeedA = vec3(wrapped.x.mul(17.3).add(tileId.mul(5.7)), wrapped.y.mul(23.1).add(ringIndex.mul(11.3)), 31.4)
  const tileRnd = cellNoiseVec3(tileSeedA)
  const tileRnd2 = cellNoiseVec3(tileSeedA.add(vec3(71.9, 43.7, 19.1)))
  const jointDist = tileFract.sub(0.5).abs()
  const ringEdgeDist = ringFract.sub(0.5).abs()
  const tileMask = jointDist.smoothstep(0.43, 0.482).oneMinus().mul(ringEdgeDist.smoothstep(0.335, 0.4).oneMinus())
  const nacreMask = isNacreBand.toFloat().mul(tileMask)
// Viscous Gaussian bead profile for hand-piped Takamaki-e sabi-urushi relief.
// The crest bead sits just inside the scale’s rim and has settled to its foot there, so the overlapped scale behind continues without a height cliff.
  const crestGaussian = filteredBead(borderDist.sub(0.06), crestWidth, footprint)
// Ribs are piped on every arch joint bordering the nacre arches 1 and 3 – from both sides of the joint, so each rib is a whole round bead.
  const ribActive = nearestRingEdge.greaterThan(0.5).and(nearestRingEdge.lessThan(4.5)).and(isQuietScale.not()).toFloat()
  const ribEdgeDist = float(0.5).sub(ringEdgeDist).div(5)
  const ribGaussian = filteredBead(ribEdgeDist, ribWidth, footprint).mul(ribActive)
  return {
    angle,
    borderDist,
    crestGaussian,
    isQuietScale: isQuietScale.toFloat(),
    jointDist,
    nacreMask,
    normR,
    q: chosenQ,
    ribGaussian,
    ringFract,
    ringIndex,
    rnd,
    tileFract,
    tileMask,
    tileRnd,
    tileRnd2,
  }
}
// Each scale swells into a smooth lacquer dome. It is summed over every nearby scale instead of following the front-most one, so the surface stays smooth where scales overlap and across cell edges; vertices 1.3–2.8 cm apart can follow it. The gold beads stay in the per-pixel relief.
const displacedMakiE = Fn(([tube]: [Node<'vec2'>]) => {
  const {position, normal} = knotFrame(tube)
  const local = tubeCells(tube, columns, rows).fract()
  let dome: Node<'float'> = float(0)
  for (const [ox, oy] of domeCenters) {
    const r = local.sub(vec2(ox, oy)).mul(vec2(1, fanAspect)).length()
    dome = dome.add(r.smoothstep(0, fanRadius).oneMinus().pow2())
  }
  return position.add(normal.mul(dome.mul(domeHeight)))
})
/** Polygonal Hirame & Nashiji gold filings suspended in translucent amber lacquer: Uses rotated anisotropic Chebyshev/hexagonal facets per cell so particles read as angular crushed gold leaf rather than circular dots. */
function polygonalGoldFlakes(position: Node<'vec3'>, view: Node<'vec3'>, depth: number, scale: number, maxRadius: number, threshold: number, seed: number) {
  const q = position.sub(view.mul(depth)).mul(scale).add(seed)
  const cell = q.floor()
  const rnd = cellNoiseVec3(cell)
  const rnd2 = cellNoiseVec3(cell.add(vec3(19.3, 47.1, 83.5)))
// Centers stay 0.3 from the cell walls: a rotated, stretched shard reaches up to 0.283 from its center, so no wall cuts it square.
  const center = rnd.mul(0.4).add(0.3)
  const d = q.fract().sub(center)
  const rot = rnd2.x.mul(TAU)
  const c = rot.cos()
  const s = rot.sin()
  const rx = d.x.mul(c).sub(d.y.mul(s)).mul(rnd2.y.mul(0.85).add(0.95))
  const ry = d.x.mul(s).add(d.y.mul(c)).mul(rnd2.z.mul(0.85).add(0.95))
// Polygonal shard metric (mix of diamond, rectangle, and hexagonal leaf silhouette) with support strictly inside cell (<0.23).
  const polyDist = rx.abs().max(ry.abs()).max(rx.add(ry).abs().mul(0.7)).max(d.z.abs().mul(1.15))
  const footprint = q.fwidth().length().max(0.001)
  const visibility = footprint.smoothstep(0.28, 1.05).oneMinus()
  const size = rnd.z.mul(maxRadius * 0.45).add(maxRadius * 0.55)
  const shape = polyDist.smoothstep(size.sub(0.025), size).oneMinus()
  const gate = rnd.x.smoothstep(threshold, Math.min(threshold + 0.08, 0.99))
  const flakeNormal = rnd2.sub(0.5).mul(2).normalize()
  const glint = flakeNormal.dot(view).abs().pow(8).mul(2.8).add(0.32)
  const beerLambert = Math.exp(-depth * 22)
  return shape.mul(gate).mul(glint).mul(beerLambert).mul(visibility)
}
/** Imperial Japanese Raden & Takamaki-e Urushi Lacquerware: Ro-iro mirror-black lacquer and Tame-urushi oxblood depth, inlaid with hand-cut Kiri-Raden abalone mother-of-pearl shards, burnished Kinpun (gold powder) Takamaki-e relief, and multi-depth angular Nashiji/Hirame 24k gold filings. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.1)
    this.name = knotData.id
    const tube = uv()
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const cells = tubeCells(tube, columns, rows)
    const footprint = cells.fwidth().x.max(cells.fwidth().y).max(0.0004)
    const eps = 0.00024
    const du = displacedMakiE(tube.add(vec2(eps, 0))).sub(displacedMakiE(tube.sub(vec2(eps, 0))))
    const dv = displacedMakiE(tube.add(vec2(0, eps))).sub(displacedMakiE(tube.sub(vec2(0, eps))))
    const macroNormal = varying(transformNormalToView(du.cross(dv).normalize())).normalize()
    this.positionNode = displacedMakiE(tube)
    const ray = tubeRay().mul(vec2(columns, rows))
    const top = seigaihaField(cells)
// Sparse Kintsugi golden lacquer seams: gated to localized fracture zones so unbroken black urushi fields breathe.
    const riverGate = mx_noise_float(p.mul(1.8).add(vec3(0.4, 1.9, -1.2))).smoothstep(0.12, 0.42)
    const riverNoise = mx_fractal_noise_float(p.mul(3.2).add(vec3(1.7, -2.3, 0.9)), 3, 2.1, 0.5)
    const kintsugiGaussian = riverNoise.abs().div(footprint.mul(0.6).add(0.014)).pow(2).negate().exp().mul(riverGate)
    const goldBeadField = top.crestGaussian.max(top.ribGaussian.mul(0.86)).max(kintsugiGaussian).clamp()
    const goldReliefMask = goldBeadField.smoothstep(0.28, 0.58)
// Angular Hirame & Nashiji gold filings clustered near the bases of the gold relief and suspended at three amber-attenuated depths.
    const makiSkirt = top.borderDist.smoothstep(0.04, 0.34).oneMinus().max(riverNoise.abs().smoothstep(0.01, 0.09).oneMinus().mul(riverGate))
    const nashijiDensityBoost = makiSkirt.mul(0.75).add(0.35)
    const nashijiZone = top.nacreMask.oneMinus().mul(goldReliefMask.oneMinus()).mul(top.isQuietScale.mul(-0.55).add(1))
    const hirameCoarse = polygonalGoldFlakes(p, view, 0.004, 34, 0.19, 0.5, 1.7).mul(makiSkirt.mul(0.8).add(0.2))
    const nashijiTop = polygonalGoldFlakes(p, view, 0.009, 58, 0.18, 0.34, 7.3)
    const nashijiMid = polygonalGoldFlakes(p, view, 0.024, 84, 0.18, 0.28, 19.4).mul(near.mul(0.6).add(0.4))
    const nashijiDeep = polygonalGoldFlakes(p, view, 0.046, 118, 0.19, 0.25, 47.8).mul(intimate.mul(0.8).add(0.2))
    const nashijiTotal = hirameCoarse.add(nashijiTop).add(nashijiMid.mul(0.85)).add(nashijiDeep.mul(0.65)).mul(nashijiDensityBoost).mul(nashijiZone)
// Kiri-Raden mother-of-pearl: each hand-cut shell shard has a discrete, non-continuous grain angle, internal aragonite feathering, and stepped spectral phase!
    const nacreParallax = cells.sub(ray.mul(0.02))
    const shardAngle = top.tileRnd2.x.mul(TAU)
    const shardDir = vec2(shardAngle.cos(), shardAngle.sin())
    const shardOrtho = vec2(shardDir.y.negate(), shardDir.x)
// Organic internal growth rings and feathery aragonite terrace boundaries inside each individual shard.
    const featherWarp = mx_noise_float(vec3(nacreParallax.mul(16), top.tileRnd.y.mul(19))).mul(0.38)
    const nacreMicro = nacreParallax.dot(shardDir).add(nacreParallax.dot(shardOrtho).mul(0.22)).add(featherWarp).mul(95).add(top.tileRnd.z.mul(TAU))
    const nacreResolved = nacreMicro.fwidth().smoothstep(0.45, 2.1).oneMinus()
    const nacreLamellae = nacreMicro.sin().mul(nacreResolved).mul(0.5).add(0.5)
    const nacreTerrace = nacreMicro.mul(0.35).cos().mul(nacreResolved).mul(0.5).add(0.5)
// Planar shard flattening: each tile has a distinct linear height ramp across its local (tileFract, ringFract) footprint,
// so its surface-gradient normal tilts uniformly across the entire individual shard, breaking the curved tube normal into flat facets!
    const shardSlopeX = top.tileRnd.x.sub(0.5).add(top.tileFract.sub(0.5).mul(-0.45)).mul(top.tileFract.sub(0.5))
    const shardSlopeY = top.tileRnd.y.sub(0.5).add(top.ringFract.sub(0.5).mul(-0.35)).mul(top.ringFract.sub(0.5))
    const shardPlanarHeight = shardSlopeX.add(shardSlopeY).mul(0.0065).mul(top.nacreMask)
// Discrete per-tile reflection alignment: neighboring shards jump abruptly in angle and wavelength.
    const tileNormalTilt = top.tileRnd.xy.sub(0.5).mul(1.35)
    const tileCos = facing.add(tileNormalTilt.x.mul(view.x)).add(tileNormalTilt.y.mul(view.y)).clamp(0, 1)
    const loopWave = tube.x.mul(TAU * 2).sub(time.mul(Math.PI)).sin().mul(0.05)
// Stepped random phase per shard + internal aragonite growth band shift so each shard also displays delicate internal rainbow banding!
    const braggPhase = top.tileRnd.x.mul(TAU)
      .add(top.tileRnd2.y.mul(4.1))
      .add(tileCos.mul(1.9))
      .add(nacreLamellae.mul(0.22))
      .add(nacreTerrace.mul(0.18))
      .add(loopWave)
// Authentic Awabi (abalone) & Yakogai nacre: milky off-white aragonite base (#eae6df) with discrete per-shard violet-pink, mint-green, and cyan fire.
    const nacreSpectrum = cosinePalette(braggPhase, [0.58, 0.64, 0.66], [0.4, 0.36, 0.34], [1, 1, 1], [0.04, 0.37, 0.71]).clamp(0.1, 1)
    const milkyAragonite = color(hsl.integer(82, 16, 91))
// Discrete per-shard brilliance: some shards catch the light right now while their immediate neighbors stay calm milky pearl.
    const shardAlignment = top.tileRnd2.z.sub(tileCos).abs().smoothstep(0, 0.26).oneMinus()
    const iridescenceStrength = shardAlignment.mul(0.62).add(tileCos.oneMinus().mul(0.28)).add(0.18).clamp(0, 1)
    const pearlBody = mix(milkyAragonite, nacreSpectrum, iridescenceStrength).mul(nacreLamellae.mul(0.22).add(nacreTerrace.mul(0.12)).add(0.74)).mul(top.tileRnd.z.mul(0.28).add(0.78))
// Ro-iro & Tame-urushi lacquer: warm brownish-amber sap undertone (#090403 to #300705) so shadows never drop to dead digital RGB(0,0,0).
    const roIroWarmBlack = color(hsl.integer(36, 31, 4))
    const tameOxblood = color(hsl.integer(29, 85, 11))
    const urushiDepth = top.normR.pow(1.7).mul(top.isQuietScale.oneMinus()).mul(facing.mul(0.55).add(0.45)).max(makiSkirt.mul(0.65))
    const urushiBase = mix(roIroWarmBlack, tameOxblood, urushiDepth.mul(0.75))
// Shallow filings gleam bright gold (#ffd15c); deeply submerged filings shift to rich reddish-amber (#9e3904) via Beer-Lambert sap absorption.
    const shallowWeight = hirameCoarse.add(nashijiTop)
    const midWeight = nashijiMid.mul(0.85)
    const deepWeight = nashijiDeep.mul(0.65)
    const totalRaw = shallowWeight.add(midWeight).add(deepWeight).add(0.0001)
    const nashijiAmberGold = color(hsl.integer(87.6, 100, 86)).mul(shallowWeight)
      .add(color(hsl.integer(59, 92, 62)).mul(midWeight))
      .add(color(hsl.integer(39, 97, 37)).mul(deepWeight))
      .div(totalRaw)
// Kinpun (burnished gold powder): micro-particulate texture with warm satin luster.
    const kinpunGrain = mx_noise_float(p.mul(180)).mul(0.08).add(0.96)
    const makiGold = mix(color(hsl.integer(72, 85, 62)), color(hsl.integer(93, 100, 90)), facing.mul(0.45).add(goldBeadField.mul(0.55))).mul(kinpunGrain)
    const substrate = urushiBase.add(nashijiAmberGold.mul(nashijiTotal.mul(1.38)))
    const withNacre = mix(substrate, pearlBody, top.nacreMask)
    this.colorNode = mix(withNacre, makiGold, goldReliefMask)
// Metalness: burnished 24k Kinpun gold is 1.0 metallic; nacre is a pearlescent dielectric under clearcoat; urushi is pure dielectric.
    this.metalnessNode = goldReliefMask.mul(0.98).add(nashijiTotal.clamp(0, 1).mul(0.88)).clamp(0, 0.98)
// Kinpun gold powder has a velvety satin 0.23 roughness; nacre is 0.20; Ro-iro lacquer beneath clearcoat is 0.04.
    this.roughnessNode = mix(mix(float(0.04), float(0.2), top.nacreMask), float(0.23).sub(kintsugiGaussian.mul(0.04)), goldReliefMask)
// Base normal: each Kiri-Raden shard tilts on its own planar facet with internal aragonite growth striations, while Takamaki-e gold has a viscous Gaussian bead profile.
    const microHeight = shardPlanarHeight
      .add(goldBeadField.mul(beadHeight))
      .add(top.tileMask.mul(top.nacreMask).mul(0.001))
      .add(nacreLamellae.add(nacreTerrace.mul(0.6)).mul(top.nacreMask).mul(0.00058).mul(intimate.mul(0.7).add(0.3)))
      .add(kinpunGrain.mul(goldReliefMask).mul(0.00035))
    this.normalNode = detailNormal(macroNormal, microHeight, 0.95)
// Togi-maki-e clearcoat meniscus + subtle Ro-iro charcoal & deer-horn hand-polishing micro-swirl at intimate range.
    const meniscus = goldBeadField.smoothstep(0.05, 0.85)
    const polishSwirl = mx_noise_float(p.mul(vec3(85, 140, 85))).abs().mul(intimate).mul(0.008)
    this.clearcoat = 1
    this.clearcoatRoughnessNode = mix(float(0.011).add(polishSwirl), float(0.065), meniscus.mul(0.6))
    this.clearcoatNormalNode = detailNormal(mix(normalViewGeometry, macroNormal, meniscus).normalize(), meniscus.mul(0.0022), 0.85)
    this.iridescenceNode = top.nacreMask.mul(0.96).add(grazing.mul(0.16)).clamp(0, 1)
    this.iridescenceIOR = 1.68
    this.iridescenceThicknessNode = top.tileRnd.x.mul(260).add(tileCos.mul(280)).add(190)
// Anisotropic silk-like shimmer aligned to each individual shard's cut grain direction!
    this.anisotropyNode = shardDir.mul(top.nacreMask.mul(0.76)).add(vec2(top.angle.sin().negate(), top.angle.cos()).mul(goldReliefMask.mul(0.52)))
    const shadowCavity = top.borderDist.smoothstep(0, 0.11).mul(0.38).add(0.62)
    this.aoNode = shadowCavity.max(goldReliefMask)
// Soft-panel Japanese tea-room & museum spotlighting: diffused warm shoji light without harsh pane-bar clutter.
    const gallery = panelSky({
      zenith: [0.016, 0.022, 0.042],
      horizon: [0.045, 0.034, 0.038],
      nadir: [0.008, 0.005, 0.006],
      glow: {
        color: [0.95, 0.54, 0.22],
        intensity: 0.35,
        width: 0.07,
      },
      panels: [{
        azimuth: 0.55,
        elevation: 0.56,
        halfWidth: 0.32,
        halfHeight: 0.24,
        color: [1, 0.91, 0.74],
        intensity: 5.8,
        softness: 0.18,
      }, {
        azimuth: -1.15,
        elevation: 0.48,
        halfWidth: 0.06,
        halfHeight: 0.55,
        color: [0.52, 0.86, 1],
        intensity: 6.8,
        softness: 0.14,
      }, {
        azimuth: 2.35,
        elevation: 0.38,
        halfWidth: 0.32,
        halfHeight: 0.06,
        color: [1, 0.48, 0.6],
        intensity: 5,
        softness: 0.15,
      }, {
        azimuth: -2.4,
        elevation: 0.22,
        halfWidth: 0.36,
        halfHeight: 0.055,
        color: [0.44, 0.96, 0.78],
        intensity: 4.6,
        softness: 0.15,
      }],
    })
    this.envNode = proceduralEnvironment(gallery)
// Discrete per-shard Bragg flash + warm subsurface amber-urushi glow in the lacquer recesses so the black sap never looks dead.
    const nacreGlow = nacreSpectrum.mul(top.nacreMask).mul(shardAlignment.pow(1.6).mul(0.72).add(0.12)).mul(near.mul(0.45).add(0.55))
    const goldShimmer = nashijiAmberGold.mul(nashijiTotal.mul(0.62)).add(color(hsl.integer(87.6, 100, 86)).mul(kintsugiGaussian.mul(0.24)))
    const urushiSubsurface = color(hsl.integer(34, 71, 7)).mul(top.nacreMask.oneMinus()).mul(goldReliefMask.oneMinus()).mul(grazing.mul(0.6).add(0.4)).mul(0.28)
    this.emissiveNode = nacreGlow.add(goldShimmer).add(urushiSubsurface)
  }
}

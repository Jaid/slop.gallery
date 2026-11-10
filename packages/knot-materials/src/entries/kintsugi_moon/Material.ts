import type {Texture} from 'three/webgpu'

import {float, mix, mx_fractal_noise_float, mx_noise_float, normalLocal, time, vec2, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../candidates/claude_fable/lib/cellNoiseVec3.ts'
import {debugLayer} from '../../candidates/claude_fable/lib/debugLayer.ts'
import {environmentHighlight} from '../../candidates/claude_fable/lib/environmentHighlight.ts'
import {glints} from '../../candidates/claude_fable/lib/glints.ts'
import {fresnel, interiorRay} from '../../candidates/claude_fable/lib/interiorRay.ts'
import {proceduralNormal} from '../../candidates/claude_fable/lib/proceduralNormal.ts'
import {rgb} from '../../candidates/claude_fable/lib/rgb.ts'
import {tubeLattice} from '../../candidates/claude_fable/lib/tubeCoordinates.ts'
import {viewerFrame} from '../../candidates/claude_fable/lib/viewerFrame.ts'
import {voronoi2d} from '../../candidates/claude_fable/lib/voronoi.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import knotData from './data.ts'

const glazeIndex = 1.5
/** Porcelain repaired with gold. The body is shattered into shards whose seams are filled with lacquer and gold dust – raised, brushed metal that catches the room's lights while the glaze around it stays cool and glassy. Under that glaze a cobalt underglaze painting drifts with parallax: the pigment sits below the surface, so it slides against the crackle as the viewer moves. A network of hairline craquelure covers the glaze itself, and on the shadow side a faint moonlight seems to come from inside the seams. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, facing, grazing, near, intimate} = viewerFrame()
    const n = normalLocal.normalize()
    const ray = interiorRay(glazeIndex, n)
// Shards: a coarse seamless Voronoi over the tube, some shards shattered further by a finer one.
    const coarse = tubeLattice(3)
    const shards = voronoi2d(coarse.lattice, coarse.period, 1)
    const shard = cellNoiseVec3(vec3(shards.cell, 7))
    const fine = tubeLattice(7)
    const splinters = voronoi2d(fine.lattice, fine.period, 2)
    const shattered = shard.x.smoothstep(0.5, 0.58)
// Seam distance in object units, so both lattices share one physical seam width.
    const coarseSeam = shards.edge.mul(coarse.cellSize * 0.5)
    const fineSeam = splinters.edge.mul(fine.cellSize * 0.5).add(shattered.oneMinus())
    const seam = coarseSeam.min(fineSeam)
    const seamWidth = mx_noise_float(p.mul(9)).mul(0.0025).add(0.0045)
    const seamFootprint = seam.fwidth().max(0.0002)
    const gold = seam.smoothstep(seamWidth.add(seamFootprint), seamWidth.sub(seamFootprint))
// The seam is a rounded bead of lacquer: high in the middle, falling off toward the porcelain.
    const seamProfile = seam.div(seamWidth).clamp().pow2().oneMinus().sqrt().mul(gold)
    const goldGrain = mx_noise_float(p.mul(160)).mul(0.5).add(0.5)
// Shards are slightly offset from each other, as a mended vessel never quite lines up again.
    const shardTilt = shard.y.sub(0.5).mul(0.002)
// Craquelure: fine cracks in the glaze, a hairline network visible only up close.
    const crackleLattice = tubeLattice(24)
    const crackle = voronoi2d(crackleLattice.lattice, crackleLattice.period, 3)
    const crackDistance = crackle.edge.mul(crackleLattice.cellSize * 0.5)
    const crackFootprint = crackDistance.fwidth().max(0.00005)
    const crack = crackDistance.smoothstep(crackFootprint.mul(1.5), 0).mul(crackFootprint.smoothstep(0.0012, 0.0003))
// Underglaze painting, seen through the glaze with parallax: washes of cobalt and sinuous brush lines.
// Ridges of noise give lines that thicken and thin like a loaded brush; a gate noise ends each stroke.
    const under = ray.at(0.012)
    const wash = mx_fractal_noise_float(under.mul(3.2).add(vec3(0, time.mul(0.008), 0)), 3, 2.1, 0.5)
    const washTone = wash.smoothstep(0, 0.6).mul(0.6)
    const strokeField = mx_fractal_noise_float(under.mul(5.5).add(vec3(2.7, 0, 1.3)), 3, 2, 0.5)
    const strokeRidge = strokeField.abs()
    const strokeWidth = mx_noise_float(under.mul(2.4)).mul(0.05).add(0.06)
    const strokeFootprint = strokeRidge.fwidth().max(0.001)
    const stroke = strokeRidge.smoothstep(strokeWidth.add(strokeFootprint), strokeWidth.sub(strokeFootprint)).mul(mx_noise_float(under.mul(1.7).add(9)).smoothstep(-0.5, -0.05))
    const fineStroke = mx_noise_float(under.mul(14).add(vec3(5, 3, 1))).abs().smoothstep(0.03, 0.012).mul(mx_noise_float(under.mul(2.9).add(4)).smoothstep(-0.2, 0.2))
    const moonAngle = under.y.atan(under.x)
    const moonRing = moonAngle.mul(3).add(under.z.mul(12)).sin().mul(0.5).add(0.5).pow(6).mul(wash.smoothstep(-0.2, 0.2))
    const cobalt = rgb('#1c3a8a')
    const paleCobalt = rgb('#6e8fd0')
    const pigment = washTone.add(stroke.mul(0.9)).add(fineStroke.mul(0.7)).add(moonRing.mul(0.4)).clamp()
    const porcelain = rgb('#f4f0e8')
    const underglaze = mix(porcelain, mix(cobalt, paleCobalt, mx_noise_float(under.mul(9)).mul(0.5).add(0.5)), pigment)
// The glaze tints the porcelain a faint celadon at the limb, where its path length grows.
    const celadon = rgb('#bfe0d2').mul(grazing.pow(3)).mul(0.25)
    const goldColor = rgb('#f2c45a').mul(goldGrain.mul(0.25).add(0.75))
    this.colorNode = mix(underglaze.mul(0.66), goldColor, gold)
    this.metalnessNode = gold
    this.roughnessNode = mix(float(0.08).add(crack.mul(0.25)), float(0.28).sub(seamProfile.mul(0.12)), gold)
    this.clearcoatNode = gold.oneMinus()
    this.clearcoatRoughness = 0.03
// Surface relief: raised gold bead, the shard tilt, a hairline groove per crack, and the glaze's orange peel.
    const orangePeel = mx_noise_float(p.mul(60)).mul(0.0004)
    const height = seamProfile.mul(0.003).add(shardTilt).sub(crack.mul(0.0004)).add(orangePeel)
    const surfaceNormal = proceduralNormal(height, 1)
    this.normalNode = surfaceNormal
// Gold dust is brushed along the seam: anisotropy follows the seam direction.
    const seamDirection = vec2(seam.dFdy(), seam.dFdx().negate())
    this.anisotropyNode = seamDirection.div(seamDirection.length().max(1e-6)).mul(gold).mul(0.6)
    this.ior = glazeIndex
// Light: the glaze's mirror image of the room, gold flashing, and a moonlight from inside the seams on the shadow side.
    const glazeHighlight = environmentHighlight(environment, n, 0.02).mul(fresnel(facing, 0.04)).mul(gold.oneMinus()).mul(0.7)
    const goldFlash = glints(surfaceNormal, 60).mul(goldColor).mul(gold).mul(0.6).add(environmentHighlight(environment, n, 0.12).mul(goldColor).mul(gold).mul(1.1))
    const shadowSide = n.y.smoothstep(0.2, -0.6)
    const moonlight = rgb('#dfe9ff').mul(gold).mul(seamProfile).mul(shadowSide).mul(time.mul(0.5).sin().mul(0.15).add(0.85)).mul(near.mul(0.5).add(0.3)).mul(0.35)
    const {emissive, isolated} = debugLayer({
      gold,
      seamProfile,
      crack,
      pigment,
      stroke,
      fineStroke,
      washTone,
      underglaze,
      glazeHighlight,
      goldFlash,
      moonlight,
      celadon,
    }, () => glazeHighlight.add(goldFlash).add(moonlight).add(celadon).add(porcelain.mul(intimate).mul(0.015)))
    this.emissiveNode = emissive
    if (isolated) {
      this.colorNode = vec3(0)
      this.envMapIntensity = 0
      this.clearcoatNode = null
    }
  }
}

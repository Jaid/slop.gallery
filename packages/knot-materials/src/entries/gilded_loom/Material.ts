import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_atan2, mx_noise_float, normalViewGeometry, time, uv, vec2} from 'three/tsl'

import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Anti-aliased band inside (`md` below `radius`) with a footprint-aware edge. */
function medallion(md: Node<'float'>, radius: Node<'float'>) {
  const aa = md.fwidth().mul(1.2).add(0.004)
  return md.smoothstep(radius.sub(aa), radius.add(aa)).oneMinus()
}
/** Brocade silk wound into a knot. A damask lattice of medallions is woven along the tube — violet silk petals, gold rim, ring and heart, with a small gold diamond sown between them — over an indigo velvet ground. Nothing here glows; the life is in the cloth: warp floats over weft in a satin weave, the sheen re-dyes itself as you circle, and the anisotropic threads catch the light in long runs. Only a close look resolves the individual threads and goldwork. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.7)
    this.name = knotData.id
    const tube = uv()
    const {p, grazing, near, intimate} = viewerFrame()
    // Satin weave: warp threads float over four weft threads before diving under,
    // so the cloth reads as long silky runs rather than a plain checkerboard.
    const q = tube.mul(vec2(3000, 380))
    const checker = q.floor().x.add(q.floor().y).mod(2)
    const dominance = q.floor().x.div(4).floor().add(q.floor().y).mod(2)
    // Threads fade out gracefully once they fall below a pixel, leaving satin.
    const weaveFade = q.fwidth().length().smoothstep(0.8, 3).oneMinus()
    const checkerF = mix(float(0.5), checker, weaveFade)
    const warpHeight = q.y.fract().mul(Math.PI).sin()
    const weftHeight = q.x.fract().mul(Math.PI).sin()
    const weave = mix(warpHeight, weftHeight, dominance)
    // Damask medallions on a lattice that follows the tube, four around and
    // twenty-eight along, each a four-petaled rosette in violet and gold.
    const mq = tube.mul(vec2(36, 5))
    const mc = mq.fract().sub(0.5)
    const mcp = vec2(mc.x.mul(1.02), mc.y)
    const md = mcp.length()
    const mAngle = mx_atan2(mcp.y, mcp.x.add(0.000001)) as unknown as Node<'float'>
    const petal = mAngle.mul(4).cos().mul(0.5).add(0.5)
    const radius = petal.mul(0.075).add(mAngle.mul(8).cos().mul(0.015)).add(0.3)
    const motif = medallion(md, radius)
    const rimA = opticalLine(md.sub(radius), 0.016)
    const ringB = opticalLine(md.sub(radius.mul(0.6)), 0.011)
    const heart = medallion(md, float(0.075))
    const spoke = mAngle.mul(4).sin().abs().smoothstep(0.05, 0.16).oneMinus().mul(medallion(md, radius.mul(0.88))).mul(medallion(md, float(0.1)).oneMinus())
    // A small four-pointed gold floret sown in the gap between four medallions.
    const mc2 = mq.add(0.5).fract().sub(0.5)
    const md2 = mc2.x.mul(1.02).abs().add(mc2.y.abs())
    const diamond = medallion(md2, float(0.16))
    const goldMask = rimA.add(ringB.mul(0.8)).add(heart.mul(0.9)).add(spoke.mul(0.35)).add(diamond.mul(0.75)).clamp()
    const ground = mix(color(hsl.integer(287, 71, 8.6)), color(hsl.integer(289, 77, 12)), mx_noise_float(p.mul(5)).mul(0.5).add(0.5).mul(0.5))
    // Damask light-play: inside a medallion the weave turns ninety degrees, so
    // motif and ground answer the same light in opposite voices.
    const weaveRot = mix(weftHeight, warpHeight, dominance)
    const weaveCloth = mix(weave, weaveRot, motif)
    const silkMotif = mix(color(hsl.integer(291, 78, 18.6)), color(hsl.integer(297, 69, 27)), petal.mul(0.5).add(weaveCloth.mul(0.25)))
    const threadTint = mix(color(hsl.integer(288, 76, 22)), color(hsl.integer(332, 62, 27)), checker)
    const ghostDiamond = medallion(md2, float(0.55))
    let albedo = mix(ground, silkMotif, motif.mul(0.85).add(ghostDiamond.mul(0.13)))
    albedo = mix(albedo, threadTint, weaveFade.mul(0.1))
    albedo = mix(albedo, color(hsl.integer(79, 83, 65)), goldMask)
    this.colorNode = albedo
    this.metalnessNode = goldMask.mul(0.95)
    this.specularIntensity = 0.6
    this.roughnessNode = mix(mix(float(0.3), float(0.44), motif), float(0.22), goldMask).add(weave.mul(0.04).mul(weaveFade))
    const stitchPhase = p.x.add(p.y).mul(260)
    const stitch = stitchPhase.sin().mul(goldMask).mul(0.2).mul(stitchPhase.fwidth().smoothstep(0.5, 2).oneMinus())
    this.normalNode = proceduralNormal(weaveCloth.mul(0.3).mul(weaveFade).add(motif.mul(0.18)).add(goldMask.mul(0.15)).add(stitch), intimate.mul(0.0013).add(0.0007))
    // The sheen travels: its hue is a slow function of viewing angle and position,
    // so a walk around the knot keeps re-dyeing the cloth.
    const sheenHue = spectralColor(grazing.mul(3.2).add(tube.x.mul(TAU * 2)).add(checker.mul(0.7)).add(time.mul(0.03)))
    this.sheenNode = mix(color(hsl.integer(291, 85, 42)), color(hsl.integer(74, 100, 80)), checkerF.mul(0.22).add(goldMask.mul(0.15))).mul(0.3).add(sheenHue.mul(0.18)).mul(motif.mul(0.4).add(0.85))
    this.sheenRoughnessNode = mix(float(0.35), float(0.25), goldMask)
    this.anisotropy = 0.8
    this.anisotropyNode = mix(vec2(1, 0), vec2(0, 1), checkerF).mul(0.65).mul(goldMask.oneMinus())
    this.aoNode = motif.mul(0.08).add(0.9)
    const goldGlint = glints(normalViewGeometry, 170).mul(goldMask).mul(intimate.mul(0.8).add(near.mul(0.3)))
    this.emissiveNode = color(hsl.integer(85, 100, 90)).mul(goldGlint).mul(0.55)
      .add(color(hsl.integer(294, 73, 16)).mul(grazing.pow(2)).mul(near.mul(0.3).add(0.4)).mul(0.22))
    this.envMapIntensity = 1.2
  }
}

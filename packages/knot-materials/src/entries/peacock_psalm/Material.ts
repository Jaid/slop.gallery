import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, time, uv, vec2, vec3} from 'three/tsl'

import {inkFill, inkLine} from '../../lib/atelier.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {hairline} from '../../lib/hairline.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

/** Peacock plumage wrapped around the knot: rows of ocellated eyes open along the feathered body, their rings shifting from sapphire to gold with your angle, while fine barbs shimmer only at close range. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.85)
    this.name = knotData.id
    const tube = uv()
    const {facing, grazing, near, intimate} = viewerFrame()
    const grid = tube.mul(vec2(28, 3))
    const local = grid.fract().sub(0.5)
    const footprint = grid.fwidth().length().max(0.0001)
    const radius = local.length()
    const identity = cellNoiseVec3(vec3(wrapCell(grid.floor(), vec2(28, 3)), 9.7))
    // Concentric eye: bronze outer ring, teal crescent, sapphire heart.
    const outerRing = inkLine(radius.sub(0.31), 0.045, footprint)
    const tealRing = inkLine(radius.sub(0.225), 0.05, footprint)
    const heart = inkFill(radius.sub(0.135), footprint)
    const pupil = inkFill(radius.sub(0.062), footprint)
    const eye = outerRing.add(tealRing).add(heart).clamp()
    // Feather barbs: diagonal micro-filaments that resolve only on approach.
    const barbPhase = tube.x.mul(TAU * 150).add(tube.y.mul(TAU * 9).sin().mul(2.2))
    const barbs = hairline(barbPhase.sin(), 0.1).mul(intimate)
    const shift = spectralColor(radius.mul(9).add(identity.x.mul(3)).add(grazing.mul(5)))
    const feather = mix(color(hsl.integer(171, 95, 20)), color(hsl.integer(235, 87, 31)), grazing.pow(1.3))
    const withEyes = mix(feather, color(hsl.integer(71, 84, 56)), outerRing)
    const withTeal = mix(withEyes, mix(color(hsl.integer(184, 96, 65)), shift, 0.45), tealRing)
    const withHeart = mix(withTeal, mix(color(hsl.integer(268, 93, 28.3)), shift, 0.5), heart)
    this.colorNode = mix(withHeart, color(hsl.integer(271, 72, 9)), pupil)
    this.metalness = 0.18
    this.roughnessNode = float(0.4).sub(eye.mul(0.13)).add(barbs.mul(0.06)).clamp(0.2, 0.5)
    this.sheen = 0.85
    this.sheenNode = mix(color(hsl.integer(177, 97, 78)), color(hsl.integer(286, 99, 53)), grazing)
    this.sheenRoughness = 0.42
    this.iridescence = 0.9
    this.iridescenceIOR = 1.32
    this.iridescenceThicknessNode = radius.mul(620).add(identity.y.mul(140)).add(140)
    this.normalNode = proceduralNormal(outerRing.mul(0.22).add(heart.mul(0.3)).add(barbs.mul(0.06)), 0.75)
    const procession = tube.x.mul(TAU * 4).sub(time.mul(Math.PI * 2)).sin().mul(0.5).add(0.5)
    this.emissiveNode = mix(color(hsl.integer(266.8, 100, 43)), color(hsl.integer(73, 100, 79)), pupil)
      .mul(heart)
      .mul(procession.pow(2).mul(0.6).add(0.4))
      .mul(near.mul(0.6).add(0.35))
      .add(color(hsl.integer(181, 97.7, 84)).mul(tealRing).mul(facing.pow(2)).mul(0.34))
  }
}

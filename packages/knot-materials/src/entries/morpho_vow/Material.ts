import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalViewGeometry, time, uv, vec2, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

/** One staggered lattice of wing scales on the tube. Each scale owns a random film thickness, ridge phase and tint, carries a domed crown that sinks at its exposed tip, and dissolves its microscopic ridges before they can alias. Distances are in lattice cells, so the UV seam keeps the same identities. */
function scaleField(tube: Node<'vec2'>) {
  const grid = vec2(144, 12)
  const q = tube.mul(grid)
  const row = q.y.floor()
  const shiftedX = q.x.add(row.mod(2).mul(0.5))
  const cell = wrapCell(vec2(shiftedX.floor(), row), grid)
  const local = vec2(shiftedX.fract().sub(0.5), q.y.fract().sub(0.5))
  const random = cellNoiseVec3(vec3(cell, 7.31))
  const random2 = cellNoiseVec3(vec3(cell, 19.17))
  // 0 at the exposed lower tip of a scale, 1 at the root hidden by its neighbor.
  const along = local.y.add(0.5)
  const nx = local.x.div(0.465)
  const ny = local.y.div(0.478)
  const shape = nx.abs().pow(4).add(ny.abs().pow(3.2))
  const aa = shape.fwidth().mul(0.7).max(0.025)
  const mask = shape.smoothstep(float(1).sub(aa), float(1).add(aa)).oneMinus()
  const dome = shape.oneMinus().clamp().pow(0.58)
  const crown = dome.mul(along.mul(0.22).add(0.84))
  // Ridges run from root to tip, so their stripes cross the short axis.
  const ridgePhase = local.x.mul(118).add(random.x.mul(6.2831))
  const ridge = opticalBands(ridgePhase)
  const resolved = q.fwidth().length().smoothstep(0.32, 1.05).oneMinus()
  const tipShade = along.smoothstep(0.03, 0.3).oneMinus()
  const tipLine = along.smoothstep(0.03, 0.1).mul(along.smoothstep(0.12, 0.3).oneMinus())
  const edgeShade = shape.smoothstep(0.55, 1)
  const height = crown
    .mul(0.0048)
    .add(ridge.sub(0.5).mul(0.00055).mul(resolved))
    .sub(tipShade.mul(0.0007))
  return {
    along,
    cell,
    crown,
    edgeShade,
    height,
    local,
    mask,
    q,
    random,
    random2,
    resolved,
    ridge,
    tipLine,
    tipShade,
  }
}

/** A Morpho wing persuaded around the knot: thousands of staggered scales, each with its own thin-film thickness. No scale is painted blue – its color is the interference agreement between film, lamp and witness, so a step sideways sends cyan fire rolling into violet while the exposed tips stay near-black. A slow shiver travels the wing once per exhibition loop, lifting each scale in turn, and the finest ridges surrender to satin long before they can sparkle into noise at gallery distance. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.85)
    this.name = knotData.id
    const tube = uv()
    const {p, facing, grazing} = viewerFrame()
    const scale = scaleField(tube)
    const loop = time.mul(Math.PI)
    // One whole traveling wave per two-second loop, three waves along the knot.
    const travel = tube.x.mul(Math.PI * 6).sub(loop).sin()
    const patch = mx_noise_float(p.mul(2.8)).mul(0.5).add(0.5)
    const filmPhase = scale.random.z
      .mul(2.1)
      .add(scale.along.mul(1.05))
      .add(facing.mul(2.35))
      .add(travel.mul(0.4))
      .add(scale.random2.x.mul(0.35))
      .add(patch.mul(0.55))
    const film = spectralColor(filmPhase)
    let scaleColor = mix(color(hsl.integer(266, 93, 7)), color(hsl.integer(262.5, 100, 38.6)), film.z)
    scaleColor = mix(scaleColor, color(hsl.integer(226, 100, 74)), film.y.mul(0.5))
    scaleColor = mix(scaleColor, color(hsl.integer(299, 100, 54.6)), film.x.mul(0.42).mul(grazing.mul(0.75).add(0.2)))
    scaleColor = scaleColor
      .mul(scale.ridge.mul(0.24).add(0.87))
      .mul(scale.along.oneMinus().mul(0.35).add(0.78))
      .mul(scale.random.y.mul(0.35).add(0.82))
      .mul(scale.tipShade.mul(-0.3).add(1))
    const sparkle = glints(normalViewGeometry, 160)
      .mul(scale.random2.y.smoothstep(0.72, 0.9))
      .mul(scale.resolved)
      .mul(scale.mask)
    const flutter = scale.height.add(travel.mul(0.00028).mul(scale.mask))
    this.colorNode = mix(color(hsl.integer(299, 44, 3.4)), scaleColor, scale.mask)
    this.metalnessNode = scale.mask.mul(0.06)
    this.roughnessNode = mix(
      float(0.94),
      float(0.2).add(scale.ridge.mul(0.13)).add(scale.random2.z.mul(0.08)),
      scale.mask,
    )
    this.normalNode = proceduralNormal(flutter, 1)
    this.aoNode = float(0.22)
      .add(scale.mask.mul(0.62))
      .add(scale.crown.mul(0.16))
      .mul(scale.tipShade.mul(-0.35).add(1))
    this.clearcoat = 0.65
    this.clearcoatRoughnessNode = mix(float(0.42), float(0.16), scale.mask)
    this.iridescence = 0.9
    this.iridescenceIOR = 1.31
    this.iridescenceThicknessMinimum = 130
    this.iridescenceThicknessMaximum = 470
    this.iridescenceNode = scale.mask.mul(0.92)
    this.sheen = 0.55
    this.sheenColor.set(hsl.integer(266.3, 100, 48))
    this.sheenRoughness = 0.42
    this.emissiveNode = scaleColor
      .mul(grazing.pow(3).mul(0.5).add(sparkle.mul(1.35)))
      .add(color(hsl.integer(216, 100, 95.7)).mul(sparkle.mul(0.9)))
      .add(color(hsl.integer(200, 100, 94.3)).mul(scale.tipLine.mul(scale.mask).mul(film.y).mul(grazing.mul(0.7).add(0.3)).mul(0.35)))
  }
}

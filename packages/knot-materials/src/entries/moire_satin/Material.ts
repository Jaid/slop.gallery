import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, normalLocal, normalViewGeometry, time, uv, vec2, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

function weaveField(tube: Node<'vec2'>) {
  const q = tube.mul(vec2(132, 12))
  const cell = q.floor()
  const local = q.fract().sub(0.5)
  const random = cellNoiseVec3(vec3(cell.x.add(0.5), cell.y.add(0.5), 7.3))
  const diagonal = local.x.add(local.y.mul(0.72)).sin().mul(0.16)
  const warpDistance = local.x.sub(diagonal).abs()
  const weftDistance = local.y.sub(diagonal.mul(0.7)).abs()
  // The fields feed vertex displacement, so they intentionally avoid fragment-only
  // derivatives. The relief is lower frequency; the weave remains a surface detail.
  const warp = warpDistance.smoothstep(0.07, 0.18).oneMinus()
  const weft = weftDistance.smoothstep(0.1, 0.22).oneMinus()
  const over = q.x.mul(TAU).add(q.y.mul(TAU).mul(0.5)).sin().mul(0.5).add(0.5)
  const weave = mix(warp, weft, over).mul(random.x.mul(0.22).add(0.78))
  const relief = tube.mul(vec2(34, 5))
  const reliefCell = relief.floor()
  const reliefRandom = cellNoiseVec3(vec3(reliefCell.x.add(0.5), reliefCell.y.add(0.5), 2.7))
  const reliefWave = relief.x.add(relief.y.sin().mul(0.2)).sin().mul(0.5).add(0.5)
  return {
    q,
    cell,
    local,
    random,
    warp,
    weft,
    weave,
    relief,
    reliefRandom,
    reliefWave,
  }
}

/** A living stellar bestiary drawn from connected pinpricks of light. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.1)
    this.name = knotData.id
    const tube = uv()
    const {p, view, grazing, near, intimate} = viewerFrame()
    const field = weaveField(tube)
    const angle = view.dot(vec3(0.43, 0.19, 0.88).normalize()).mul(0.5).add(0.5)
    const breath = time.mul(0.12).add(tube.x.mul(TAU * 2)).sin().mul(0.5).add(0.5)
    const interference = tube.x.mul(TAU * 17).add(tube.y.mul(4.8).sin().mul(0.55)).add(angle.mul(3.7)).add(breath.mul(0.18)).sin().mul(0.5).add(0.5)
    const moire = interference.pow(2.4).mul(0.78).add(0.12)
    const fiber = field.weave.mul(0.72).add(moire.mul(0.28))
    const base = mix(color(hsl.integer(273, 59, 7)), color(hsl.integer(299, 74, 14)), field.random.y.pow(1.7).mul(0.7).add(0.15))
    const rose = mix(color(hsl.integer(1, 77, 46)), color(hsl.integer(34, 71, 73)), field.random.x)
    const violet = mix(color(hsl.integer(293, 73, 37)), color(hsl.integer(195, 63, 79)), angle)
    const threadColor = mix(rose, violet, interference.pow(1.5)).mul(0.78).add(0.16)
    const height = field.reliefWave.mul(0.022).add(field.reliefRandom.x.mul(0.006)).add(fiber.mul(0.012))
    this.positionNode = p.add(normalLocal.mul(height.mul(near.mul(0.45).add(0.55)).mul(0.0022)))
    this.colorNode = mix(base, threadColor, field.weave.mul(0.82).add(moire.mul(0.18)))
    this.metalnessNode = field.weave.mul(0.26).add(moire.mul(0.08))
    this.roughnessNode = float(0.27).sub(field.weave.mul(0.1)).add(grazing.mul(0.08)).clamp(0.12, 0.42)
    this.sheen = 0.82
    this.sheenColor.set(hsl.integer(304, 100, 80))
    this.sheenRoughness = 0.28
    this.anisotropy = 0.78
    this.anisotropyNode = vec2(0.82, 0.16).mul(field.weave.mul(0.5).add(0.5))
    this.clearcoatNode = float(0.24).add(moire.mul(0.2))
    this.clearcoatRoughnessNode = float(0.13).add(grazing.mul(0.08))
    this.normalNode = proceduralNormal(height.mul(1.4), 0.0018)
    this.iridescenceNode = moire.mul(0.36).add(grazing.mul(0.16))
    this.iridescenceIOR = 1.34
    this.iridescenceThicknessNode = interference.mul(260).add(90).add(angle.mul(80))
    const sparkle = glints(normalViewGeometry, 95).mul(field.weave).mul(field.random.z.smoothstep(0.58, 0.8)).mul(near)
    this.emissiveNode = color(hsl.integer(325, 100, 93)).mul(sparkle.mul(0.5)).add(color(hsl.integer(181, 75, 83)).mul(moire).mul(grazing).mul(intimate.mul(0.6).add(0.2)).mul(0.09))
    this.aoNode = float(0.72).add(field.weave.mul(0.28))
  }
}

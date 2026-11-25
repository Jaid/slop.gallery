import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, time, uv, vec2, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Four cat poses in a unit square, origin at the center. Each pose keeps the ears as a separated pair so the head reads before the body. */
type Pose = {
  links: ReadonlyArray<readonly [number, number]>
  stars: ReadonlyArray<readonly [number, number]>
}
const pose = (stars: ReadonlyArray<readonly [number, number]>, links: ReadonlyArray<readonly [number, number]>): Pose => ({
  links,
  stars,
})
const catPoses = [pose([[-0.1, 0.34], [0.1, 0.34], [-0.06, 0.2], [0.06, 0.2], [0, 0.08], [-0.12, -0.02], [0.12, -0.02], [0, -0.12], [-0.14, -0.24], [0.14, -0.24], [-0.1, -0.34], [0.1, -0.34], [-0.2, -0.4], [0.2, -0.4], [-0.22, 0], [0.22, 0]], [[0, 2], [1, 3], [2, 4], [3, 4], [2, 3], [4, 5], [4, 6], [5, 7], [6, 7], [7, 8], [7, 9], [8, 10], [9, 11], [10, 12], [11, 13], [5, 14], [6, 15]]), pose([[-0.28, 0.1], [-0.16, 0.22], [-0.04, 0.12], [0.1, 0.08], [0.22, 0], [0.3, -0.1], [0.18, -0.2], [0.02, -0.24], [-0.14, -0.18], [-0.26, -0.06], [-0.16, 0], [0.02, -0.04], [0.14, -0.12], [-0.32, -0.16]], [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 0], [9, 10], [10, 11], [11, 4], [6, 12], [8, 13]]), pose([[-0.34, 0.08], [-0.22, 0.18], [-0.1, 0.08], [0.02, 0.1], [0.14, 0.08], [0.26, 0.12], [0.34, 0.02], [0.22, -0.04], [0.08, -0.06], [-0.06, -0.06], [-0.2, -0.04], [-0.32, -0.02], [-0.34, -0.14], [-0.16, -0.18], [0.02, -0.16], [0.2, -0.16], [0.34, -0.2], [0.28, 0.24]], [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [4, 7], [3, 8], [2, 9], [1, 10], [0, 11], [11, 12], [10, 13], [9, 14], [8, 15], [7, 16], [5, 17]]), pose([[-0.06, 0.34], [0.06, 0.34], [-0.02, 0.2], [0.04, 0.2], [0, 0.08], [-0.12, -0.02], [0.14, -0.04], [0, -0.14], [-0.16, -0.24], [0.12, -0.26], [-0.12, -0.36], [0.14, -0.38], [-0.04, -0.32], [0.04, -0.32], [0.22, 0.08], [0.28, 0.2], [-0.2, 0.04]], [[0, 2], [1, 3], [2, 4], [3, 4], [2, 3], [4, 5], [4, 6], [5, 7], [6, 7], [7, 8], [7, 9], [8, 10], [9, 11], [7, 12], [7, 13], [6, 14], [14, 15], [5, 16]])] as const
const catPoseCount = catPoses.length
/** Distance to the stars of one pose and to the short meridians that join them. */
function constellation(local: Node<'vec2'>, variant: number) {
  const chart = catPoses[variant]
  let nearest: Node<'float'> = float(2)
  for (const [x, y] of chart.stars) {
    nearest = nearest.min(local.sub(vec2(x, y)).length())
  }
  let link: Node<'float'> = float(2)
  for (const [a, b] of chart.links) {
    const start = vec2(...chart.stars[a])
    const end = vec2(...chart.stars[b])
    const span = end.sub(start)
    const spanLength = span.length().max(0.0001)
    const along = local.sub(start).dot(span).div(spanLength.mul(spanLength)).clamp(0, 1)
    link = link.min(local.sub(start.add(span.mul(along))).length())
  }
  return {
    link,
    nearest,
  }
}

/** A night chart wrapped once around the tube. Four cat poses share it, each a constellation of dots joined by short meridians. The chart is flat in UV so a pose stays a pose. Leaning in wakes the twinkle. Circling warms the ear turned toward you. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.15)
    this.name = knotData.id
    const {facing, grazing, near, intimate, view} = viewerFrame()
    const tube = uv()
    const columns = 2
    const rows = 2
    const chart = tube.mul(vec2(columns, rows))
    const cell = chart.floor()
    const local = chart.fract().sub(0.5).mul(vec2(1.15, 1.35))
    const variant = cell.x.add(cell.y.mul(columns)).mod(catPoseCount)
    const posed = Array.from({length: catPoseCount}, (_, index) => constellation(local, index))
    let nearest: Node<'float'> = float(2)
    let link: Node<'float'> = float(2)
    for (const [index, cat] of posed.entries()) {
      const chosen = variant.equal(index)
      nearest = chosen.select(cat.nearest, nearest)
      link = chosen.select(cat.link, link)
    }
    const footprint = local.fwidth().length().max(0.0012)
    const starRadius = footprint.mul(1.5).clamp(0.016, 0.03)
    const star = nearest.div(starRadius).smoothstep(1.04, 0.08)
    const core = nearest.div(starRadius.mul(0.32)).smoothstep(1, 0)
    const resolved = footprint.smoothstep(0.07, 0.014)
    const threadWidth = footprint.mul(0.7).clamp(0.004, 0.008)
    const thread = link.div(threadWidth).smoothstep(1, 0.18).mul(star.oneMinus()).mul(resolved.mul(0.55).add(0.45))
    const alive = link.fwidth().smoothstep(0.03, 0.006)
    const wake = time.mul(0.9).add(cell.x.mul(1.7)).add(cell.y.mul(2.3)).sin().mul(0.5).add(0.5)
    const pulse = wake.mul(intimate.mul(0.55).add(0.2)).add(0.62)
    const milky = tube.y.sub(0.5).abs().smoothstep(0.42, 0.04).mul(mx_noise_float(vec3(tube.x.mul(18), tube.y.mul(8), time.mul(0.03))).mul(0.3).add(0.7))
    const parallax = view.y.mul(0.5).add(0.5)
    const ink = mix(color(hsl.integer(266, 40, 4)), color(hsl.integer(300, 43, 7.5)), milky.mul(0.45))
    const starColor = mix(color(hsl.integer(63, 100, 88)), color(hsl.integer(256, 100, 91)), parallax)
    const limb = mix(color(hsl.integer(291, 100, 68.4)), color(hsl.integer(53, 100, 85)), parallax)
    this.colorNode = ink
    this.roughnessNode = float(0.86).sub(star.mul(0.3))
    this.metalnessNode = star.mul(0.15)
    this.clearcoatNode = float(0.08).add(near.mul(0.06))
    this.clearcoatRoughness = 0.3
    this.emissiveNode = color(hsl.integer(267, 47, 33)).mul(milky).mul(0.06)
      .add(starColor.mul(star).mul(pulse).mul(resolved.mul(0.65).add(0.35)).mul(5.5))
      .add(color(hsl.integer(77, 100, 98)).mul(core).mul(pulse).mul(3.2))
      .add(limb.mul(thread).mul(alive).mul(1.35))
      .add(color(hsl.integer(75, 100, 92.6)).mul(star).mul(wake).mul(intimate).mul(0.4))
      .add(color(hsl.integer(266, 51, 68)).mul(grazing.pow(4)).mul(0.08))
      .add(color(hsl.integer(0, 0, 0)).mul(facing.mul(0)))
  }
}

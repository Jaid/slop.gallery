import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, Fn, Loop, mix, mx_fractal_noise_float, mx_noise_float, normalViewGeometry, struct, uv, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const flakeField = struct({
  tint: 'vec3',
  sparkle: 'vec3',
  coverage: 'float',
})
/** Complete gold flakes with stable centers, tints and tilts, including neighboring-cell overlap. */
const evaluateFlakes = Fn(([position, threshold]: [Node<'vec3'>, Node<'float'>]) => {
  const cell = position.floor().toVar()
  const local = position.fract().toVar()
  const footprint = position.fwidth().length().max(0.001).toVar()
  const visibility = footprint.smoothstep(0.4, 1.6).oneMinus().toVar()
  // Centers occupy [0.3, 0.7]. Unsearched cells are at least 1.3 units away.
  // Only cap the broad minification filter, not the original 0.24 core or 0.3 radius.
  const outer = footprint.mul(0.8).add(0.3).min(1.3).toVar()
  const coverage = float(0).toVar()
  const tintSum = vec3(0).toVar()
  const sparkle = vec3(0).toVar()
  Loop(27, ({i}) => {
    const offset = vec3(i.mod(3), i.div(3).mod(3), i.div(9)).sub(1)
    const identity = cell.add(offset).toVar()
    const random = cellNoiseVec3(identity).toVar()
    const secondary = cellNoiseVec3(identity.add(vec3(37.1, 11.3, 59.7))).toVar()
    const present = random.x.smoothstep(threshold, threshold.add(0.04))
    const center = offset.add(secondary.mul(0.4).add(0.3))
    const distance = local.sub(center).length()
    const shape = distance.smoothstep(0.24, outer).oneMinus()
    const mask = present.mul(shape).mul(visibility)
    const normal = normalViewGeometry.add(secondary.mul(2).sub(1).mul(0.45)).normalize()
    const tint = mix(color(hsl.integer(86, 86, 82)), color(hsl.integer(92, 100, 92.7)), random.y)
    coverage.addAssign(mask)
    tintSum.addAssign(tint.mul(mask))
    sparkle.addAssign(tint.mul(glints(normal, 90)).mul(mask))
  })
  return flakeField(tintSum.div(coverage.max(0.000001)), sparkle, coverage.clamp())
})
function goldFlakes(position: Node<'vec3'>, threshold: Node<'float'>) {
  // Three's struct declarations do not yet expose TSL extensions or member types.
  const field = (evaluateFlakes(position, threshold) as unknown as Node<'struct'>).toVar()
  return {
    coverage: field.get('coverage') as Node<'float'>,
    tint: field.get('tint') as Node<'vec3'>,
    sparkle: field.get('sparkle') as Node<'vec3'>,
  }
}

/** Urushi lacquer, black when faced and blood-red at the edges, with sprinkled gold flakes under the coat. Every flake has its own tilt so glints ignite and die with each step; the flakes gather in drifts like real maki-e, and a second gold thread wound around the knot only reveals itself at arm's length. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment)
    this.name = knotData.id
    const {p, view, grazing, rim, near, intimate} = viewerFrame()
    const tube = uv()
    const inner = p.sub(view.mul(0.012))
    const q = inner.mul(85)
    const dispersal = mx_fractal_noise_float(p.mul(2.6), 2, 2, 0.5).mul(0.5).add(0.5)
    const threshold = dispersal.mul(-0.7).add(0.85)
    const flakes = goldFlakes(q, threshold)
    const flakeMask = flakes.coverage
    const flakeTint = flakes.tint
    const flakeSparkle = flakes.sparkle
    const thread = opticalLine(tube.y.mul(3).add(tube.x.mul(36)).fract().sub(0.5), 0.045)
    const threadFine = opticalLine(tube.y.mul(-2).add(tube.x.mul(24)).add(0.5).fract().sub(0.5), 0.035).mul(intimate)
    const threadMask = thread.max(threadFine).clamp()
    const goldMask = flakeMask.max(threadMask).clamp()
    // Continuous gold threads must not inherit the surrounding cells' random flake tint.
    const threadTint = mix(color(hsl.integer(86, 86, 82)), color(hsl.integer(92, 100, 92.7)), 0.5)
    const lacquer = mix(color(hsl.integer(15, 76, 5)), color(hsl.integer(28, 94, 28)), grazing.pow(1.6).mul(0.85).add(mx_noise_float(p.mul(2)).mul(0.1)).clamp())
    this.colorNode = mix(mix(lacquer, flakeTint, flakeMask), threadTint, threadMask)
    this.metalnessNode = goldMask.mul(0.95)
    this.roughnessNode = float(0.34).mix(0.22, goldMask)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.035
    this.normalNode = proceduralNormal(goldMask.mul(0.5).add(mx_noise_float(p.mul(14)).mul(0.15)), 0.0009)
    this.emissiveNode = flakeSparkle.mul(1.4).mul(near.mul(0.6).add(0.5)).add(color(hsl.integer(86, 100, 86)).mul(thread.add(threadFine)).mul(glints(normalViewGeometry, 40)).mul(0.5)).add(color(hsl.integer(27, 85, 13)).mul(rim).mul(0.15))
  }
}

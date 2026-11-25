import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, float, Fn, mix, modelWorldMatrixInverse, mx_fractal_noise_float, mx_noise_float, negateOnBackSide, normalLocal, time, transformNormalToView, uv, varying, vec2, vec3, vec4} from 'three/tsl'

import {environmentHighlight, studioSheen} from '../../candidates/muse_wonder/lib/environmentHighlight.ts'
import {glints} from '../../lib/glints.ts'
import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {liquidNormal} from '../../lib/liquidNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Magnetic weather over an undeformed tube point. The cycle closes after two seconds, so preview loops breathe instead of jumping. */
const magneticField = (p: Node<'vec3'>) => {
  const cycle = time.mul(Math.PI)
  const swell = mx_fractal_noise_float(p.mul(2.3).add(vec3(cycle.sin().mul(0.22), cycle.mul(2).sin().mul(0.16), cycle.sin().mul(0.12))), 3, 2.08, 0.52)
  const spikeNoise = mx_noise_float(p.mul(4.8).add(swell.mul(1.35)).add(vec3(cycle.sin().mul(0.18), 0, cycle.mul(2).sin().mul(0.14)))).mul(0.5).add(0.5)
  return {
    swell,
    spine: spikeNoise.smoothstep(0.42, 0.92).pow(3),
  }
}
/** The undeformed tube point and its magnetic relief, shared by the displaced surface and its finite-difference normal. */
const magneticSurface = Fn(([tube]: [Node<'vec2'>]) => {
  const {position: p, normal} = knotFrame(tube)
  const cameraLocal = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz
  const proximity = cameraLocal.sub(p).length().smoothstep(1.2, 5.2).oneMinus()
  const {swell, spine} = magneticField(p)
  const attraction = proximity.mul(0.95).add(0.5)
  const height = swell.mul(0.007).add(spine.mul(0.058).mul(attraction))
  return p.add(normal.mul(height))
})
/** Liquid iron that feels the visitor. A black magnetic tide crawls over the knot and, as you approach, its spines lengthen toward you as if your body carried the magnet. The spikes themselves are polished near-mirror, but a living oil film crawls over their tips, breaking grazing light into a slow spectral bloom. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.15)
    this.name = knotData.id
    const tube = uv()
    const {p, facing, grazing, intimate, objectDistance} = viewerFrame()
    const close = objectDistance.smoothstep(1.5, 4.8).oneMinus()
    this.positionNode = magneticSurface(tube)
    const epsilon = 0.00035
    const du = magneticSurface(tube.add(vec2(epsilon, 0))).sub(magneticSurface(tube.sub(vec2(epsilon, 0))))
    const dv = magneticSurface(tube.add(vec2(0, epsilon))).sub(magneticSurface(tube.sub(vec2(0, epsilon))))
    const displacedNormal = varying(transformNormalToView(du.cross(dv).normalize())).normalize()
    this.normalNode = negateOnBackSide(displacedNormal)
// The same magnetic weather in the fragment, used to crown the spine tips with oil and light.
    const {spine} = magneticField(p)
    const cycle = time.mul(Math.PI)
    const ripple = mx_noise_float(p.mul(15).add(vec3(cycle.sin().mul(0.3), cycle.mul(2).sin().mul(0.22), 0))).mul(0.5).add(0.5)
    const abyss = color(hsl.integer(273, 38, 3.4))
    const wetIron = color(hsl.integer(263, 43, 12))
    this.colorNode = mix(abyss, wetIron, spine.mul(0.7).add(ripple.mul(0.22)).clamp())
    this.metalnessNode = spine.mul(0.24).add(0.2)
    this.roughnessNode = float(0.13).sub(spine.mul(0.075)).add(ripple.mul(0.028).mul(close.mul(0.7).add(0.3))).clamp(0.035, 0.18)
    this.clearcoat = 1
    this.clearcoatRoughnessNode = float(0.075).sub(spine.mul(0.04)).clamp(0.02, 0.08)
    this.clearcoatNormalNode = liquidNormal(float(0.75), 0.55)
    this.iridescenceNode = spine.mul(grazing.mul(0.62).add(0.18)).add(ripple.mul(grazing).mul(0.14)).clamp()
    this.iridescenceIOR = 1.46
    this.iridescenceThicknessNode = spine.mul(360).add(grazing.mul(190)).add(90)
    this.sheen = 0.24
    this.sheenColor.set(hsl.integer(267, 39, 22))
    this.sheenRoughness = 0.42
    const glint = glints(displacedNormal, 150)
    const chrome = environmentHighlight(environment, normalLocal, 0.09)
    const oilPhase = spine.mul(2.2).add(grazing.mul(2.7)).add(cycle.sin().mul(0.35))
    this.emissiveNode = chrome.mul(spine.mul(0.55).add(0.32)).mul(1.15)
      .add(color(hsl.integer(273, 100, 78)).mul(studioSheen(normalLocal)).mul(spine.mul(0.3).add(0.12)).mul(0.5))
      .add(color(hsl.integer(264, 100, 92.4)).mul(glint).mul(spine).mul(close.mul(0.9).add(0.35)).mul(1.7))
      .add(spectralColor(oilPhase).mul(spine.mul(0.55).add(0.2)).mul(grazing.pow(2)).mul(0.24))
      .add(color(hsl.integer(272, 100, 55.7)).mul(spine).mul(intimate).mul(0.075))
      .add(color(hsl.integer(271, 72, 9)).mul(facing.oneMinus().pow(3)).mul(0.22))
  }
}

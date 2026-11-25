import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, float, mix, modelWorldMatrixInverse, normalLocal, select, time, transformNormalToView, uv, vec2, vec4} from 'three/tsl'

import {panelSky, proceduralEnvironment} from '../../candidates/claude_sonnet/lib/environment.ts'
import {knotFrame} from '../../candidates/claude_sonnet/lib/knotFrame.ts'
import {tubeHex} from '../../candidates/claude_sonnet/lib/tubeHex.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import knotData from './data.ts'

const cells = [64, 8] as const
const coreRadius = 0.112
const reach = 0.066
const spikeRadius = 0.072
/** Black ferrofluid on a hexagonal Rosensweig lattice. The magnet sits at the viewer, so the crown stands up toward you and leans as you move. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const tube = uv()
    const cameraLocal = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz
    const magnetDistance = cameraLocal.length()
    const strength = magnetDistance.smoothstep(1.1, 5).oneMinus().mul(0.35).add(0.65)
/** Height above the fluid pool, and how far the tip is dragged toward the magnet, at a point of the surface. */
    const crown = (at: Node<'vec2'>) => {
      const frame = knotFrame(at)
      const toMagnet = cameraLocal.sub(frame.center).normalize()
      const facing = frame.normal.dot(toMagnet)
      const pull = facing.smoothstep(-0.25, 0.8).mul(0.6).add(0.4)
      const site = tubeHex(at, cells, 4)
      const wave = at.x.mul(TAU * 3).sub(time.mul(1.3)).sin().mul(0.1).add(0.9)
      const height = site.id.x.mul(0.3).add(0.8).mul(pull).mul(strength).mul(wave).mul(reach)
      const profile = site.distance.div(spikeRadius).oneMinus().clamp().pow(2.1)
      const rise = profile.mul(height)
      const sideways = toMagnet.sub(frame.normal.mul(facing))
      const point = frame.center.add(frame.normal.mul(rise.add(coreRadius))).add(sideways.mul(rise.mul(0.5)))
      return {
        point,
        rise,
      }
    }
    this.positionNode = crown(tube).point
    const eu = vec2(0.0005, 0)
    const ev = vec2(0, 0.0045)
    const du = crown(tube.add(eu)).point.sub(crown(tube.sub(eu)).point)
    const dv = crown(tube.add(ev)).point.sub(crown(tube.sub(ev)).point)
    const raw = du.cross(dv).normalize()
    const outward = select(raw.dot(normalLocal).greaterThan(0), raw, raw.negate())
    this.normalNode = transformNormalToView(outward).normalize()
    const studio = panelSky({
      zenith: [0.07, 0.08, 0.13],
      horizon: [0.32, 0.26, 0.24],
      nadir: [0.03, 0.028, 0.035],
      glow: {
        color: [1, 0.55, 0.25],
        intensity: 0.7,
        width: 0.09,
      },
      panels: [{
        azimuth: 0.7,
        elevation: 0.62,
        halfWidth: 0.4,
        halfHeight: 0.26,
        color: [1, 0.92, 0.8],
        intensity: 7,
        panes: [3, 2],
      }, {
        azimuth: -0.95,
        elevation: 0.4,
        halfWidth: 0.04,
        halfHeight: 0.7,
        color: [0.7, 0.85, 1],
        intensity: 12,
      }, {
        azimuth: 2.6,
        elevation: 0.5,
        halfWidth: 0.3,
        halfHeight: 0.045,
        color: [1, 0.35, 0.6],
        intensity: 9,
      }, {
        azimuth: -2.3,
        elevation: 0.15,
        halfWidth: 0.5,
        halfHeight: 0.04,
        color: [0.3, 1, 0.85],
        intensity: 6,
      }, {
        azimuth: 0,
        elevation: 1.25,
        halfWidth: 0.9,
        halfHeight: 0.3,
        color: [1, 1, 1],
        intensity: 1.8,
        softness: 0.4,
      }],
    })
    this.envNode = proceduralEnvironment(studio)
    const height = crown(tube).rise.div(reach)
    this.colorNode = mix(color(hsl.integer(286, 7, 4)), color(hsl.integer(285, 14, 10)), height.pow(2))
    this.metalness = 0.92
    this.roughnessNode = float(0.045).add(height.oneMinus().mul(0.03))
    this.iridescence = 0.35
    this.iridescenceIOR = 1.55
    this.iridescenceThicknessNode = height.mul(380).add(180)
    this.clearcoat = 0
  }
}

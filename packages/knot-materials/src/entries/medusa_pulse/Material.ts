import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalLocal, select, time, transformNormalToView, uv, vec2} from 'three/tsl'

import {knotFrame} from '../../candidates/claude_sonnet/lib/knotFrame.ts'
import {tubeParallax} from '../../candidates/claude_sonnet/lib/tubeParallax.ts'
import {tubeVoronoi} from '../../candidates/claude_sonnet/lib/tubeVoronoiGap.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const canals = 12
const beats = 3
/** Periodic ridge that fades to its mean once its period drops below a few pixels. */
const ridge = (phase: Node<'float'>, sharpness: number) => phase.mul(TAU).cos().mul(0.5).add(0.5).pow(sharpness).mul(phase.fwidth().smoothstep(0.18, 0.6).oneMinus())
/** The bell contracts in traveling beats and its rim ruffles; both the shape and the light follow the same pulse. */
const bell = (at: Node<'vec2'>) => {
  const beat = at.x.mul(beats).sub(time.mul(0.16))
  const contraction = beat.mul(TAU).sin().mul(0.5).add(0.5).pow(2)
  const ruffle = at.y.mul(canals).add(at.x.mul(5)).sub(time.mul(0.35)).mul(TAU).sin().mul(0.0032)
  const {center, normal} = knotFrame(at)
  return center.add(normal.mul(float(0.1155).add(contraction.mul(0.0125)).add(ruffle.mul(contraction.add(0.4)))))
}
/** A translucent living bell. Radial canals carry pulses of bioluminescence that travel the whole knot, and organs float at two depths. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.55)
    this.name = knotData.id
    const tube = uv()
    const frame = knotFrame(tube)
    const {p, view, grazing, near, intimate} = viewerFrame()
    this.positionNode = bell(tube)
    const eu = vec2(0.00003, 0)
    const ev = vec2(0, 0.0003)
    const du = bell(tube.add(eu)).sub(bell(tube.sub(eu)))
    const dv = bell(tube.add(ev)).sub(bell(tube.sub(ev)))
    const raw = du.cross(dv).normalize()
    const outward = select(raw.dot(normalLocal).greaterThan(0), raw, raw.negate())
    this.normalNode = transformNormalToView(outward).normalize()
// Radial canals wander slightly, so no two beats run in perfect parallel.
    const wander = mx_noise_float(frame.center.mul(3.1).add(frame.normal.mul(1.3))).mul(0.16)
    const canalPhase = tube.y.mul(canals).add(wander)
    const canalIndex = canalPhase.round().mod(canals)
    const canal = ridge(canalPhase, 40)
    const ring = ridge(tube.x.mul(96).add(tube.y.mul(TAU * 2).sin().mul(0.06)), 18).mul(near.mul(0.6).add(0.25))
// Beats travel along the knot; each canal fires a little later than its neighbor, like a slow spiral wave.
    const front = tube.x.mul(beats).sub(time.mul(0.16)).sub(canalIndex.mul(0.045)).fract()
    const beat = front.sub(0.5).div(0.075).pow2().negate().exp()
    const afterglow = front.smoothstep(0.44, 0.52).mul(front.sub(0.5).max(0).mul(-7).exp())
    const heart = beat.add(afterglow.mul(0.3))
// Deeper organs shift against the surface as you walk around; nearer cilia only appear when you lean in.
    const shallow = tubeVoronoi(tube.add(tubeParallax(frame, view, 0.035)), [44, 5], 0.9, 2)
    const deep = tubeVoronoi(tube.add(tubeParallax(frame, view, 0.09)), [26, 3], 0.85, 9)
    const organ = (site: ReturnType<typeof tubeVoronoi>, size: number, gate: number) => {
      const shape = site.nearest.div(size).pow2().negate().exp()
      const alive = site.id.y.smoothstep(gate, gate + 0.05)
      const blink = time.mul(site.id.x.mul(0.6).add(0.5)).add(site.id.z.mul(TAU)).sin().mul(0.5).add(0.5)
      return shape.mul(alive).mul(blink.mul(0.6).add(0.4))
    }
    const nuclei = organ(shallow, 0.16, 0.55).mul(near.mul(0.7).add(0.3))
    const gonads = organ(deep, 0.34, 0.5)
    const cilia = mx_noise_float(p.mul(540)).mul(0.5).add(0.5).pow(6).mul(intimate).mul(grazing.mul(0.6).add(0.4))
    const membrane = color(hsl.integer(284, 75, 28))
    this.colorNode = membrane
    this.transmission = 0.7
    this.thickness = 0.32
    this.ior = 1.34
    this.dispersion = 0.12
    this.attenuationColor.set(hsl.integer(284, 93, 40.5))
    this.attenuationDistance = 0.16
    this.roughnessNode = float(0.26).sub(canal.mul(0.08))
    this.clearcoat = 0.7
    this.clearcoatRoughness = 0.07
    const pulseColor = mix(color(hsl.integer(354, 100, 63)), color(hsl.integer(203, 99.9, 87)), beat.mul(0.85).add(tube.x.mul(TAU).sin().mul(0.15)).clamp())
    const canalGlow = pulseColor.mul(canal.mul(heart.mul(2.4).add(0.16)))
    const ringGlow = color(hsl.integer(284, 100, 54.5)).mul(ring.mul(heart.mul(1.4).add(0.05)))
    const bodyGlow = color(hsl.integer(283, 100, 49.6)).mul(beat).mul(0.22).mul(grazing.mul(0.6).add(0.4))
    this.emissiveNode = canalGlow.add(ringGlow).add(bodyGlow).add(color(hsl.integer(67, 100, 78)).mul(nuclei).mul(0.95)).add(color(hsl.integer(347, 100, 67.6)).mul(gonads).mul(0.55)).add(color(hsl.integer(201, 100, 93.5)).mul(cilia).mul(0.14)).add(color(hsl.integer(218, 99, 82)).mul(grazing.pow(3)).mul(0.1))
  }
}

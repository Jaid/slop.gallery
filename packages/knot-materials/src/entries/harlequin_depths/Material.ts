import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_hsvtorgb, time, uv, vec3} from 'three/tsl'

import {knotFrame} from '../../candidates/claude_sonnet/lib/knotFrame.ts'
import {tubeParallax} from '../../candidates/claude_sonnet/lib/tubeParallax.ts'
import {tubeVoronoi} from '../../candidates/claude_sonnet/lib/tubeVoronoiGap.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Red through violet and back: a ping-pong sweep so no hue ever jumps. */
const spectrum = (phase: Node<'float'>) => {
  const t = phase.div(TAU).fract().mul(2).sub(1).abs()
  const rgb = mx_hsvtorgb(vec3(t.mul(0.76).add(0.005), 0.94, 1))
// Blues and violets are dark in raw HSV; lift them so every band reads as luminous.
  return rgb.mul(t.smoothstep(0.55, 1).mul(0.55).add(1))
}
/** A black opal cut en cabochon, its harlequin mosaic diffracting light from two depths of the stone. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.05)
    this.name = knotData.id
    const tube = uv()
    const frame = knotFrame(tube)
    const {view, grazing, near, intimate} = viewerFrame()
    const lamp = vec3(0.32, 0.68, 0.66).normalize()
    const half = view.add(lamp).normalize()
    const orientation = (id: Node<'vec3'>) => frame.axis.mul(id.x.sub(0.5).mul(1.7)).add(frame.across.mul(id.y.sub(0.5).mul(1.7))).add(frame.normal.mul(id.z.mul(0.3).add(0.8))).normalize()
/** One stratum of ordered spheres. Deeper strata slide against the surface and answer at different angles. */
    const stratum = (depth: number, cells: readonly [number, number], seed: number, rate: number) => {
      const at = tube.add(tubeParallax(frame, view, depth))
      const domain = tubeVoronoi(at, cells, 0.94, seed)
      const angle = orientation(domain.id).dot(half)
      const breathing = time.mul(0.31).add(domain.id.x.mul(TAU)).sin().mul(0.9)
      const hue = angle.mul(rate).add(domain.id.z.mul(TAU)).add(breathing)
      const gate = angle.mul(rate * 0.62).add(domain.id.y.mul(TAU)).add(time.mul(0.23).add(domain.id.z.mul(TAU)).sin().mul(1.1)).cos().mul(0.5).add(0.5)
      const flash = gate.smoothstep(0.42, 0.95).pow(1.4).mul(0.95).add(0.05)
      const seam = domain.edge.smoothstep(0.015, 0.015 + 0.09)
      return {
        domain,
        hue,
        flash,
        seam,
      }
    }
    const top = stratum(0.012, [88, 10], 1, 15)
    const deep = stratum(0.055, [62, 7], 7, 12)
// Pinfire: a finer confetti of sub-domains inside each patch, only resolved from up close.
    const pins = tubeVoronoi(tube.add(tubeParallax(frame, view, 0.02)), [330, 38], 0.96, 3)
    const pinVisible = near.mul(0.85).add(0.15)
    const hueTop = top.hue.add(pins.id.x.sub(0.5).mul(2.6).mul(pinVisible))
    const pinFlash = pins.id.y.mul(0.5).add(0.5).mix(1, pinVisible.oneMinus())
    const fire = spectrum(hueTop).mul(top.flash).mul(pinFlash).mul(top.seam)
    const fireDeep = spectrum(deep.hue).mul(deep.flash).mul(deep.seam)
    const coverage = top.flash.mul(0.55)
    const glow = fire.mul(0.62).add(fireDeep.mul(0.3).mul(coverage.oneMinus()))
    const dome = top.domain.nearest.pow2().mul(-0.0075)
    this.colorNode = mix(color(hsl.integer(273, 42, 3.5)), color(hsl.integer(269, 69, 9.5)), top.domain.id.z.mul(0.5))
    this.metalness = 0
    this.roughnessNode = float(0.16).add(top.domain.edge.smoothstep(0, 0.1).oneMinus().mul(0.25))
    this.ior = 1.45
    this.clearcoat = 1
    this.clearcoatRoughness = 0.025
    this.normalNode = proceduralNormal(dome, 1)
    const milk = mix(color(hsl.integer(265, 88, 16)), color(hsl.integer(286, 80, 19)), top.domain.id.x)
    this.emissiveNode = glow.add(milk.mul(grazing.pow(2.5)).mul(0.5)).add(milk.mul(intimate).mul(0.05))
  }
}

import type {Node} from 'three/webgpu'

import hsl from 'okhsl'
import {array, float, If, Loop, min, mix, mx_noise_float, screenSize, screenUV, smoothstep, vec2, vec3, vec4} from 'three/tsl'

import MoodScreen from '../base/MoodScreen.ts'

/** Display-space pigments, since the frame beneath the brush has already been tone mapped. */
const palette = [hsl.integer(213, 63, 46), hsl.integer(256, 37, 64), hsl.integer(30, 58, 67), hsl.integer(76, 73, 68), hsl.integer(252, 35, 49), hsl.integer(180, 40, 71)]
const paints = array(palette.map(hex => vec3(hex >> 16, hex >> 8 & 255, hex & 255).div(255)))
/** Each pass of the wet mop: center from the corner, half-length and belly in short screen sides, then the brush angle in radians. Dilute underwashes first, smaller drops of concentrated color last. */
const strokes = [
  [-0.005, 0.12, 0.245, 0.083, -1.4],
  [0.14, 0.012, 0.24, 0.073, -0.13],
  [0.075, 0.075, 0.2, 0.057, -0.68],
  [0.017, 0.14, 0.16, 0.049, -1.28],
  [0.21, 0.015, 0.17, 0.041, -0.23],
  [0.041, 0.031, 0.135, 0.068, -0.6],
  [0.092, 0.062, 0.093, 0.038, -0.39],
  [0.028, 0.21, 0.071, 0.032, -1.44],
  [0.264, 0.026, 0.073, 0.022, -0.17],
] as const
const marks = array(strokes.map(([x, y, a, b]) => vec4(x, y, a, b)))
const angles = array(strokes.map(([, , , , a]) => vec2(Math.cos(a), Math.sin(a))))

/** Transparent watercolor. The paper draws pigment to the drying edge of each wash. A fresh drop of water spreads into it, pushing a second, scalloped tide line ahead of itself. */
export default class TideLines extends MoodScreen {
  constructor(private readonly arrivalTime: number) {
    super()
  }

  draw(frame: Node<'vec3'>): Node<'vec3'> {
    const short = min(screenSize.x, screenSize.y)
    const p = min(screenUV, screenUV.oneMinus()).mul(screenSize).div(short).toVar()
    const margin = p.x.min(p.y)
    const result = frame.toVar()
    // No wash reaches beyond this corner patch, even on an ultrawide or portrait screen.
    If(margin.lessThan(0.24).and(p.x.max(p.y).lessThan(0.55)), () => {
      const corner = screenUV.x.step(0.5).add(screenUV.y.step(0.5).mul(2))
      const pixel = float(1).div(short)
      const clock = this.arrival.mul(this.arrivalTime).add(this.stay)
      const painted = frame.toVar()
      const paper = mx_noise_float(p.mul(380).add(corner)).toVar()
      const fibers = mx_noise_float(p.mul(105).add(corner.mul(3))).toVar()
      Loop(strokes.length, ({i}) => {
        const mark = marks.element(i)
        const along = angles.element(i)
        const seed = float(i).add(corner.mul(3.74))
        const offset = p.sub(mark.xy.mul(seed.sin().mul(0.18).add(1)))
        const u = offset.dot(along).div(mark.z)
        const v = offset.dot(vec2(along.y.negate(), along.x)).div(mark.w).add(u.mul(3).add(seed).sin().mul(0.19))
        const age = clock.sub(float(i).mul(0.24)).sub(corner.mul(0.08)).max(0)
        const laid = smoothstep(0, 1.27, age)
        const rag = mx_noise_float(p.mul(34).add(seed)).mul(0.18).add(fibers.mul(0.057))
        const dist = vec2(u, v).length().add(rag)
        const front = laid.mul(2.4).sub(1.2).sub(u)
        const edge = smoothstep(0.94, 1.04, dist).oneMinus().mul(smoothstep(-0.08, 0.07, front))
        const rim = smoothstep(0.8, 0.995, dist)
        // A backrun starts anew under the wash after the former bloom dried into it.
        const cycle = age.div(seed.sin().mul(1.7).add(7)).add(seed.mul(0.117)).fract()
        const ring = vec2(u.add(0.13), v.mul(0.63)).length().add(rag).sub(cycle.mul(1.35))
        const bloom = smoothstep(-0.04, 0.07, ring).oneMinus().mul(smoothstep(0, 0.2, cycle)).mul(smoothstep(0.73, 1, cycle).oneMinus())
        const bank = smoothstep(0, pixel.div(mark.w).add(0.055), ring.abs()).oneMinus().mul(bloom)
        const pigment = paints.element(i.add(corner.mul(2).toInt()).mod(palette.length))
        const stain = mix(pigment, pigment.mul(0.56), rim).add(paper.mul(0.052)).add(fibers.mul(0.04))
        painted.assign(mix(painted, stain, edge.mul(rim.mul(0.37).add(0.43).add(bank.mul(0.4)).sub(bloom.mul(0.25)))))
      })
      result.assign(mix(frame, painted, smoothstep(0.19, 0.24, margin).oneMinus().mul(this.presence)))
    })
    return result
  }
}

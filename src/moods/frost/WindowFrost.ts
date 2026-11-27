import type {Node} from 'three/webgpu'

import hsl from 'okhsl'
import {float, If, min, mix, mx_fractal_noise_float, mx_noise_float, screenSize, screenUV, smoothstep, time, vec2, vec3} from 'three/tsl'

import MoodScreen from '../base/MoodScreen.ts'

/** how the frost creeps over the view: how fast its front travels in seconds, how far it reaches from the edges in short screen sides at most, how far fractal noise pushes that reach to and fro and how much farther its fine tendrils feel ahead of the front; the middle of the view, half a short side from every edge, stays clear whatever they do */
export const windowFrost = {
  base: 0.62,
  corner: 0.09,
  growSeconds: 16,
  reach: 0.3,
  tendril: 0.045,
  wobble: 0.5,
} as const
/** a packed color as display-space channels, which the screen draws in, unlike the working space the world is lit in */
const display = (hex: number) => vec3(hex >> 16, hex >> 8 & 255, hex & 255).div(255)
const iceTint = display(hsl.integer(224, 80, 88))
const crystalDeep = display(hsl.integer(232, 48, 83))
const crystalWhite = display(hsl.integer(212, 100, 98))

/** Window frost creeping over the view from its edges like over a cold pane: a milky, desaturating glaze spreads first, crystalline facets and bright fern veins grow through it and single crystals twinkle; it keeps creeping for as long as the cold holds, and melts back toward the edges as the mood leaves. The middle of the view always stays clear. */
export default class WindowFrost extends MoodScreen {
  constructor(private readonly arrivalTime: number) {
    super()
  }

  draw(frame: Node<'vec3'>): Node<'vec3'> {
    const short = min(screenSize.x, screenSize.y)
    const pos = screenUV.mul(screenSize).div(short).toVar()
    const fromEdge = min(screenUV, screenUV.oneMinus()).mul(screenSize).div(short)
    const edgeDistance = fromEdge.x.min(fromEdge.y).toVar()
    const result = frame.toVar()
    // No frost reaches beyond this band along the edges, on any screen.
    If(edgeDistance.lessThan(0.45), () => {
      const clock = this.arrival.mul(this.arrivalTime).add(this.stay)
      const grown = smoothstep(0, windowFrost.growSeconds, clock).mul(this.presence)
      // The front itself creeps like frost: fractal noise pushes it in and out at two scales, so it feels its way in feathery tongues rather than a straight band, and the corners, coldest on any pane, creep farthest.
      const uneven = mx_fractal_noise_float(vec3(pos.mul(3.2), 1.7), 3, 2.1, 0.5)
      const tongues = mx_fractal_noise_float(vec3(pos.mul(11), 4.2), 3, 2.1, 0.5)
      const corner = smoothstep(0.28, 0.02, fromEdge.x.max(fromEdge.y)).mul(windowFrost.corner)
      const front = grown.mul(windowFrost.reach).mul(uneven.mul(windowFrost.wobble).add(windowFrost.base)).add(tongues.mul(windowFrost.tendril).mul(grown)).add(corner.mul(grown))
      const coverage = smoothstep(front, front.sub(0.03), edgeDistance)
      // Crystalline patches, flat facets and a fine grain, with single crystals twinkling as the light moves.
      const patches = mx_noise_float(vec3(pos.mul(17), 2.2)).mul(0.6).add(mx_noise_float(vec3(pos.mul(43), 9.4)).mul(0.4)).mul(0.5).add(0.5)
      const facets = mx_noise_float(vec3(pos.mul(210), 6.3)).mul(0.5).add(0.5).mul(6).floor().div(6)
      const grain = mx_noise_float(vec3(pos.mul(120), 0.5)).mul(0.5).add(0.5)
      const twinkle = mx_noise_float(vec3(pos.mul(170), time.mul(0.35))).smoothstep(0.62, 0.85).pow(2)
      // Hair-fine crystalline veins thread the glaze: ridged noise at two fine scales, warped so its filaments branch and wander instead of running straight.
      const warp = vec2(mx_noise_float(vec3(pos.mul(3.4), 5.5)), mx_noise_float(vec3(pos.mul(3.4), 8.9))).mul(1.6)
      const fern = (scale: number, seed: number) => float(1).sub(mx_noise_float(vec3(pos.mul(scale).add(warp), seed)).abs()).max(0)
      const veins = fern(130, 7.7).pow(6).add(fern(260, 3.1).pow(8).mul(0.5))
      // Under the crystals, the view goes milky and pale like through a frozen pane: only a crushed, lifted shadow of its brightness comes through the ice.
      const luma = frame.dot(vec3(0.299, 0.587, 0.114))
      const glazed = mix(frame, vec3(luma.mul(0.3).add(0.38)).mul(iceTint), 0.88)
      const crystals = mix(crystalDeep, crystalWhite, patches.mul(0.36).add(facets.mul(0.2)).add(veins.mul(0.15)).add(grain.mul(0.12)).clamp()).add(vec3(twinkle.mul(0.55)))
      const frosted = mix(glazed, crystals, veins.mul(0.12).add(facets.mul(0.14)).add(patches.mul(0.22)).add(0.32).clamp())
      // The creeping front itself is brightest, a rim of fresh crystals where the frost is thinnest.
      const rim = coverage.mul(coverage.oneMinus()).mul(patches.mul(0.5).add(0.35))
      result.assign(mix(frame, frosted, coverage.mul(0.95)).add(crystalWhite.mul(rim)))
    })
    return result
  }
}

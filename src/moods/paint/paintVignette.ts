import type {MoodVignette} from '../base/Mood.ts'
import type {Node} from 'three/webgpu'

import {float, Fn, If, max, min, mix, mx_noise_float, screenSize, screenUV, smoothstep, vec2, vec3, vec4} from 'three/tsl'
import {Color, SRGBColorSpace} from 'three/webgpu'

import {oilPaints} from '#src/lib/materials/oilPaints.ts'

type Point = readonly [number, number]
type Float = Node<'float'>
type Vec2 = Node<'vec2'>
type Vec3 = Node<'vec3'>

type Stroke = {
  /** perpendicular offset of the midpoint from the straight path, in short sides of the frame */
  bow: number
  /** the interval of the reveal in which this stroke is drawn */
  draw: Point
  /** the brush path’s ends in viewport UV */
  ends: readonly [Point, Point]
  opacity: number
  /** the main pigment and a second one picked up on one edge of the brush */
  pigments: readonly [string, string]
  /** brush half-width as a share of the short side */
  width: number
}

const {ultramarine, viridian, titaniumWhite, vermilion, cadmiumYellow} = oilPaints
const strokes: ReadonlyArray<Stroke> = [
  {
    ends: [[-0.062, 0.31], [0.35, 0.054]],
    bow: -0.102,
    width: 0.071,
    draw: [0, 0.53],
    pigments: [ultramarine, '#6081ef'],
    opacity: 0.94,
  },
  {
    ends: [[0.675, 1.065], [1.035, 0.64]],
    bow: 0.087,
    width: 0.083,
    draw: [0.11, 0.68],
    pigments: [vermilion, '#ff875c'],
    opacity: 0.95,
  },
  {
    ends: [[-0.055, 0.44], [0.193, 0.126]],
    bow: -0.055,
    width: 0.039,
    draw: [0.23, 0.65],
    pigments: [viridian, '#51c4b4'],
    opacity: 0.87,
  },
  {
    ends: [[1.065, 0.057], [0.824, 0.155]],
    bow: 0.054,
    width: 0.046,
    draw: [0.24, 0.7],
    pigments: ['#2a7568', '#87c9ad'],
    opacity: 0.88,
  },
  {
    ends: [[-0.041, 0.786], [0.168, 0.945]],
    bow: 0.043,
    width: 0.043,
    draw: [0.31, 0.77],
    pigments: ['#48388e', '#b1a0e0'],
    opacity: 0.85,
  },
  {
    ends: [[1.043, 0.828], [0.725, 0.984]],
    bow: -0.044,
    width: 0.039,
    draw: [0.4, 0.88],
    pigments: [cadmiumYellow, '#ffe092'],
    opacity: 0.94,
  },
  {
    ends: [[0.035, 0.069], [0.243, 0.042]],
    bow: -0.017,
    width: 0.014,
    draw: [0.51, 0.92],
    pigments: [titaniumWhite, '#f6c16d'],
    opacity: 0.9,
  },
  {
    ends: [[0.045, 1.027], [0.157, 0.907]],
    bow: -0.026,
    width: 0.014,
    draw: [0.62, 0.98],
    pigments: [titaniumWhite, '#89cbb9'],
    opacity: 0.82,
  },
]
const displayColor = (hex: string) => {
  const linear = new Color(hex)
  const {r, g, b} = linear.getRGB(new Color, SRGBColorSpace)
  return vec3(r, g, b)
}
/** A swept, bristle-textured brush footprint. The head pushes a bead of paint as it advances; the tail dries toward the brush’s lift. */
const brush = Fn(([point, start, end, shape, style, pigment, tint]: [Vec2, Vec2, Vec2, Node<'vec4'>, Vec2, Vec3, Vec3]) => {
  const [width, bow, drawn, pixel] = [shape.x, shape.y, shape.z, shape.w]
  const [seed, opacity] = [style.x, style.y]
  const paint = vec4(0).toVar()
  const reach = width.mul(1.5).add(bow.abs()).add(pixel.mul(2))
  const inBounds = point.greaterThanEqual(min(start, end).sub(reach)).all().and(point.lessThanEqual(max(start, end).add(reach)).all())
  If(drawn.greaterThan(0).and(inBounds), () => {
    const line = end.sub(start).toVar()
    const length = line.length().toVar()
    const along = line.div(length).toVar()
    const offset = point.sub(start).toVar()
    const distance = offset.dot(along).toVar()
    const t = distance.div(length).clamp().toVar()
    const arc = t.mul(float(1).sub(t)).mul(bow).mul(4)
    const pressure = mix(float(0.61), float(1), smoothstep(0, 0.24, t)).mul(mix(float(1), float(0.58), smoothstep(0.45, 1, t)))
    const across = offset.dot(vec2(along.y.negate(), along.x)).sub(arc).div(width).toVar()
    // Keep the bristles parallel as the pressure changes. The narrow end carries fewer marks, not the same marks squashed together.
    // At small sizes, keep the broad silhouette but filter subpixel bristle detail toward its mean.
    const pixelsAcross = width.div(pixel).toVar()
    const grain = mx_noise_float(vec3(across.mul(11), t.mul(2.8), seed)).mul(smoothstep(8, 24, pixelsAcross)).toVar()
    const ridges = mx_noise_float(vec3(across.mul(32), t.mul(6), seed.add(41))).mul(smoothstep(48, 120, pixelsAcross)).toVar()
    const wobble = mx_noise_float(vec3(t.mul(13), across.sign().mul(1.7), seed.add(17))).mul(0.13)
    const side = across.abs().sub(pressure).add(grain.mul(0.18)).add(wobble).mul(width)
    const round = float(1).sub(across.div(pressure).pow2()).max(0)
    const heel = distance.negate().sub(round.mul(width).mul(0.63)).add(grain.mul(width).mul(0.3))
    const ahead = distance.sub(drawn.mul(length)).toVar()
    const lifting = smoothstep(0.86, 1, drawn)
    // At lift-off the brush leaves an oblique, frayed edge, with different bristle lengths instead of a pointed cap.
    const skew = across.mul(seed.mul(0.5).sin().mul(0.8).add(0.2)).mul(lifting)
    const tip = ahead.add(grain.mul(0.58).add(ridges.mul(0.26)).add(skew).sub(round.mul(0.38).mul(lifting.oneMinus())).mul(width))
    const edge = max(max(side, heel), tip).toVar()
    const coverage = smoothstep(pixel.mul(-1.35), pixel.mul(1.35), edge).oneMinus()
    const fringe = smoothstep(0.46, 1.05, across.abs().div(pressure))
    const dry = smoothstep(0.5, 1, t).mul(0.44).add(fringe.mul(0.41))
    const load = smoothstep(-0.21, 0.15, grain.mul(0.85).add(ridges.mul(0.28)).add(0.49).sub(dry)).mul(fringe.mul(-0.28).add(1))
    const ribbon = smoothstep(-0.26, 0.66, across.add(grain.mul(1.2))).mul(0.73)
    const bead = smoothstep(0.05, 0.75, ahead.abs().div(width)).oneMinus().mul(lifting.oneMinus()).mul(0.15)
    const shade = grain.mul(0.25).add(ridges.mul(0.22)).add(bead).add(0.98)
    const color = mix(pigment, tint, ribbon).mul(shade).saturate()
    const alpha = coverage.mul(load).mul(opacity).mul(smoothstep(0, 0.08, drawn))
    paint.assign(vec4(color.mul(alpha), alpha))
  })
  return paint
}).setLayout({
  name: 'atelierBrush',
  type: 'vec4',
  inputs: [
    ['point', 'vec2'],
    ['start', 'vec2'],
    ['end', 'vec2'],
    ['shape', 'vec4'],
    ['style', 'vec2'],
    ['pigment', 'vec3'],
    ['tint', 'vec3'],
  ].map(([name, type]) => ({
    type,
    name,
  })),
})
/** Sweeps oil paint in from the frame’s margins, leaving the center clear for the gallery and the work. */
const paintVignette: MoodVignette = reveal => Fn(() => {
  const pixel: Float = min(screenSize.x, screenSize.y).max(1).reciprocal().toVar()
  const aspect = screenSize.mul(pixel).toVar()
  const point = screenUV.mul(aspect).toVar()
  const ink = vec4(0).toVar()
  for (const [index, {ends: [start, end], bow, width, draw: [first, last], pigments, opacity}] of strokes.entries()) {
    const drawn = smoothstep(first, last, reveal)
    const mark = brush(point, vec2(...start).mul(aspect), vec2(...end).mul(aspect), vec4(width, bow, drawn, pixel), vec2(index * 7.13, opacity), displayColor(pigments[0]), displayColor(pigments[1])).toVar()
    ink.assign(mark.add(ink.mul(mark.a.oneMinus())))
  }
  return vec4(ink.rgb.div(ink.a.max(1e-5)), ink.a)
})()

export default paintVignette

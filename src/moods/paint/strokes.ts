import type {OilPaint} from '#src/lib/materials/oilPaints.ts'

import {paintIndex} from '#src/lib/materials/oilPaints.ts'

/** a curved oil brush stroke painted onto the screen border as part of the Paint Orb’s vignette */
export type VignetteStroke = {
  /** screen UV anchor in [0, 1]² that the stroke hugs */
  anchor: readonly [number, number]
  /** circle center offset from `anchor`, in screen-height units */
  center: readonly [number, number]
  /** seconds after the mood begins that the brush sets down */
  delay: number
  /** seconds the brush takes to sweep from start to end */
  duration: number
  /** half-width of the brush at full pressure, in screen-height units */
  halfWidth: number
  /** primary pigment and secondary pigment streaked along one side, indices into `paintOrder` */
  paint: readonly [number, number]
  /** bristle and tone seed in [0, 1) */
  phase: number
  /** circle radius in screen-height units */
  radius: number
  /** seconds between gentle refreshes of a top accent stroke, or 0 to stay put once painted */
  repaintPeriod: number
  /** starting angle on the circle in radians (0 right, +pi/2 down) */
  startAngle: number
  /** angular sweep in radians */
  sweep: number
}

const pigments = (primary: OilPaint, streak: OilPaint = primary): readonly [number, number] => [paintIndex(primary), paintIndex(streak)]

/**
 * Twenty curved oil strokes layered across all four corners and along all four borders, drawn sequentially in painter’s order as the Paint Orb’s mood comes on, with four vivid corner accents that periodically repaint themselves while the mood holds.
 */
export const vignetteStrokes: ReadonlyArray<VignetteStroke> = [
  // First pass: broad corner fills tucked right into each corner
  {
    anchor: [0, 0],
    center: [-0.22, -0.22],
    radius: 0.36,
    startAngle: 0.42,
    sweep: 0.78,
    halfWidth: 0.088,
    delay: 0.08,
    duration: 0.52,
    repaintPeriod: 0,
    paint: pigments('ultramarine', 'titaniumWhite'),
    phase: 0.11,
  },
  {
    anchor: [1, 1],
    center: [0.23, 0.21],
    radius: 0.36,
    startAngle: -Math.PI + 0.4,
    sweep: 0.8,
    halfWidth: 0.088,
    delay: 0.32,
    duration: 0.52,
    repaintPeriod: 0,
    paint: pigments('ultramarine', 'titaniumWhite'),
    phase: 0.27,
  },
  {
    anchor: [1, 0],
    center: [0.22, -0.23],
    radius: 0.36,
    startAngle: Math.PI - 1.18,
    sweep: 0.78,
    halfWidth: 0.086,
    delay: 0.56,
    duration: 0.52,
    repaintPeriod: 0,
    paint: pigments('viridian', 'cadmiumYellow'),
    phase: 0.43,
  },
  {
    anchor: [0, 1],
    center: [-0.21, 0.23],
    radius: 0.36,
    startAngle: -1.16,
    sweep: 0.76,
    halfWidth: 0.086,
    delay: 0.8,
    duration: 0.52,
    repaintPeriod: 0,
    paint: pigments('viridian', 'cadmiumYellow'),
    phase: 0.59,
  },

  // Second pass: continuous border sweeps across top, bottom, left and right edges
  {
    anchor: [0, 0],
    center: [0.36, -0.975],
    radius: 0.98,
    startAngle: 1.18,
    sweep: 0.68,
    halfWidth: 0.045,
    delay: 1.02,
    duration: 0.44,
    repaintPeriod: 0,
    paint: pigments('cadmiumYellow', 'titaniumWhite'),
    phase: 0.71,
  },
  {
    anchor: [1, 0],
    center: [-0.36, -0.975],
    radius: 0.98,
    startAngle: Math.PI - 1.18,
    sweep: -0.68,
    halfWidth: 0.045,
    delay: 1.18,
    duration: 0.44,
    repaintPeriod: 0,
    paint: pigments('ultramarine', 'titaniumWhite'),
    phase: 0.14,
  },
  {
    anchor: [0.5, 0],
    center: [-0.02, -1.27],
    radius: 1.26,
    startAngle: Math.PI / 2 - 0.42,
    sweep: 0.84,
    halfWidth: 0.038,
    delay: 1.34,
    duration: 0.46,
    repaintPeriod: 0,
    paint: pigments('viridian', 'cadmiumYellow'),
    phase: 0.19,
  },
  {
    anchor: [1, 1],
    center: [-0.34, 0.975],
    radius: 0.98,
    startAngle: -Math.PI + 1.18,
    sweep: 0.68,
    halfWidth: 0.045,
    delay: 1.5,
    duration: 0.44,
    repaintPeriod: 0,
    paint: pigments('cadmiumYellow', 'titaniumWhite'),
    phase: 0.83,
  },
  {
    anchor: [0, 1],
    center: [0.34, 0.975],
    radius: 0.98,
    startAngle: -1.18,
    sweep: -0.68,
    halfWidth: 0.045,
    delay: 1.66,
    duration: 0.44,
    repaintPeriod: 0,
    paint: pigments('vermilion', 'cadmiumYellow'),
    phase: 0.29,
  },
  {
    anchor: [0.5, 1],
    center: [0.02, 1.27],
    radius: 1.26,
    startAngle: -Math.PI / 2 - 0.42,
    sweep: 0.84,
    halfWidth: 0.038,
    delay: 1.82,
    duration: 0.46,
    repaintPeriod: 0,
    paint: pigments('ultramarine', 'viridian'),
    phase: 0.37,
  },
  {
    anchor: [0, 0.5],
    center: [-0.96, 0],
    radius: 0.968,
    startAngle: -0.56,
    sweep: 1.12,
    halfWidth: 0.044,
    delay: 1.98,
    duration: 0.44,
    repaintPeriod: 0,
    paint: pigments('vermilion', 'cadmiumYellow'),
    phase: 0.53,
  },
  {
    anchor: [1, 0.5],
    center: [0.96, 0],
    radius: 0.968,
    startAngle: Math.PI - 0.56,
    sweep: 1.12,
    halfWidth: 0.044,
    delay: 2.14,
    duration: 0.44,
    repaintPeriod: 0,
    paint: pigments('viridian', 'cadmiumYellow'),
    phase: 0.67,
  },

  // Third pass: diagonal corner sweeps overlapping the base coat
  {
    anchor: [0, 0],
    center: [-0.42, -0.26],
    radius: 0.65,
    startAngle: 0.35,
    sweep: 0.52,
    halfWidth: 0.048,
    delay: 2.3,
    duration: 0.42,
    repaintPeriod: 0,
    paint: pigments('cadmiumYellow', 'titaniumWhite'),
    phase: 0.77,
  },
  {
    anchor: [1, 1],
    center: [0.42, 0.24],
    radius: 0.65,
    startAngle: -Math.PI + 0.86,
    sweep: -0.54,
    halfWidth: 0.046,
    delay: 2.46,
    duration: 0.42,
    repaintPeriod: 0,
    paint: pigments('vermilion', 'cadmiumYellow'),
    phase: 0.91,
  },
  {
    anchor: [1, 0],
    center: [0.4, -0.28],
    radius: 0.65,
    startAngle: Math.PI - 0.36,
    sweep: -0.52,
    halfWidth: 0.046,
    delay: 2.62,
    duration: 0.42,
    repaintPeriod: 0,
    paint: pigments('ultramarine', 'titaniumWhite'),
    phase: 0.23,
  },
  {
    anchor: [0, 1],
    center: [-0.4, 0.28],
    radius: 0.65,
    startAngle: -0.34,
    sweep: -0.54,
    halfWidth: 0.046,
    delay: 2.78,
    duration: 0.42,
    repaintPeriod: 0,
    paint: pigments('cadmiumYellow', 'vermilion'),
    phase: 0.41,
  },

  // Fourth pass: vivid corner accents that periodically repaint themselves
  {
    anchor: [0, 0],
    center: [-0.28, -0.32],
    radius: 0.51,
    startAngle: 0.48,
    sweep: 0.56,
    halfWidth: 0.027,
    delay: 2.94,
    duration: 0.38,
    repaintPeriod: 8,
    paint: pigments('vermilion', 'cadmiumYellow'),
    phase: 0.31,
  },
  {
    anchor: [1, 1],
    center: [0.28, 0.3],
    radius: 0.5,
    startAngle: -Math.PI + 0.46,
    sweep: 0.56,
    halfWidth: 0.026,
    delay: 3.1,
    duration: 0.38,
    repaintPeriod: 8,
    paint: pigments('titaniumWhite', 'ultramarine'),
    phase: 0.47,
  },
  {
    anchor: [1, 0],
    center: [0.31, -0.26],
    radius: 0.5,
    startAngle: Math.PI - 0.44,
    sweep: -0.56,
    halfWidth: 0.026,
    delay: 3.26,
    duration: 0.38,
    repaintPeriod: 8,
    paint: pigments('cadmiumYellow', 'titaniumWhite'),
    phase: 0.63,
  },
  {
    anchor: [0, 1],
    center: [-0.3, 0.28],
    radius: 0.51,
    startAngle: -0.98,
    sweep: 0.56,
    halfWidth: 0.027,
    delay: 3.42,
    duration: 0.38,
    repaintPeriod: 8,
    paint: pigments('vermilion', 'cadmiumYellow'),
    phase: 0.79,
  },
]

/** Screen UV of `stroke` at normalized progress `t` (0–1) for a viewport of `aspect` width-to-height. */
export function vignetteStrokePoint(stroke: VignetteStroke, t: number, aspect: number): readonly [number, number] {
  const angle = stroke.startAngle + stroke.sweep * t
  const x = stroke.center[0] + Math.cos(angle) * stroke.radius
  const y = stroke.center[1] + Math.sin(angle) * stroke.radius
  return [stroke.anchor[0] + x / aspect, stroke.anchor[1] + y]
}

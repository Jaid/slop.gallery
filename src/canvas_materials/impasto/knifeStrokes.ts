/** what the knife lays its strokes by */
export type KnifeStrokesRequest = {
  /** how many texels of the relief lie along a meter of the work */
  density: number
  /** the picture shrunk to a few dozen pixels a side, as RGBA, which only holds its broad shapes for the strokes to turn by */
  guide: {
    data: Uint8ClampedArray
    height: number
    width: number
  }
  /** how many rows of texels the relief has */
  height: number
  /** the band of rows to lay, counted from the bottom, its first and one past its last; the whole relief by default, which several workers can share band by band */
  rows?: [number, number]
  /** how large the strokes are, against what they were made with */
  size: number
  /** how many columns of texels the relief has */
  width: number
}

/** how high the bare ground under the paint lies, 0 to 1 */
export const ground = 0.31
/** how many texels along a meter of the work the sizes of the strokes below are given in */
const strokeDensity = 800
/** how many strokes cover a square meter at stroke size 1 */
const strokesPerSquareMeter = 5340
/** how wide a gaussian, in texels, the ridges of a stroke are filtered with, so none is finer than the texels can hold */
const blur = 0.6
/** how quickly a stroke covers what lies under it toward its middle, in units of its own inside measure */
const coverage = 4.5
/** how many texels a stroke’s edge spans at least, so it is drawn antialiased rather than in steps of whole texels */
const edge = 1.2
/** how sharp the ridge along a stroke’s lip is, against its width */
const lipSharpness = 15

/**
 * The height of the paint a palette knife lays on a picture, 0 to 1 per texel, its first row the bottom of the band of `rows`: overlapping ribbons of paint, each turned along the picture’s contour where it lies, bristled across and with a raised lip along one edge, thicker where the picture is light. The same picture always gets the same strokes.
 *
 * The strokes have the same size in meters on every work, whatever its size and the relief’s density. Their count falls with the square of `size`, so larger strokes cover the picture just as densely. Each is drawn antialiased: its edge spans at least `edge` texels, and its bristles and lip are filtered by how fine they are against a texel, so a coarse relief holds a softer stroke instead of stairs and aliased ridges.
 */
export default function layKnifeStrokes({density, guide, height, rows: [bottom, top] = [0, height], size, width}: KnifeStrokesRequest) {
  // How many of the relief’s texels one texel of the density the strokes are given in spans.
  const unit = density / strokeDensity
  const scale = size * unit
  const squareMeters = width * height / density ** 2
  const luma = (x: number, y: number) => {
    const column = Math.max(0, Math.min(guide.width - 1, Math.floor(x * guide.width / width)))
    const row = Math.max(0, Math.min(guide.height - 1, Math.floor(y * guide.height / height)))
    const index = 4 * (column + row * guide.width)
    return (guide.data[index] * 0.22 + guide.data[index + 1] * 0.71 + guide.data[index + 2] * 0.07) / 255
  }
  const random = sequence(0x30_93_BA)
  // Blending one stroke over another in full precision, only the result is rounded.
  const field = new Float32Array(width * (top - bottom))
  field.fill(ground)
  const margin = 24 * scale
  const reach = 9 * unit
  for (let stroke = 0; stroke < strokesPerSquareMeter * squareMeters / size ** 2; stroke++) {
    const x = random() * (width + 2 * margin) - margin
    const y = random() * (height + 2 * margin) - margin
    const dx = luma(x + reach, y) - luma(x - reach, y)
    const dy = luma(x, y + reach) - luma(x, y - reach)
    // Along the contour where the picture has one, else in a slow sway.
    const direction = dx * dx + dy * dy > 0.0018 ? Math.atan2(dy, dx) + Math.PI / 2 : 0.45 + 0.8 * Math.sin(x / unit * 0.011 + Math.cos(y / unit * 0.016))
    const angle = direction + (random() - 0.5) * 0.84
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const long = (8 + random() * 23) * scale
    const wide = (2.7 + random() * 5.3) * scale
    const bend = (random() - 0.5) * 0.8
    const phase = random() * 2 * Math.PI
    const load = 0.45 + 0.4 * luma(x, y) + 0.15 * random()
    // Both bristle waves run across the stroke at so many radians per texel, and fade as they near the texels’ limit.
    const bristles = 0.047 * load
    const fineBristles = bristles * kept(11 / wide)
    const coarseBristles = bristles * kept(5.4 / wide)
    // The lip is a gaussian across the stroke, which the filter widens and lowers.
    const lipSpread = 1 / (2 * lipSharpness) + (blur / wide) ** 2
    const lipHeight = 0.14 * load * Math.sqrt(1 / (2 * lipSharpness) / lipSpread)
    const body = 0.23 + 0.26 * load
    // The texels of each row within the stroke’s bounds, a rectangle along it that holds its bend.
    const across = [wide * (Math.min(0, bend) - 1), wide * (Math.max(0, bend) + 1)]
    const rowReach = Math.abs(sin) * long + Math.abs(cos) * Math.max(-across[0], across[1])
    // The picture’s rows run from the top, the band’s from the bottom.
    for (let j = Math.max(height - top, Math.ceil(y - rowReach)); j <= Math.min(height - 1 - bottom, y + rowReach); j++) {
      const offsetY = j - y
      // Along the stroke, offsetX · cos + offsetY · sin lies within ±long, and across it, offsetY · cos − offsetX · sin lies within `across`.
      const [alongFrom, alongTo] = span(cos, -long - offsetY * sin, long - offsetY * sin)
      const [acrossFrom, acrossTo] = span(-sin, across[0] - offsetY * cos, across[1] - offsetY * cos)
      const from = Math.max(0, Math.ceil(x + Math.max(alongFrom, acrossFrom)))
      const to = Math.min(width - 1, Math.floor(x + Math.min(alongTo, acrossTo)))
      const row = (height - 1 - j - bottom) * width
      for (let i = from; i <= to; i++) {
        const offsetX = i - x
        const u = (offsetX * cos + offsetY * sin) / long
        if (Math.abs(u) >= 1) {
          continue
        }
        const uu = u * u
        const v = (offsetY * cos - offsetX * sin) / wide - bend * (1 - uu)
        const inside = 1 - uu * uu - v * v
        if (inside <= 0) {
          continue
        }
        // How fast the inside measure changes per texel, across the stroke and, toward its ends, along it, which sets how far it must climb to cover the stroke’s edge in `edge` texels.
        const alongSlope = 4 * u * (uu + v * bend) / long
        const acrossSlope = 2 * v / wide
        const ramp = Math.sqrt(Math.max(1 / coverage ** 2, edge ** 2 * (alongSlope * alongSlope + acrossSlope * acrossSlope)))
        const blend = Math.min(1, inside / ramp)
        const ridges = fineBristles * Math.cos(v * 11 + phase + u * 1.9) + coarseBristles * Math.cos(v * 5.4 - u * 2.1)
        // Past six of its spreads, the lip is nothing anymore.
        const fromLip = (v - 0.58) ** 2 / (2 * lipSpread)
        const lip = fromLip < 18 ? lipHeight * Math.exp(-fromLip) : 0
        const deposit = body + ridges + lip + (1 - u) * 0.07 * load
        field[row + i] += (deposit - field[row + i]) * blend
      }
    }
  }
  return Float16Array.from(field)
}

/** what is left of a wave of `frequency` radians per texel after the filter */
function kept(frequency: number) {
  return Math.exp(-((frequency * blur) ** 2) / 2)
}
/** A pseudo-random sequence of numbers from 0 to 1, the same every time, so a work’s strokes stay where they are. */
function sequence(seed: number) {
  let state = seed
  return () => {
    // A linear congruential step modulo 2³².
    state = Math.imul(1_664_525, state) + 1_013_904_223 >>> 0
    return state / 4_294_967_296
  }
}
/** Where `factor · t` lies between `low` and `high`: the range of `t`, empty if there is none. */
function span(factor: number, low: number, high: number): [number, number] {
  if (Math.abs(factor) < 1e-9) {
    return low < 0 && high > 0 ? [-Infinity, Infinity] : [Infinity, -Infinity]
  }
  return factor > 0 ? [low / factor, high / factor] : [high / factor, low / factor]
}

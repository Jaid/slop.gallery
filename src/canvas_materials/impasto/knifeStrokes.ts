/** what the knife lays its strokes by */
export type KnifeStrokesRequest = {
  /** the picture shrunk to a few dozen pixels a side, as RGBA, which only holds its broad shapes for the strokes to turn by */
  guide: {
    data: Uint8ClampedArray
    height: number
    width: number
  }
  /** how many rows of texels the relief has */
  height: number
  /** how large the strokes are, against what they were made with */
  size: number
  /** how many columns of texels the relief has */
  width: number
}

/** how high the bare ground under the paint lies, 0 to 255 */
export const ground = 80
/** how many rows of texels an ordinary print takes */
export const reliefRows = 896
/** how many strokes cover a square of `reliefRows` texels a side at stroke size 1 */
const squareStrokes = 6700

/**
 * The height of the paint a palette knife lays on a picture, 0 to 255 per texel, its first row the picture’s bottom: overlapping ribbons of paint, each turned along the picture’s contour where it lies, bristled across and with a raised lip along one edge, thicker where the picture is light. The same picture always gets the same strokes.
 *
 * The stroke count falls with the square of `size`, so larger strokes cover the picture just as densely.
 */
export default function layKnifeStrokes({guide, height, size, width}: KnifeStrokesRequest) {
  const area = width * height / reliefRows ** 2
  const luma = (x: number, y: number) => {
    const column = Math.max(0, Math.min(guide.width - 1, Math.floor(x * guide.width / width)))
    const row = Math.max(0, Math.min(guide.height - 1, Math.floor(y * guide.height / height)))
    const index = 4 * (column + row * guide.width)
    return (guide.data[index] * 0.22 + guide.data[index + 1] * 0.71 + guide.data[index + 2] * 0.07) / 255
  }
  const random = sequence(0x30_93_BA)
  const field = new Uint8Array(width * height)
  field.fill(ground)
  const margin = 24 * size
  for (let stroke = 0; stroke < squareStrokes * area / size ** 2; stroke++) {
    const x = random() * (width + 2 * margin) - margin
    const y = random() * (height + 2 * margin) - margin
    const dx = luma(x + 9, y) - luma(x - 9, y)
    const dy = luma(x, y + 9) - luma(x, y - 9)
    // Along the contour where the picture has one, else in a slow sway.
    const direction = dx * dx + dy * dy > 0.0018 ? Math.atan2(dy, dx) + Math.PI / 2 : 0.45 + 0.8 * Math.sin(x * 0.011 + Math.cos(y * 0.016))
    const angle = direction + (random() - 0.5) * 0.84
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const long = (8 + random() * 23) * size
    const wide = (2.7 + random() * 5.3) * size
    const bend = (random() - 0.5) * 0.8
    const phase = random() * 2 * Math.PI
    const load = 0.45 + 0.4 * luma(x, y) + 0.15 * random()
    const reachX = Math.ceil(Math.abs(cos) * long + Math.abs(sin) * wide * 1.6)
    const reachY = Math.ceil(Math.abs(sin) * long + Math.abs(cos) * wide * 1.6)
    for (let j = Math.max(0, Math.floor(y - reachY)); j <= Math.min(height - 1, y + reachY); j++) {
      for (let i = Math.max(0, Math.floor(x - reachX)); i <= Math.min(width - 1, x + reachX); i++) {
        const u = ((i - x) * cos + (j - y) * sin) / long
        if (Math.abs(u) >= 1) {
          continue
        }
        const v = (-(i - x) * sin + (j - y) * cos) / wide - bend * (1 - u * u)
        const inside = 1 - u ** 4 - v * v
        if (inside <= 0) {
          continue
        }
        const bristles = Math.cos(v * 11 + phase + u * 1.9) * 12 + Math.cos(v * 5.4 - u * 2.1) * 12
        const lip = 36 * Math.exp(-((v - 0.58) ** 2) * 15)
        const deposit = 58 + (66 + bristles + lip + (1 - u) * 18) * load
        const texel = (height - 1 - j) * width + i
        field[texel] += (deposit - field[texel]) * Math.min(1, inside * 4.5)
      }
    }
  }
  return field
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

import type {FloorSize} from '../base/Room.ts'

/** how far the drawing keeps inside the walls’ center lines */
const inset = 0.3
const round = (value: number) => Math.round(value * 1e4) / 1e4 + 0

/**
 * The Studio’s floor plan for the map, as SVG markup in meters relative to the room’s origin: the floor between its walls, whose center lines span `size`.
 * The viewBox frames the walls’ center lines.
 */
export default function studioMap([width, depth]: FloorSize) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${round(-width / 2)} ${round(-depth / 2)} ${round(width)} ${round(depth)}" fill="#fff">`,
    `  <rect x="${round(-width / 2 + inset)}" y="${round(-depth / 2 + inset)}" width="${round(width - inset * 2)}" height="${round(depth - inset * 2)}"/>`,
    '</svg>',
  ].join('\n')
}

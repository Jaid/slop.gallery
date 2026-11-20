/** a rectangle on the map in meters: its west and north edges, its width along x and its depth along z */
export type MapFrame = readonly [x: number, z: number, width: number, depth: number]

const rootPattern = /<svg\b([^>]*)>/u
const viewBoxPattern = /\sviewBox\s*=\s*(["'])(.*?)\1/u
// The frame and the overflow are the map’s to set, so the drawing lands where its viewBox says.
const framingPattern = /\s(?:height|overflow|width|x|y)\s*=\s*(["']).*?\1/gu

/**
 * A room’s floor plan for the map: an SVG drawing in meters relative to the room’s origin, x to the east and the drawing’s y to the south, along the world’s z.
 * Its viewBox frames the room, so a world stitches the plans of its rooms together by placing each drawing at the origin of its room.
 * The drawings end up in one document, so ids in them, like those of gradients, start with the room’s id.
 */
export default class RoomMap {
  /** what the drawing’s viewBox frames, relative to the room’s origin */
  readonly frame: MapFrame
  /** the drawing as an `<svg>` element that renders at its viewBox in any drawing in the same meters, unclipped */
  readonly markup: string

  constructor(svg: string) {
    const root = rootPattern.exec(svg)
    const viewBox = root && viewBoxPattern.exec(root[1])
    const frame = viewBox?.[2].trim().split(/[\s,]+/u).map(Number)
    if (!root || frame?.length !== 4 || !frame.every(Number.isFinite) || frame[2] <= 0 || frame[3] <= 0) {
      throw new Error('A room’s map needs an <svg> root with a viewBox of four numbers and a positive size.')
    }
    const [x, z, width, depth] = frame
    this.frame = [x, z, width, depth]
    const attributes = root[1].replaceAll(framingPattern, '').trimEnd()
    this.markup = `<svg${attributes} x="${x}" y="${z}" width="${width}" height="${depth}" overflow="visible">${svg.slice(root.index + root[0].length)}`.trim()
  }

  /** Whether the drawing frames a point in the room’s own x and z. */
  frames(x: number, z: number) {
    const [west, north, width, depth] = this.frame
    return x >= west && x <= west + width && z >= north && z <= north + depth
  }

  /** The frame of the drawing placed at the world x and z of its room’s origin. */
  placedFrame([originX, originZ]: readonly [x: number, z: number]): MapFrame {
    const [x, z, width, depth] = this.frame
    return [x + originX, z + originZ, width, depth]
  }
}

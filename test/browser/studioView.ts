import type {PortraitModelSubject} from '../../src/lib/gallery/PortraitModel.ts'

import PortraitModel from '../../src/lib/gallery/PortraitModel.ts'
import {viewFill} from '../../src/lib/rendering/studio/studioFraming.ts'
import StudioView from '../../src/lib/rendering/studio/StudioView.ts'

const width = 720
const height = 480
/** the colors of the test image’s quarters, which tell its corners apart: top left, top right, bottom left and bottom right */
const quarters = ['#ff0000', '#00ff00', '#0000ff', '#ffff00'] as const
type Pixels = Uint8ClampedArray
/** what of the canvas is opaque, in the view’s own measure from −1 to 1 on each axis, up being positive */
type Extent = {
  bottom: number
  left: number
  /** the opaque share of the canvas */
  opaque: number
  right: number
  top: number
}

/**
 * Shows works in the studio view the pause menu looks into, with their real frames and an image whose corners tell each other apart, and checks the pixels the canvas really shows:
 * a work stands upright and unmirrored on a transparent backdrop, in the middle, filling the share of the canvas its framing aims for; it stays whole in view turned to its back and at an angle; the camera moves closer and away; another work takes its place; hiding it empties the canvas; and a work asked for and replaced before it got there never shows.
 */
export default async function verifyStudioView() {
  const view = new StudioView
  const image = await quarteredImage()
  const wide = new PortraitModel(subject(image, 2.4, 1.6, 'classic'))
  const tall = new PortraitModel(subject(image, 1.2, 2.1, 'oak'))
  const late = new PortraitModel(subject(image, 2, 2, 'float'))
  const timings: Record<string, number> = {}
  try {
    view.resize(width, height)
    view.start()
    await Promise.all([wide.loaded, tall.loaded, late.loaded])
    let started = performance.now()
    assert(await view.show(wide.object, wide.size), 'The first work did not get onto the stage.')
    timings.firstShowMs = performance.now() - started
    // Drawn before the promise resolved, so the canvas shows it within this very task.
    const front = read(view)
    const frontExtent = extentOf(front)
    for (const [x, y] of [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]]) {
      assert(alphaAt(front, x, y) === 0, `The backdrop is not transparent at ${x}, ${y}.`)
    }
    assertCentered(frontExtent, 'From the front')
    // The canvas is wider than the framed work, so the work’s height fills the view.
    assertFilled(frontExtent, 'From the front')
    assert(frontExtent.right < frontExtent.top, 'A work wider than high in a wider view should be fitted by its height.')
    // Its image upright and unmirrored: each quarter where it belongs, halfway out to the image’s corners.
    const imageHalfWidth = frontExtent.right * 0.5
    const imageHalfHeight = frontExtent.top * 0.5
    const dominant = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([x, y]) => dominantChannels(front, x * imageHalfWidth, y * imageHalfHeight))
    assert(dominant.join(' ') === 'r g b rg', `The image’s quarters show as “${dominant.join(' ')}” instead of red, green, blue and yellow from the top left.`)
    // From behind, all of it still shows, without the image.
    view.turn(Math.PI, 0)
    const back = redraw(view)
    const backExtent = extentOf(back)
    assertCentered(backExtent, 'From behind')
    assertFilled(backExtent, 'From behind')
    const backColors = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([x, y]) => dominantChannels(back, x * imageHalfWidth, y * imageHalfHeight))
    assert(backColors.every(color => color === backColors[0]), `The back shows something like the image: “${backColors.join(' ')}”.`)
    // At an angle from above, a corner comes toward the camera, which backs off just far enough.
    view.reset()
    redraw(view)
    view.turn(0.9, 0.5)
    const angledExtent = extentOf(redraw(view))
    assertWithin(angledExtent, 'At an angle')
    assert(reachOf(angledExtent) > viewFill - 0.12, `At an angle, the work only reaches ${reachOf(angledExtent).toFixed(3)} of the view, far from ${viewFill}.`)
    // Closer, it covers more of the canvas, here nearly all of it, farther away less.
    view.reset()
    redraw(view)
    view.zoom(-0.3)
    const closer = extentOf(redraw(view))
    view.zoom(0.8)
    const farther = extentOf(redraw(view))
    assert(closer.opaque > frontExtent.opaque * 1.3, `Moving closer did not enlarge the work: ${closer.opaque.toFixed(3)} of the canvas after ${frontExtent.opaque.toFixed(3)}.`)
    assert(farther.opaque < frontExtent.opaque * 0.6, `Moving away did not shrink the work: ${farther.opaque.toFixed(3)} of the canvas after ${frontExtent.opaque.toFixed(3)}.`)
    // Another work takes its place, one that never got there doesn’t show.
    started = performance.now()
    const superseded = view.show(late.object, late.size)
    const shown = view.show(tall.object, tall.size)
    assert(!await superseded, 'A work replaced before it got onto the stage claims to be there.')
    assert(await shown, 'The work that replaced another did not get onto the stage.')
    timings.secondShowMs = performance.now() - started
    const tallExtent = extentOf(read(view))
    assertCentered(tallExtent, 'The second work')
    assertFilled(tallExtent, 'The second work')
    // Taller than wide, it leaves most of the canvas’s width empty.
    assert(tallExtent.right < 0.5, `The work higher than wide reaches ${tallExtent.right.toFixed(3)} of the view’s width, like the wide one before it.`)
    // Hiding something that isn’t on the stage changes nothing; hiding what is empties the canvas.
    view.hide(wide.object)
    assert(extentOf(redraw(view)).opaque > 0, 'Hiding a work that left the stage emptied the canvas.')
    view.hide(tall.object)
    assert(extentOf(redraw(view)).opaque === 0, 'The canvas still shows a hidden work.')
    return {
      front: frontExtent,
      back: backExtent,
      angled: angledExtent,
      tall: tallExtent,
      timings,
    }
  } finally {
    wide.dispose()
    tall.dispose()
    late.dispose()
    await view.disposeAsync()
  }
}

function subject(source: Blob, modelWidth: number, modelHeight: number, frame: PortraitModelSubject['frame']): PortraitModelSubject {
  return {
    width: modelWidth,
    height: modelHeight,
    source,
    frame,
  }
}
/** A PNG of four plain quarters, see {@link quarters}. */
async function quarteredImage() {
  const canvas = new OffscreenCanvas(64, 64)
  const context = canvas.getContext('2d')!
  for (const [index, color] of quarters.entries()) {
    context.fillStyle = color
    context.fillRect(index % 2 * 32, Math.floor(index / 2) * 32, 32, 32)
  }
  return canvas.convertToBlob({type: 'image/png'})
}
/** What the view’s canvas shows right now. Only within the task that drew it, after which the browser takes the picture away. */
function read(view: StudioView) {
  const copy = new OffscreenCanvas(width, height)
  const context = copy.getContext('2d', {willReadFrequently: true})!
  context.drawImage(view.canvas, 0, 0)
  return context.getImageData(0, 0, width, height).data
}
/** Has the view bring its camera to where it is headed and draw at once, which telling it its size does, and reads what it drew. */
function redraw(view: StudioView) {
  view.resize(width, height)
  return read(view)
}
function alphaAt(pixels: Pixels, x: number, y: number) {
  return pixels[(y * width + x) * 4 + 3]
}
/** The channels that dominate the pixel at a point of the view from −1 to 1: “r”, “g”, “b”, or two of them for a mix like yellow’s “rg”; empty for a gray. */
function dominantChannels(pixels: Pixels, x: number, y: number) {
  const index = (Math.round((1 - y) / 2 * (height - 1)) * width + Math.round((x + 1) / 2 * (width - 1))) * 4
  const channels = [pixels[index], pixels[index + 1], pixels[index + 2]]
  const strongest = Math.max(...channels)
  return ['r', 'g', 'b'].filter((_, channel) => strongest - channels[channel] < 60 && strongest - Math.min(...channels) > 60).join('')
}
function extentOf(pixels: Pixels): Extent {
  let minX = width
  let maxX = -1
  let minY = height
  let maxY = -1
  let opaque = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // More than the faint rim antialiasing leaves around the work.
      if (alphaAt(pixels, x, y) < 128) {
        continue
      }
      opaque++
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
  }
  return {
    left: minX / width * 2 - 1,
    right: (maxX + 1) / width * 2 - 1,
    top: 1 - minY / height * 2,
    bottom: 1 - (maxY + 1) / height * 2,
    opaque: opaque / (width * height),
  }
}
/** how far the work reaches from the middle of the view at most, 1 being the view’s edge */
function reachOf({top, bottom, left, right}: Extent) {
  return Math.max(-left, right, top, -bottom)
}
function assertCentered({top, bottom, left, right}: Extent, where: string) {
  assert(Math.abs(left + right) < 0.02 && Math.abs(top + bottom) < 0.02, `${where}, the work is off the middle: it spans ${left.toFixed(3)} to ${right.toFixed(3)} and ${bottom.toFixed(3)} to ${top.toFixed(3)}.`)
}
/** All of the work lies inside the share of the view its framing leaves it. */
function assertWithin(extent: Extent, where: string) {
  // Half a pixel of antialiased rim on each side.
  assert(reachOf(extent) <= viewFill + 2 / height, `${where}, the work reaches ${reachOf(extent).toFixed(3)} of the view, past the ${viewFill} it should fit in.`)
}
/** The work fills the share of the view its framing aims for, as far as its frame reaches the corners of the box around it. */
function assertFilled(extent: Extent, where: string) {
  assertWithin(extent, where)
  assert(reachOf(extent) > viewFill - 0.05, `${where}, the work only reaches ${reachOf(extent).toFixed(3)} of the view instead of about ${viewFill}.`)
}
function assert(value: unknown, message: string): asserts value {
  if (!value) {
    throw new Error(message)
  }
}

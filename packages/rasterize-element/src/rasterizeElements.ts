import type {ElementPlacement, RasterizeElementsOptions} from './types.ts'

import ElementRasterizer from './ElementRasterizer.ts'

/**
 * Rasterizes HTML elements into a new canvas, each at its placement: laid out, styled and painted by the browser like on the page, with the page’s style sheets, fonts and images.
 * The elements are taken from wherever they are and come back detached. The caller owns the canvas and releases it by setting its width to 0.
 */
export default async function rasterizeElements({elements, width, height, signal, arrange, ...options}: RasterizeElementsOptions) {
  const placements = Array.from(elements, (entry): ElementPlacement => ('element' in entry ? entry : {element: entry}))
  // Without a given size, the canvas only takes its own once the elements have theirs.
  const rasterizer = new ElementRasterizer({
    ...options,
    width: width ?? 1,
    height: height ?? 1,
  })
  try {
    rasterizer.add(...placements.map(placement => placement.element))
    await rasterizer.settle(signal)
    if (arrange) {
      arrange()
      await rasterizer.settle(signal)
    }
    if (width === undefined || height === undefined) {
      let right = 0
      let bottom = 0
      for (const {element, x = 0, y = 0, width: placedWidth, height: placedHeight} of placements) {
        const own = rasterizer.sizeOf(element)
        const drawnWidth = placedWidth ?? (placedHeight === undefined || own.height === 0 ? own.width : placedHeight * own.width / own.height)
        const drawnHeight = placedHeight ?? (placedWidth === undefined || own.width === 0 ? own.height : placedWidth * own.height / own.width)
        right = Math.max(right, x + drawnWidth)
        bottom = Math.max(bottom, y + drawnHeight)
      }
      if ((width ?? right) <= 0 || (height ?? bottom) <= 0) {
        throw new RangeError('The elements to rasterize have no size, so the canvas needs a width and a height.')
      }
      rasterizer.resize(width ?? right, height ?? bottom)
    }
    for (const placement of placements) {
      rasterizer.draw(placement)
    }
    return rasterizer.release()
  } catch (error) {
    rasterizer.dispose()
    throw error
  }
}

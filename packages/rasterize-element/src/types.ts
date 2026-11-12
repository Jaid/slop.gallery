export type ElementSize = {
  height: number
  width: number
}

/** Where an element’s border box goes on the canvas, in logical units. */
export type ElementPlacement = {
  /** how far the drawn area reaches beyond the border box on every side, in the element’s own CSS pixels, for shadows, outlines and overflowing or transformed children; 0 clips at the border box */
  bleed?: number
  element: Element
  /** defaults to the element’s own height, or keeps its aspect ratio if only `width` is given */
  height?: number
  /** defaults to the element’s own width, or keeps its aspect ratio if only `height` is given */
  width?: number
  x?: number
  y?: number
}

export type ElementRasterizerOptions = {
  colorSpace?: PredefinedColorSpace
  /** the rendered element the hidden host is mounted in, the document’s body by default; an ancestor with `display: none` leaves the elements without paint records */
  container?: Element
  /** logical height in CSS pixels, which percentage heights of the elements resolve against */
  height: number
  /** backing pixels per logical unit; elements are rasterized at this scale rather than resampled */
  resolution?: number
  /** logical width in CSS pixels, which percentage widths of the elements resolve against */
  width: number
}

export type RasterizeElementsOptions = Omit<ElementRasterizerOptions, 'height' | 'width'> & {
  /** called once the elements are laid out, to adapt them to what they measure, like shrinking a line that came out too wide; they are painted anew after it */
  arrange?: () => void
  elements: Iterable<Element | ElementPlacement>
  /** defaults to the lowest edge of the placed elements, with no basis for percentage heights */
  height?: number
  signal?: AbortSignal
  /** defaults to the rightmost edge of the placed elements, with no basis for percentage widths */
  width?: number
}

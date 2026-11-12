import type {ElementPlacement, ElementRasterizerOptions, ElementSize} from './types.ts'

import abortable from './lib/abortable.ts'

// HTML-in-canvas is newer than TypeScript’s DOM library.
type HostCanvas = HTMLCanvasElement & {
  getElementImageDefaultSize: (element: Element) => ElementSize
  requestPaint: () => void
}
type HostContext = CanvasRenderingContext2D & {
  drawElementImage: (element: Element, sourceX: number, sourceY: number, sourceWidth: number, sourceHeight: number, x: number, y: number, width: number, height: number, options?: {preserveElementGeometry?: boolean}) => void
}
type PaintEvent = Event & {changedElements: ReadonlyArray<Element>}

const validateSize = (width: number, height: number) => {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new RangeError('Element rasterizer dimensions must be positive finite numbers.')
  }
}

/**
 * A hidden canvas in the document whose child elements the browser lays out and paints like any other HTML, and which draws them into itself.
 * An element can only ever be drawn into the canvas it is a child of, so this canvas is the result.
 */
export default class ElementRasterizer implements Disposable {
  readonly canvas: HTMLCanvasElement
  readonly context: CanvasRenderingContext2D
  readonly resolution: number
  #disposed = false
  readonly #elements = new Set<Element>
  /** the CSS box of the canvas, which stays as it was laid out while the backing store may be resized */
  readonly #layout: ElementSize
  readonly #marked = new Set<Element>
  #size: ElementSize

  constructor({width, height, resolution = 1, container = document.body, colorSpace = 'srgb'}: ElementRasterizerOptions) {
    validateSize(width, height)
    if (!Number.isFinite(resolution) || resolution <= 0) {
      throw new RangeError('Element rasterizer resolution must be a positive finite number.')
    }
    const page = container.ownerDocument
    const canvas = page.createElement('canvas')
    // An opaque canvas would switch text to subpixel antialiasing, whose color fringes are wrong on anything but the screen’s own pixels.
    const context = canvas.getContext('2d', {colorSpace}) as HostContext | null
    if (typeof context?.drawElementImage !== 'function') {
      throw new TypeError('HTML-in-canvas is unavailable: drawing elements needs a 2D context with drawElementImage (Chromium 157 or newer).')
    }
    this.canvas = canvas
    this.context = context
    this.resolution = resolution
    this.#layout = {
      width,
      height,
    }
    this.#size = this.#layout
    this.resize(width, height)
    canvas.setAttribute('content', 'drawable')
    // Elements only get paint records while their canvas is rendered, reaches into the viewport and is not clipped away, so it sits at the viewport’s origin, fully transparent.
    canvas.style.cssText = `position:fixed;top:0;left:0;width:${width}px;height:${height}px;opacity:0;pointer-events:none;visibility:visible`
    // Keeps the elements away from focus, find-in-page and assistive technology.
    canvas.inert = true
    canvas.ariaHidden = 'true'
    container.append(canvas)
  }

  get #canvas() {
    return this.canvas as HostCanvas
  }

  get #context() {
    return this.context as HostContext
  }

  get height() {
    return this.#size.height
  }

  get width() {
    return this.#size.width
  }

  /** Makes the elements children of the canvas, taking them from wherever they are. They have no paint records before {@link settle}. */
  add(...elements: Array<Element>) {
    this.#requireAlive()
    for (const element of elements) {
      if (!element.hasAttribute('drawable')) {
        element.setAttribute('drawable', '')
        this.#marked.add(element)
      }
      this.#elements.add(element)
    }
    this.canvas.append(...elements)
  }

  /** Clears a logical rectangle, or the whole canvas. */
  clear(x = 0, y = 0, width = this.width, height = this.height) {
    this.#requireAlive()
    const [scaleX, scaleY] = this.#scale()
    this.context.clearRect(x * scaleX, y * scaleY, width * scaleX, height * scaleY)
  }

  dispose() {
    if (this.#disposed) {
      return
    }
    this.#unmount()
    this.canvas.width = 0
    this.canvas.height = 0
  }

  /** Draws an element’s current paint record. Only {@link settle} makes sure there is one and that it is complete. */
  draw(placement: Element | ElementPlacement) {
    this.#requireAlive()
    const {element, x = 0, y = 0, bleed = 0, width, height} = 'element' in placement ? placement : {element: placement}
    const own = this.sizeOf(element)
    if (own.width <= 0 || own.height <= 0) {
      return
    }
    const drawnWidth = width ?? (height === undefined ? own.width : height * own.width / own.height)
    const drawnHeight = height ?? (width === undefined ? own.height : width * own.height / own.width)
    const [scaleX, scaleY] = this.#scale()
    const stretchX = drawnWidth / own.width * scaleX
    const stretchY = drawnHeight / own.height * scaleY
    // The source rectangle is in the element’s CSS pixels, the destination in the canvas’ backing pixels.
    this.#context.drawElementImage(element, -bleed, -bleed, own.width + bleed * 2, own.height + bleed * 2, x * scaleX - bleed * stretchX, y * scaleY - bleed * stretchY, (own.width + bleed * 2) * stretchX, (own.height + bleed * 2) * stretchY, {preserveElementGeometry: true})
  }

  /** Takes the canvas out of the document with its pixels and hands it to the caller, who releases it by setting its width to 0. The elements are detached and the rasterizer is done. */
  release() {
    this.#requireAlive()
    this.#unmount()
    for (const attribute of ['content', 'style', 'inert', 'aria-hidden']) {
      this.canvas.removeAttribute(attribute)
    }
    return this.canvas
  }

  /** Takes an element out of the canvas again. */
  remove(element: Element) {
    if (!this.#elements.delete(element)) {
      return
    }
    if (this.#marked.delete(element)) {
      element.removeAttribute('drawable')
    }
    if (element.parentNode === this.canvas) {
      element.remove()
    }
  }

  /** Gives the canvas another logical size, which empties it. The box the elements are laid out in stays the one it was created with. */
  resize(width: number, height: number) {
    this.#requireAlive()
    validateSize(width, height)
    this.#size = {
      width,
      height,
    }
    this.canvas.width = Math.max(1, Math.round(width * this.resolution))
    this.canvas.height = Math.max(1, Math.round(height * this.resolution))
  }

  /**
   * Resolves once every added element has a paint record that shows its web fonts and images.
   * That takes a rendering update, so it waits for as long as the page is hidden, and again for every font or image still on its way.
   * CSS background images are not waited for.
   */
  async settle(signal?: AbortSignal) {
    this.#requireAlive()
    do {
      await this.#painted(signal)
      this.#requireRecords()
    } while (await this.#loaded(signal))
  }

  /** The size of an element’s border box in its own CSS pixels, from its paint record. */
  sizeOf(element: Element): ElementSize {
    this.#requireAlive()
    const size = this.#canvas.getElementImageDefaultSize(element)
    // The browser reports it in backing pixels, stretched by how the canvas’ backing store relates to its CSS box.
    return {
      width: size.width * this.#layout.width / this.canvas.width,
      height: size.height * this.#layout.height / this.canvas.height,
    }
  }

  [Symbol.dispose]() {
    this.dispose()
  }

  /**
   * Calls `listener` whenever the browser repainted added elements, with those elements, right in time to {@link draw} them anew for the frame that is about to be shown.
   * For canvases that stay in the document and follow their elements.
   */
  watch(listener: (changed: Array<Element>) => void): Disposable {
    this.#requireAlive()
    const onPaint = (event: Event) => {
      const changed = (event as PaintEvent).changedElements.filter(element => this.#elements.has(element))
      if (changed.length > 0) {
        listener(changed)
      }
    }
    this.canvas.addEventListener('paint', onPaint)
    return {[Symbol.dispose]: () => this.canvas.removeEventListener('paint', onPaint)}
  }

  /** Waits for the fonts and images that the last rendering update asked for, and tells whether there were any, as the paint records are outdated then. */
  async #loaded(signal?: AbortSignal) {
    const {fonts} = this.canvas.ownerDocument
    const images = Array.from(this.#elements, element => [...element instanceof HTMLImageElement ? [element] : [], ...element.querySelectorAll('img')]).flat().filter(image => !image.complete)
    if (fonts.status !== 'loading' && images.length === 0) {
      return false
    }
    // A broken image stays out of the picture like it does on the page.
    await abortable(Promise.all([fonts.ready, ...images.map(image => image.decode().catch(() => {}))]), signal)
    return true
  }

  /** The next rendering update that paints the canvas’ elements. */
  #painted(signal?: AbortSignal) {
    const painted = new Promise<void>(resolve => {
      this.canvas.addEventListener('paint', () => resolve(), {
        once: true,
        signal,
      })
    })
    // Without it, a canvas whose elements cannot be painted would never fire.
    this.#canvas.requestPaint()
    return abortable(painted, signal)
  }

  #requireAlive() {
    if (this.#disposed) {
      throw new Error('The element rasterizer was disposed or released.')
    }
  }

  /** A rendering update leaves no record for what is not rendered, and empty ones for a canvas outside the viewport, both without any error of its own. */
  #requireRecords() {
    let missing = 0
    for (const element of this.#elements) {
      try {
        this.#canvas.getElementImageDefaultSize(element)
      } catch {
        missing++
      }
    }
    if (missing > 0) {
      throw new Error(`${missing} of ${this.#elements.size} elements have no paint record. They or the rasterizer’s container are not rendered (display: none, visibility: hidden, content-visibility), or they are not children of the canvas anymore.`)
    }
    const view = this.canvas.ownerDocument.defaultView
    const box = this.canvas.getBoundingClientRect()
    if (!view || box.right <= 0 || box.bottom <= 0 || box.left >= view.innerWidth || box.top >= view.innerHeight) {
      throw new Error('The element rasterizer’s canvas lies outside the viewport, where elements are painted empty. Its container probably has a transform, filter or containment that moves fixed positioning.')
    }
  }

  #scale(): [number, number] {
    return [this.canvas.width / this.#size.width, this.canvas.height / this.#size.height]
  }

  #unmount() {
    this.#disposed = true
    for (const element of this.#elements) {
      this.remove(element)
    }
    this.canvas.remove()
  }
}

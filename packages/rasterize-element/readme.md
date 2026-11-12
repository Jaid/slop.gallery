# rasterize-element

HTML elements rasterized into a canvas by the browser’s own layout and paint, through [HTML-in-canvas](https://github.com/WICG/html-in-canvas): wrapping, ellipses, flexbox, web fonts, images and everything else CSS does, without measuring and placing text by hand. The package only produces a 2D canvas and has no dependencies beyond React for its optional adapter; what becomes of the canvas, like a texture, is up to its user.

It needs Chromium 157 or newer and throws where `drawElementImage` is missing.

## One rasterization

```ts
import rasterizeElements from 'rasterize-element'

const card = document.createElement('div')
card.className = 'card'
card.textContent = 'A title of any length, wrapped and balanced by the browser'

const canvas = await rasterizeElements({
  width: 1024,
  height: 256,
  resolution: 2,
  elements: [card],
})
// A plain 2048 × 512 canvas outside of the document. Release it with canvas.width = 0.
```

The elements are laid out with the page’s style sheets and fonts. `width` and `height` are the logical size in CSS pixels, against which percentage sizes of the elements resolve; `resolution` (default 1) scales the backing canvas. Elements are rasterized at that scale from their paint commands, not resampled, so text stays sharp at any resolution. Without `width` or `height`, the canvas takes the size of what is placed on it.

An entry of `elements` is an element or a placement in logical units:

```ts
const atlas = await rasterizeElements({
  width: columns * 720,
  height: rows * 480,
  elements: plates.map((element, index) => ({
    element,
    x: index % columns * 720,
    y: Math.floor(index / columns) * 480,
  })),
  signal,
})
```

| Placement | Default | Meaning |
| --- | --- | --- |
| `x`, `y` | `0` | where the element’s border box goes |
| `width`, `height` | its own size | another size for the border box; a single one keeps the aspect ratio |
| `bleed` | `0` | how far to draw beyond the border box on every side, in the element’s CSS pixels: shadows, outlines and overflowing or transformed children are clipped at the border box otherwise |

The promise resolves once every element is painted with its web fonts and `<img>` images, however late they arrive; a broken image stays empty like on the page. It rejects with the reason of an aborted `signal`, and when an element cannot be painted at all, instead of leaving a hole. Either way, the elements end up detached and nothing stays in the document.

## Adapting to the layout

Some things need the layout before they can be decided, like shrinking a line until it fits. `arrange` runs once the elements are laid out and measurable, and they are painted anew after it, which takes another rendering update:

```ts
const canvas = await rasterizeElements({
  elements: [card],
  arrange() {
    if (title.scrollWidth > title.clientWidth) {
      title.style.fontSize = `${Math.floor(48 * title.clientWidth / title.scrollWidth)}px`
    }
  },
})
```

## React

```tsx
import rasterizeElements from 'rasterize-element'
import renderElement from 'rasterize-element/react'

using card = renderElement(<Card title='Rendered by React DOM' />)
const canvas = await rasterizeElements({elements: [card.element]})
```

`renderElement(node)` renders the node right away into a detached element as wide and high as its content, and unmounts it on disposal. React DOM cannot render synchronously from inside its own renders and effects, so call it from asynchronous code or from another renderer.

## A rasterizer that stays

`rasterizeElements` is a short-lived `ElementRasterizer`. Keeping one keeps the elements alive in its hidden canvas, where the browser reports every repaint of them:

```ts
import {ElementRasterizer} from 'rasterize-element'

using rasterizer = new ElementRasterizer({width: 1024, height: 256})
rasterizer.add(card)
await rasterizer.settle()
rasterizer.draw(card)

using watch = rasterizer.watch(changed => {
  for (const element of changed) {
    rasterizer.draw(element)
  }
  // rasterizer.canvas is up to date for the frame about to be shown.
})
card.textContent = 'Changed'
```

`settle(signal)` waits for the paint records, `draw(placement)` draws one, `clear(x, y, width, height)` empties a logical rectangle, `sizeOf(element)` gives an element’s border box, `resize(width, height)` changes the logical size and empties the canvas, `remove(element)` takes an element out again. `release()` hands over the canvas like `rasterizeElements` does and ends the rasterizer; `dispose()` ends it with its canvas.

## What to know

All of this is measured in Chromium 157, not taken from the explainer.

- **A hidden page is not painted.** Paint records come from rendering updates, which stop in background tabs and minimized windows. A rasterization started there resolves when the page shows again.
- **It takes a rendering update**: a frame at most, almost nothing when started inside an animation frame callback. 167 nameplates of 720 × 480 took about 45 ms into a 7200 × 8160 canvas where `fillText` took about 27 ms.
- **The container has to be rendered**, the document’s body by default. `display: none` on it or above it fails the rasterization. `visibility: hidden` and `opacity: 0` are fine. A container with a transform, filter or containment moves the rasterizer’s fixed-positioned canvas along; once that is out of the viewport, elements are painted empty without any error from the browser, which the rasterizer turns into one.
- **An element’s own size is its own business.** Children of the canvas do not stretch to its width: give them a width, a percentage or `max-content`. Each one is laid out at the canvas’ origin, on its own.
- **A `transform` on the element itself is applied and then clipped** to its untransformed border box. Transform a child instead, and give it `bleed`. `opacity`, `filter`, `clip-path` and `mask` on the element apply; its margins and offsets do not move it. `position: fixed` descendants are positioned against the element.
- **Cross-origin images need CORS** (`crossorigin` and the header) and are left out silently otherwise, as are cross-origin CSS backgrounds. CSS background images are not waited for at all: preload them.
- **The canvas keeps its alpha channel on purpose.** Text on an opaque canvas gets subpixel antialiasing, whose color fringes are wrong anywhere but on the screen’s own pixels.
- **An element can only be drawn into the canvas it is a child of**, which is why the rasterizer owns the canvas instead of drawing into a given one. Copy from it with `drawImage` (7 ms for 7200 × 8160) or use it as it is.
- Do not remove an iframe from inside a `paint` event of a canvas in it, like a `watch` listener: Chromium 157 hangs the page.

## Testing

`bun test ./test` skips everything without a browser. `BROWSER_URL=http://127.0.0.1:9222 bun test ./test` attaches to a running Chromium’s DevTools and opens a tab of its own, `BROWSER=/path/to/chromium` launches one. `RASTERIZE_ELEMENT_TEST_HOST` names the test server for a browser on another machine.

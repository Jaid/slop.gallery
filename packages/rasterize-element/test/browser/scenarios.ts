import {createElement} from 'react'

import rasterizeElements, {ElementRasterizer} from '../../src/main.ts'
import renderElement from '../../src/react/main.ts'

const box = (style: string, text = '') => {
  const element = document.createElement('div')
  element.style.cssText = style
  element.textContent = text
  return element
}
const scratch = (width: number, height: number) => {
  const canvas = new OffscreenCanvas(width, height)
  return canvas.getContext('2d', {willReadFrequently: true})!
}
const pixel = (canvas: HTMLCanvasElement, x: number, y: number) => {
  const copy = scratch(1, 1)
  copy.drawImage(canvas, -x, -y)
  return [...copy.getImageData(0, 0, 1, 1).data].join(',')
}
/** the share of pixels in a rectangle that are close to `color` */
const coverage = (canvas: HTMLCanvasElement, [x, y, width, height]: [number, number, number, number], [red, green, blue]: [number, number, number]) => {
  const copy = scratch(width, height)
  copy.drawImage(canvas, -x, -y)
  const {data} = copy.getImageData(0, 0, width, height)
  let hits = 0
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] > 200 && Math.abs(data[index] - red) < 40 && Math.abs(data[index + 1] - green) < 40 && Math.abs(data[index + 2] - blue) < 40) {
      hits++
    }
  }
  return hits / (width * height)
}
/** the share of pixels that are neither background nor fully covered, which stretching a raster multiplies and rasterizing larger does not */
const softness = (canvas: HTMLCanvasElement) => {
  const copy = scratch(canvas.width, canvas.height)
  copy.drawImage(canvas, 0, 0)
  const {data} = copy.getImageData(0, 0, canvas.width, canvas.height)
  let soft = 0
  for (let index = 0; index < data.length; index += 4) {
    if (data[index] > 24 && data[index] < 232) {
      soft++
    }
  }
  return soft / (data.length / 4)
}
const free = (canvas: HTMLCanvasElement) => {
  canvas.width = 0
}
const failure = async (job: () => Promise<unknown>) => {
  try {
    await job()
    return 'resolved'
  } catch (error) {
    return Error.isError(error) ? `${error.name}: ${error.message}` : String(error)
  }
}
const leftovers = () => document.querySelectorAll('canvas, [drawable]').length
const text = () => box('width:300px;font:600 24px/32px sans-serif;color:#ffffff;background:#000000;padding:4px', 'Sharp at any size 123')
const shadowed = () => box('width:100px;height:50px;background:#ff0000;box-shadow:0 0 0 20px #00ff00')
const mount = (style: string) => {
  const container = box(style)
  document.body.append(container)
  return container
}
const red = 'width:100px;height:50px;background:#ff0000'
const green = 'width:100px;height:50px;background:#00ff00'
/** paints a red box inside a container of the given style and tells how that went */
const paintIn = async (style: string) => {
  const container = mount(style)
  const outcome = await failure(async () => {
    const canvas = await rasterizeElements({
      elements: [box(red)],
      container,
    })
    const drawn = pixel(canvas, 50, 25)
    free(canvas)
    if (drawn !== '255,0,0,255') {
      throw new Error(`drew ${drawn}`)
    }
  })
  container.remove()
  return outcome
}

export const tiles = async () => {
  const first = box(red)
  const second = box(green)
  const bodyChildren = document.body.childElementCount
  const canvas = await rasterizeElements({
    width: 400,
    height: 100,
    resolution: 2,
    elements: [
      first,
      {
        element: second,
        x: 200,
        y: 50,
      },
    ],
  })
  const result = {
    size: [canvas.width, canvas.height],
    first: pixel(canvas, 100, 50),
    betweenTiles: pixel(canvas, 300, 50),
    second: pixel(canvas, 500, 150),
    belowFirst: pixel(canvas, 100, 150),
    connected: canvas.isConnected,
    contentAttribute: canvas.getAttribute('content'),
    elementsDetached: first.parentNode === null && second.parentNode === null,
    drawableAttributes: [first, second].filter(element => element.hasAttribute('drawable')).length,
    bodyChildrenAdded: document.body.childElementCount - bodyChildren,
    leftovers: leftovers(),
  }
  free(canvas)
  return result
}

export const ownSize = async () => {
  const plain = await rasterizeElements({elements: [box('width:120px;height:40px;background:#ff0000')]})
  const scaled = await rasterizeElements({
    elements: [box('width:120px;height:40px;background:#ff0000')],
    resolution: 1.5,
  })
  const widened = await rasterizeElements({
    elements: [
      {
        element: box('width:120px;height:40px;background:#ff0000'),
        width: 240,
      },
    ],
  })
  const fractional = await rasterizeElements({elements: [box('width:max-content;font:20px/30px sans-serif;background:#ff0000', 'A line of text')]})
  const offset = await rasterizeElements({
    elements: [
      {
        element: box('width:120px;height:40px;background:#ff0000'),
        x: 30,
        y: 10,
      },
    ],
  })
  const result = {
    plain: [plain.width, plain.height, pixel(plain, 119, 39)],
    scaled: [scaled.width, scaled.height, pixel(scaled, 179, 59)],
    widened: [widened.width, widened.height, pixel(widened, 239, 79)],
    fractionalHeight: fractional.height,
    fractionalWidthIsWholeAndWide: Number.isInteger(fractional.width) && fractional.width > 60,
    offset: [offset.width, offset.height, pixel(offset, 10, 5), pixel(offset, 149, 49)],
  }
  for (const canvas of [plain, scaled, widened, fractional, offset]) {
    free(canvas)
  }
  return result
}

export const percentages = async () => {
  const canvas = await rasterizeElements({
    width: 400,
    height: 100,
    elements: [box('width:50%;height:50%;background:#ff0000')],
  })
  const result = {
    inside: pixel(canvas, 199, 49),
    rightOf: pixel(canvas, 201, 25),
    below: pixel(canvas, 100, 51),
  }
  free(canvas)
  return result
}

export const rasterizedAtResolution = async () => {
  const small = await rasterizeElements({elements: [text()]})
  const large = await rasterizeElements({
    elements: [text()],
    resolution: 4,
  })
  const stretched = document.createElement('canvas')
  stretched.width = large.width
  stretched.height = large.height
  const context = stretched.getContext('2d')!
  context.imageSmoothingQuality = 'high'
  context.drawImage(small, 0, 0, large.width, large.height)
  const result = {
    sizes: [small.width, large.width],
    rasterized: softness(large),
    stretched: softness(stretched),
  }
  for (const canvas of [small, large, stretched]) {
    free(canvas)
  }
  return result
}

export const bleed = async () => {
  const clipped = await rasterizeElements({
    width: 200,
    height: 150,
    elements: [
      {
        element: shadowed(),
        x: 50,
        y: 50,
      },
    ],
  })
  const bled = await rasterizeElements({
    width: 200,
    height: 150,
    resolution: 2,
    elements: [
      {
        element: shadowed(),
        x: 50,
        y: 50,
        bleed: 20,
      },
    ],
  })
  const result = {
    clippedShadow: pixel(clipped, 40, 75),
    clippedBox: pixel(clipped, 100, 75),
    bledShadow: pixel(bled, 80, 150),
    bledBox: pixel(bled, 200, 150),
    bledBoxCorner: pixel(bled, 102, 102),
    bledBeyondShadow: pixel(bled, 50, 150),
  }
  free(clipped)
  free(bled)
  return result
}

export const lateImage = async () => {
  const element = box('width:100px;height:100px;background:#000000')
  const image = new Image
  image.src = `/image.svg?delay=300&${Math.random()}`
  image.style.cssText = 'display:block;width:100px;height:100px'
  element.append(image)
  const started = performance.now()
  const canvas = await rasterizeElements({elements: [element]})
  const result = {
    waited: performance.now() - started,
    pixel: pixel(canvas, 50, 50),
  }
  free(canvas)
  return result
}

export const brokenImage = async () => {
  const element = box('width:100px;height:100px;background:#0000ff')
  const image = new Image
  image.src = `/missing.svg?${Math.random()}`
  image.style.cssText = 'display:block;width:50px;height:50px'
  element.append(image)
  const canvas = await rasterizeElements({elements: [element]})
  const result = {pixel: pixel(canvas, 90, 90)}
  free(canvas)
  return result
}

export const lateFont = async () => {
  const style = document.createElement('style')
  style.textContent = `@font-face { font-family: late-box; src: url('/box.woff2?delay=300&${Math.random()}') format('woff2'); }`
  document.head.append(style)
  // The box font’s “W” fills its whole em square, a fallback font’s does not.
  const element = box('width:100px;height:100px;font:100px/100px late-box, sans-serif;color:#ff0000;background:#000000', 'W')
  const started = performance.now()
  const canvas = await rasterizeElements({elements: [element]})
  const result = {
    waited: performance.now() - started,
    covered: coverage(canvas, [0, 0, 100, 100], [255, 0, 0]),
  }
  free(canvas)
  return result
}

export const notRendered = async () => {
  const hidden = box(`${red};display:none`)
  const shown = box(green)
  const message = await failure(() => rasterizeElements({elements: [shown, hidden]}))
  return {
    message,
    leftovers: leftovers(),
    detached: hidden.parentNode === null && shown.parentNode === null,
  }
}

export const containers = async () => {
  return {
    plain: await paintIn(''),
    invisible: await paintIn('visibility:hidden'),
    transparent: await paintIn('opacity:0'),
    displayNone: await paintIn('display:none'),
    movedAway: await paintIn('transform:translate(-5000px,0)'),
    scrolledAwayButFixed: await paintIn('position:absolute;top:5000px'),
    leftovers: leftovers(),
  }
}

export const abort = async () => {
  const before = AbortSignal.abort(new Error('before'))
  const early = await failure(() => rasterizeElements({
    elements: [box(red)],
    signal: before,
  }))
  const controller = new AbortController
  const element = box('width:100px;height:100px')
  const image = new Image
  image.src = `/image.svg?delay=2000&${Math.random()}`
  element.append(image)
  setTimeout(() => controller.abort(new Error('during')), 100)
  const started = performance.now()
  const late = await failure(() => rasterizeElements({
    elements: [element],
    signal: controller.signal,
  }))
  return {
    early,
    late,
    waited: performance.now() - started,
    leftovers: leftovers(),
    detached: element.parentNode === null,
  }
}

export const pageStyles = async () => {
  const style = document.createElement('style')
  style.textContent = '.styled-by-page { width: 80px; height: 30px; background: #00ff00; } .styled-by-page > span { display: block; width: 40px; height: 30px; background: #ff0000; }'
  document.head.append(style)
  const element = document.createElement('div')
  element.className = 'styled-by-page'
  element.append(document.createElement('span'))
  const canvas = await rasterizeElements({elements: [element]})
  const result = {
    size: [canvas.width, canvas.height],
    child: pixel(canvas, 20, 15),
    parent: pixel(canvas, 60, 15),
  }
  free(canvas)
  style.remove()
  return result
}

export const again = async () => {
  const element = box(red)
  const first = await rasterizeElements({elements: [element]})
  element.style.background = '#00ff00'
  const second = await rasterizeElements({elements: [element]})
  const attached = box('')
  document.body.append(attached)
  attached.append(element)
  element.style.background = '#0000ff'
  const third = await rasterizeElements({elements: [element]})
  const result = {
    first: pixel(first, 50, 25),
    second: pixel(second, 50, 25),
    third: pixel(third, 50, 25),
    takenFromItsParent: attached.childElementCount === 0,
  }
  attached.remove()
  for (const canvas of [first, second, third]) {
    free(canvas)
  }
  return result
}

export const manyAtOnce = async () => {
  const canvases = await Promise.all(Array.from({length: 24}, (_, index) => rasterizeElements({elements: [box(index % 2 ? red : green)]})))
  const wrong = canvases.filter((canvas, index) => pixel(canvas, 50, 25) !== (index % 2 ? '255,0,0,255' : '0,255,0,255')).length
  for (const canvas of canvases) {
    free(canvas)
  }
  return {
    wrong,
    leftovers: leftovers(),
  }
}

export const arranging = async () => {
  const line = box('width:100px;height:50px;overflow:hidden;white-space:nowrap;font:40px/50px sans-serif;color:#ffffff;background:#000000', 'A line too long')
  const measured: Array<number> = []
  const canvas = await rasterizeElements({
    elements: [line],
    arrange() {
      measured.push(line.scrollWidth, line.clientWidth)
      line.style.fontSize = `${Math.floor(40 * line.clientWidth / line.scrollWidth)}px`
    },
  })
  const result = {
    overflowedBefore: measured[0] > measured[1],
    fitsAfter: line.scrollWidth <= line.clientWidth,
    size: [canvas.width, canvas.height],
    // The shrunken line is low enough to leave the rows above and below it black.
    blankAbove: coverage(canvas, [0, 0, 100, 12], [0, 0, 0]),
    blankBelow: coverage(canvas, [0, 38, 100, 12], [0, 0, 0]),
    blankMiddle: coverage(canvas, [0, 12, 100, 26], [0, 0, 0]),
  }
  free(canvas)
  return result
}

export const reactNodes = async () => {
  const rendered = renderElement(createElement('div', {
    style: {
      width: 120,
      height: 40,
      background: '#00ff00',
    },
  }, createElement('span', {
    style: {
      display: 'block',
      width: 60,
      height: 40,
      background: '#ff0000',
    },
  })))
  const canvas = await rasterizeElements({elements: [rendered.element]})
  const result = {
    size: [canvas.width, canvas.height],
    child: pixel(canvas, 30, 20),
    parent: pixel(canvas, 90, 20),
    childrenBefore: rendered.element.childElementCount,
    childrenAfter: -1,
  }
  rendered[Symbol.dispose]()
  result.childrenAfter = rendered.element.childElementCount
  free(canvas)
  return result
}

export const watching = async () => {
  using rasterizer = new ElementRasterizer({
    width: 200,
    height: 50,
  })
  const first = box(red)
  const second = box(green)
  rasterizer.add(first, second)
  await rasterizer.settle()
  const place = (element: Element) => ({
    element,
    x: element === first ? 0 : 100,
  })
  rasterizer.draw(place(first))
  rasterizer.draw(place(second))
  const before = [pixel(rasterizer.canvas, 50, 25), pixel(rasterizer.canvas, 150, 25)]
  const repaints: Array<Array<string>> = []
  const watch = rasterizer.watch(changed => {
    repaints.push(changed.map(element => (element === first ? 'first' : 'second')))
    for (const element of changed) {
      rasterizer.draw(place(element))
    }
  })
  second.style.background = '#0000ff'
  await new Promise(resolve => setTimeout(resolve, 150))
  const after = [pixel(rasterizer.canvas, 50, 25), pixel(rasterizer.canvas, 150, 25)]
  watch[Symbol.dispose]()
  first.style.background = '#ffffff'
  await new Promise(resolve => setTimeout(resolve, 150))
  const unwatched = pixel(rasterizer.canvas, 50, 25)
  const size = rasterizer.sizeOf(first)
  rasterizer.remove(first)
  return {
    before,
    after,
    repaints,
    unwatched,
    size: [size.width, size.height],
    removed: first.parentNode === null && !first.hasAttribute('drawable'),
    removedSizeOf: await failure(async () => rasterizer.sizeOf(first)),
  }
}

export const disposal = async () => {
  const rasterizer = new ElementRasterizer({
    width: 100,
    height: 50,
  })
  const element = box(red)
  element.setAttribute('drawable', '')
  rasterizer.add(element)
  await rasterizer.settle()
  rasterizer.draw(element)
  rasterizer.dispose()
  rasterizer.dispose()
  return {
    canvasSize: [rasterizer.canvas.width, rasterizer.canvas.height],
    leftovers: document.querySelectorAll('canvas').length,
    keptItsOwnAttribute: element.hasAttribute('drawable'),
    detached: element.parentNode === null,
    afterDisposal: await failure(async () => rasterizer.draw(element)),
    invalid: [
      await failure(async () => new ElementRasterizer({
        width: 0,
        height: 10,
      })),
      await failure(async () => new ElementRasterizer({
        width: 10,
        height: 10,
        resolution: 0,
      })),
    ],
  }
}

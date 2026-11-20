import type {KnifeStrokesRequest} from './knifeStrokes.ts'

import layKnifeStrokes from './knifeStrokes.ts'

// Lays the strokes of one relief after another, off the page’s main thread, and hands each back without copying it.
globalThis.addEventListener('message', ({data}: MessageEvent<KnifeStrokesRequest & {id: number}>) => {
  const field = layKnifeStrokes(data)
  globalThis.postMessage({
    id: data.id,
    field,
  }, {transfer: [field.buffer]})
})

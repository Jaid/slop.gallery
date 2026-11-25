import type {KnifeStrokesRequest} from './knifeStrokes.ts'

import layKnifeStrokes from './knifeStrokes.ts'

// Lays its band of the strokes of one relief after another, off the page’s main thread, and hands each back without copying it.
globalThis.addEventListener('message', ({data}: MessageEvent<KnifeStrokesRequest & {id: number}>) => {
  const field = layKnifeStrokes(data)
  globalThis.postMessage({
    id: data.id,
    bottom: data.rows?.[0] ?? 0,
    field,
  }, {transfer: [field.buffer]})
})

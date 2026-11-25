import type {Texture} from 'three/webgpu'

import {DataTexture, LinearFilter, LinearMipmapLinearFilter, RedFormat, UnsignedByteType} from 'three/webgpu'

import {maximumArtworkEdge} from '#src/lib/gallery/imagePolicy.ts'
import {trackLoadingPromise} from '#src/lib/loadingItems.ts'

import {ground, reliefRows} from './knifeStrokes.ts'

/** how many pixels the picture is shrunk to along its height for the strokes to turn by */
const guideRows = 80
/** the strokes asked of the worker, by the id of their request */
const requests = new Map<number, (field?: Uint8Array) => void>
let lastRequest = 0
let worker: Worker | undefined
/**
 * The height of the paint a palette knife lays on the image of the texture, 0 to 1 in one channel, see `layKnifeStrokes`, at `size` times the size its strokes were made at.
 *
 * Laying the strokes takes a few hundred milliseconds, so a worker does it: `relief` is flat bare ground at first and takes the strokes once `ready` resolves, a loading item meanwhile.
 */
export default function knifeRelief(map: Texture, size = 1) {
  // The artworks’ textures hold their decoded images as canvases.
  const image = map.image as HTMLCanvasElement
  const aspect = image.width / image.height
  // A panoramic print must not ask for a texture wider than the artwork limit, nor a tall strip for a zero-width guide.
  const rows = Math.min(reliefRows, maximumArtworkEdge / aspect)
  const height = Math.max(1, Math.round(rows))
  const width = Math.max(1, Math.round(rows * aspect))
  const shrunk = document.createElement('canvas')
  shrunk.height = Math.max(1, Math.round(rows * guideRows / reliefRows))
  shrunk.width = Math.max(1, Math.round(rows * aspect * guideRows / reliefRows))
  const context = shrunk.getContext('2d', {willReadFrequently: true})!
  context.drawImage(image, 0, 0, shrunk.width, shrunk.height)
  const guide = context.getImageData(0, 0, shrunk.width, shrunk.height)
  const field = new Uint8Array(width * height)
  field.fill(ground)
  const relief = new DataTexture(field, width, height, RedFormat, UnsignedByteType)
  relief.name = 'Palette knife strokes'
  relief.magFilter = LinearFilter
  relief.minFilter = LinearMipmapLinearFilter
  relief.generateMipmaps = true
  relief.needsUpdate = true
  let disposed = false
  relief.addEventListener('dispose', () => {
    disposed = true
  })
  const id = ++lastRequest
  // A loading item until then, which captures and the frozen world’s frames wait for.
  const ready = trackLoadingPromise(`knife-strokes:${id}`, new Promise<void>(resolve => {
    requests.set(id, strokes => {
      if (strokes && !disposed) {
        field.set(strokes)
        relief.needsUpdate = true
      }
      resolve()
    })
  }))
  strokeWorker().postMessage({
    id,
    guide: {
      data: guide.data,
      width: guide.width,
      height: guide.height,
    },
    width,
    height,
    size,
  }, {transfer: [guide.data.buffer]})
  return {
    relief,
    ready,
  }
}

/** The worker that lays the strokes, which starts with the first relief and stays for the page. */
function strokeWorker() {
  if (!worker) {
    worker = new Worker(new URL('knifeStrokes.worker.ts', import.meta.url), {
      type: 'module',
      name: 'knife-strokes',
    })
    worker.addEventListener('message', ({data}: MessageEvent<{
      field: Uint8Array
      id: number
    }>) => {
      requests.get(data.id)?.(data.field)
      requests.delete(data.id)
    })
    // The reliefs asked for so far stay flat.
    worker.addEventListener('error', event => {
      console.warn('The palette knife’s strokes could not be laid.', event.message)
      for (const settle of requests.values()) {
        settle()
      }
      requests.clear()
    })
  }
  return worker
}

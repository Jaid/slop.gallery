import type {ImageSize} from '../lib/canvasSurface.ts'
import type {Texture} from 'three/webgpu'

import {DataTexture, LinearFilter, LinearMipmapLinearFilter, RedFormat, UnsignedByteType} from 'three/webgpu'

import {maximumArtworkEdge} from '#src/lib/gallery/imagePolicy.ts'
import {trackLoadingPromise} from '#src/lib/loadingItems.ts'

import {ground, reliefDensity} from './knifeStrokes.ts'

/** how many pixels a meter of the picture is shrunk to for the strokes to turn by */
const guideDensity = 70
/** the most texels a relief has, at a lower density on works larger than about 2.5 m square, so the worker lays even their strokes in under a second */
const reliefTexels = 2048 ** 2
/** the strokes asked of the worker, by the id of their request */
const requests = new Map<number, (field?: Uint8Array) => void>
let lastRequest = 0
let worker: Worker | undefined
/**
 * The height of the paint a palette knife lays on the image of the texture, which spans `size` on the work, 0 to 1 in one channel, see `layKnifeStrokes`, at `strokeSize` times the size its strokes were made at. The strokes are as large in meters on every work, so a larger one takes more of them.
 *
 * Laying the strokes takes a few hundred milliseconds, so a worker does it: `relief` is flat bare ground at first and takes the strokes once `ready` resolves, a loading item meanwhile.
 */
export default function knifeRelief(map: Texture, size: ImageSize, strokeSize = 1) {
  // The artworks’ textures hold their decoded images as canvases.
  const image = map.image as HTMLCanvasElement
  // A large or panoramic work must neither ask for a texture longer than the artwork limit nor keep the worker for long, so it gets fewer texels per meter. A strip still gets at least one texel and guide pixel across.
  const density = Math.min(reliefDensity, maximumArtworkEdge / Math.max(size.width, size.height), Math.sqrt(reliefTexels / (size.width * size.height)))
  const width = Math.max(1, Math.round(size.width * density))
  const height = Math.max(1, Math.round(size.height * density))
  const shrunk = document.createElement('canvas')
  const guideScale = Math.min(guideDensity, density)
  shrunk.width = Math.max(1, Math.round(size.width * guideScale))
  shrunk.height = Math.max(1, Math.round(size.height * guideScale))
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
    density,
    size: strokeSize,
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

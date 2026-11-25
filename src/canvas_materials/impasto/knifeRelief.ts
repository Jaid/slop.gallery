import type {ImageSize} from '../lib/canvasSurface.ts'
import type {Texture} from 'three/webgpu'

import {DataTexture, HalfFloatType, LinearFilter, LinearMipmapLinearFilter, RedFormat} from 'three/webgpu'

import {maximumArtworkEdge} from '#src/lib/gallery/imagePolicy.ts'
import {trackLoadingPromise} from '#src/lib/loadingItems.ts'

import {ground} from './knifeStrokes.ts'

/** how many pixels a meter of the picture is shrunk to for the strokes to turn by */
const guideDensity = 70
/** how many texels of relief lie along a meter of the work, fine enough for the strokes’ bristles and lips, which are a few millimeters across */
const reliefDensity = 1600
/** the most texels a relief has, at a lower density on works larger than about 3.3 m², so the workers lay even their strokes in about half a second */
const reliefTexels = 2 ** 23
/** how many workers lay the strokes, each a band of rows of every relief */
const workerCount = Math.max(1, Math.min(4, navigator.hardwareConcurrency - 1))
/** the reliefs asked of the workers, by the id of their request: what takes each band of strokes as it arrives, and what gives up on the rest */
const requests = new Map<number, {
  lay: (bottom: number, strokes: Float16Array) => void
  settle: () => void
}>
let lastRequest = 0
let workers: Array<Worker> | undefined
/**
 * The height of the paint a palette knife lays on the image of the texture, which spans `size` on the work, 0 to 1 in one channel of half floats, see `layKnifeStrokes`, at `strokeSize` times the size its strokes were made at. The strokes are as large in meters on every work, so a larger one takes more of them. Their gentle slopes take finer steps of height than a byte holds, which would light up as terraces.
 *
 * Laying the strokes takes about a second of work, so up to four workers share it, each laying a band of rows: `relief` is flat bare ground at first and takes the strokes once `ready` resolves, a loading item meanwhile.
 */
export default function knifeRelief(map: Texture, size: ImageSize, strokeSize = 1) {
  // The artworks’ textures hold their decoded images as canvases.
  const image = map.image as HTMLCanvasElement
  // A large or panoramic work must neither ask for a texture longer than the artwork limit nor keep the workers for long, so it gets fewer texels per meter. A strip still gets at least one texel and guide pixel across.
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
  const field = new Float16Array(width * height)
  field.fill(ground)
  // A texture takes half floats by their bits.
  const relief = new DataTexture(new Uint16Array(field.buffer), width, height, RedFormat, HalfFloatType)
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
  const pool = strokeWorkers()
  const bands = Math.min(pool.length, height)
  // A loading item until then, which captures and the frozen world’s frames wait for.
  const ready = trackLoadingPromise(`knife-strokes:${id}`, new Promise<void>(resolve => {
    let missing = bands
    requests.set(id, {
      lay: (bottom, strokes) => {
        if (!disposed) {
          field.set(strokes, bottom * width)
        }
        missing--
        // The texture takes the strokes once they are all laid, so it uploads them only once.
        if (missing === 0) {
          requests.delete(id)
          relief.needsUpdate = !disposed
          resolve()
        }
      },
      settle: resolve,
    })
  }))
  for (let band = 0; band < bands; band++) {
    pool[band].postMessage({
      id,
      guide: {
        data: guide.data,
        width: guide.width,
        height: guide.height,
      },
      width,
      height,
      density,
      rows: [Math.round(band * height / bands), Math.round((band + 1) * height / bands)],
      size: strokeSize,
    })
  }
  return {
    relief,
    ready,
  }
}

/** The workers that lay the strokes, which start with the first relief and stay for the page. */
function strokeWorkers() {
  workers ??= Array.from({length: workerCount}, (_, index) => {
    const worker = new Worker(new URL('knifeStrokes.worker.ts', import.meta.url), {
      type: 'module',
      name: `knife-strokes-${index + 1}`,
    })
    worker.addEventListener('message', ({data}: MessageEvent<{
      bottom: number
      field: Float16Array
      id: number
    }>) => {
      requests.get(data.id)?.lay(data.bottom, data.field)
    })
    // The reliefs asked for so far stay flat.
    worker.addEventListener('error', event => {
      console.warn('The palette knife’s strokes could not be laid.', event.message)
      for (const {settle} of requests.values()) {
        settle()
      }
      requests.clear()
    })
    return worker
  })
  return workers
}

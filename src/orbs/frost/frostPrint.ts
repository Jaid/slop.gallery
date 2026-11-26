/** A worker owns the tinted source bitmap from dispatch until it has drawn it. */
export type PrintRequest = {
  image: ImageBitmap
  seed: number
}

/** One print per throw. Only a local Frost fusion loads the printer; it never stalls the portal’s animation to grow ice across a few hundred thousand pixels. */
export default async function frostPrint(paper: OffscreenCanvasRenderingContext2D, seed: number) {
  const worker = new Worker(new URL('frostPrint.worker.ts', import.meta.url), {
    type: 'module',
    name: 'frost-print',
  })
  try {
    const {promise, reject, resolve} = Promise.withResolvers<ImageBitmap>()
    worker.addEventListener('message', ({data}: MessageEvent<ImageBitmap>) => resolve(data))
    worker.addEventListener('error', event => reject(new Error(event.message)))
    worker.addEventListener('messageerror', () => reject(new Error('The frost print could not be read.')))
    const image = paper.canvas.transferToImageBitmap()
    worker.postMessage({
      image,
      seed,
    } satisfies PrintRequest, [image])
    const print = await promise
    try {
      paper.drawImage(print, 0, 0)
    } finally {
      print.close()
    }
  } finally {
    worker.terminate()
  }
}

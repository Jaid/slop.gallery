import type {CameraPose} from '#src/lib/diagnostics.ts'
import type {RenderFrame} from 'knot-materials/scripts/lib/renderSettings.ts'
import type {KnotScene} from 'knot-materials/scripts/renderKnot.ts'

import {endWarmup, installVirtualClock, waitForLoadingItems} from 'capture-session/script'
import {createKnotGeometry} from 'knot-materials/geometry.ts'
import {animationFps, frameSizes, previewCamera, previewDistance} from 'knot-materials/scripts/lib/renderSettings.ts'

import {openHeadlessGallery, resolveGallerySetup} from './headlessGallery.ts'

/** frames a still renders at its pose before the capture, so temporal antialiasing and filtering settle */
const stillSettleFrames = 16
const knotRadius = (displacement = 0) => {
  const geometry = createKnotGeometry()
  geometry.computeBoundingSphere()
  const sphere = geometry.boundingSphere!
  const radius = sphere.radius + sphere.center.length() + displacement
  geometry.dispose()
  return radius
}

/**
 * The knot alone in its own Knottingham room (`?knot_id`), held still (`?knot_rotation=false`) and reflecting the gallery’s environment (`?pmrem=slop_gallery`), rendered by the full game under the given graphics.
 * The camera takes the same views around the knot as in the transparent renders. Engine time only moves between animation frames, by the frames’ own steps, so stills settle and animations stay exact however slowly each frame renders.
 */
export const knottinghamScene = (graphics: 'cinematic' | 'heavy'): KnotScene => async (item, run) => {
  const [stillWidth, stillHeight] = frameSizes.still
  const setup = await resolveGallerySetup({
    graphics,
    height: String(stillHeight),
    // ?knot_id opens Knottingham on its own.
    knot_id: item.id,
    knot_rotation: 'false',
    pmrem: 'slop_gallery',
    seed: '1',
    width: String(stillWidth),
  })
  await using gallery = await openHeadlessGallery(setup, {
    cacheDir: 'node_modules/.vite-render-knot',
    initScripts: [installVirtualClock],
  })
  const {page} = gallery
  // The knot only enters once its shader has arrived, which can be after the loading screen.
  const center = await page.waitForFunction((id: string) => globalThis.slopGallery!.snapshot!().props.find(prop => prop.id === id)?.visualPosition, {timeout: 120_000}, `prop-knot-${item.id}`).then(handle => handle.jsonValue()).catch((error: unknown) => {
    throw new Error(`Knottingham did not exhibit ${item.id}.`, {cause: error})
  })
  if (!center) {
    throw new Error(`Knottingham did not exhibit ${item.id}.`)
  }
  const baseDistance = previewDistance(knotRadius(item.displacement))
  const pose = (frame: RenderFrame): Partial<CameraPose> => {
    const {fov, position: [x, y, z]} = previewCamera(frame, baseDistance)
    return {
      fov,
      position: [center[0] + x, center[1] + y, center[2] + z],
      rotation: [-Math.atan2(y, Math.hypot(x, z)), Math.atan2(x, z), 0],
    }
  }
  const received: Array<Uint8Array> = []
  // PNGs travel as request bodies; base64 through the DevTools protocol would cost more than rendering.
  const frameServer = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    maxRequestBodySize: 2 ** 30,
    async fetch(request) {
      received.push(await request.bytes())
      return new Response(null, {
        status: 204,
        headers: {'Access-Control-Allow-Origin': '*'},
      })
    },
  })
  try {
    // Everything loads at the warmup scale; the frames render at the full size, whose still frames settle at every pose anyway.
    await waitForLoadingItems(page)
    await endWarmup(page)
    await page.evaluate(() => {
      globalThis.virtualClock!.start()
      // Fiber measures its first frozen delta from the last wall-clock frame; this aligns it without capturing.
      globalThis.virtualClock!.step(0)
    })
    let size: RenderFrame['size'] | undefined
    let seconds: number | undefined
    await run(async frame => {
      const [frameWidth, frameHeight] = frameSizes[frame.size]
      const isResized = frame.size !== size
      if (isResized) {
        await page.setViewport({
          width: frameWidth,
          height: frameHeight,
          deviceScaleFactor: 1,
        })
        size = frame.size
      }
      // The inspection video wraps its preview time once; engine time keeps going forward by one frame instead.
      let delta = 0
      if (seconds !== undefined) {
        delta = frame.seconds >= seconds ? frame.seconds - seconds : 1 / animationFps
      }
      seconds = frame.seconds
      received.length = 0
      await page.evaluate(async (input: {
        delta: number
        height: number
        pose: Partial<CameraPose>
        settle: number
        url: string
        width: number
      }) => {
        const api = globalThis.slopGallery!
        const clock = globalThis.virtualClock!
        api.pose!(input.pose)
        clock.step(input.delta)
        const canvas = document.querySelector('canvas')!
        const deadline = Date.now() + 120_000
        // Resizes reach the canvas through a ResizeObserver; still frames render a few more times at the same moment.
        for (let index = 0; index < input.settle || canvas.width !== input.width || canvas.height !== input.height || api.snapshot!().loadingItems.length > 0; index++) {
          if (Date.now() > deadline) {
            throw new Error(`The canvas did not reach ${input.width}×${input.height} or finish loading within 2 minutes.`)
          }
          await new Promise(resolveDelay => setTimeout(resolveDelay, 10))
          clock.step(0)
        }
        const {image, width, height} = await api.captureFrame!()
        if (width !== input.width || height !== input.height) {
          throw new Error(`Captured ${width}×${height} instead of ${input.width}×${input.height}.`)
        }
        const response = await fetch(input.url, {
          method: 'POST',
          body: await image.arrayBuffer(),
        })
        if (!response.ok) {
          throw new Error(await response.text())
        }
      }, {
        delta,
        height: frameHeight,
        pose: pose(frame),
        settle: delta === 0 || isResized ? stillSettleFrames : 0,
        url: `http://127.0.0.1:${frameServer.port}/`,
        width: frameWidth,
      })
      const [image] = received
      if (received.length !== 1) {
        throw new Error('The page did not deliver exactly one frame.')
      }
      return image
    })
  } finally {
    await frameServer.stop(true)
  }
}

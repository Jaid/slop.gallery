import {pass, renderOutput, vec4} from 'three/tsl'
import {Color, PerspectiveCamera, RenderPipeline, Scene, WebGPURenderer} from 'three/webgpu'
import WebgpuCapture from 'webgpu-capture-bridge'

import {MoodVignettes, moodVignettes} from '../../src/lib/rendering/moodVignettes.ts'
import {moods} from '../../src/moods/index.ts'

/** Verify native WebGPU rendering and capture together, without touching the game page. */
export default async function verifyMoodVignette() {
  const renderer = new WebGPURenderer({canvas: document.createElement('canvas')})
  await renderer.init()
  const {device} = renderer.backend as typeof renderer.backend & {device: GPUDevice}
  const errors: Array<string> = []
  device.addEventListener('uncapturederror', event => errors.push(event.error.message))
  const scene = new Scene
  scene.background = new Color('#6e757f')
  const camera = new PerspectiveCamera
  const scenePass = pass(scene, camera, {samples: 0})
  const pipeline = new RenderPipeline(renderer, moodVignettes.compose(renderOutput(scenePass)))
  pipeline.outputColorTransform = false
  const capture = new WebgpuCapture({
    renderer,
    scene,
    camera,
    pipeline,
  })
  const plain = new WebgpuCapture({
    renderer,
    scene,
    camera,
  })
  const draw = async (amount: number, reveal: number) => {
    moodVignettes.show([{
      amount,
      reveal,
      vignette: moods.paint.vignette,
    }])
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    const {pixels} = await capture.capturePixels()
    return pixels
  }
  try {
    const formats = []
    for (const [width, height] of [[641, 361], [361, 641], [721, 311]]) {
      renderer.setSize(width, height, false)
      const empty = await draw(0, 0)
      const {pixels: direct} = await plain.capturePixels()
      assert(empty.every((byte, index) => byte === direct[index]), 'The light pipeline changed the unpainted frame.')
      const early = await draw(1, 0.27)
      const full = await draw(1, 1)
      const fading = await draw(0.5, 1)
      const cleared = await draw(0, 1)
      let started = 0
      let painted = 0
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4
          const delta = (frame: Uint8ClampedArray) => Math.max(Math.abs(frame[i] - empty[i]), Math.abs(frame[i + 1] - empty[i + 1]), Math.abs(frame[i + 2] - empty[i + 2]))
          const spread = delta(full)
          started += Number(delta(early) > 8)
          painted += Number(spread > 8)
          assert(full[i + 3] === empty[i + 3], 'The overlay wrote to scene alpha.')
          if (x > width * 0.3 && x < width * 0.7 && y > height * 0.3 && y < height * 0.7) {
            assert(spread === 0, 'Paint reached the central view.')
          }
          assert(Math.abs(spread / 2 - delta(fading)) <= 1, 'A fade-out must lower opacity, not move the paint.')
        }
      }
      assert(cleared.every((byte, index) => byte === empty[index]), 'Paint remained after the mood left.')
      assert(started > 0 && started < painted * 0.7 && painted < width * height * 0.24, `Unexpected paint coverage (${started} early, ${painted} finished).`)
      formats.push({
        width,
        height,
        started,
        painted,
      })
    }
    // A registry’s order can differ from the actual room/cast stack. A second shader must draw on top when requested, whichever one it is.
    const red = () => vec4(1, 0, 0, 1)
    const green = () => vec4(0, 1, 0, 1)
    const stack = new MoodVignettes([red, green])
    const solid = new RenderPipeline(renderer, stack.compose(vec4(0, 0, 1, 1)))
    solid.outputColorTransform = false
    using layers = new WebgpuCapture({
      renderer,
      scene,
      camera,
      pipeline: solid,
    })
    try {
      for (const [under, over, channel] of [[green, red, 0], [red, green, 1]] as const) {
        stack.show([under, over].map(vignette => ({
          amount: 1,
          reveal: 1,
          vignette,
        })))
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
        const {pixels} = await layers.capturePixels()
        assert(pixels[channel] === 255 && pixels[1 - channel] === 0, 'Vignettes did not follow the mixer’s draw order.')
      }
    } finally {
      solid.dispose()
    }
    assert(errors.length === 0, errors.join('\n'))
    return formats
  } finally {
    moodVignettes.show([])
    capture.dispose()
    plain.dispose()
    pipeline.dispose()
    scenePass.dispose()
    await renderer.dispose()
  }
}

function assert(value: unknown, message: string): asserts value {
  if (!value) {
    throw new Error(message)
  }
}

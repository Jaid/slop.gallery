import type {AntiAliasing} from '../../src/lib/rendering/antiAliasing.ts'

import {Color, CylinderGeometry, DataUtils, HalfFloatType, Mesh, MeshBasicNodeMaterial, PerspectiveCamera, RenderTarget, Scene, SphereGeometry, WebGPURenderer} from 'three/webgpu'

import GalleryRenderPipeline from '../../src/lib/rendering/GalleryRenderPipeline.ts'
import {graphicsProfiles} from '../../src/lib/rendering/graphicsMode.ts'
import {getRenderPipelineSettings} from '../../src/lib/rendering/renderPipelineSettings.ts'

// Heavy graphics, without the dither, which would add noise to the measured pixels.
const getSettings = (antiAliasing: AntiAliasing) => ({
  ...getRenderPipelineSettings(graphicsProfiles.heavy, antiAliasing),
  dither: false,
})
const width = 320
const height = 192
const frames = 32
type Pixels = Awaited<ReturnType<WebGPURenderer['readRenderTargetPixelsAsync']>>
function assert(value: unknown, message: string): asserts value {
  if (!value) {
    throw new Error(message)
  }
}
function channel(pixels: Pixels, index: number) {
  return pixels instanceof Uint16Array ? DataUtils.fromHalfFloat(pixels[index]) : pixels[index]
}
function decode(pixels: Pixels) {
  // WebGPU readbacks retain 256-byte row padding.
  const stride = Math.ceil(width * 4 * pixels.BYTES_PER_ELEMENT / 256) * 256 / pixels.BYTES_PER_ELEMENT
  const output = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * stride + x * 4
      output[y * width + x] = channel(pixels, i) * 0.2126 + channel(pixels, i + 1) * 0.7152 + channel(pixels, i + 2) * 0.0722
    }
  }
  return output
}
/** Subpixel HDR features: thin emissive filaments and specks, like flames, sparkles and glowing knot veins. */
function buildScene() {
  const scene = new Scene
  scene.background = new Color(0.02, 0.02, 0.025)
  const disposables: Array<{dispose: () => void}> = []
  const hot = new MeshBasicNodeMaterial({color: new Color(12, 9, 6)})
  disposables.push(hot)
  for (let index = 0; index < 9; index++) {
    const filament = new CylinderGeometry(0.0035, 0.0035, 2.4, 6)
    disposables.push(filament)
    const mesh = new Mesh(filament, hot)
    mesh.position.set(-2.6 + index * 0.65, 0, 0)
    mesh.rotation.z = 0.15 + index * 0.21
    scene.add(mesh)
  }
  const speck = new SphereGeometry(0.006, 8, 6)
  disposables.push(speck)
  for (let index = 0; index < 24; index++) {
    const mesh = new Mesh(speck, hot)
    mesh.position.set(Math.sin(index * 2.39) * 2.8, Math.cos(index * 1.71) * 1.5, 0.3)
    scene.add(mesh)
  }
  const camera = new PerspectiveCamera(50, width / height, 0.05, 90)
  camera.position.z = 6
  return {
    scene,
    camera,
    dispose: () => {
      for (const item of disposables) {
        item.dispose()
      }
    },
  }
}
async function measure(renderer: WebGPURenderer, antiAliasing: AntiAliasing) {
  const {scene, camera, dispose} = buildScene()
  const pipeline = new GalleryRenderPipeline(renderer, scene, camera, {
    heavy: true,
    settings: getSettings(antiAliasing),
  })
  pipeline.outputColorTransform = false
  const target = new RenderTarget(width, height, {
    type: HalfFloatType,
    depthBuffer: false,
  })
  try {
    renderer.setSize(width, height, false)
    renderer.setOutputRenderTarget(target)
    renderer.setRenderTarget(target)
    const render = async () => {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      pipeline.render()
    }
    for (let frame = 0; frame < 48; frame++) {
      await render()
    }
    const sum = new Float64Array(width * height)
    const squares = new Float64Array(width * height)
    const geometry = new Uint8Array(width * height)
    for (let frame = 0; frame < frames; frame++) {
      await render()
      const output = decode(await renderer.readRenderTargetPixelsAsync(target, 0, 0, width, height))
      const raw = decode(await renderer.readRenderTargetPixelsAsync(pipeline.scenePass.renderTarget, 0, 0, width, height))
      for (const [i, element] of output.entries()) {
        sum[i] += element
        squares[i] += element ** 2
        if (raw[i] > 0.1) {
          geometry[i] = 1
        }
      }
    }
    // Halo = pixels no frame ever rasterized geometry into, within 5 px of it, so only bloom can light them.
    let haloPixels = 0
    let glow = 0
    let deviation = 0
    let worstDeviation = 0
    for (let y = 6; y < height - 6; y++) {
      for (let x = 6; x < width - 6; x++) {
        const i = y * width + x
        if (geometry[i]) {
          continue
        }
        let near = false
        for (let dy = -5; dy <= 5 && !near; dy++) {
          for (let dx = -5; dx <= 5 && !near; dx++) {
            near = geometry[i + dy * width + dx] === 1
          }
        }
        if (!near) {
          continue
        }
        const mean = sum[i] / frames
        const sigma = Math.sqrt(Math.max(0, squares[i] / frames - mean ** 2))
        haloPixels++
        glow += mean
        deviation += sigma
        worstDeviation = Math.max(worstDeviation, sigma)
      }
    }
    assert(haloPixels > 500, 'The fixture produced no halo region.')
    return {
      antiAliasing,
      haloPixels,
      meanGlow: glow / haloPixels,
      meanTemporalDeviation: deviation / haloPixels,
      relativeFlicker: deviation / glow,
      worstDeviation,
    }
  } finally {
    renderer.setOutputRenderTarget(null)
    renderer.setRenderTarget(null)
    pipeline.dispose()
    target.dispose()
    dispose()
  }
}
/** Mean halo 4–10 px around a speck about one pixel wide, like a sharp clearcoat highlight that a rotating knot moves on and off a pixel. */
async function measureSpeck(renderer: WebGPURenderer, brightness: number) {
  const scene = new Scene
  scene.background = new Color(0.02, 0.02, 0.025)
  const geometry = new SphereGeometry(0.03, 8, 6)
  const material = new MeshBasicNodeMaterial({color: new Color(brightness, brightness, brightness)})
  scene.add(new Mesh(geometry, material))
  const camera = new PerspectiveCamera(50, width / height, 0.05, 90)
  camera.position.z = 6
  const pipeline = new GalleryRenderPipeline(renderer, scene, camera, {
    heavy: true,
    settings: getSettings(false),
  })
  pipeline.outputColorTransform = false
  const target = new RenderTarget(width, height, {
    type: HalfFloatType,
    depthBuffer: false,
  })
  try {
    renderer.setSize(width, height, false)
    renderer.setOutputRenderTarget(target)
    renderer.setRenderTarget(target)
    for (let frame = 0; frame < 8; frame++) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      pipeline.render()
    }
    const output = decode(await renderer.readRenderTargetPixelsAsync(target, 0, 0, width, height))
    let halo = 0
    let count = 0
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const distance = Math.hypot(x + 0.5 - width / 2, y + 0.5 - height / 2)
        if (!(distance >= 4 && distance <= 10)) {
          continue
        }
        halo += output[y * width + x]
        count++
      }
    }
    return halo / count
  } finally {
    renderer.setOutputRenderTarget(null)
    renderer.setRenderTarget(null)
    pipeline.dispose()
    target.dispose()
    geometry.dispose()
    material.dispose()
  }
}
/** Detached native GPU check: a perfectly still scene must produce a still bloom halo, and a lone firefly must not flash an oversized one. No input, navigation or visible canvases. */
async function verifyBloomStability() {
  const renderer = new WebGPURenderer({
    canvas: document.createElement('canvas'),
    antialias: false,
  })
  const errors: Array<string> = []
  try {
    await renderer.init()
    const {device} = renderer.backend as typeof renderer.backend & {device: GPUDevice}
    device.addEventListener('uncapturederror', event => errors.push(event.error.message))
    const none = await measure(renderer, false)
    const traa = await measure(renderer, 'traa')
    const glowSpeck = await measureSpeck(renderer, 16)
    const firefly = await measureSpeck(renderer, 2000)
    await device.queue.onSubmittedWorkDone()
    assert(errors.length === 0, errors.join('\n'))
    for (const result of [none, traa]) {
      assert(result.meanGlow > 0.005, `The halo lost its bloom: ${JSON.stringify(result)}`)
      // Jittered bloom input measured 10.3%; resolved input 0.1%.
      assert(result.relativeFlicker < 0.01, `A still scene produced a flickering halo: ${JSON.stringify(result)}`)
    }
    // The background alone measures about 0.02.
    assert(glowSpeck > 0.03, `A glowing speck lost its bloom: ${glowSpeck}`)
    // Without the luminance cap, the firefly halo measured 3.25 instead of 0.073 (glowing speck: 0.046).
    assert(firefly < glowSpeck * 2, `A firefly flashed an oversized halo: ${firefly} vs ${glowSpeck}`)
    return {
      none,
      traa,
      speckHalo: {
        glowSpeck,
        firefly,
      },
    }
  } finally {
    await renderer.dispose()
  }
}

export default verifyBloomStability

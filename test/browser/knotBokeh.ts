import type {AntiAliasing} from '../../src/lib/rendering/antiAliasing.ts'

import {float, perspectiveDepthToViewZ, texture, uniform} from 'three/tsl'
import {Color, DataTexture, DataUtils, FloatType, HalfFloatType, LinearFilter, Mesh, MeshBasicNodeMaterial, NearestFilter, NodeMaterial, PerspectiveCamera, PlaneGeometry, QuadMesh, RenderTarget, RGBAFormat, Scene, TorusGeometry, WebGPURenderer} from 'three/webgpu'

import GalleryRenderPipeline from '../../src/lib/rendering/GalleryRenderPipeline.ts'
import {graphicsProfiles} from '../../src/lib/rendering/graphicsMode.ts'
import KnotBokeh from '../../src/lib/rendering/KnotBokeh.ts'
import {getRenderPipelineSettings} from '../../src/lib/rendering/renderPipelineSettings.ts'

// Heavy graphics, without the dither, which would add noise to the measured pixels.
const getSettings = (antiAliasing: AntiAliasing) => ({
  ...getRenderPipelineSettings(graphicsProfiles.heavy, antiAliasing),
  dither: false,
})
function assert(value: unknown, message: string): asserts value {
  if (!value) {
    throw new Error(message)
  }
}
function decode(pixels: Awaited<ReturnType<WebGPURenderer['readRenderTargetPixelsAsync']>>, width: number, height: number) {
  // WebGPU readbacks retain 256-byte row padding, including on odd-sized render targets.
  const stride = Math.ceil(width * 4 * pixels.BYTES_PER_ELEMENT / 256) * 256 / pixels.BYTES_PER_ELEMENT
  const output = new Float32Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width * 4; x++) {
      const value = pixels[y * stride + x]
      output[y * width * 4 + x] = pixels instanceof Uint16Array ? DataUtils.fromHalfFloat(value) : value
    }
  }
  return output
}
async function renderFrame(pipeline: GalleryRenderPipeline) {
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  pipeline.render()
}
async function verifySpatial(renderer: WebGPURenderer) {
  const width = 256
  const height = 128
  renderer.setSize(width, height, false)
  const colorData = new Float32Array(width * height * 4)
  const depthData = new Float32Array(width * height * 4)
  const near = 0.05
  const far = 90
  const fill = (allForeground = false) => {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const r = Math.hypot(x - 145, y - 64)
        const foreground = allForeground || r > 23 && r < 51
        const i = (y * width + x) * 4
        colorData.set(foreground ? [0.05, 4, 4, 1] : [0.2, 0, 0, 1], i)
        const distance = foreground ? 2 : 8
        depthData.set([far / (far - near) - far * near / ((far - near) * distance), 0, 0, 1], i)
      }
    }
  }
  fill()
  const colorMap = new DataTexture(colorData, width, height, RGBAFormat, FloatType)
  colorMap.minFilter = LinearFilter
  colorMap.magFilter = LinearFilter
  colorMap.needsUpdate = true
  const depthMap = new DataTexture(depthData, width, height, RGBAFormat, FloatType)
  depthMap.minFilter = NearestFilter
  depthMap.magFilter = NearestFilter
  depthMap.needsUpdate = true
  const amount = uniform(1)
  const radius = uniform(26)
  const effect = new KnotBokeh(texture(colorMap), perspectiveDepthToViewZ(texture(depthMap).r, float(near), float(far)), {
    amount,
    radius,
    distance: float(3),
    enabled: () => amount.value > 0,
  })
  const material = new NodeMaterial
  material.fragmentNode = effect.outputNode
  const quad = new QuadMesh(material)
  const target = new RenderTarget(width, height, {
    type: HalfFloatType,
    depthBuffer: false,
  })
  const sample = async () => {
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    renderer.setRenderTarget(target)
    quad.render(renderer)
    return decode(await renderer.readRenderTargetPixelsAsync(target, 0, 0, width, height), width, height)
  }
  try {
    const cases: Array<{
      amount: number
      maximumBackgroundError: number
      maximumLeak: number
      radius: number
    }> = []
    for (const focusAmount of [0, 0.1, 0.5, 1, 0, 1]) {
      for (const blurRadius of [8, 26, 34]) {
        amount.value = focusAmount
        radius.value = blurRadius
        const pixels = await sample()
        let maximumLeak = 0
        let maximumBackgroundError = 0
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const r = Math.hypot(x - 145, y - 64)
            if (r > 23 && r < 51) {
              continue
            }
            const i = (y * width + x) * 4
            maximumLeak = Math.max(maximumLeak, pixels[i + 2])
            maximumBackgroundError = Math.max(maximumBackgroundError, Math.abs(pixels[i] - 0.2))
          }
        }
        assert(maximumLeak < 0.001, `Foreground contaminated background: ${maximumLeak}`)
        assert(maximumBackgroundError < 0.001, `Normalization produced a dark or bright fringe: ${maximumBackgroundError}`)
        assert(pixels[(64 * width + 182) * 4 + 2] > 3.9, 'Focused foreground was lost or dimmed.')
        assert(pixels.every(Number.isFinite), 'Empty coverage produced NaN/Infinity.')
        cases.push({
          amount: focusAmount,
          radius: blurRadius,
          maximumLeak,
          maximumBackgroundError,
        })
      }
    }
    fill(true)
    colorMap.needsUpdate = true
    depthMap.needsUpdate = true
    const emptyBackground = await sample()
    assert(emptyBackground.every(Number.isFinite), 'All-foreground image produced invalid normalization.')
    assert(emptyBackground[2] > 3.9, 'No-background fallback did not retain the focused scene.')
    // A real background emitter must still expand into the same six-bladed aperture.
    colorData.fill(0)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4
        const light = Math.abs(x - 128) <= 2 && Math.abs(y - 64) <= 2
        colorData.set(light ? [4, 4, 4, 1] : [0, 0, 0, 1], i)
        depthData.set([far / (far - near) - far * near / ((far - near) * 8), 0, 0, 1], i)
      }
    }
    colorMap.needsUpdate = true
    depthMap.needsUpdate = true
    radius.value = 26
    amount.value = 1
    const highlights = await sample()
    let expandedHighlights = 0
    let outsideAperture = 0
    let horizontalRadius = 0
    let verticalRadius = 0
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (highlights[(y * width + x) * 4 + 1] < 0.02) {
          continue
        }
        const dx = Math.abs(x - 128)
        const dy = Math.abs(y - 64)
        expandedHighlights += Number(dx > 3 || dy > 3)
        horizontalRadius = Math.max(horizontalRadius, dx)
        verticalRadius = Math.max(verticalRadius, dy)
        outsideAperture += Number(dx + dy / Math.sqrt(3) > 31 || dy > 28)
      }
    }
    assert(expandedHighlights > 500, 'The background light was not defocused.')
    assert(outsideAperture === 0, 'Highlight escaped the six-bladed aperture footprint.')
    return {
      cases,
      emptyBackground: 'finite and sharp',
      highlights: {
        expandedHighlights,
        outsideAperture,
        horizontalRadius,
        verticalRadius,
      },
    }
  } finally {
    renderer.setRenderTarget(null)
    target.dispose()
    effect.dispose()
    material.dispose()
    colorMap.dispose()
    depthMap.dispose()
  }
}
async function verifyTemporal(renderer: WebGPURenderer) {
  let width = 320
  let height = 192
  renderer.setSize(width, height, false)
  const scene = new Scene
  scene.background = new Color(0.2, 0, 0)
  const camera = new PerspectiveCamera(50, width / height, 0.05, 90)
  camera.position.z = 6
  const geometry = new TorusGeometry(1.2, 0.35, 32, 128)
  const material = new MeshBasicNodeMaterial
  material.colorNode = uniform(new Color(0.05, 4, 4))
  const mesh = new Mesh(geometry, material)
  scene.add(mesh)
  const wallGeometry = new PlaneGeometry(40, 40)
  const wallMaterial = new MeshBasicNodeMaterial({color: new Color(0.2, 0, 0)})
  const wall = new Mesh(wallGeometry, wallMaterial)
  wall.position.z = -5
  scene.add(wall)
  let focusAmount = 1
  const pipeline = new GalleryRenderPipeline(renderer, scene, camera, {
    settings: getSettings('traa'),
    focus: {
      amount: () => focusAmount,
      distance: () => 7.6,
      proximity: () => 1,
    },
    heavy: true,
  })
  pipeline.outputColorTransform = false
  const target = new RenderTarget(width, height, {
    type: HalfFloatType,
    depthBuffer: false,
  })
  try {
    renderer.setOutputRenderTarget(target)
    renderer.setRenderTarget(target)
    const observations: Array<{
      antialiasedPixels: number
      contaminated: number
      maximumLeak: number
      stage: string
    }> = []
    const observe = async (stage: string) => {
      const pixels = decode(await renderer.readRenderTargetPixelsAsync(target, 0, 0, width, height), width, height)
      const raw = decode(await renderer.readRenderTargetPixelsAsync(pipeline.scenePass.renderTarget, 0, 0, width, height), width, height)
      let maximumLeak = 0
      let contaminated = 0
      let antialiasedPixels = 0
      for (let y = 4; y < height - 4; y++) {
        for (let x = 4; x < width - 4; x++) {
          const i = (y * width + x) * 4
          let foregroundNearby = false
          for (let dy = -3; dy <= 3; dy++) {
            for (let dx = -3; dx <= 3; dx++) {
              if (raw[((y + dy) * width + x + dx) * 4 + 2] > 0.01) {
                foregroundNearby = true
              }
            }
          }
          if (foregroundNearby) {
            if (pixels[i + 2] > 0.01 && pixels[i + 2] < 3.5) {
              antialiasedPixels++
            }
          } else {
            maximumLeak = Math.max(maximumLeak, pixels[i + 2])
            contaminated += Number(pixels[i + 2] > 0.01)
          }
        }
      }
      assert(pixels.every(Number.isFinite), 'Temporal composite produced invalid color.')
      observations.push({
        stage,
        maximumLeak,
        contaminated,
        antialiasedPixels,
      })
    }
    for (let frame = 0; frame < 40; frame++) {
      await renderFrame(pipeline)
    }
    await observe('stationary')
    for (let frame = 0; frame < 32; frame++) {
      mesh.position.x = Math.sin(frame * 0.12) * 0.45
      mesh.rotation.y = Math.sin(frame * 0.1) * 0.4
      await renderFrame(pipeline)
      if (frame % 8 === 7) {
        await observe(`motion-${frame}`)
      }
    }
    focusAmount = 0
    for (let frame = 0; frame < 4; frame++) {
      await renderFrame(pipeline)
    }
    focusAmount = 1
    for (let frame = 0; frame < 32; frame++) {
      await renderFrame(pipeline)
    }
    await observe('reactivated')
    for (let frame = 0; frame < 24; frame++) {
      camera.position.x = Math.sin(frame * 0.15) * 0.6
      camera.lookAt(0, 0, 0)
      await renderFrame(pipeline)
      if (frame % 8 === 7) {
        await observe(`camera-${frame}`)
      }
    }
    width = 257
    height = 129
    renderer.setSize(width, height, false)
    target.setSize(width, height)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    for (let frame = 0; frame < 12; frame++) {
      await renderFrame(pipeline)
    }
    await observe('resized-odd')
    for (const observation of observations) {
      assert(observation.maximumLeak < 0.01, `Temporal edge leaked beyond its reconstruction footprint: ${JSON.stringify(observation)}`)
      assert(observation.antialiasedPixels > 20, 'The final composite lost antialiased coverage.')
    }
    return observations
  } finally {
    renderer.setOutputRenderTarget(null)
    renderer.setRenderTarget(null)
    pipeline.dispose()
    target.dispose()
    geometry.dispose()
    material.dispose()
    wallGeometry.dispose()
    wallMaterial.dispose()
  }
}
/** Count real submissions, not shader blend weights: zero-weight effects must do no GPU work. */
async function verifyModes(renderer: WebGPURenderer) {
  renderer.setSize(128, 96, false)
  const scene = new Scene
  scene.background = new Color(0.2, 0, 0)
  const camera = new PerspectiveCamera(50, 128 / 96, 0.05, 90)
  camera.position.z = 6
  const geometry = new TorusGeometry(1.2, 0.35, 16, 64)
  const material = new MeshBasicNodeMaterial({color: new Color(0.05, 4, 4)})
  scene.add(new Mesh(geometry, material))
  const target = new RenderTarget(128, 96, {
    type: HalfFloatType,
    depthBuffer: false,
  })
  // Preserve the exact method for restoration; the wrapper explicitly supplies its receiver.
  // eslint-disable-next-line typescript/unbound-method
  const render = renderer.render
  const submissions: Array<string> = []
  renderer.render = function (object, view) {
    submissions.push(object.name)
    return render.call(this, object, view)
  }
  const observations: Array<{
    antiAliasing: AntiAliasing
    aperture: number
    focus: number
    gaussian: number
    source: number
    zoom: number
  }> = []
  try {
    renderer.setOutputRenderTarget(target)
    renderer.setRenderTarget(target)
    for (const antiAliasing of [false, 'traa'] as const) {
      let zoom = 0
      let focus = 0
      const pipeline = new GalleryRenderPipeline(renderer, scene, camera, {
        settings: getSettings(antiAliasing),
        zoom: () => zoom,
        focus: {
          amount: () => focus,
          distance: () => 3,
          proximity: () => 1,
        },
      })
      pipeline.outputColorTransform = false
      try {
        // Includes first-frame inactivity, both transition tails, simultaneous modes,
        // exit/re-entry, and a resize while both effects are sleeping.
        for (const [nextZoom, nextFocus] of [[0, 0], [1, 0], [0.01, 0], [0, 0], [0, 1], [0, 0.01], [1, 1], [0, 0], [1, 1], [0, 0]]) {
          zoom = nextZoom
          focus = nextFocus
          submissions.length = 0
          await renderFrame(pipeline)
          const gaussian = submissions.filter(name => name.startsWith('Gaussian Blur')).length
          const aperture = submissions.filter(name => name.startsWith('knotApertureGather')).length
          const source = submissions.filter(name => name.startsWith('zoomSource')).length
          assert(gaussian === (zoom > 0 ? 2 : 0), `Zoom Gaussian pass gating failed: ${JSON.stringify(submissions)}`)
          assert(aperture === (focus > 0 ? 1 : 0), `V-view aperture gating failed: ${JSON.stringify(submissions)}`)
          assert(submissions.filter(name => name.startsWith('knotFocusSource')).length === (focus > 0 ? 1 : 0), 'V-view isolation gating failed.')
          assert(source === (!antiAliasing && zoom > 0 ? 1 : 0), 'Zoom-only materialization gating failed.')
          const pixels = decode(await renderer.readRenderTargetPixelsAsync(target, 0, 0, target.width, target.height), target.width, target.height)
          assert(pixels.every(Number.isFinite), 'Mode transition produced invalid pixels.')
          assert(pixels.some((value, index) => index % 4 === 2 && value > 1), 'Mode transition lost the current scene.')
          observations.push({
            antiAliasing,
            zoom,
            focus,
            gaussian,
            aperture,
            source,
          })
          if (!(zoom === 0 && focus === 0)) {
            continue
          }
          renderer.setSize(129, 97, false)
          target.setSize(129, 97)
          camera.aspect = 129 / 97
          camera.updateProjectionMatrix()
        }
      } finally {
        pipeline.dispose()
      }
    }
    return observations
  } finally {
    renderer.render = render
    renderer.setOutputRenderTarget(null)
    renderer.setRenderTarget(null)
    target.dispose()
    geometry.dispose()
    material.dispose()
  }
}
/** Detached native GPU tests: no input, navigation, focus, live scene edits or visible canvases. */
async function verifyKnotBokeh() {
  const renderer = new WebGPURenderer({
    canvas: document.createElement('canvas'),
    antialias: false,
  })
  const errors: Array<string> = []
  try {
    await renderer.init()
    const {device} = renderer.backend as typeof renderer.backend & {device: GPUDevice}
    device.addEventListener('uncapturederror', event => errors.push(event.error.message))
    const spatial = await verifySpatial(renderer)
    const temporal = await verifyTemporal(renderer)
    const modes = await verifyModes(renderer)
    await device.queue.onSubmittedWorkDone()
    assert(errors.length === 0, errors.join('\n'))
    return {
      spatial,
      temporal,
      modes,
      errors,
    }
  } catch (error) {
    throw new Error(`${String(error)}\nGPU errors: ${JSON.stringify(errors.slice(0, 5))}`)
  } finally {
    await renderer.dispose()
  }
}

export default verifyKnotBokeh

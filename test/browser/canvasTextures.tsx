import type {Texture} from 'three/webgpu'

import {createRoot as createFiberRoot, extend, unmountComponentAtNode} from '@react-three/fiber'
import renderCanvasTexture from 'canvas-textures/three'
import useDisposable from 'disposable-lifetime/react'
import hsl from 'okhsl'
import {StrictMode, useEffect, useMemo} from 'react'
import {createRoot} from 'react-dom/client'
import {Color, Mesh, MeshBasicNodeMaterial, OrthographicCamera, PlaneGeometry, RenderTarget, SRGBColorSpace, WebGPURenderer} from 'three/webgpu'

/** No page navigation, attached DOM, input, focus, or app viewport changes. */
export default async function verifyCanvasTextures() {
  let owned: Texture<HTMLCanvasElement> | undefined
  let setups = 0
  let cleanups = 0
  function Owner() {
    const texture = useDisposable(useMemo(() => renderCanvasTexture({
      width: 4,
      height: 4,
      mipmaps: false,
      draw(context) {
        context.fillStyle = '#ff0000'
        context.fillRect(0, 0, 4, 2)
        context.fillStyle = '#00ff00'
        context.fillRect(0, 2, 2, 2)
        context.fillStyle = 'rgba(255, 0, 0, 0.5)'
        context.fillRect(2, 2, 2, 2)
      },
    }), []))
    useEffect(() => {
      owned = texture
      setups++
      return () => {
        cleanups++
      }
    }, [texture])
    return null
  }
  const owner = createRoot(document.createElement('div'))
  const canvas = document.createElement('canvas')
  const renderer = new WebGPURenderer({
    canvas,
    antialias: false,
  })
  // RGBA8 rows are 256-byte aligned in Three's raw WebGPU readback.
  const renderWidth = 64
  const target = new RenderTarget(renderWidth, 4)
  target.texture.colorSpace = SRGBColorSpace
  let unmountFiber: (() => Promise<void>) | undefined
  const errors: Array<string> = []
  try {
    owner.render(<StrictMode><Owner /></StrictMode>)
    await until(() => setups === 2)
    assert(cleanups === 1, 'StrictMode did not replay the ownership effect.')
    assert(owned?.image.width === 4, 'StrictMode destroyed the live canvas.')
    await renderer.init()
    const backend = renderer.backend as typeof renderer.backend & {device: GPUDevice}
    backend.device.addEventListener('uncapturederror', event => errors.push(event.error.message))
    extend({
      Mesh,
      MeshBasicNodeMaterial,
      PlaneGeometry,
    })
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
    camera.position.z = 2
    Object.assign(camera, {manual: true})
    const root = createFiberRoot(canvas)
    await root.configure({
      renderer,
      camera,
      frameloop: 'never',
      dpr: 1,
      size: {
        width: renderWidth,
        height: 4,
        top: 0,
        left: 0,
      },
    })
    unmountFiber = () => new Promise(resolve => unmountComponentAtNode(canvas, () => resolve()))
    function Plane({texture}: {texture: Texture | null}) {
      return <mesh>
        <planeGeometry args={[2, 2]} />
        <meshBasicNodeMaterial key={texture?.uuid ?? 'pending'} map={texture} toneMapped={false} transparent />
      </mesh>
    }
    const store = root.render(<Plane texture={null} />)
    const scene = store.getState().scene
    scene.background = new Color(hsl.integer(264.06, 100, 36.6))
    await until(() => scene.children.some(child => child instanceof Mesh))
    renderer.setRenderTarget(target)
    renderer.render(scene, camera)
    await renderer.readRenderTargetPixelsAsync(target, 0, 0, renderWidth, 4)
    const oldMaterial = (scene.children.find(child => child instanceof Mesh) as Mesh).material
    root.render(<Plane texture={owned} />)
    await until(() => (scene.children.find(child => child instanceof Mesh) as Mesh).material !== oldMaterial)
    renderer.render(scene, camera)
    const pixels = await renderer.readRenderTargetPixelsAsync(target, 0, 0, renderWidth, 4)
    const red = [...pixels.slice(0, 4)]
    const green = [...pixels.slice(3 * renderWidth * 4, 3 * renderWidth * 4 + 4)]
    const blend = [...pixels.slice((4 * renderWidth - 1) * 4, 4 * renderWidth * 4)]
    assert(red[0] > 245 && red[1] < 5 && red[2] < 5, `Top canvas pixels did not render red: ${JSON.stringify({
      red,
      green,
      blend,
    })}`)
    assert(green[0] < 5 && green[1] > 245 && green[2] < 5, `Bottom canvas pixels did not render green: ${JSON.stringify({
      red,
      green,
      blend,
      length: pixels.length,
    })}`)
    assert(blend[0] > 100 && blend[2] > 100 && blend[1] < 5, 'Canvas alpha did not blend over the blue background.')
    assert(errors.length === 0, errors.join('\n'))
    await unmountFiber()
    unmountFiber = undefined
    owner.unmount()
    await Promise.resolve()
    // Read the width as a plain number again; the StrictMode assertion above narrowed it to 4.
    const releasedCanvasWidth: number = owned.image.width
    assert(releasedCanvasWidth === 0, 'Final owner unmount did not release canvas storage.')
    return {
      setups,
      cleanups,
      red,
      green,
      blend,
      errors,
    }
  } finally {
    await unmountFiber?.()
    owner.unmount()
    target.dispose()
    await renderer.dispose()
  }
}
function assert(value: unknown, message: string): asserts value {
  if (!value) {
    throw new Error(message)
  }
}
async function until(test: () => boolean) {
  const deadline = performance.now() + 10_000
  while (!test()) {
    assert(performance.now() < deadline, 'Browser fixture timed out.')
    await new Promise(resolve => setTimeout(resolve, 10))
  }
}

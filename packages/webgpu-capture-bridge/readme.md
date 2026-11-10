# WebGPU Capture Bridge

On-demand frame capture for Three.js WebGPU renderers, with optional React Three Fiber bindings. No gallery globals, app imports, animation loop or browser work on import.

Targets Three r187 (`three@^0.187.0`). The renderer belongs to the caller; wait for pending captures before awaiting `renderer.dispose()` during application teardown.

## Three.js

```typescript
import WebgpuCapture from 'webgpu-capture-bridge'

await renderer.init()

const capture = new WebgpuCapture({
  renderer,
  scene,
  camera,
})

try {
  const frame = await capture.captureFrame()
  console.log(frame.image, frame.width, frame.height)
} finally {
  capture.dispose()
}
```

For postprocessing, pass `pipeline`, a Three `RenderPipeline` owned by the same renderer. Native WebGPU is required; renderers using Three’s WebGL fallback are rejected. Initialize the renderer before capturing. The service does not own or dispose your renderer, scene or pipeline.

Pass `around` to wrap every capture’s render, a function `(render, camera) => void` that calls `render` exactly once and synchronously: whatever your own frames set up around their render and take back afterwards, like a camera adjustment that only applies while drawing, a capture then renders with as well.

`captureFrame` is bound to its instance and can be passed directly as a callback. Each instance lazily allocates one RGBA8 render target and resizes it to the renderer’s current physical drawing-buffer dimensions, including pixel ratio. Empty or invalid dimensions reject instead of producing a misleading image.

Captures use an output render target, preserving Three.js screen tone mapping and output color conversion for direct scene rendering. The previous render target, cube face, mipmap level, output target and `autoClear` are restored synchronously before awaiting GPU readback.

## React Three Fiber

Use Fiber 10’s `Canvas`, which renders with WebGPU. When `state.renderPipeline` (the slot `@react-three/tsl` defines, also filled by its `useRenderPipeline`) holds a pipeline, captures render through it. The hook returns a stable capture function and reconnects its capture service when the scene, camera, renderer or render pipeline changes.

```tsx
import {useEffect} from 'react'
import {useCaptureFrame} from 'webgpu-capture-bridge/react'

function CaptureButtonBinding() {
  const captureFrame = useCaptureFrame()

  useEffect(() => {
    // Connect captureFrame to your own toolbar, diagnostics API or event system.
    return registerScreenshotHandler(captureFrame)
  }, [captureFrame])

  return null
}
```

Mount the component inside the WebGPU `Canvas`. The hook owns setup and disposal, including React Strict Mode effect replay. Calls before effect setup or after unmount reject. `useWebgpuCapture({around})` passes a render wrap on; keep the function stable, as a new one reconnects the capture service.

For access outside the canvas, use the ref component, whose ref receives both `captureFrame` and `capturePixels`:

```tsx
import type {CaptureFrameApi} from 'webgpu-capture-bridge'
import {Canvas} from '@react-three/fiber'
import {useRef} from 'react'
import WebgpuCaptureBridge from 'webgpu-capture-bridge/react'

function Viewer() {
  const capture = useRef<CaptureFrameApi>(null)

  return <>
    <Canvas>
      <WebgpuCaptureBridge ref={capture}/>
      {/* Your scene and optional render pipeline. */}
    </Canvas>
    <button onClick={async () => {
      const frame = await capture.current?.captureFrame()
      if (frame) open(URL.createObjectURL(frame.image))
    }}>Capture</button>
  </>
}
```

The core entry point never imports React or Fiber. Only consumers of `webgpu-capture-bridge/react` need those optional peers; `@react-three/tsl` is needed for its types only.

## Raw pixels

`capturePixels()` renders the same frame as `captureFrame()` but resolves with the readback as `{pixels, width, height}` (tightly packed, top-to-bottom RGBA8) and skips statistics and encoding. Use it when frames leave the page anyway, e.g. for video encoding. It coalesces concurrent callers like `captureFrame()`, and both kinds may run at the same time. In React, `useWebgpuCapture()` returns a stable `{captureFrame, capturePixels}` object; `useCaptureFrame()` is its `captureFrame`.

## Result

| Property | Meaning |
| --- | --- |
| `image` | Encoded frame as a `Blob`, PNG with the default encoder |
| `width`, `height` | Physical capture dimensions |
| `centerPixel` | RGBA bytes at `floor(width / 2), floor(height / 2)` |
| `meanLuminance` | Mean of `0.2126 × R + 0.7152 × G + 0.0722 × B`, using encoded bytes in 0–255 |
| `nonBlackFraction` | Fraction in 0–1 with any RGB channel greater than 8 |

The statistics ignore alpha. `meanLuminance` is a byte-based diagnostic, not a linear-light measurement. Readback accepts tightly packed rows and WebGPU’s 256-byte-aligned rows, with or without trailing padding on the last row. Padding is removed without flipping the image.

## Encoding and lifecycle

Results are binary: the default encoder draws into an `OffscreenCanvas` and resolves with its PNG `Blob`, so it also works in workers. Convert to base64 only where a boundary needs text, such as returning a frame from Puppeteer’s `page.evaluate`. A custom `encode` function receives `{pixels, width, height}`, where `pixels` is a tightly packed, top-to-bottom `Uint8ClampedArray`, and returns a `Blob` directly or asynchronously, e.g. for another image format. Statistics are computed before calling the encoder.

Concurrent calls on one instance share the same promise and result through rendering, readback and encoding. Treat shared results as read-only. A later call captures a new frame. Any failure rejects all current callers and permits a later retry.

`dispose()` is idempotent: it immediately rejects new requests but lets an already accepted capture finish before disposing its target. `Symbol.dispose` is supported for `using`. Keep the external renderer alive until pending captures settle. No capture runs continuously or modifies DOM content.

This is a fresh render of the scene or pipeline, not a browser screenshot: DOM overlays are excluded, render callbacks run again and custom viewport/scissor layouts are not reproduced. Use a standard full-frame WebGPU renderer with sRGB output for the default PNG encoder. Custom color spaces require an encoder that interprets them correctly.

## Development

The package ships modern ESM TypeScript source for Bun and TypeScript-aware bundlers. It targets Three.js 0.187, React 19 and the WebGPU API in Fiber 10. TypeScript consumers need the matching Three.js type definitions.

```sh
bun run --cwd packages/webgpu-capture-bridge test
bun run check
```

The root check includes the library’s tests, strict type checking and the gallery production build. Unit tests use renderer doubles; real GPU rendering and visual output still need a browser check.

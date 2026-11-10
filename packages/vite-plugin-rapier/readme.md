# vite-plugin-rapier

[Rapier](https://rapier.rs)’s compat builds, like `@dimforge/rapier3d-compat`, which `@react-three/rapier` uses, need no bundler setup because they carry their WebAssembly as base64 inside the JavaScript. That costs a third more bytes, keeps the browser from compiling it while it streams in and from keeping the compiled code in its cache, and blocks the main thread while 4 mb of text are decoded.

This plugin emits the WebAssembly as a file of its own during `vite build` and makes Rapier fetch it, with a preload in the page so the download starts right away instead of when the physics mount.

```typescript
import {defineConfig} from 'vite'
import rapierPlugin from 'vite-plugin-rapier'

export default defineConfig({
  plugins: [rapierPlugin()],
})
```

Nothing changes for the code that uses Rapier: `await RAPIER.init()` and `<Physics>` of `@react-three/rapier` work as before.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `preload` | `true` | whether the page gets a `<link rel="preload" as="fetch">` for the WebAssembly; without it, the download only starts once the page initializes Rapier |

## Details

- Every compat flavor is handled: `@dimforge/rapier2d-compat`, `@dimforge/rapier3d-compat` and their `-simd` and `-deterministic` variants.
- The file is a regular asset named `<flavor>.wasm`, like `rapier3d.wasm`, so `build.rolldownOptions.output.assetFileNames` names and hashes it like every other asset, and Vite’s `base` applies.
- The server has to send it as `application/wasm`, which lets the browser compile it while it downloads. Common hosts do.
- The development server is left alone, where Vite prebundles Rapier anyway.
- If a future Rapier inlines its WebAssembly differently, the build fails with a message instead of silently shipping the base64 again.

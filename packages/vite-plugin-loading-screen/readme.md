# vite-plugin-loading-screen

A loading screen that is part of the page’s HTML: a centered CSS spinner over a wallpaper, painted with the first bytes of the page, long before the scripts have downloaded and the app has started. The app fades it out once it is ready.

```typescript
import {defineConfig} from 'vite'
import loadingScreenPlugin from 'vite-plugin-loading-screen'

export default defineConfig({
  plugins: [
    loadingScreenPlugin({
      wallpaper: 'assets/wallpaper.jxl',
    }),
  ],
})
```

```typescript
import hideLoadingScreen from 'vite-plugin-loading-screen/client'

await startApp()
hideLoadingScreen()
```

The plugin adds a `<style>`, a `<div id="loading-screen">` at the start of the body and a preload of the wallpaper, in development and in builds. The spinner is an inline SVG ring with a 60° gap. It rotates continuously around its center.

Keep the app entry in `index.html`, so the same page also works without the plugin:

```html
<script type="module" src="/src/main.tsx"></script>
```

The plugin inspects the output HTML after Vite resolves module URLs. By default it defers every script already in the page, including inline scripts. Deferred scripts become inert templates during the transform. Once the splash is installed, the loader restores each script in place with its original attributes and text. The app can then dismiss the splash when it is ready.

To keep selected scripts in the HTML, pass a `deferScript` predicate. For example, `deferScript: ({type}) => type !== 'application/ld+json'` keeps structured data readable without JavaScript while deferring the app. A `src` seen by the predicate in a production build is the emitted URL, which may be hashed.

## Wallpaper

`wallpaper` is the image’s file, absolute or relative to Vite’s root. During development, the page shows the file itself. A build shows what it made of the page’s import of that file, so a module of the page has to import it too, and whatever other plugins do to the import, like converting or hashing it, applies. A wallpaper no module imports fails the build.

```typescript
import wallpaper from './assets/wallpaper.jxl'
```

## Options

| Option | Default | Description |
| --- | --- | --- |
| `deferScript` | `() => true` | called with each output script’s attributes; `true` defers that script, `false` keeps it in place |
| `wallpaper` | none | the file of the image behind the spinner |

## Client

`vite-plugin-loading-screen/client` is for the page:

- `hideLoadingScreen(options?)` lets clicks through the screen at once, fades it out and removes it. It returns a promise that resolves once the screen is gone. Set `fadeMs` to change the 600 ms fade.
- `isLoadingScreenShown()` tells whether the screen still covers the page.
- `findLoadingScreen()` returns its element while it is in the page.

The screen has a `z-index` of 20, so anything that should show above it while the page loads, like a progress indicator, needs a higher one.

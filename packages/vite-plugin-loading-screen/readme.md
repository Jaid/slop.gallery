# vite-plugin-loading-screen

A loading screen that is part of the page’s HTML: a title over a wallpaper, painted with the first bytes of the page, long before the scripts have downloaded and the app has started. The app fades it out once it is ready.

```typescript
import {defineConfig} from 'vite'
import loadingScreenPlugin from 'vite-plugin-loading-screen'

export default defineConfig({
  plugins: [
    loadingScreenPlugin({
      title: 'Slop Gallery',
      tagline: 'Good taste. Questionable art.',
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

The plugin adds a `<style>`, a `<div id="loading-screen">` at the start of the body and a preload of the wallpaper, in development and in builds. Nothing of it waits for JavaScript.

## Wallpaper

`wallpaper` is the image’s file, absolute or relative to Vite’s root. During development, the page shows the file itself. A build shows what it made of the page’s import of that file, so a module of the page has to import it too, and whatever other plugins do to the import, like converting or hashing it, applies. A wallpaper no module imports fails the build.

```typescript
import wallpaper from './assets/wallpaper.jxl'
```

## Several screens

Where one page opens several ways, like a build that holds several worlds picked by the URL, give every one a screen and a function that picks one from the URL’s query:

```typescript
loadingScreenPlugin({
  screens: {
    gallery: {
      title: 'Slop Gallery',
      tagline: 'Good taste. Questionable art.',
      wallpaper: 'assets/gallery.jxl',
    },
    sandbox: {
      title: 'Sandbox',
      tagline: 'One empty room to try things in.',
    },
  },
  defaultScreen: 'gallery',
  select: (search, parameter) => (new URLSearchParams(search).has(parameter) ? 'sandbox' : 'gallery'),
  selectorArguments: ['item'],
})
```

The page’s HTML holds the default screen. A small inline script right after it runs `select` before the first paint and sets the picked screen’s title, tagline and wallpaper, and the document’s title. The script holds the function’s source, so it has to be self-contained: it may only use its arguments, which are the query (`location.search`) followed by `selectorArguments`, which have to survive JSON. That way the app can call the very same function to decide what to open.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `title` | | the screen’s heading |
| `tagline` | none | the line under the title |
| `wallpaper` | none | the file of the image behind the title |
| `label` | `'Loading…'` | the pulsing line that says the page is loading |
| `fontFamily` | `'system-ui, sans-serif'` | the CSS `font-family` of the screen; a font the page’s stylesheet declares takes over once it has loaded |
| `screens` | | several screens by their IDs, each with `title`, `tagline` and `wallpaper`, instead of a single one |
| `defaultScreen` | | the ID of the screen in the page’s HTML, also shown for an ID without a screen |
| `select` | | the self-contained function that picks a screen’s ID from the query |
| `selectorArguments` | `[]` | what `select` gets after the query |

## Client

`vite-plugin-loading-screen/client` is for the page:

- `hideLoadingScreen(options?)` lets clicks through the screen at once, fades it out and removes it. It returns a promise that resolves once the screen is gone. Its options are `fadeMs` (600), `glideMs` (300) and `titleTarget`: an element, or a selector looked up a frame later, where the page shows the same title afterward. The screen’s title then glides there first, so the page fades in around it instead of showing the title twice.
- `isLoadingScreenShown()` tells whether the screen still covers the page.
- `findLoadingScreen()` returns its element while it is in the page.

```typescript
import hideLoadingScreen from 'vite-plugin-loading-screen/client'

hideLoadingScreen({titleTarget: '#menu-title'})
```

The screen has a `z-index` of 20, so anything that should show above it while the page loads, like a progress indicator, needs a higher one.

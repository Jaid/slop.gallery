import type {DeferScript} from './lib/deferScripts.ts'
import type {HtmlTagDescriptor, Plugin, Rolldown} from 'vite'

import {extname, isAbsolute, relative, resolve} from 'node:path'

import {normalizePath} from 'vite'

import deferScripts from './lib/deferScripts.ts'
import elementId from './lib/elementId.ts'

export type LoadingScreenOptions = {
  /** Which output scripts to start behind the loading screen; all by default. */
  deferScript?: DeferScript
  /** the CSS `font-family` of the screen, by default the system’s; a font the page’s stylesheet declares takes over once it has loaded */
  fontFamily?: string
  /** the pulsing line that says the page is loading, by default “Loading…” */
  label?: string
  /** the line under the title */
  tagline?: string
  title: string
  /** the file of the image behind the title, absolute or relative to Vite’s root, which a module of the page has to import as well, so that the build holds it */
  wallpaper?: string
}

const mediaTypes: Partial<Record<string, string>> = {
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.jxl': 'image/jxl',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}
// Covers everything else until the page hides it. The gradient keeps the title readable on bright wallpapers.
const makeStyle = (fontFamily: string) => `
#${elementId} {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: grid;
  padding: 2rem 1rem;
  font-family: ${fontFamily};
  color: #eee;
  text-align: center;
  text-shadow: 0 0 1rem #000;
  background: radial-gradient(rgb(0 0 0 / 50%), rgb(0 0 0 / 10%) 75%), #111 var(--wallpaper, none) center / cover no-repeat;
}
#${elementId}[aria-busy=false] {
  pointer-events: none;
}
#${elementId} > div {
  width: min(440px, 100%);
  margin: auto;
}
#${elementId} h1 {
  margin: 0;
  font-size: clamp(1.8rem, 5vw, 2.5rem);
  font-weight: 400;
}
#${elementId} p {
  margin: 0.75rem 0 2rem;
  color: #ccc;
}
#${elementId} span {
  color: #e5cf87;
  animation: ${elementId} 1.2s ease-in-out infinite alternate;
}
@keyframes ${elementId} {
  from {
    opacity: 0.3;
  }
}
`
const escapeHtml = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const cssUrl = (url: string) => `url(${JSON.stringify(url)})`

/**
 * Paints a title over a wallpaper as plain HTML and CSS right in the page, which covers it while the scripts download and the app starts. The app hides it with `hideLoadingScreen` of `vite-plugin-loading-screen/client` once it is ready.
 */
export default function loadingScreenPlugin({title, tagline = '', wallpaper, fontFamily = 'system-ui, sans-serif', label = 'Loading…', deferScript}: LoadingScreenOptions): Plugin {
  let base: string
  let root: string
  /** the wallpaper’s URL: the file itself during development, otherwise what the build made of the page’s import of it, which other plugins may have converted */
  const wallpaperUrl = (source: string, bundle?: Rolldown.OutputBundle) => {
    const file = resolve(root, source)
    const originalFileName = normalizePath(relative(root, file))
    if (!bundle) {
      return originalFileName.startsWith('../') || isAbsolute(originalFileName) ? `${base}@fs/${normalizePath(file)}` : `${base}${originalFileName}`
    }
    const asset = Object.values(bundle).find(output => output.type === 'asset' && output.originalFileNames.includes(originalFileName))
    if (!asset) {
      throw new Error(`The build holds no ${originalFileName}, so the loading screen cannot show it. A module of the page has to import it.`)
    }
    return `${base}${asset.fileName}`
  }
  return {
    name: 'loading-screen',
    enforce: 'post',
    configResolved(config) {
      base = config.base
      root = config.root
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, {bundle}) {
        const url = wallpaper && wallpaperUrl(wallpaper, bundle)
        const tags: Array<HtmlTagDescriptor> = [
          {
            tag: 'style',
            children: makeStyle(fontFamily),
            injectTo: 'head',
          },
        ]
        tags.push({
          tag: 'div',
          attrs: {
            id: elementId,
            'aria-busy': 'true',
            ...url ? {style: `--wallpaper: ${cssUrl(url)}`} : {},
          },
          children: `<div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(tagline)}</p><span>${escapeHtml(label)}</span></div>`,
          injectTo: 'body-prepend',
        })
        if (url) {
          // The preload scanner does not look into style attributes, so without the hint the wallpaper would only start downloading once the loading screen is styled.
          const type = mediaTypes[extname(url).toLowerCase()]
          tags.push({
            tag: 'link',
            attrs: {
              rel: 'preload',
              as: 'image',
              ...type ? {type} : {},
              href: url,
              fetchpriority: 'high',
            },
            injectTo: 'head',
          })
        }
        return deferScripts(html, tags, deferScript)
      },
    },
  }
}

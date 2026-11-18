import type {DeferScript} from './lib/deferScripts.ts'
import type {HtmlTagDescriptor, Plugin, Rolldown} from 'vite'

import {extname, isAbsolute, relative, resolve} from 'node:path'

import {normalizePath} from 'vite'

import deferScripts from './lib/deferScripts.ts'
import elementId from './lib/elementId.ts'

export type LoadingScreenOptions = {
  /** Which output scripts to start behind the loading screen; all by default. */
  deferScript?: DeferScript
  /** the image behind the spinner, absolute or relative to the Vite root; a page module must import it for the build */
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
const style = `
#${elementId} {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  font-size: 40px;
  background: #111 var(--wallpaper, none) center / cover no-repeat;
}
#${elementId}[aria-busy=false] {
  pointer-events: none;
}
#${elementId} > svg {
  width: auto;
  height: 1em;
  transform-origin: center;
  filter: drop-shadow(0 0 0.4em black);
  animation: ${elementId} 0.8s linear infinite;
}
@keyframes ${elementId} {
  to { rotate: 1turn; }
}
`
const cssUrl = (url: string) => `url(${JSON.stringify(url)})`

/**
 * Paints a spinner over a wallpaper as plain HTML and CSS right in the page, which covers it while the scripts download and the app starts. The app hides it with `hideLoadingScreen` of `vite-plugin-loading-screen/client` once it is ready.
 */
export default function loadingScreenPlugin({wallpaper, deferScript}: LoadingScreenOptions = {}): Plugin {
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
            children: style,
            injectTo: 'head',
          },
        ]
        tags.push({
          tag: 'div',
          attrs: {
            id: elementId,
            role: 'status',
            'aria-label': 'Loading',
            'aria-busy': 'true',
            ...url ? {style: `--wallpaper: ${cssUrl(url)}`} : {},
          },
          children: '<svg aria-hidden="true" viewBox="-16 -16 32 32"><circle r="10" pathLength="6" stroke-dasharray="5 1" fill="none" stroke="white" stroke-width="2.5"/></svg>',
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

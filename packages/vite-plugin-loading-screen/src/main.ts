import type {HtmlTagDescriptor, Plugin, Rolldown} from 'vite'

import {extname, isAbsolute, relative, resolve} from 'node:path'

import {normalizePath} from 'vite'

import elementId from './lib/elementId.ts'

export type LoadingScreen = {
  /** the line under the title */
  tagline?: string
  title: string
  /** the file of the image behind the title, absolute or relative to Vite’s root, which a module of the page has to import as well, so that the build holds it */
  wallpaper?: string
}
export type LoadingScreenAppearance = {
  /** the CSS `font-family` of the screen, by default the system’s; a font the page’s stylesheet declares takes over once it has loaded */
  fontFamily?: string
  /** the pulsing line that says the page is loading, by default “Loading…” */
  label?: string
}
/** a page that always starts with the same screen */
export type SingleLoadingScreenOptions = LoadingScreen & LoadingScreenAppearance
/** a page that starts with one of several screens, picked by its URL */
export type SelectedLoadingScreenOptions<Id extends string> = LoadingScreenAppearance & {
  /** the screen the page’s HTML holds, before the script right after it picks the URL’s, and the one of an ID that {@link select} returns without a screen */
  defaultScreen: NoInfer<Id>
  screens: Readonly<Record<Id, LoadingScreen>>
  /** a self-contained function that picks the screen from the URL query, called with the query and {@link selectorArguments}; the page runs its source without the module around it */
  select: (search: string, ...selectorArguments: Array<never>) => NoInfer<Id>
  /** the arguments {@link select} gets after the query, which have to survive JSON */
  selectorArguments?: ReadonlyArray<unknown>
}
export type LoadingScreenOptions<Id extends string = string> = SelectedLoadingScreenOptions<Id> | SingleLoadingScreenOptions
/** what the page knows of a screen */
type PageScreen = {
  tagline: string
  title: string
  /** the wallpaper’s URL */
  wallpaper?: string
  /** the wallpaper’s media type, where its extension tells */
  wallpaperType?: string
}

const mediaTypes: Record<string, string> = {
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
/** JSON that can stand inside a script element, whatever the text holds. */
const scriptJson = (value: unknown) => JSON.stringify(value).replaceAll('<', String.raw`\u003C`)
const cssUrl = (url: string) => `url(${JSON.stringify(url)})`

/**
 * Paints a title over a wallpaper as plain HTML and CSS right in the page, which covers it while the scripts download and the app starts. The app hides it with `hideLoadingScreen` of `vite-plugin-loading-screen/client` once it is ready.
 *
 * A page that opens differently by its URL, like one build holding several worlds, gives several {@link SelectedLoadingScreenOptions.screens} and a function that picks one: a small inline script right after the screen runs it before the first paint and sets the picked screen’s title, tagline and wallpaper, and the document’s title.
 */
export default function loadingScreenPlugin<Id extends string>(options: LoadingScreenOptions<Id>): Plugin {
  const {fontFamily = 'system-ui, sans-serif', label = 'Loading…'} = options
  let base: string
  let root: string
  /** the wallpaper’s URL: the file itself during development, otherwise what the build made of the page’s import of it, which other plugins may have converted */
  const wallpaperUrl = (wallpaper: string, bundle?: Rolldown.OutputBundle) => {
    const file = resolve(root, wallpaper)
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
  const pageScreen = ({tagline = '', title, wallpaper}: LoadingScreen, bundle?: Rolldown.OutputBundle): PageScreen => {
    if (!wallpaper) {
      return {
        title,
        tagline,
      }
    }
    const url = wallpaperUrl(wallpaper, bundle)
    const wallpaperType = mediaTypes[extname(url).toLowerCase()] as string | undefined
    return {
      title,
      tagline,
      wallpaper: url,
      ...wallpaperType ? {wallpaperType} : {},
    }
  }
  return {
    name: 'loading-screen',
    configResolved(config) {
      base = config.base
      root = config.root
    },
    transformIndexHtml(_html, {bundle}) {
      const tags: Array<HtmlTagDescriptor> = [
        {
          tag: 'style',
          children: makeStyle(fontFamily),
          injectTo: 'head',
        },
      ]
      const element = ({tagline, title, wallpaper}: PageScreen): HtmlTagDescriptor => ({
        tag: 'div',
        attrs: {
          id: elementId,
          'aria-busy': 'true',
          ...wallpaper ? {style: `--wallpaper: ${cssUrl(wallpaper)}`} : {},
        },
        children: `<div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(tagline)}</p><span>${escapeHtml(label)}</span></div>`,
        injectTo: 'body-prepend',
      })
      if (!('screens' in options)) {
        const screen = pageScreen(options, bundle)
        if (screen.wallpaper) {
          // The preload scanner does not look into style attributes, so without the hint the wallpaper would only start downloading once the loading screen is styled.
          tags.push({
            tag: 'link',
            attrs: {
              rel: 'preload',
              as: 'image',
              ...screen.wallpaperType ? {type: screen.wallpaperType} : {},
              href: screen.wallpaper,
              fetchpriority: 'high',
            },
            injectTo: 'head',
          })
        }
        tags.push(element(screen))
        return tags
      }
      const {defaultScreen, screens, select, selectorArguments = []} = options
      const pageScreens = Object.fromEntries(Object.entries<LoadingScreen>(screens).map(([id, screen]) => [id, pageScreen(screen, bundle)]))
      // The preload does for the picked wallpaper what the link element does for a single screen’s.
      const script = `{
const screens = ${scriptJson(pageScreens)}
const screen = screens[(${select.toString()})(location.search, ...${scriptJson(selectorArguments)})] ?? screens[${scriptJson(defaultScreen)}]
const element = document.querySelector('#${elementId}')
element.querySelector('h1').textContent = screen.title
element.querySelector('p').textContent = screen.tagline
document.title = screen.title
if (screen.wallpaper) {
  element.style.setProperty('--wallpaper', 'url(' + JSON.stringify(screen.wallpaper) + ')')
  const preload = Object.assign(document.createElement('link'), {rel: 'preload', as: 'image', href: screen.wallpaper, fetchPriority: 'high'})
  if (screen.wallpaperType) {
    preload.type = screen.wallpaperType
  }
  document.head.append(preload)
}
}`
      // Without its wallpaper, which only the script knows to be the right one.
      const {tagline, title} = pageScreens[defaultScreen]
      tags.push(element({
        title,
        tagline,
      }), {
        tag: 'script',
        children: script,
        injectTo: 'body-prepend',
      })
      return tags
    },
  }
}

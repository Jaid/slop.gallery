import readPermalink from 'read-permalink'

import {readStored, writeStored} from '../browserStorage.ts'

export type GraphicsQuality = 'cinematic' | 'fast' | 'heavy'

const preset = (value: unknown): GraphicsQuality => (value === 'heavy' || value === 'cinematic' ? value : 'fast')

/** The concrete preset the menu saved for the next visit. Missing, invalid or inaccessible storage leaves the gallery in Fast. */
export function readStoredGraphics(): GraphicsQuality {
  return preset(readStored('graphics'))
}

/** An explicit graphics parameter, including one in packed permalink state. Even an invalid override (Fast) takes precedence over storage. */
export function readGraphicsOverride(input: URL | string = typeof location === 'undefined' ? '' : location.href): GraphicsQuality | 'auto' | undefined {
  const {graphics} = readPermalink(input)
  if (graphics === undefined || graphics === 'auto') {
    return graphics
  }
  return graphics === true ? 'heavy' : preset(graphics)
}

/** Store a choice without reloading. On a page with an override, navigate to the new preset instead, leaving the saved preference alone. */
export function chooseGraphics(quality: 'fast' | 'heavy') {
  const url = new URL(location.href)
  if (readGraphicsOverride(url) === undefined) {
    return writeStored('graphics', quality)
  }
  // A packed fragment wins even over the last query entry. Edit it in place rather than moving any of its potentially private fields into the query.
  if (url.hash.startsWith('#data:')) {
    const fragment = readPermalink(new URL(url.hash, url.origin))
    if (Object.hasOwn(fragment, 'graphics')) {
      fragment.graphics = quality
      const encoder = new TextEncoder
      url.hash = `data:${encoder.encode(JSON.stringify(fragment)).toBase64({
        alphabet: 'base64url',
        omitPadding: true,
      })}`
      // Assigning a fragment alone would keep this document and its renderer alive. A pushed entry would share this document, so Back would show the old preset’s URL over the new renderer without loading it again.
      history.replaceState(null, '', url)
      location.reload()
      return true
    }
  }
  // Append after any packed query entries, which read-permalink merges left to right.
  url.searchParams.delete('graphics')
  url.searchParams.append('graphics', quality)
  location.assign(url.href)
  return true
}

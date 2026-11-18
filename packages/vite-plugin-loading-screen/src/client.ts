import elementId from './lib/elementId.ts'

export type HideLoadingScreenOptions = {
  /** how long the screen takes to fade out, in milliseconds, by default 600 */
  fadeMs?: number
}

let hiding: Promise<void> | undefined

/** The loading screen’s element, as long as it is in the page. */
export function findLoadingScreen() {
  return document.querySelector<HTMLElement>(`#${elementId}`)
}

/** Whether the loading screen still covers the page, which it does until {@link hideLoadingScreen} is called. */
export function isLoadingScreenShown() {
  return findLoadingScreen()?.getAttribute('aria-busy') === 'true'
}

/**
 * Fades the loading screen out to whatever is behind it, then removes it for good. Clicks pass through it from the first moment on.
 * Returns a promise that resolves once it is gone, at once if it already was; calling it again while it fades changes nothing.
 */
export default function hideLoadingScreen({fadeMs = 600}: HideLoadingScreenOptions = {}) {
  if (hiding) {
    return hiding
  }
  const element = findLoadingScreen()
  if (!element) {
    return Promise.resolve()
  }
  element.setAttribute('aria-busy', 'false')
  const {promise, resolve} = Promise.withResolvers<void>()
  hiding = promise
  const fade = element.animate({opacity: [1, 0]}, {
    duration: fadeMs,
    easing: 'ease-in-out',
    fill: 'forwards',
  })
  fade.addEventListener('finish', () => {
    element.remove()
    hiding = undefined
    resolve()
  })
  return promise
}

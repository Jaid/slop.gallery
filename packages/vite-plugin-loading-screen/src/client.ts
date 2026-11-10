import elementId from './lib/elementId.ts'

export type HideLoadingScreenOptions = {
  /** how long the screen takes to fade out, in milliseconds, by default 600 */
  fadeMs?: number
  /** how long the title takes to glide to {@link titleTarget}, in milliseconds, by default 300 */
  glideMs?: number
  /** where the page shows the same title afterward, as an element or a selector looked up a frame later, when what the page mounts on hiding has its layout: the screen’s title first glides there, so the page fades in around it instead of showing it twice */
  titleTarget?: Element | string | null
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
export default function hideLoadingScreen({fadeMs = 600, glideMs = 300, titleTarget}: HideLoadingScreenOptions = {}) {
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
  requestAnimationFrame(() => {
    const content = element.firstElementChild
    const from = element.querySelector('h1')?.getBoundingClientRect()
    const target = typeof titleTarget === 'string' ? document.querySelector(titleTarget) : titleTarget
    const to = target?.getBoundingClientRect()
    let delay = 0
    if (content && from && to) {
      delay = glideMs
      content.animate({transform: ['none', `translate(${to.left - from.left}px, ${to.top - from.top}px)`]}, {
        duration: glideMs,
        easing: 'ease-out',
        fill: 'forwards',
      })
      element.querySelector('span')?.animate({opacity: 0}, {
        duration: glideMs,
        fill: 'forwards',
      })
    }
    const fade = element.animate({opacity: [1, 0]}, {
      duration: fadeMs,
      delay,
      easing: 'ease-in-out',
      fill: 'forwards',
    })
    fade.addEventListener('finish', () => {
      element.remove()
      hiding = undefined
      resolve()
    })
  })
  return promise
}

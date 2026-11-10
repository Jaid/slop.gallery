import {afterEach, beforeEach, expect, test} from 'bun:test'

import hideLoadingScreen, {findLoadingScreen, isLoadingScreenShown} from '../src/client.ts'

type Animation = {
  keyframes: unknown
  options: KeyframeAnimationOptions
  target: string
}

const globals = globalThis as unknown as Record<string, unknown>
let animations: Array<Animation>
let frames: Array<() => void>
let finish: Array<() => void>
let removed: boolean
let attributes: Map<string, string>
/** whether the page shows a title of its own, at 130, 260 */
let menuMounted: boolean
/** A page with a loading screen whose title sits at 100, 200. Returns the page’s own title, which it only shows once {@link menuMounted}. */
const mount = ({screen = true} = {}) => {
  animations = []
  frames = []
  finish = []
  removed = false
  menuMounted = false
  attributes = new Map([['aria-busy', 'true']])
  const animated = (target: string) => (keyframes: unknown, options: KeyframeAnimationOptions) => {
    animations.push({
      target,
      keyframes,
      options,
    })
    return {
      addEventListener(_type: string, listener: () => void) {
        finish.push(listener)
      },
    }
  }
  const parts: Record<string, unknown> = {
    h1: {
      getBoundingClientRect: () => ({
        top: 200,
        left: 100,
      }),
    },
    span: {animate: animated('label')},
  }
  const element = {
    firstElementChild: {animate: animated('content')},
    animate: animated('screen'),
    getAttribute: (name: string) => attributes.get(name) ?? null,
    setAttribute: (name: string, value: string) => attributes.set(name, value),
    querySelector: (selector: string) => parts[selector] ?? null,
    remove() {
      removed = true
    },
  }
  const menuTitle = {
    getBoundingClientRect: () => ({
      top: 260,
      left: 130,
    }),
  }
  globals.document = {
    querySelector(selector: string) {
      if (selector === '#loading-screen') {
        return screen && !removed ? element : null
      }
      return selector === '#menu-title' && menuMounted ? menuTitle : null
    },
  }
  globals.requestAnimationFrame = (callback: () => void) => frames.push(callback)
  return menuTitle as unknown as Element
}
const saved = {
  document: globals.document,
  requestAnimationFrame: globals.requestAnimationFrame,
}
beforeEach(() => {
  mount()
})
afterEach(() => {
  Object.assign(globals, saved)
})
/** Runs the pending frame and ends every animation. */
const play = () => {
  for (const frame of frames.splice(0)) {
    frame()
  }
  for (const listener of finish.splice(0)) {
    listener()
  }
}
test('the screen lets clicks through at once, fades out and leaves the page', async () => {
  expect(isLoadingScreenShown()).toBe(true)
  const hidden = hideLoadingScreen()
  expect(attributes.get('aria-busy')).toBe('false')
  expect(isLoadingScreenShown()).toBe(false)
  expect(findLoadingScreen()).not.toBeNull()
  expect(animations).toEqual([])
  play()
  await hidden
  expect(removed).toBe(true)
  expect(findLoadingScreen()).toBeNull()
  expect(animations).toEqual([
    {
      target: 'screen',
      keyframes: {opacity: [1, 0]},
      options: {
        duration: 600,
        delay: 0,
        easing: 'ease-in-out',
        fill: 'forwards',
      },
    },
  ])
})
test('the title first glides to where the page shows its own, found a frame later by its selector', async () => {
  const hidden = hideLoadingScreen({titleTarget: '#menu-title'})
  // The page only mounts its title now.
  menuMounted = true
  play()
  await hidden
  expect(animations.map(animation => animation.target)).toEqual(['content', 'label', 'screen'])
  expect(animations[0].keyframes).toEqual({transform: ['none', 'translate(30px, 60px)']})
  expect(animations[0].options.duration).toBe(300)
  expect(animations[2].options.delay).toBe(300)
})
test('an element works as the target too, and without one nothing glides', async () => {
  const target = mount()
  const hidden = hideLoadingScreen({
    titleTarget: target,
    glideMs: 200,
    fadeMs: 400,
  })
  play()
  await hidden
  expect(animations.map(animation => [animation.target, animation.options.duration, animation.options.delay])).toEqual([['content', 200, undefined], ['label', 200, undefined], ['screen', 400, 200]])
  mount()
  const plain = hideLoadingScreen({titleTarget: '#missing'})
  play()
  await plain
  expect(animations.map(animation => animation.target)).toEqual(['screen'])
})
test('hiding again while it fades changes nothing, and hiding a page without a screen resolves at once', async () => {
  const first = hideLoadingScreen()
  expect(hideLoadingScreen()).toBe(first)
  play()
  await first
  expect(animations).toHaveLength(1)
  await hideLoadingScreen()
  expect(animations).toHaveLength(1)
  mount({screen: false})
  expect(isLoadingScreenShown()).toBe(false)
  await hideLoadingScreen()
  expect(frames).toEqual([])
})

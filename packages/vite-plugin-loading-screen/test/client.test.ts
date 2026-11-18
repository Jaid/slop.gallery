import {afterEach, expect, mock, test} from 'bun:test'

import hideLoadingScreen, {findLoadingScreen, isLoadingScreenShown} from '../src/client.ts'

const globals = globalThis as unknown as Record<string, unknown>
const saved = globals.document
afterEach(() => {
  globals.document = saved
})
test('hiding releases input immediately and removes the screen once its fade finishes', async () => {
  const attributes = new Map([['aria-busy', 'true']])
  const animation = new EventTarget
  const element = {
    getAttribute: (name: string) => attributes.get(name),
    setAttribute: (name: string, value: string) => attributes.set(name, value),
    animate: mock(() => animation),
    remove: mock(() => {}),
  }
  globals.document = {querySelector: () => (element.remove.mock.calls.length ? null : element)}
  expect(isLoadingScreenShown()).toBe(true)
  const hidden = hideLoadingScreen()
  expect(hideLoadingScreen()).toBe(hidden)
  expect(isLoadingScreenShown()).toBe(false)
  expect(findLoadingScreen()).not.toBeNull()
  expect(element.animate).toHaveBeenCalledTimes(1)
  animation.dispatchEvent(new Event('finish'))
  await hidden
  expect(findLoadingScreen()).toBeNull()
  await hideLoadingScreen()
  expect(element.remove).toHaveBeenCalledTimes(1)
})

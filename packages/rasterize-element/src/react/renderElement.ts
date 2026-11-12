import type {ReactNode} from 'react'

import {flushSync} from 'react-dom'
import {createRoot} from 'react-dom/client'

/**
 * Renders a React node into a detached element as wide and high as its content, ready to be rasterized. Dispose it to unmount the node.
 * The node is rendered right away, which React DOM only does outside of its own renders and effects.
 */
export default function renderElement(node: ReactNode): Disposable & {element: HTMLDivElement} {
  const element = document.createElement('div')
  // A block child of a rasterizer’s canvas does not stretch to it, so the element takes the size of what React renders into it.
  element.style.width = 'max-content'
  const root = createRoot(element)
  flushSync(() => root.render(node))
  return {
    element,
    [Symbol.dispose]: () => root.unmount(),
  }
}

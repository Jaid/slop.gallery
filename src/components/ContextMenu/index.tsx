import type {IconName} from '#component/Icon'
import type {KeyboardEvent} from 'react'

import Branch from 'branch-component'
import {useLayoutEffect, useRef} from 'react'

import Icon from '#component/Icon'

import css from './style.module.sass'

/** something a context menu offers to do */
export type ContextMenuItem = {
  icon?: IconName
  /** unique within its menu */
  id: string
  label: string
  /** Called from the player’s click itself, so it may do what browsers only allow right after one, like writing to the clipboard. */
  onSelect: () => void
}
export type ContextMenuProps = {
  items: ReadonlyArray<ContextMenuItem>
  /** what the menu is about, for assistive technology */
  label: string
  /** Called once the menu has closed, by choosing an item, by a click elsewhere or by the Escape key; stop rendering it then. */
  onClose: () => void
  /** where the menu opens, in viewport pixels, like the pointer’s `clientX` and `clientY`; it moves there when they change */
  x: number
  y: number
}

/** how far the menu keeps from the edges of the viewport, in pixels */
const margin = 8
/** what the keys that move through the menu do to the index of the focused item among `count` items; no item is focused at -1 */
const steps: Partial<Record<string, (index: number, count: number) => number>> = {
  ArrowDown: (index, count) => (index + 1) % count,
  ArrowUp: (index, count) => (index <= 0 ? count : index) - 1,
  Home: () => 0,
  End: (_index, count) => count - 1,
}

/**
 * A menu of the page’s own at a point of the viewport, in place of the browser’s context menu: render it while it should be open.
 * It lies in the top layer above everything else, stays within the viewport, closes on a click elsewhere and on the Escape key, which hands the focus back to where it was, and takes the arrow keys, Home and End.
 */
export default function ContextMenu({items, label, onClose, x, y}: ContextMenuProps) {
  const menu = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const element = menu.current!
    // Opened anew where it moves, it hands the focus back to wherever the focus was last. Closing and opening in one go tells no listener that it closed.
    if (element.matches(':popover-open')) {
      element.hidePopover()
    }
    element.showPopover()
    const {width, height} = element.getBoundingClientRect()
    const {clientWidth, clientHeight} = document.documentElement
    // Its corner at the point where it fits; otherwise as near as the viewport allows.
    element.style.left = `${Math.max(margin, Math.min(x, clientWidth - width - margin))}px`
    element.style.top = `${Math.max(margin, Math.min(y, clientHeight - height - margin))}px`
    element.querySelector('button')?.focus({preventScroll: true})
  }, [x, y])
  const handleKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = steps[event.key]
    if (!step) {
      return
    }
    event.preventDefault()
    // Arrow keys move through the menu rather than whatever lies behind it.
    event.stopPropagation()
    const buttons = [...event.currentTarget.querySelectorAll('button')]
    buttons[step(buttons.indexOf(document.activeElement as HTMLButtonElement), buttons.length)]?.focus()
  }
  return <div
    className={css.container} aria-label={label} popover='auto' role='menu' ref={menu} onContextMenu={event => event.preventDefault()} onKeyDown={handleKey} onToggle={event => {
      if (event.newState === 'closed') {
        onClose()
      }
    }}
  >
    {items.map(item => <button
      key={item.id} className={css.item} data-item={item.id} role='menuitem' type='button' onClick={() => {
        item.onSelect()
        menu.current?.hidePopover()
      }}
    >
      <Branch if={item.icon}><Icon name={item.icon!} size={16} /></Branch>
      <span>{item.label}</span>
    </button>)}
  </div>
}

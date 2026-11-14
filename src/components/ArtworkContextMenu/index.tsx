import type {ArtworkMenuTarget} from '#component/ArtworkCollectionItem'
import type {ArtworkExportAction} from '#src/lib/gallery/exportArtwork.ts'

import {useLayoutEffect, useRef} from 'react'

import css from './style.module.sass'

const actions = [
  ['png', 'Export as PNG'],
  ['webp', 'Export as WebP'],
  ['copy', 'Copy as PNG'],
] as const

/** A top-layer menu: native outside-click/Escape dismissal, with menu-key navigation and viewport clamping. */
export default function ArtworkContextMenu({target, busy, onClose, onAction}: {
  busy: boolean
  onAction: (action: ArtworkExportAction) => void
  onClose: () => void
  target: ArtworkMenuTarget
}) {
  const menu = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const element = menu.current!
    target.anchor.focus({preventScroll: true})
    element.showPopover({source: target.anchor})
    const rect = element.getBoundingClientRect()
    element.style.left = `${Math.max(8, Math.min(target.x, innerWidth - rect.width - 8))}px`
    element.style.top = `${Math.max(8, Math.min(target.y, innerHeight - rect.height - 8))}px`
    element.querySelector('button')?.focus({preventScroll: true})
    const dismiss = (event: Event) => {
      if (event.type === 'resize' || event.target instanceof Node && event.target.contains(target.anchor)) {
        element.hidePopover()
      }
    }
    // A scrolled thumbnail is no longer under the menu, so dismiss rather than leaving it behind.
    document.addEventListener('scroll', dismiss, true)
    window.addEventListener('resize', dismiss)
    return () => {
      document.removeEventListener('scroll', dismiss, true)
      window.removeEventListener('resize', dismiss)
      element.hidePopover()
    }
  }, [target])
  return <div
    className={css.container} aria-label='Artwork actions' popover='auto' role='menu' ref={menu}
    onContextMenu={event => event.preventDefault()}
    onKeyDown={event => {
      const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')]
      const index = items.indexOf(document.activeElement as HTMLButtonElement)
      const movement = {
        ArrowDown: 1,
        ArrowUp: -1,
        Home: -index,
        End: items.length - 1 - index,
      }[event.key]
      if (movement !== undefined && items.length) {
        event.preventDefault()
        items[(index + movement + items.length) % items.length]?.focus()
      } else if (event.key === 'Tab') {
        menu.current?.hidePopover()
      }
    }}
    onToggle={event => {
      if (event.newState === 'closed') {
        onClose()
      }
    }}
  >
    {actions.map(([action, label]) => <button
      key={action} aria-disabled={busy} role='menuitem' tabIndex={-1} type='button' onClick={() => {
        if (!busy) {
          onAction(action)
        }
      }}
    >{label}</button>)}
  </div>
}

import type {Portrait} from '#src/lib/gallery.ts'
import type {MouseEvent as ReactMouseEvent} from 'react'

import Branch from 'branch-component'
import {useEffect, useId, useLayoutEffect, useRef, useState} from 'react'

import Icon from '#component/Icon'
import {notify, useGallery} from '#src/lib/gallery.ts'
import {copyPortraitPng, exportPortrait} from '#src/lib/gallery/portraitExport.ts'

import css from './style.module.sass'

type ContextMenuState = {
  portraitId: string
  x: number
  y: number
}

const viewportMargin = 16

/** The pause menu’s right-hand grid of every artwork currently in the world, with rich hover tooltips after interaction and a custom export/clipboard context menu. */
export default function PortraitCollection() {
  const portraits = useGallery(s => s.portraits)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const triggerButton = useRef<HTMLButtonElement | null>(null)
  const activePortrait = contextMenu ? portraits.find(portrait => portrait.id === contextMenu.portraitId) : undefined
  const interactedCount = portraits.filter(portrait => portrait.interacted).length
  const openContextMenu = (event: ReactMouseEvent<HTMLButtonElement>, portrait: Portrait) => {
    event.preventDefault()
    event.stopPropagation()
    for (const openTooltip of document.querySelectorAll<HTMLElement>('[data-testid="portrait-tooltip"]:popover-open')) {
      openTooltip.hidePopover()
    }
    triggerButton.current = event.currentTarget
    let {clientX: x, clientY: y} = event
    if (x === 0 && y === 0) {
      const rect = event.currentTarget.getBoundingClientRect()
      x = rect.left + rect.width / 2
      y = rect.top + rect.height / 2
    }
    setContextMenu({
      portraitId: portrait.id,
      x,
      y,
    })
  }
  const closeContextMenu = (restoreFocus = false) => {
    setContextMenu(null)
    if (restoreFocus) {
      triggerButton.current?.focus({preventScroll: true})
    }
  }
  return <section className={css.container} aria-label='Artwork collection' data-testid='portrait-collection'>
    <div className={css.header}>
      <span>Collection</span>
      <Branch if={portraits.length > 0}><small>{interactedCount} / {portraits.length}</small></Branch>
    </div>
    <Branch if={portraits.length > 0} else={<p className={css.empty}>No artworks in this world yet.</p>}>
      <div className={css.grid}>
        {portraits.map(portrait => <PortraitItem key={portrait.id} menuOpen={contextMenu !== null} portrait={portrait} onContextMenu={openContextMenu} />)}
      </div>
    </Branch>
    <Branch all={[activePortrait, contextMenu]}>
      <PortraitContextMenu portrait={activePortrait!} x={contextMenu?.x ?? 0} y={contextMenu?.y ?? 0} onClose={closeContextMenu} />
    </Branch>
  </section>
}

function PortraitItem({menuOpen, onContextMenu, portrait}: {
  menuOpen: boolean
  onContextMenu: (event: ReactMouseEvent<HTMLButtonElement>, portrait: Portrait) => void
  portrait: Portrait
}) {
  const tooltipId = useId()
  const interacted = Boolean(portrait.interacted)
  return <>
    <button
      className={css.item}
      aria-label={interacted ? portrait.title : 'Artwork'}
      data-imported={portrait.imported || undefined}
      data-interacted={interacted || undefined}
      data-portrait={portrait.id}
      interestfor={interacted && !menuOpen ? tooltipId : undefined}
      type='button'
      onContextMenu={event => onContextMenu(event, portrait)}
    >
      <PortraitThumbnail source={portrait.source} />
    </button>
    <Branch if={interacted}>
      <div id={tooltipId} className={css.tooltip} data-testid='portrait-tooltip' popover='hint'>
        <p className={css.tooltipTitle}>{portrait.title || 'Untitled'}</p>
        <Branch if={portrait.description}><p className={css.tooltipDescription}>{portrait.description}</p></Branch>
        <p className={css.tooltipMeta}><span>{portrait.creator}</span><span aria-hidden='true'> · </span><span>{portrait.year ?? 'Undated'}</span></p>
      </div>
    </Branch>
  </>
}
function PortraitThumbnail({source}: {source: Blob | string}) {
  const image = useRef<HTMLImageElement>(null)
  useEffect(() => {
    const element = image.current
    if (!element || typeof source === 'string') {
      return
    }
    const url = URL.createObjectURL(source)
    element.src = url
    return () => {
      element.removeAttribute('src')
      URL.revokeObjectURL(url)
    }
  }, [source])
  return <img alt='' draggable={false} loading='lazy' src={typeof source === 'string' ? source : undefined} ref={image} />
}
function PortraitContextMenu({onClose, portrait, x, y}: {
  onClose: (restoreFocus?: boolean) => void
  portrait: Portrait
  x: number
  y: number
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const menu = menuRef.current
    if (!menu) {
      return
    }
    if (!menu.matches(':popover-open')) {
      menu.showPopover()
    }
    menu.style.left = `${x}px`
    menu.style.top = `${y}px`
    const rect = menu.getBoundingClientRect()
    menu.style.left = `${Math.max(viewportMargin, Math.min(x, globalThis.innerWidth - rect.width - viewportMargin))}px`
    menu.style.top = `${Math.max(viewportMargin, Math.min(y, globalThis.innerHeight - rect.height - viewportMargin))}px`
    menu.querySelector<HTMLButtonElement>('button')?.focus({preventScroll: true})
  }, [portrait.id, x, y])
  useEffect(() => {
    const pointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) {
        return
      }
      onClose()
    }
    const keyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onClose(true)
      }
    }
    const dismiss = () => onClose()
    globalThis.addEventListener('pointerdown', pointerDown, true)
    globalThis.addEventListener('keydown', keyDown, true)
    globalThis.addEventListener('blur', dismiss)
    globalThis.addEventListener('resize', dismiss)
    globalThis.addEventListener('scroll', dismiss, true)
    return () => {
      globalThis.removeEventListener('pointerdown', pointerDown, true)
      globalThis.removeEventListener('keydown', keyDown, true)
      globalThis.removeEventListener('blur', dismiss)
      globalThis.removeEventListener('resize', dismiss)
      globalThis.removeEventListener('scroll', dismiss, true)
    }
  }, [onClose])
  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')]
    const current = items.indexOf(document.activeElement as HTMLButtonElement)
    if (current === -1 || items.length === 0) {
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      items[(current + 1) % items.length].focus()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      items[(current - 1 + items.length) % items.length].focus()
    } else if (event.key === 'Home') {
      event.preventDefault()
      items[0].focus()
    } else if (event.key === 'End') {
      event.preventDefault()
      items.at(-1)!.focus()
    }
  }
  const handleExport = (format: 'png' | 'webp') => {
    onClose(true)
    void exportPortrait(portrait, format).catch(() => notify(`Could not export the artwork as ${format.toUpperCase()}.`))
  }
  const handleCopy = () => {
    void copyPortraitPng(portrait).then(() => {
      notify(portrait.interacted ? `Copied “${portrait.title}” to clipboard.` : 'Copied artwork to clipboard.')
    }).catch(() => notify('Could not copy the artwork to the clipboard.'))
    onClose(true)
  }
  return <div
    className={css.contextMenu}
    aria-label='Artwork actions'
    data-portrait={portrait.id}
    data-testid='portrait-context-menu'
    popover='manual'
    role='menu'
    style={{
      top: `${y}px`,
      left: `${x}px`,
    }}
    ref={menuRef}
    onContextMenu={event => event.preventDefault()}
    onKeyDown={onMenuKeyDown}
  >
    <button className={css.menuAction} role='menuitem' type='button' onClick={() => handleExport('png')}><Icon name='download' size={16} /><span>Export as PNG</span></button>
    <button className={css.menuAction} role='menuitem' type='button' onClick={() => handleExport('webp')}><Icon name='download' size={16} /><span>Export as WebP</span></button>
    <button className={css.menuAction} role='menuitem' type='button' onClick={handleCopy}><Icon name='copy' size={16} /><span>Copy to clipboard (PNG)</span></button>
  </div>
}

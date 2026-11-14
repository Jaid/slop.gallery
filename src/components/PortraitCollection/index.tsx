import type {Portrait} from '#src/lib/gallery.ts'
import type {ArtworkExportFormat} from '#src/lib/gallery/artworkExport.ts'
import type {KeyboardEvent, MouseEvent} from 'react'

import Branch from 'branch-component'
import {useEffect, useId, useLayoutEffect, useRef, useState} from 'react'

import {notify, useGallery} from '#src/lib/gallery.ts'
import {copyArtwork, downloadArtwork} from '#src/lib/gallery/artworkExport.ts'
import useArtworkTexture from '#src/lib/useArtworkTexture.ts'

import css from './style.module.sass'

/** a work’s open export menu: the work, where it opens and the tile that opened it, which takes the focus back when it closes */
type ExportMenu = {
  id: string
  invoker: HTMLButtonElement
  x: number
  y: number
}

const formatNames = {
  png: 'PNG',
  webp: 'WebP',
} as const satisfies Record<ArtworkExportFormat, string>

/**
 * The portrait collection of the pause menu: every work in the world as a thumbnail grid. A work the player has already interacted with names itself in a tooltip with its flavor text, creator and year; every work exports from its own right-click menu, as a PNG or WebP download or onto the clipboard as a PNG.
 */
export default function PortraitCollection() {
  const portraits = useGallery(s => s.portraits)
  const [menu, setMenu] = useState<ExportMenu | null>(null)
  const menuPortrait = menu ? portraits.find(portrait => portrait.id === menu.id) : undefined
  const interacted = portraits.filter(portrait => portrait.interacted).length
  const openMenu = (event: MouseEvent<HTMLButtonElement>, portrait: Portrait) => {
    event.preventDefault()
    const invoker = event.currentTarget
    // A keyboard’s menu key reports no point of its own, so the menu opens at the tile’s corner instead.
    const corner = invoker.getBoundingClientRect()
    setMenu({
      id: portrait.id,
      invoker,
      x: event.clientX === 0 && event.clientY === 0 ? corner.left : event.clientX,
      y: event.clientX === 0 && event.clientY === 0 ? corner.bottom : event.clientY,
    })
  }
  const closeMenu = (restoreFocus = false) => {
    setMenu(null)
    if (restoreFocus) {
      menu?.invoker.focus()
    }
  }
  const exportAs = (format: ArtworkExportFormat) => {
    if (!menuPortrait) {
      return
    }
    const portrait = menuPortrait
    closeMenu(true)
    void downloadArtwork(portrait, format).then(() => notify(`Saved “${portrait.title}” as ${formatNames[format]}.`)).catch(() => notify(`“${portrait.title}” could not be exported as ${formatNames[format]}.`))
  }
  const copy = () => {
    if (!menuPortrait) {
      return
    }
    const portrait = menuPortrait
    closeMenu(true)
    void copyArtwork(portrait).then(() => notify(`Copied “${portrait.title}” to the clipboard as PNG.`)).catch(() => notify(`“${portrait.title}” could not be copied to the clipboard.`))
  }
  return <section className={css.container} aria-label='Portrait collection' data-testid='portrait-collection'>
    <header className={css.header}>
      <h2>Collection</h2>
      <p>{`${interacted} of ${portraits.length} interacted with`}</p>
    </header>
    <Branch if={portraits.length} else={<p className={css.empty}>No artworks in this world yet. Drop an image into the window to bring one in.</p>}>
      <ul className={css.grid}>
        {portraits.map(portrait => <CollectionItem key={portrait.id} portrait={portrait} onContextMenu={openMenu} />)}
      </ul>
    </Branch>
    <Branch if={menu && menuPortrait}><ArtworkContextMenu key={`${menuPortrait?.id}:${menu?.x}:${menu?.y}`} portrait={menuPortrait!} x={menu?.x ?? 0} y={menu?.y ?? 0} onClose={closeMenu} onCopy={copy} onExport={exportAs} /></Branch>
  </section>
}

function CollectionItem({portrait, onContextMenu}: {
  onContextMenu: (event: MouseEvent<HTMLButtonElement>, portrait: Portrait) => void
  portrait: Portrait
}) {
  const tooltipId = useId()
  const interacted = portrait.interacted === true
  return <li className={css.item}>
    <button
      className={css.tile} aria-haspopup='menu' aria-label={interacted ? `${portrait.title} by ${portrait.creator}` : 'Artwork you have not interacted with yet'} data-interacted={interacted || undefined} data-portrait={portrait.id} data-testid='collection-item' interestfor={interacted ? tooltipId : undefined} type='button'
      onContextMenu={event => onContextMenu(event, portrait)}
    >
      <Thumbnail portrait={portrait} />
    </button>
    <Branch if={interacted}>
      <div id={tooltipId} className={css.tooltip} data-testid='collection-tooltip' popover='hint'>
        <p className={css.tooltipTitle}>{portrait.title}</p>
        <p className={css.tooltipText}>{portrait.description}</p>
        <p className={css.tooltipByline}><span>{portrait.creator}</span><span aria-hidden='true'> · </span><span>{portrait.year ?? 'Undated'}</span></p>
      </div>
    </Branch>
  </li>
}
/** The work’s image as the world shows it, drawn from the decoded texture the hung work already holds instead of decoding it a second time for the grid. */
function Thumbnail({portrait}: {portrait: Portrait}) {
  const {texture} = useArtworkTexture(portrait.source)
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const element = canvas.current
    const context = element?.getContext('2d')
    if (element && texture && context) {
      context.drawImage(texture.image, 0, 0, element.width, element.height)
    }
  }, [texture])
  const ratio = portrait.width > 0 && portrait.height > 0 ? portrait.width / portrait.height : 1
  const width = ratio >= 1 ? 256 : Math.max(1, Math.round(256 * ratio))
  const height = ratio >= 1 ? Math.max(1, Math.round(256 / ratio)) : 256
  return <canvas className={css.thumbnail} aria-hidden='true' height={height} width={width} ref={canvas} />
}
/** A work’s export menu, opened where its tile was right-clicked, kept inside the window, and closed by a click anywhere else, a scroll, a resize or Escape. */
function ArtworkContextMenu({portrait, x, y, onClose, onCopy, onExport}: {
  onClose: (restoreFocus?: boolean) => void
  onCopy: () => void
  onExport: (format: ArtworkExportFormat) => void
  portrait: Portrait
  x: number
  y: number
}) {
  const element = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({
    x,
    y,
  })
  useLayoutEffect(() => {
    const menu = element.current
    if (!menu) {
      return
    }
    if (!menu.matches(':popover-open')) {
      menu.showPopover()
    }
    const {width, height} = menu.getBoundingClientRect()
    setPosition({
      x: Math.min(x, Math.max(8, window.innerWidth - width - 8)),
      y: Math.min(y, Math.max(8, window.innerHeight - height - 8)),
    })
    menu.querySelector('button')?.focus()
  }, [x, y])
  useEffect(() => {
    const close = () => onClose()
    const onPointerDown = (event: PointerEvent) => {
      if (!element.current?.contains(event.target as Node)) {
        onClose()
      }
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose(true)
      }
    }
    globalThis.addEventListener('pointerdown', onPointerDown, true)
    globalThis.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('blur', close)
    return () => {
      globalThis.removeEventListener('pointerdown', onPointerDown, true)
      globalThis.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('blur', close)
    }
  }, [onClose])
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'End', 'Home'].includes(event.key)) {
      return
    }
    const items = [...event.currentTarget.querySelectorAll('button')]
    if (!items.length) {
      return
    }
    event.preventDefault()
    const index = items.indexOf(document.activeElement as HTMLButtonElement)
    const next = event.key === 'Home' ? 0 : (event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length)
    items[next].focus()
  }
  return <div
    className={css.contextMenu} aria-label={`Export “${portrait.title}”`} data-testid='collection-context-menu' popover='manual' role='menu' style={{
      top: position.y,
      left: position.x,
    }} ref={element} onKeyDown={onKeyDown}
  >
    <button role='menuitem' type='button' onClick={() => onExport('png')}>Export as PNG</button>
    <button role='menuitem' type='button' onClick={() => onExport('webp')}>Export as WebP</button>
    <button role='menuitem' type='button' onClick={onCopy}><span>Copy to clipboard</span><small>PNG</small></button>
  </div>
}

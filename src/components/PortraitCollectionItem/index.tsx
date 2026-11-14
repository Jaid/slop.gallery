import type {Portrait} from '#src/lib/gallery.ts'

import Branch from 'branch-component'
import clsx from 'clsx'
import {useId} from 'react'

import PortraitTooltip from '#component/PortraitTooltip'
import useArtworkThumbnail from '#src/lib/useArtworkThumbnail.ts'

import css from './style.module.sass'

export type PortraitCollectionItemProps = {
  /** whether the work’s menu is open, which marks the work it is about */
  menuOpen?: boolean
  /** Called with a point of the viewport as the player asks for the work’s menu there: by a right click or by the context menu key. */
  onMenu: (x: number, y: number) => void
  /** Called as the player left-clicks the work, which opens its spectation view, and again on the spectated work, which closes it. */
  onSelect?: () => void
  portrait: Portrait
  /** whether the spectation view is showing this work, which marks it and keeps its tooltip out of the way */
  selected?: boolean
}

/**
 * A work of the collection as a small image in the shape of its frame, whose right click opens the work’s menu and whose left click opens its spectation view, another on the spectated work closing it again.
 * Once the player has interacted with the work in the world, showing interest in it by hovering or focusing it also tells what the gallery knows about it; until then, it stays faint and pale and keeps its title to itself here, which only its spectation view gives away.
 * A default work the player hasn’t interacted with yet offers no menu at all, only works that arrived since, which the player brought in, do from the start.
 */
export default function PortraitCollectionItem({menuOpen = false, onMenu, onSelect, portrait: p, selected = false}: PortraitCollectionItemProps) {
  const thumbnail = useArtworkThumbnail(p.source)
  const tooltipId = useId()
  const known = Boolean(p.interacted)
  const menuAvailable = known || Boolean(p.imported)
  const shape = clsx(css.container, p.width < p.height ? css.tall : css.wide, known && css.known, (menuOpen || selected) && css.chosen)
  const style = {aspectRatio: `${p.width} / ${p.height}`}
  return <>
    <button
      className={shape} aria-expanded={menuAvailable ? menuOpen : undefined} aria-haspopup={menuAvailable ? 'menu' : undefined} aria-label={known ? p.title : 'Untouched work'} aria-pressed={selected} data-interacted={known} data-portrait={p.id} data-selected={selected} interestfor={known && !selected ? tooltipId : undefined} style={style} type='button' onClick={onSelect} onContextMenu={event => {
        // Not even the browser’s own menu for a work without one, whose “Save image as…” would hand out its thumbnail.
        event.preventDefault()
        if (menuAvailable) {
          onMenu(event.clientX, event.clientY)
        }
      }}
    >
      {/* Dragging it would offer the page its own image as a new arrival. */}
      <Branch if={thumbnail}><img className={css.image} alt='' draggable={false} src={thumbnail} /></Branch>
    </button>
    <Branch if={known}><PortraitTooltip id={tooltipId} portrait={p} /></Branch>
  </>
}

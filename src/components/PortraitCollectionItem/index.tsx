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
  /** Called on left-click to spectate the work in the pause menu. */
  onSelect?: (portrait: Portrait) => void
  portrait: Portrait
  /** whether the work is currently shown in the spectation view */
  selected?: boolean
}

/**
 * A work of the collection as a small image in the shape of its frame.
 * Left-clicking any work opens it in the spectation view; once the player has interacted with the work in the world, hovering or focusing it also tells what the gallery knows about it.
 * A default work the player hasn’t interacted with yet offers no context menu, only works that arrived since, which the player brought in, do from the start.
 */
export default function PortraitCollectionItem({menuOpen = false, onMenu, onSelect, portrait: p, selected = false}: PortraitCollectionItemProps) {
  const thumbnail = useArtworkThumbnail(p.source)
  const tooltipId = useId()
  const known = Boolean(p.interacted)
  const hasMenu = known || Boolean(p.imported)
  const shape = clsx(css.container, p.width < p.height ? css.tall : css.wide, known && css.known, (menuOpen || selected) && css.chosen)
  const style = {aspectRatio: `${p.width} / ${p.height}`}
  return <>
    <button
      className={shape} aria-expanded={hasMenu ? menuOpen : undefined} aria-haspopup={hasMenu ? 'menu' : undefined} aria-label={known ? p.title : 'Untouched work'} aria-pressed={selected} data-interacted={known} data-portrait={p.id} interestfor={known ? tooltipId : undefined} style={style} type='button' onClick={() => onSelect?.(p)} onContextMenu={event => {
        event.preventDefault()
        if (hasMenu) {
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

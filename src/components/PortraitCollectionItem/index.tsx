import type {Portrait} from '#src/lib/gallery.ts'

import Branch from 'branch-component'
import clsx from 'clsx'
import {useId, useState} from 'react'

import PortraitTooltip from '#component/PortraitTooltip'
import useArtworkThumbnail from '#src/lib/useArtworkThumbnail.ts'

import css from './style.module.sass'

export type PortraitCollectionItemProps = {
  /** whether the work’s menu is open, which marks the work it is about */
  menuOpen?: boolean
  /** Called with a point of the viewport as the player asks for the work’s menu there: by a right click or by the context menu key. */
  onMenu: (x: number, y: number) => void
  portrait: Portrait
}

/**
 * A work of the collection as a small image in the shape of its frame, whose right click opens the work’s menu.
 * Once the player has interacted with the work in the world, showing interest in it by hovering or focusing it also tells what the gallery knows about it, and clicking it pins that tooltip, so its text can be selected and copied; until then, it stays faint and pale, keeps even its title to itself and does nothing on a click.
 * A default work the player hasn’t interacted with yet offers no menu at all, only works that arrived since, which the player brought in, do from the start.
 */
export default function PortraitCollectionItem({menuOpen = false, onMenu, portrait: p}: PortraitCollectionItemProps) {
  const thumbnail = useArtworkThumbnail(p.source)
  const tooltipId = useId()
  // the button while it pins the tooltip
  const [pinnedTo, setPinnedTo] = useState<HTMLElement>()
  const pinned = pinnedTo !== undefined
  const known = Boolean(p.interacted)
  const shape = clsx(css.container, p.width < p.height ? css.tall : css.wide, known && css.known, (menuOpen || pinned) && css.chosen)
  const style = {aspectRatio: `${p.width} / ${p.height}`}
  // Dragging it would offer the page its own image as a new arrival.
  const image = <Branch if={thumbnail}><img className={css.image} alt='' draggable={false} src={thumbnail} /></Branch>
  if (!known && !p.imported) {
    // Not even the browser’s own menu, whose “Save image as…” would hand out its thumbnail.
    return <div className={clsx(shape, css.locked)} aria-label='Untouched work' data-interacted={false} data-portrait={p.id} role='img' style={style} onContextMenu={event => event.preventDefault()}>{image}</div>
  }
  return <>
    <button
      className={shape} aria-expanded={menuOpen} aria-haspopup='menu' aria-label={known ? p.title : 'Untouched work'} aria-pressed={known ? pinned : undefined} data-interacted={known} data-portrait={p.id} interestfor={known && !pinned ? tooltipId : undefined} style={style} type='button' onClick={known ? event => setPinnedTo(pinned ? undefined : event.currentTarget) : undefined} onContextMenu={event => {
        event.preventDefault()
        onMenu(event.clientX, event.clientY)
      }}
    >
      {image}
    </button>
    <Branch if={known}><PortraitTooltip id={tooltipId} pinnedTo={pinnedTo} portrait={p} onUnpin={() => setPinnedTo(undefined)} /></Branch>
  </>
}

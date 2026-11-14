import type {Portrait} from '#src/lib/gallery.ts'
import type {MouseEvent} from 'react'

import Branch from 'branch-component'
import clsx from 'clsx'
import {useId} from 'react'

import PortraitTooltip from '#component/PortraitTooltip'
import useArtworkThumbnail from '#src/lib/useArtworkThumbnail.ts'

import css from './style.module.sass'

export type PortraitCollectionItemProps = {
  /** whether the work’s menu is open, which marks the work it is about */
  menuOpen?: boolean
  /** Called with a point of the viewport as the player asks for the work’s menu there: by a right click, by the context menu key or by clicking the work. */
  onMenu: (x: number, y: number) => void
  portrait: Portrait
}

/**
 * A work of the collection as a small image in the shape of its frame, which opens the work’s menu.
 * Once the player has interacted with the work in the world, showing interest in it by hovering or focusing it also tells what the gallery knows about it; until then, it stays faint and pale and keeps even its title to itself.
 * A default work the player hasn’t interacted with yet offers no menu at all, only works that arrived since, which the player brought in, do from the start.
 */
export default function PortraitCollectionItem({menuOpen = false, onMenu, portrait: p}: PortraitCollectionItemProps) {
  const thumbnail = useArtworkThumbnail(p.source)
  const tooltipId = useId()
  const known = Boolean(p.interacted)
  const shape = clsx(css.container, p.width < p.height ? css.tall : css.wide, known && css.known, menuOpen && css.chosen)
  const style = {aspectRatio: `${p.width} / ${p.height}`}
  // Dragging it would offer the page its own image as a new arrival.
  const image = <Branch if={thumbnail}><img className={css.image} alt='' draggable={false} src={thumbnail} /></Branch>
  if (!known && !p.imported) {
    // Not even the browser’s own menu, whose “Save image as…” would hand out its thumbnail.
    return <div className={clsx(shape, css.locked)} aria-label='Untouched work' data-interacted={false} data-portrait={p.id} role='img' style={style} onContextMenu={event => event.preventDefault()}>{image}</div>
  }
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    // A click by keyboard has no pointer to open the menu at.
    if (event.detail === 0) {
      const {left, top, width, height} = event.currentTarget.getBoundingClientRect()
      onMenu(left + width / 2, top + height / 2)
    } else {
      onMenu(event.clientX, event.clientY)
    }
  }
  return <>
    <button
      className={shape} aria-expanded={menuOpen} aria-haspopup='menu' aria-label={known ? p.title : 'Untouched work'} data-interacted={known} data-portrait={p.id} interestfor={known ? tooltipId : undefined} style={style} type='button' onClick={handleClick} onContextMenu={event => {
        event.preventDefault()
        onMenu(event.clientX, event.clientY)
      }}
    >
      {image}
    </button>
    <Branch if={known}><PortraitTooltip id={tooltipId} portrait={p} /></Branch>
  </>
}

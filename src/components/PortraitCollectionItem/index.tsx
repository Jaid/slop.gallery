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
 * Once the player has interacted with the work in the world, showing interest in it by hovering or focusing it also tells what the gallery knows about it; until then, it stays gray and keeps even its title to itself.
 */
export default function PortraitCollectionItem({menuOpen = false, onMenu, portrait: p}: PortraitCollectionItemProps) {
  const thumbnail = useArtworkThumbnail(p.source)
  const tooltipId = useId()
  const known = Boolean(p.interacted)
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
      className={clsx(css.container, p.width < p.height ? css.tall : css.wide, known && css.known, menuOpen && css.chosen)} aria-expanded={menuOpen} aria-haspopup='menu' aria-label={known ? p.title : 'Untouched work'} data-interacted={known} data-portrait={p.id} interestfor={known ? tooltipId : undefined} style={{aspectRatio: `${p.width} / ${p.height}`}} type='button' onClick={handleClick} onContextMenu={event => {
        event.preventDefault()
        onMenu(event.clientX, event.clientY)
      }}
    >
      {/* Dragging it would offer the page its own image as a new arrival. */}
      <Branch if={thumbnail}><img className={css.image} alt='' draggable={false} src={thumbnail} /></Branch>
    </button>
    <Branch if={known}><PortraitTooltip id={tooltipId} portrait={p} /></Branch>
  </>
}

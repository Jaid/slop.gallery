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
  /** Called as the player clicks the work, to show it up close, or to put that view away again if it shows this work. */
  onSpectate: () => void
  portrait: Portrait
  /** whether the pause menu shows the work up close, which marks it too */
  spectated?: boolean
}

/**
 * A work of the collection as a small image in the shape of its frame: a click shows it up close, and a right click opens its menu.
 * Once the player has interacted with the work in the world, showing interest in it by hovering or focusing it also tells what the gallery knows about it, unless the menu already tells so up close; until then, it stays faint and pale and keeps even its title to itself.
 * A default work the player hasn’t interacted with yet offers no menu, only works that arrived since, which the player brought in, do from the start.
 */
export default function PortraitCollectionItem({menuOpen = false, onMenu, onSpectate, portrait: p, spectated = false}: PortraitCollectionItemProps) {
  const thumbnail = useArtworkThumbnail(p.source)
  const tooltipId = useId()
  const known = Boolean(p.interacted)
  const hasMenu = known || Boolean(p.imported)
  // Up close, the menu tells the same beside it, where the tooltip of a work at the grid’s edge would cover it.
  const hasTooltip = known && !spectated
  return <>
    <button
      className={clsx(css.container, p.width < p.height ? css.tall : css.wide, known && css.known, (menuOpen || spectated) && css.chosen)} aria-expanded={hasMenu ? menuOpen : undefined} aria-haspopup={hasMenu ? 'menu' : undefined} aria-label={known ? p.title : 'Untouched work'} aria-pressed={spectated} data-interacted={known} data-portrait={p.id} interestfor={hasTooltip ? tooltipId : undefined} style={{aspectRatio: `${p.width} / ${p.height}`}} type='button' onClick={onSpectate} onContextMenu={event => {
        // Not even the browser’s own menu for a work without one, whose “Save image as…” would hand out its thumbnail.
        event.preventDefault()
        if (hasMenu) {
          onMenu(event.clientX, event.clientY)
        }
      }}
    >
      {/* Dragging it would offer the page its own image as a new arrival. */}
      <Branch if={thumbnail}><img className={css.image} alt='' draggable={false} src={thumbnail} /></Branch>
    </button>
    <Branch if={hasTooltip}><PortraitTooltip id={tooltipId} portrait={p} /></Branch>
  </>
}

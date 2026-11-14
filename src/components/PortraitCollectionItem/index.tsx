import type {Portrait} from '#src/lib/gallery.ts'

import Branch from 'branch-component'
import clsx from 'clsx'
import {useId} from 'react'

import PortraitTooltip from '#component/PortraitTooltip'
import useArtworkThumbnail from '#src/lib/useArtworkThumbnail.ts'

import css from './style.module.sass'

export type PortraitCollectionItemProps = {
  /** whether the work’s export menu is open */
  menuOpen?: boolean
  /** Called by left click, Enter or Space to inspect the work, even before meeting it in the world. */
  onInspect: (button: HTMLButtonElement) => void
  /** Called with a viewport point by right click or the keyboard’s context-menu command. */
  onMenu: (x: number, y: number) => void
  portrait: Portrait
  selected?: boolean
}

/** Every work opens the studio on activation. Known works still offer a hover hint; only known or imported works offer exports, as before. */
export default function PortraitCollectionItem({menuOpen = false, onInspect, onMenu, portrait: p, selected = false}: PortraitCollectionItemProps) {
  const thumbnail = useArtworkThumbnail(p.source)
  const tooltipId = useId()
  const known = Boolean(p.interacted)
  const canExport = known || p.imported
  const shape = clsx(css.container, p.width < p.height ? css.tall : css.wide, known && css.known, (menuOpen || selected) && css.chosen)
  return <>
    <button
      className={shape} aria-label={known ? p.title : 'Untouched work'} aria-pressed={selected} data-interacted={known} data-portrait={p.id} interestfor={known && !selected && !menuOpen ? tooltipId : undefined} style={{aspectRatio: `${p.width} / ${p.height}`}} type='button' onClick={event => onInspect(event.currentTarget)} onContextMenu={event => {
        event.preventDefault()
        if (canExport) {
          onMenu(event.clientX, event.clientY)
        }
      }} onKeyDown={event => {
        if (event.key === 'ContextMenu' || event.shiftKey && event.key === 'F10') {
          event.preventDefault()
          if (canExport) {
            const rect = event.currentTarget.getBoundingClientRect()
            onMenu(rect.left + rect.width / 2, rect.top + rect.height / 2)
          }
        }
      }}
    >
      {/* Dragging it would offer the page its own image as a new arrival. */}
      <Branch if={thumbnail}><img className={css.image} alt='' draggable={false} src={thumbnail} /></Branch>
    </button>
    <Branch if={known && !selected && !menuOpen}><PortraitTooltip id={tooltipId} portrait={p} /></Branch>
  </>
}

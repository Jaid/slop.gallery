import type {Portrait} from '#src/lib/gallery.ts'

import clsx from 'clsx'
import {useLayoutEffect, useRef} from 'react'

import css from './style.module.sass'

export type PortraitTooltipProps = {
  id: string
  /** Called once a pinned tooltip has closed; stop pinning it then. */
  onUnpin?: () => void
  /** the button the tooltip is pinned to, which keeps it open with its text selectable until a click elsewhere, the Escape key or the button lets go of it; while left out, it comes and goes with the interest in the button whose `interestfor` names `id` */
  pinnedTo?: HTMLElement
  portrait: Pick<Portrait, 'creator' | 'description' | 'title' | 'year'>
}

/** What the gallery tells about a work, its title, description, creator and year, as a tooltip for a button. */
export default function PortraitTooltip({id, pinnedTo, onUnpin, portrait: p}: PortraitTooltipProps) {
  const tooltip = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const element = tooltip.current!
    // Turning from a hint into a popover of its own closed it, if the interest had it open.
    if (pinnedTo && !element.matches(':popover-open')) {
      element.showPopover({source: pinnedTo})
    }
  }, [pinnedTo])
  return <div
    id={id} className={clsx(css.container, pinnedTo && css.pinned)} data-testid='portrait-tooltip' popover={pinnedTo ? 'auto' : 'hint'} ref={tooltip} onToggle={event => {
      // A hint that closed as it was pinned reports only after it opened again.
      if (event.newState === 'closed' && !event.currentTarget.matches(':popover-open')) {
        onUnpin?.()
      }
    }}
  >
    <p className={css.title}>{p.title}</p>
    <p className={css.description}>{p.description}</p>
    <p className={css.byline}><span>{p.creator}</span><span aria-hidden='true'> · </span><span>{p.year ?? 'Undated'}</span></p>
  </div>
}

import type {Portrait} from '#src/lib/gallery.ts'

import css from './style.module.sass'

export type PortraitTooltipProps = {
  id: string
  portrait: Pick<Portrait, 'creator' | 'description' | 'title' | 'year'>
}

/** A hover/focus hint for a known work. Its full, selectable plate lives in the portrait studio instead of a pinned popover. */
export default function PortraitTooltip({id, portrait: p}: PortraitTooltipProps) {
  return <div id={id} className={css.container} data-testid='portrait-tooltip' popover='hint'>
    <p className={css.title}>{p.title}</p>
    <p className={css.description}>{p.description}</p>
    <p className={css.byline}><span>{p.creator}</span><span aria-hidden='true'> · </span><span>{p.year ?? 'Undated'}</span></p>
  </div>
}

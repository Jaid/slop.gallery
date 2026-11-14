import type {Portrait} from '#src/lib/gallery.ts'

import css from './style.module.sass'

export type PortraitTooltipProps = {
  id: string
  portrait: Pick<Portrait, 'creator' | 'description' | 'title' | 'year'>
}

/** What the gallery tells about a work, its title, description, creator and year, as a hint for the button whose `interestfor` names `id`, which shows it while the player hovers or focuses the button. */
export default function PortraitTooltip({id, portrait: p}: PortraitTooltipProps) {
  return <div id={id} className={css.container} data-testid='portrait-tooltip' popover='hint'>
    <p className={css.title}>{p.title}</p>
    <p className={css.description}>{p.description}</p>
    <p className={css.byline}><span>{p.creator}</span><span aria-hidden='true'> · </span><span>{p.year ?? 'Undated'}</span></p>
  </div>
}

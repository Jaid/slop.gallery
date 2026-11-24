import type {Portrait} from '#src/lib/gallery.ts'

import Branch from 'branch-component'

import PortraitByline from '#component/PortraitByline'

import css from './style.module.sass'

export type PortraitTooltipProps = {
  id: string
  portrait: Pick<Portrait, 'creator' | 'description' | 'title' | 'year'>
}

/** What the gallery tells about a work, its title, description, creator and year, as far as anyone told, as a tooltip that comes and goes with the interest in the button whose `interestfor` names `id`. */
export default function PortraitTooltip({id, portrait: p}: PortraitTooltipProps) {
  return <div id={id} className={css.container} data-testid='portrait-tooltip' popover='hint'>
    <Branch if={p.title}><p className={css.title}>{p.title}</p></Branch>
    <Branch if={p.description}><p className={css.description}>{p.description}</p></Branch>
    <PortraitByline className={css.byline} portrait={p} />
  </div>
}

import type {Portrait} from '#src/lib/gallery.ts'

import Branch from 'branch-component'

import PortraitByline from '#component/PortraitByline'
import {hasDetails} from '#src/lib/gallery/portraitFlavor.ts'

import css from './style.module.sass'

/** What the gallery tells about the work whose placard the player aims at, its title, description, creator and year, as far as anyone told, or nothing while nobody has. */
export default function ArtworkOverlay({portrait: p}: {portrait: Portrait}) {
  if (!hasDetails(p)) {
    return null
  }
  return <section className={css.container} aria-label='Artwork details' data-testid='artwork-overlay'>
    <Branch if={p.title}><h2>{p.title}</h2></Branch>
    <Branch if={p.description}><p className={css.description}>{p.description}</p></Branch>
    <PortraitByline className={css.byline} portrait={p} />
  </section>
}

import type {Portrait} from '#src/lib/gallery.ts'

import Branch from 'branch-component'
import clsx from 'clsx'
import {upperFirst} from 'es-toolkit'
import {useEffect, useSyncExternalStore} from 'react'

import PortraitViewer from '#component/PortraitViewer'
import {isTextInput} from '#src/lib/gallery.ts'
import portraitRoom from '#src/lib/gallery/portraitRoom.ts'
import {usePortraitSpectation} from '#src/lib/gallery/portraitSpectation.ts'
import workName from '#src/lib/gallery/workName.ts'
import subscribeToFrames from '#src/lib/subscribeToFrames.ts'

import css from './style.module.sass'

/** Puts the view away and hands the focus back to the work in the collection the view came from instead of leaving it nowhere. */
const close = () => {
  const {id} = usePortraitSpectation.getState()
  usePortraitSpectation.getState().close()
  if (id !== null) {
    document.querySelector<HTMLElement>(`[data-testid='portrait-collection'] [data-portrait='${CSS.escape(id)}']`)?.focus({preventScroll: true})
  }
}
/** The size of a work’s image, in whole centimeters, like “212 cm × 141 cm”. */
const sizeOf = ({width, height}: Portrait) => `${Math.round(width * 100)} cm × ${Math.round(height * 100)} cm`

/**
 * A work of the collection up close, in place of the pause menu’s map and its main column: above, the work as the object it is in the world, to turn around, see `PortraitViewer`, and below what the gallery tells about it, its title, description, creator and year, as far as anyone told, its size and the room it is in right now, which follows a loose work around.
 * A work the player hasn’t interacted with yet shows faint and keeps all of that to itself but its room, like it has no tooltip in the collection.
 * The Escape key or another click on the work in the collection brings the map back.
 */
export default function PortraitSpectation({className, portrait: p}: {
  className?: string
  portrait: Portrait
}) {
  const known = Boolean(p.interacted)
  // The body of a loose work moves without telling anyone wherever the world still runs behind the menu, like while it isn’t ready, and whatever moves it from outside, like a tool, doesn’t tell either.
  const roomTitle = () => portraitRoom(p)?.title
  const room = useSyncExternalStore(subscribeToFrames, roomTitle, roomTitle)
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      // A menu open above it takes the key for itself. A tooltip goes along with the view.
      if (event.code !== 'Escape' || event.repeat || isTextInput(event.target) || document.querySelector('[role="menu"]:popover-open')) {
        return
      }
      event.preventDefault()
      close()
    }
    globalThis.addEventListener('keydown', keydown)
    return () => globalThis.removeEventListener('keydown', keydown)
  }, [])
  return <article className={clsx(css.container, className)} data-interacted={known} data-portrait={p.id} data-testid='portrait-spectation'>
    {/* A stage of its own for every work, so nothing it knows of the work before, like that its model stood there, passes for this one’s. */}
    <PortraitViewer key={p.id} faint={!known} label={known ? `${upperFirst(workName(p))} in its frame` : 'An untouched work in its frame'} portrait={p} />
    <div className={css.details}>
      {/* A work without a title shows no heading, which still names the view for assistive technology. */}
      <h1 id='menu-title' aria-label={known && !p.title ? 'Untitled work' : undefined}><Branch if={known} then={p.title} else='Untouched work' /></h1>
      <dl className={css.facts}>
        <Branch if={known}>
          <Branch if={p.creator}><div><dt>Creator</dt><dd>{p.creator}</dd></div></Branch>
          <Branch if={p.year !== undefined}><div><dt>Year</dt><dd>{p.year}</dd></div></Branch>
          <div><dt>Size</dt><dd data-testid='portrait-size'>{sizeOf(p)}</dd></div>
        </Branch>
        <div><dt>Room</dt><dd data-testid='portrait-room'>{room ?? 'Between rooms'}</dd></div>
      </dl>
      <Branch if={known} else={<p className={css.secret}>Find it in the gallery and listen to it, grab it or view it up close to learn what there is to know about it.</p>}><Branch if={p.description}><p className={css.description}>{p.description}</p></Branch></Branch>
    </div>
  </article>
}

import type {Portrait} from '#src/lib/gallery.ts'

import Branch from 'branch-component'
import clsx from 'clsx'
import {useEffect, useSyncExternalStore} from 'react'

import Icon from '#component/Icon'
import PortraitViewer from '#component/PortraitViewer'
import {isTextInput} from '#src/lib/gallery.ts'
import portraitRoom from '#src/lib/gallery/portraitRoom.ts'
import {usePortraitSpectation} from '#src/lib/gallery/portraitSpectation.ts'
import subscribeToFrames from '#src/lib/subscribeToFrames.ts'

import css from './style.module.sass'

/**
 * Puts the view away.
 * @param byKeyboard whether a key did, which hands the focus back to the work in the collection the view came from instead of leaving it nowhere
 */
const close = (byKeyboard: boolean) => {
  const {id} = usePortraitSpectation.getState()
  usePortraitSpectation.getState().close()
  if (byKeyboard && id !== null) {
    document.querySelector<HTMLElement>(`[data-testid='portrait-collection'] [data-portrait='${CSS.escape(id)}']`)?.focus({preventScroll: true})
  }
}

/**
 * A work of the collection up close, in place of the pause menu’s map and its main column: above, the work as the object it is in the world, to turn around, see `PortraitViewer`, and below what the gallery tells about it, its title, description, creator and year, and the room it is in right now, which follows a loose work around.
 * A work the player hasn’t interacted with yet shows faint and keeps all of that to itself but its room, like it has no tooltip in the collection.
 * The Escape key and its close button bring the map back.
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
      close(true)
    }
    globalThis.addEventListener('keydown', keydown)
    return () => globalThis.removeEventListener('keydown', keydown)
  }, [])
  return <article className={clsx(css.container, className)} data-interacted={known} data-portrait={p.id} data-testid='portrait-spectation'>
    {/* A stage of its own for every work, so nothing it knows of the work before, like that its model stood there, passes for this one’s. */}
    <PortraitViewer key={p.id} faint={!known} label={known ? `“${p.title}” in its frame` : 'An untouched work in its frame'} portrait={p} />
    <button className={css.close} aria-label='Back to the map' title='Back to the map' type='button' onClick={event => close(event.detail === 0)}><Icon name='close' size={18} /></button>
    <div className={css.details}>
      <h1 id='menu-title'><Branch if={known} then={p.title} else='Untouched work' /></h1>
      <dl className={css.facts}>
        <Branch if={known}>
          <div><dt>Creator</dt><dd>{p.creator}</dd></div>
          <div><dt>Year</dt><dd>{p.year ?? 'Undated'}</dd></div>
        </Branch>
        <div><dt>Room</dt><dd data-testid='portrait-room'>{room ?? 'Between rooms'}</dd></div>
      </dl>
      <Branch if={known} else={<p className={css.secret}>Find it in the gallery and listen to it, grab it or view it up close to learn what there is to know about it.</p>}><p className={css.description}>{p.description}</p></Branch>
    </div>
  </article>
}

import type {Portrait} from '#src/lib/gallery.ts'

import Branch from 'branch-component'
import {lazy, Suspense, useLayoutEffect, useRef, useState, useSyncExternalStore} from 'react'

import Icon from '#component/Icon'
import {enterGallery, useGallery} from '#src/lib/gallery.ts'
import portraitRoom from '#src/lib/gallery/portraitRoom.ts'
import subscribeToFrames from '#src/lib/subscribeToFrames.ts'
import world from '#src/worlds/current.ts'

import StudioBoundary from './StudioBoundary.tsx'

import css from './style.module.sass'

const Studio = lazy(() => import('./Studio.tsx'))

/** The pause menu’s map and main columns become a studio and a readable, selectable plate. Looking here does not count as meeting a work in the world. */
export default function PortraitSpectation({onClose, portrait: p}: {
  onClose: () => void
  portrait: Portrait
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  const ready = useGallery(s => s.ready)
  const [reset, setReset] = useState(0)
  const getRoom = () => portraitRoom(world, p)
  const room = useSyncExternalStore(subscribeToFrames, getRoom, getRoom)
  useLayoutEffect(() => {
    heading.current?.focus({preventScroll: true})
  }, [p.id])
  return <section className={css.container} aria-labelledby='portrait-title' data-testid='portrait-spectation'>
    <div className={css.toolbar}>
      <button type='button' onClick={onClose}><Icon name='close' size={16} />Back to menu</button>
      <button disabled={!ready} type='button' onClick={enterGallery}>Resume<Icon name='arrow' size={16} /></button>
    </div>
    <div className={css.studio} aria-label='Orbitable 3D portrait' data-interacted={Boolean(p.interacted)}>
      <StudioBoundary portraitId={p.id}><Suspense fallback={<p role='status'>Opening studio…</p>}><Studio portrait={p} reset={reset} /></Suspense></StudioBoundary>
    </div>
    <div className={css.controls}>
      <span>Drag to rotate · Scroll to zoom</span>
      <button type='button' onClick={() => setReset(value => value + 1)}>Reset view</button>
    </div>
    <div className={css.details}>
      <h1 id='portrait-title' tabIndex={-1} ref={heading}>{p.title}</h1>
      <p className={css.byline}><span>{p.creator}</span><span aria-hidden='true'> · </span><span>{p.year ?? 'Undated'}</span></p>
      <p className={css.description}>{p.description}</p>
      <p className={css.location}>Current room: <span data-testid='portrait-room'>{room?.title ?? 'Outside the rooms'}</span></p>
      <Branch not={p.interacted}><p className={css.untouched}>Not yet interacted with in the world.</p></Branch>
    </div>
  </section>
}

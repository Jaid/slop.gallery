import type useGalleryAI from '#src/lib/useGalleryAI.ts'
import type {PauseMenuStage} from 'use-pause-menu'

import Branch from 'branch-component'
import clsx from 'clsx'
import {useCallback, useEffect, useRef, useState} from 'react'
import useGraphicsMode from 'use-graphics-mode'
import usePauseMenu from 'use-pause-menu'

import Icon from '#component/Icon'
import MenuNarration from '#component/MenuNarration'
import MenuOptions from '#component/MenuOptions'
import Minimap from '#component/Minimap'
import OpenRouterConnection from '#component/OpenRouterConnection'
import PortraitCollection from '#component/PortraitCollection'
import PortraitSpectation from '#component/PortraitSpectation'
import icon from '#root/assets/icon.svg'
import {enterGallery, useGallery} from '#src/lib/gallery.ts'
import {useIntro} from '#src/lib/gallery/intro.ts'
import {startNewGame} from '#src/lib/gameSeed.ts'
import pauseMenu from '#src/lib/pauseMenu.ts'
import world from '#src/worlds/current.ts'

import css from './style.module.sass'

export default function Menu(settings: ReturnType<typeof useGalleryAI>) {
  const s = useGallery()
  const {stage} = usePauseMenu(pauseMenu)
  const isHeavy = useGraphicsMode()
  const room = world.roomById(s.room) ?? world.room(world.defaultRoom)
  const paused = stage === 'pause'
  const tagline = paused ? world.roomTagline(room) : world.tagline
  const heading = useRef<HTMLHeadingElement>(null)
  // Until the player first enters, the menu leaves the intro in full view: the title above it, the buttons below.
  const intro = useIntro(state => state.orbit !== null) && (stage === 'first' || stage === 'return')
  // The work of the collection the player left-clicked, close up in place of the map and of this column, until they go back or click it again. Only the pause stage shows it.
  const [spectatedId, setSpectatedId] = useState<string | null>(null)
  const spectated = paused ? s.portraits.find(portrait => portrait.id === spectatedId) : undefined
  const closeSpectation = useCallback(() => {
    setSpectatedId(null)
    // The collection stays beside the view the whole time, so its work is still there to take the focus back.
    if (spectatedId) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-testid="portrait-collection"] [data-portrait="${CSS.escape(spectatedId)}"]`)?.focus({preventScroll: true}))
    }
  }, [spectatedId])
  useEffect(() => {
    heading.current?.focus({preventScroll: true})
  }, [])
  if (intro) {
    return <section className={clsx(css.container, css.intro, isHeavy && css.heavy)} aria-labelledby='menu-title' data-stage={stage} data-testid='menu-overlay'>
      <header className={css.header}>
        <img className={css.logo} alt='' height={128} src={icon} width={128} />
        <h1 id='menu-title' tabIndex={-1} ref={heading}>{world.title}</h1>
      </header>
      <div className={css.actions}>
        <div className={css.play}>
          <button id='enter-gallery' className={css.enter} disabled={!s.ready} type='button' onClick={enterGallery}>{s.ready ? 'Play' : enterButtonLabel(false, stage)}</button>
          <Branch if={stage === 'return'}><button className={css.newGame} disabled={!s.ready} type='button' onClick={startNewGame}>Reroll seed</button></Branch>
        </div>
        <MenuOptions className={css.options} />
      </div>
    </section>
  }
  return <section className={css.container} aria-labelledby='menu-title' data-stage={stage} data-testid='menu-overlay'>
    <div className={css.layout}>
      {/* The pause menu’s sides: the map of the floor the player is on, and every work in the world. A work left-clicked there stands in for the map and for the main column until the player goes back. */}
      <Branch if={spectated}><PortraitSpectation portrait={spectated!} titleId='menu-title' onClose={closeSpectation} /></Branch>
      <Branch if={paused} not={spectated} then={Minimap} />
      <Branch not={spectated}><div className={css.content}>
        <h1 id='menu-title' tabIndex={-1} ref={heading}><Branch if={paused} then={room.title} else={world.title} /></h1>
        <Branch not={stage === 'unfocus'}><p className={css.tagline}>{tagline}</p></Branch>
        <button id='enter-gallery' className={css.enter} disabled={!s.ready} type='button' onClick={stage === 'reset' ? startNewGame : enterGallery}>{enterButtonLabel(s.ready, stage)}<Icon name='arrow' size={18} /></button>
        <Branch if={stage === 'return'}><button className={css.newGame} disabled={!s.ready} type='button' onClick={startNewGame}>Reroll seed</button></Branch>
        <Branch not={stage === 'unfocus'}>
          <MenuOptions />
          <Branch if={settings.available}><OpenRouterConnection {...settings} /></Branch>
          <MenuNarration />
        </Branch>
      </div></Branch>
      <Branch if={paused}><PortraitCollection selectedId={spectated?.id} onSelect={id => setSpectatedId(current => (current === id ? null : id))} /></Branch>
    </div>
  </section>
}

function enterButtonLabel(ready: boolean, stage: PauseMenuStage) {
  if (!ready) {
    return `Opening ${world.title}…`
  }
  if (stage === 'reset') {
    return 'Reroll seed'
  }
  if (stage === 'first') {
    return world.enterLabel
  }
  if (stage === 'return') {
    return 'Continue'
  }
  return 'Resume'
}

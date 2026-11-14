import type useGalleryAI from '#src/lib/useGalleryAI.ts'
import type {PauseMenuStage} from 'use-pause-menu'

import Branch from 'branch-component'
import clsx from 'clsx'
import {useEffect, useRef, useState} from 'react'
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
  const heading = useRef<HTMLHeadingElement>(null)
  const paused = stage === 'pause'
  const [inspecting, setInspecting] = useState<{
    button: HTMLButtonElement
    id: string
  }>()
  const selected = paused ? s.portraits.find(portrait => portrait.id === inspecting?.id) : undefined
  const closeInspector = () => {
    setInspecting(undefined)
    if (inspecting?.button.isConnected) {
      inspecting.button.focus({preventScroll: true})
    } else {
      requestAnimationFrame(() => heading.current?.focus({preventScroll: true}))
    }
  }
  // Adjust during render, so a removed work or a stage change cannot revive an old selection later.
  if (inspecting && !selected) {
    setInspecting(undefined)
  }
  const tagline = paused ? world.roomTagline(room) : world.tagline
  // Until the player first enters, the menu leaves the intro in full view: the title above it, the buttons below.
  const intro = useIntro(state => state.orbit !== null) && (stage === 'first' || stage === 'return')
  useEffect(() => {
    // Also recover focus if a fusion removed the selected work while the menu was open.
    if (document.activeElement === document.body) {
      heading.current?.focus({preventScroll: true})
    }
  }, [selected])
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
  return <section
    className={css.container} aria-labelledby={selected ? 'portrait-title' : 'menu-title'} data-stage={stage} data-testid='menu-overlay' onKeyDown={event => {
      // Escape closes a top-layer export menu first, otherwise returns from the studio without resuming the world.
      if (selected && event.key === 'Escape' && !event.defaultPrevented && !(event.target as HTMLElement).closest('[popover]:popover-open')) {
        event.preventDefault()
        event.stopPropagation()
        closeInspector()
      }
    }}
  >
    <div className={css.layout}>
      {/* The pause menu’s sides: the map of the floor the player is on, and every work in the world. */}
      <Branch
        if={selected} else={<>
          <Branch if={paused} then={Minimap} />
          <div className={css.content}>
            <h1 id='menu-title' tabIndex={-1} ref={heading}><Branch if={paused} then={room.title} else={world.title} /></h1>
            <Branch not={stage === 'unfocus'}><p className={css.tagline}>{tagline}</p></Branch>
            <button id='enter-gallery' className={css.enter} disabled={!s.ready} type='button' onClick={stage === 'reset' ? startNewGame : enterGallery}>{enterButtonLabel(s.ready, stage)}<Icon name='arrow' size={18} /></button>
            <Branch if={stage === 'return'}><button className={css.newGame} disabled={!s.ready} type='button' onClick={startNewGame}>Reroll seed</button></Branch>
            <Branch not={stage === 'unfocus'}>
              <MenuOptions />
              <Branch if={settings.available}><OpenRouterConnection {...settings} /></Branch>
              <MenuNarration />
            </Branch>
          </div>
        </>}
      ><PortraitSpectation portrait={selected!} onClose={closeInspector} /></Branch>
      <Branch if={paused}><PortraitCollection
        selectedId={selected?.id} onInspect={(id, button) => setInspecting({
          id,
          button,
        })}
      /></Branch>
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

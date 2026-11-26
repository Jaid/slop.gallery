import Branch from 'branch-component'
import clsx from 'clsx'
import {useId} from 'react'

import GraphicsHints from '#component/GraphicsHints'
import Icon from '#component/Icon'
import {switchGraphics, toggleSound, useGallery} from '#src/lib/gallery.ts'
import {graphicsQuality, useNextGraphics} from '#src/lib/rendering/graphicsQuality.ts'

import css from './style.module.sass'

const graphicsLabels = {
  fast: 'Fast',
  heavy: 'Heavy',
  cinematic: 'Cinematic',
} as const

export default function MenuOptions({className}: {className?: string}) {
  const sound = useGallery(s => s.sound)
  // The button shows the graphics of the next reload, which only differ from this page’s once it was clicked.
  const next = useNextGraphics(state => state.quality)
  const pending = next !== graphicsQuality
  const graphicsHintsId = useId()
  return <div className={clsx(css.container, className)}>
    <button className={css.option} aria-label='Mute audio' aria-pressed={!sound} type='button' onClick={toggleSound}><Icon name={sound ? 'sound' : 'mute'} size={18} /><span>Audio</span><small>{sound ? 'On' : 'Muted'}</small></button>
    <button className={css.option} aria-label='Heavy graphics' aria-pressed={next !== 'fast'} data-pending={pending || undefined} interestfor={graphicsHintsId} type='button' onClick={switchGraphics}><Icon name='settings' size={18} /><span>Graphics</span><small><Branch if={pending}><Icon name='reload' size={14} /></Branch>{graphicsLabels[next]}</small></button>
    <GraphicsHints id={graphicsHintsId} current={pending ? graphicsLabels[graphicsQuality] : undefined} />
  </div>
}

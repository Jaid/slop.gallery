import clsx from 'clsx'
import {useId, useState} from 'react'

import GraphicsHints from '#component/GraphicsHints'
import Icon from '#component/Icon'
import {toggleSound, useGallery} from '#src/lib/gallery.ts'
import {readNextGraphicsQuality, toggleGraphicsPreference} from '#src/lib/rendering/graphicsMode.ts'

import css from './style.module.sass'

/** the menu’s Graphics value by the quality the next load goes by */
const graphicsLabels = {
  fast: 'Fast',
  heavy: 'Heavy',
  cinematic: 'Cinematic',
} as const

export default function MenuOptions({className}: {className?: string}) {
  const sound = useGallery(s => s.sound)
  // What the next load renders with; this page keeps rendering with the graphics it loaded with, so flipping it only changes this label and the stored preference, or, where the permalink carries its graphics, goes to the same URL with the new ones.
  const [nextQuality, setNextQuality] = useState(readNextGraphicsQuality)
  const graphicsHintsId = useId()
  return <div className={clsx(css.container, className)}>
    <button className={css.option} aria-label='Mute audio' aria-pressed={!sound} type='button' onClick={toggleSound}><Icon name={sound ? 'sound' : 'mute'} size={18} /><span>Audio</span><small>{sound ? 'On' : 'Muted'}</small></button>
    <button
      className={css.option} aria-label='Heavy graphics' aria-pressed={nextQuality !== 'fast'} interestfor={graphicsHintsId} type='button' onClick={() => setNextQuality(toggleGraphicsPreference().next)}
    ><Icon name='settings' size={18} /><span>Graphics</span><small>{graphicsLabels[nextQuality]}</small></button>
    <GraphicsHints id={graphicsHintsId} />
  </div>
}

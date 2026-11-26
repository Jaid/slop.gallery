import type {GraphicsQuality} from '#src/lib/rendering/graphicsQuality.ts'

import clsx from 'clsx'
import {useId} from 'react'

import GraphicsHints from '#component/GraphicsHints'
import Icon from '#component/Icon'
import {toggleSound, useGallery} from '#src/lib/gallery.ts'
import {toggleGraphicsQuality, useSelectedGraphics} from '#src/lib/rendering/graphicsQuality.ts'

import css from './style.module.sass'

const graphicsLabels: Record<GraphicsQuality, string> = {
  fast: 'Fast',
  heavy: 'Heavy',
  cinematic: 'Cinematic',
}

export default function MenuOptions({className}: {className?: string}) {
  const sound = useGallery(s => s.sound)
  const graphics = useSelectedGraphics(s => s.quality)
  const graphicsHintsId = useId()
  return <div className={clsx(css.container, className)}>
    <button className={css.option} aria-label='Mute audio' aria-pressed={!sound} type='button' onClick={toggleSound}><Icon name={sound ? 'sound' : 'mute'} size={18} /><span>Audio</span><small>{sound ? 'On' : 'Muted'}</small></button>
    <button className={css.option} aria-label='Heavy graphics' aria-pressed={graphics !== 'fast'} interestfor={graphicsHintsId} type='button' onClick={toggleGraphicsQuality}><Icon name='settings' size={18} /><span>Graphics</span><small>{graphicsLabels[graphics]}</small></button>
    <GraphicsHints id={graphicsHintsId} />
  </div>
}

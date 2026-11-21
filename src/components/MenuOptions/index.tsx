import clsx from 'clsx'
import {useId} from 'react'
import useGraphicsMode, {useCinematicGraphics, useSetGraphicsMode} from 'use-graphics-mode'

import GraphicsHints from '#component/GraphicsHints'
import Icon from '#component/Icon'
import {toggleSound, useGallery} from '#src/lib/gallery.ts'

import css from './style.module.sass'

export default function MenuOptions({className}: {className?: string}) {
  const sound = useGallery(s => s.sound)
  const isHeavy = useGraphicsMode()
  const setIsHeavy = useSetGraphicsMode()
  const isCinematic = useCinematicGraphics()
  const graphicsHintsId = useId()
  return <div className={clsx(css.container, className)}>
    <button className={css.option} aria-label='Mute audio' aria-pressed={!sound} type='button' onClick={toggleSound}><Icon name={sound ? 'sound' : 'mute'} size={18} /><span>Audio</span><small>{sound ? 'On' : 'Muted'}</small></button>
    <button className={css.option} aria-label='Heavy graphics' aria-pressed={isHeavy} interestfor={graphicsHintsId} type='button' onClick={() => setIsHeavy(!isHeavy)}><Icon name='settings' size={18} /><span>Graphics</span><small>{isHeavy ? (isCinematic ? 'Cinematic' : 'Heavy') : 'Fast'}</small></button>
    <GraphicsHints id={graphicsHintsId} />
  </div>
}

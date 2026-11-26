import clsx from 'clsx'
import {useId, useState} from 'react'

import GraphicsHints from '#component/GraphicsHints'
import Icon from '#component/Icon'
import {notify, toggleSound, useGallery} from '#src/lib/gallery.ts'
import {graphicsOverride, graphicsQuality} from '#src/lib/rendering/graphicsMode.ts'
import {chooseGraphics, readStoredGraphics} from '#src/lib/rendering/graphicsPreference.ts'

import css from './style.module.sass'

export default function MenuOptions({className}: {className?: string}) {
  const sound = useGallery(s => s.sound)
  // The menu remounts on pause. Show what will load next, not necessarily what this page is rendering.
  const [selected, setSelected] = useState(() => (graphicsOverride === undefined ? readStoredGraphics() : graphicsQuality))
  const toggleGraphics = () => {
    const next = selected === 'fast' ? 'heavy' : 'fast'
    if (chooseGraphics(next)) {
      setSelected(next)
    } else {
      notify('Could not save the graphics preset in browser storage.')
    }
  }
  const graphicsHintsId = useId()
  return <div className={clsx(css.container, className)}>
    <button className={css.option} aria-label='Mute audio' aria-pressed={!sound} type='button' onClick={toggleSound}><Icon name={sound ? 'sound' : 'mute'} size={18} /><span>Audio</span><small>{sound ? 'On' : 'Muted'}</small></button>
    <button className={css.option} aria-describedby={`${graphicsHintsId}-behavior`} aria-label='Heavy graphics' aria-pressed={selected !== 'fast'} interestfor={graphicsHintsId} type='button' onClick={toggleGraphics}><Icon name='settings' size={18} /><span>Graphics</span><small>{selected === 'fast' ? 'Fast' : (selected === 'heavy' ? 'Heavy' : 'Cinematic')}</small></button>
    <GraphicsHints id={graphicsHintsId} />
  </div>
}

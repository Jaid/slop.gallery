import type {GraphicsQuality} from '#src/lib/rendering/graphicsPreference.ts'

import Branch from 'branch-component'
import clsx from 'clsx'
import {useId, useState} from 'react'

import GraphicsHints from '#component/GraphicsHints'
import Icon from '#component/Icon'
import {notify, toggleSound, useGallery} from '#src/lib/gallery.ts'
import {graphicsOverride, graphicsQuality} from '#src/lib/rendering/graphicsMode.ts'
import {chooseGraphics, readStoredGraphics} from '#src/lib/rendering/graphicsPreference.ts'

import css from './style.module.sass'

const graphicsLabels = {
  fast: 'Fast',
  heavy: 'Heavy',
  cinematic: 'Cinematic',
} as const satisfies Record<GraphicsQuality, string>

export default function MenuOptions({className}: {className?: string}) {
  const sound = useGallery(s => s.sound)
  // The menu remounts on pause. Show what will load next, not necessarily what this page is rendering.
  const [selected, setSelected] = useState(() => (graphicsOverride === undefined ? readStoredGraphics() : graphicsQuality))
  // Only a saved preset waits for a reload; on an overridden page, the button navigates at once.
  const pending = graphicsOverride === undefined && selected !== graphicsQuality
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
    <button className={css.option} aria-describedby={`${graphicsHintsId}-behavior`} aria-label='Heavy graphics' aria-pressed={selected !== 'fast'} data-pending={pending || undefined} interestfor={graphicsHintsId} type='button' onClick={toggleGraphics}><Icon name='settings' size={18} /><span>Graphics</span><small><Branch if={pending}><Icon name='reload' size={14} /></Branch>{graphicsLabels[selected]}</small></button>
    <GraphicsHints id={graphicsHintsId} current={pending ? graphicsLabels[graphicsQuality] : undefined} />
  </div>
}

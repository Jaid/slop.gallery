import type {HintContent, HintControl} from '#src/lib/interactionHint.ts'

import Branch from 'branch-component'
import clsx from 'clsx'
import {Fragment, useSyncExternalStore} from 'react'

import interactionHint from '#src/lib/interactionHint.ts'

import MouseIcon from './MouseIcon.tsx'

import css from './style.module.sass'

const controlNames: Record<HintControl, string> = {
  KeyE: 'E',
  KeyV: 'V',
  MouseLeft: 'Left mouse button',
}
/** Name of the aimed object and the controls available on it, e.g. “Knotty Prince · E Listen · V Inspect”, or only the controls for an object without a name. */
export function InteractionHintView({content, visible}: {
  content: HintContent
  visible: boolean
}) {
  return <div className={css.container} aria-hidden={!visible} data-testid='interaction-hint' data-visible={visible}>
    <Branch if={content.title}><span className={css.title}>{content.title}</span></Branch>
    {content.keys.map((key, position) => <Fragment key={key.action}>
      <Branch if={content.title || position > 0}><span className={css.separator} aria-hidden='true'>·</span></Branch>
      <span className={clsx(css.action, key.blocked && css.blocked)} title={key.blocked ? `${key.action} is not possible right now` : undefined}>
        {key.controls.map((control, index) => <Fragment key={control}><Branch if={index > 0}><span className={css.or}>/</span></Branch><Control control={control} /></Fragment>)}
        <span className={css.verb}>{key.action}</span>
      </span>
    </Fragment>)}
  </div>
}

export default function InteractionHint() {
  const {content, visible} = useSyncExternalStore(interactionHint.subscribe, interactionHint.getSnapshot, interactionHint.getSnapshot)
  if (!content) {
    return null
  }
  // Keyed by target so switching objects replays the entry animation instead of morphing the text in place.
  return <InteractionHintView key={content.id} content={content} visible={visible} />
}

function Control({control}: {control: HintControl}) {
  if (control === 'MouseLeft') {
    return <kbd className={clsx(css.key, css.mouse)} aria-label={controlNames[control]} title={controlNames[control]}><MouseIcon button='left' /></kbd>
  }
  return <kbd className={css.key}>{controlNames[control]}</kbd>
}

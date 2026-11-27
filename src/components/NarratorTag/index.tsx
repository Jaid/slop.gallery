import type {NarrationState} from 'use-narrator/core'

import Branch from 'branch-component'
import clsx from 'clsx'

import NarrationBars from '#component/NarrationBars'
import NarratorAvatar from '#component/NarratorAvatar'

import css from './style.module.sass'

export const narratorName = 'Sloperator'

type Props = Pick<NarrationState, 'instanceId' | 'source' | 'status' | 'statusEndsAt'> & {className?: string}

/** Who speaks, set into the text like a word in the dark box of the narration indicators: the avatar next to the narrator’s name on the line, and under the name the spectrum of a recording, which native speech doesn’t have. */
export default function NarratorTag({className, instanceId, source, status, statusEndsAt}: Props) {
  return <span className={clsx(css.container, className)} data-testid='narrator-tag'>
    <span className={css.name}>{narratorName}</span>
    <NarratorAvatar className={css.avatar} />
    <Branch if={source === 'audio'}><NarrationBars className={css.bars} instanceId={instanceId} status={status} statusEndsAt={statusEndsAt} /></Branch>
  </span>
}

import type {NarrationState} from 'use-narrator/core'

import Branch from 'branch-component'
import clsx from 'clsx'

import NarrationBars from '#component/NarrationBars'
import NarratorAvatar from '#component/NarratorAvatar'

import css from './style.module.sass'

export const narratorName = 'Sloperator'

type Props = Pick<NarrationState, 'instanceId' | 'source' | 'status' | 'statusEndsAt'> & {className?: string}

/** Who speaks, as a line of its own: the avatar, the narrator’s name and the spectrum of a recording, which native speech doesn’t have. */
export default function NarratorTag({className, instanceId, source, status, statusEndsAt}: Props) {
  return <div className={clsx(css.container, className)} data-testid='narrator-tag'>
    <NarratorAvatar className={css.avatar} />
    <span className={css.name}>{narratorName}</span>
    <Branch if={source === 'audio'}><NarrationBars className={css.bars} instanceId={instanceId} status={status} statusEndsAt={statusEndsAt} /></Branch>
  </div>
}

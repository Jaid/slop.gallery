import type {HeavyCapabilityHints, HeavyCapabilityVerdict} from '#src/lib/rendering/autoGraphics.ts'

import Branch from 'branch-component'
import {Suspense, use, useState} from 'react'

import Icon from '#component/Icon'
import {judgeHeavyCapability, readHeavyCapabilityHints} from '#src/lib/rendering/autoGraphics.ts'

import css from './style.module.sass'

const verdictIcons = {
  met: 'check',
  unknown: 'question',
  unmet: 'cross',
} as const satisfies Record<HeavyCapabilityVerdict, string>
const verdictLabels = {
  met: 'Met',
  unknown: 'Not reported',
  unmet: 'Not met',
} satisfies Record<HeavyCapabilityVerdict, string>
const unknown = 'unknown'
/** What `?graphics=auto` looks at, as a tooltip for the button whose `interestfor` names `id`. It only asks the GPU once it first opens and changes nothing about the graphics mode. */
export default function GraphicsHints({id}: {id: string}) {
  const [opened, setOpened] = useState(false)
  return <div
    id={id} className={css.container} popover='hint' onBeforeToggle={event => {
      if (event.newState === 'open') {
        setOpened(true)
      }
    }}
  >
    <p className={css.title}>Auto graphics</p>
    <p className={css.note}>The picked graphics apply when the page loads again.</p>
    <Branch if={opened}><Suspense fallback={<p className={css.pending}>Asking the GPU…</p>}><Checks /></Suspense></Branch>
  </div>
}

function Checks() {
  const hints = use(readHeavyCapabilityHints())
  const verdicts = judgeHeavyCapability(hints)
  const rows: Array<{
    key: keyof HeavyCapabilityHints
    label: string
    value: string
  }> = [
    {
      key: 'architecture',
      label: 'GPU family',
      value: hints.architecture || unknown,
    },
    {
      key: 'deviceMemory',
      label: 'RAM',
      value: hints.deviceMemory === undefined ? unknown : `${hints.deviceMemory}\u{202F}gb`,
    },
    {
      key: 'cpuPerformance',
      label: 'CPU tier',
      value: hints.cpuPerformance ? String(hints.cpuPerformance) : unknown,
    },
  ]
  return <dl className={css.checks}>
    {rows.map(({key, label, value}) => <div key={key} className={css.check} data-verdict={verdicts[key]}>
      <dt><span aria-label={verdictLabels[verdicts[key]]} role='img'><Icon name={verdictIcons[verdicts[key]]} size={16} /></span>{label}</dt>
      <dd>{value}</dd>
    </div>)}
  </dl>
}

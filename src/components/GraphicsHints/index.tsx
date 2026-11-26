import type {HeavyCapabilityHints, HeavyCapabilityVerdict} from '#src/lib/rendering/autoGraphics.ts'

import Branch from 'branch-component'
import {Suspense, use, useState} from 'react'

import Icon from '#component/Icon'
import {judgeHeavyCapability, readHeavyCapabilityHints} from '#src/lib/rendering/autoGraphics.ts'
import {graphicsOverride} from '#src/lib/rendering/graphicsMode.ts'

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
/** What the button does to the graphics, which `current` names while this page keeps other ones than the button shows. */
const describeBehavior = (current?: string) => {
  if (current) {
    return `Reload to switch. This page keeps ${current} graphics until then.`
  }
  return graphicsOverride === undefined ? 'Changes apply on the next reload.' : 'Changing the preset opens a new URL.'
}
/**
 * What the button whose `interestfor` names `id` does and what `?graphics=auto` looks at, as its tooltip. It only asks the GPU once it first opens and changes nothing about the graphics mode.
 * @param current the label of this page’s graphics, once the button saved others for the next reload
 */
export default function GraphicsHints({current, id}: {
  current?: string
  id: string
}) {
  const [opened, setOpened] = useState(false)
  return <div
    id={id} className={css.container} popover='hint' onBeforeToggle={event => {
      if (event.newState === 'open') {
        setOpened(true)
      }
    }}
  >
    <p id={`${id}-behavior`}>{describeBehavior(current)}</p>
    <p className={css.title}>Auto graphics</p>
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

import type {ThreeElements} from '@react-three/fiber'

import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import InteractiveObject from '#component/InteractiveObject'
import SwitchPlate, {SwitchButton} from '#component/SwitchPlate'
import {switchSoundEffects} from '#src/lib/audio/switchSoundEffects.ts'
import {playEffect} from '#src/lib/gallery.ts'
import {switchButtonY} from '#src/lib/gallery/lightSwitch.ts'

/** one of the buttons of a {@link SelectorSwitch} */
export type SelectorOption = {
  /** the color of its enameled button as packed sRGB */
  button: number
  /** short name of the option, which the interaction hint offers as the next one */
  title: string
}

/**
 * An old push-button switch with a column of enameled buttons of which one at a time is pushed in, the back of its plate on the wall at its origin: E anywhere on the plate presses the next button down, after the bottom one the top one again, which pops the pushed one out.
 * It only shows the chosen option; the owner applies it.
 */
export default function SelectorSwitch<Option extends string>({id, onChange, options, title, value, ...props}: Omit<ThreeElements['group'], 'id' | 'onChange' | 'ref'> & {
  /** its id as an interactive object */
  id: string
  onChange: (value: Option) => void
  /** its buttons by their options, from top to bottom */
  options: Readonly<Record<Option, SelectorOption>>
  /** short display name for the interaction hint */
  title: string
  /** the option whose button is pushed in */
  value: Option
}) {
  const buttons = Object.entries(options) as Array<[Option, SelectorOption]>
  const [next, nextOption] = buttons[(buttons.findIndex(([option]) => option === value) + 1) % buttons.length]
  const press = () => {
    playEffect(switchSoundEffects.selector.id)
    onChange(next)
  }
  return <InteractiveObject id={id} action={nextOption.title} title={title} onActivate={press} {...props}>
    <SwitchPlate buttons={buttons.length} />
    {buttons.map(([option, {button}], index) => <SelectorButton key={option} color={button} pressed={option === value} y={switchButtonY(index, buttons.length)} />)}
  </InteractiveObject>
}

/** An enameled button of a {@link SelectorSwitch}, `y` above the plate’s middle. */
function SelectorButton({color, pressed, y}: {
  color: number
  pressed: boolean
  y: number
}) {
  const enamel = useDisposable(useMemo(() => new MeshStandardNodeMaterial({
    color,
    roughness: 0.22,
  }), [color]))
  return <SwitchButton material={enamel} pressed={pressed} y={y} />
}

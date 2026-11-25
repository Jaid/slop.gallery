import type {ThreeElements} from '@react-three/fiber'

import useDisposable from 'disposable-lifetime/react'
import hsl from 'okhsl'
import {useMemo} from 'react'
import {MeshPhysicalNodeMaterial, MeshStandardNodeMaterial} from 'three/webgpu'

import InteractiveObject from '#component/InteractiveObject'
import SwitchPlate, {SwitchButton} from '#component/SwitchPlate'
import {switchSoundEffects} from '#src/lib/audio/switchSoundEffects.ts'
import {playEffect} from '#src/lib/gallery.ts'
import {switchButtonY} from '#src/lib/gallery/lightSwitch.ts'

/**
 * An old push-button light switch with a mother-of-pearl button that switches on above an ebony one that switches off, the back of its plate on the wall at its origin: E presses the button that stands out, which pops the other one out.
 * It only shows whether its lights are on; the owner switches them.
 */
export default function LightSwitch({id, on, onToggle, title = 'Light switch', ...props}: Omit<ThreeElements['group'], 'id' | 'ref'> & {
  /** its id as an interactive object */
  id: string
  /** whether its lights are on, which keeps the upper button pushed in and the lower one out */
  on: boolean
  onToggle: () => void
  /** short display name for the interaction hint */
  title?: string
}) {
  const pearl = useDisposable(useMemo(() => new MeshPhysicalNodeMaterial({
    color: hsl.integer(85, 35, 91.5),
    roughness: 0.2,
    iridescence: 0.7,
    iridescenceIOR: 1.45,
    iridescenceThicknessMinimum: 180,
    iridescenceThicknessMaximum: 520,
  }), []))
  const ebony = useDisposable(useMemo(() => new MeshStandardNodeMaterial({
    color: hsl.integer(61, 18, 8),
    roughness: 0.3,
  }), []))
  const press = () => {
    playEffect(on ? switchSoundEffects.lightOff.id : switchSoundEffects.lightOn.id)
    onToggle()
  }
  return <InteractiveObject id={id} action={on ? 'Switch off' : 'Switch on'} title={title} onActivate={press} {...props}>
    <SwitchPlate buttons={2} />
    <SwitchButton material={pearl} pressed={on} y={switchButtonY(0, 2)} />
    <SwitchButton material={ebony} pressed={!on} y={switchButtonY(1, 2)} />
  </InteractiveObject>
}

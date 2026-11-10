import useBodyContacts from 'rapier-body-contact/react'

import {impactSounds} from '#src/lib/audio/impactSounds.ts'

/** Sounds what orbs and loose works strike, sampling their motion around every physics step. */
export default function ImpactSounds() {
  useBodyContacts(impactSounds)
  return null
}

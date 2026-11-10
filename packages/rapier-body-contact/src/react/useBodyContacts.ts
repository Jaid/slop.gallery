import type BodyContacts from '../BodyContacts.ts'

import {useAfterPhysicsStep, useBeforePhysicsStep} from '@react-three/rapier'

/** Runs `contacts` around every step of the nearest `Physics` of @react-three/rapier while the calling component is mounted. */
export default function useBodyContacts<Tag>(contacts: BodyContacts<Tag>) {
  useBeforePhysicsStep(() => contacts.capture())
  useAfterPhysicsStep(world => contacts.collect(world))
}

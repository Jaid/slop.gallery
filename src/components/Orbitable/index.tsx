import type {OrbitSettings} from '#src/lib/camera/OrbitInspection.ts'
import type {Vec3} from '#src/lib/gallery.ts'
import type {ThreeElements} from '@react-three/fiber'
import type {RapierRigidBody} from '@react-three/rapier'
import type {RefObject} from 'react'

import {registerOrbitable} from '#src/lib/gallery/orbitables.ts'

/** Lets holding V orbit around an object that can’t be grabbed. */
export default function Orbitable({id, bodyRef, center, orbit, title, ...props}: Omit<ThreeElements['group'], 'id' | 'ref'> & {
  bodyRef?: RefObject<RapierRigidBody | null>
  /** where the orbit centers, relative to the group */
  center?: Vec3
  id: string
  orbit: OrbitSettings
  /** short display name for the interaction hint */
  title: string
}) {
  return <group
    {...props} ref={group => {
      if (group) {
        return registerOrbitable(id, {
          get body() {
            return bodyRef?.current ?? undefined
          },
          center,
          group,
          orbit,
          title,
        })
      }
    }}
  />
}

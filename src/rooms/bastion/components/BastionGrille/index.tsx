import type {Wall, WallOpening} from '#src/lib/placement/wallGeometry.ts'

import {RigidBody, TrimeshCollider} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {colliderGeometry} from '#src/lib/gallery/architecture.ts'
import gateGeometry from '#src/lib/gallery/gateGeometry.ts'

/** Iron bars standing in an opening through one of the Bastion’s straight walls, like the gate barring the connecting tunnel where it opens into the western mouth’s elbow, with the mouse hole at its foot that lets orbs through, or the window behind the suit of armor at the end of the blind branch beside the Lodge. */
export default function BastionGrille({grille, name}: {
  grille: {
    bands: ReadonlyArray<number>
    hatch?: WallOpening
    hole: WallOpening
    wall: Pick<Wall, 'center' | 'rotation'>
  }
  name: string
}) {
  const bars = useDisposable(useMemo(() => gateGeometry(grille), [grille]))
  const collision = useMemo(() => colliderGeometry(bars), [bars])
  // The apse’s wrought iron.
  const iron = useDisposable(useMemo(() => new MeshStandardNodeMaterial({
    color: '#2a2724',
    metalness: 0.75,
    roughness: 0.5,
    envMapIntensity: 0.3,
  }), []))
  return <RigidBody colliders={false} name={name} type='fixed'>
    <TrimeshCollider args={collision} />
    <mesh castShadow geometry={bars} material={iron} name={`${name}-bars`} receiveShadow />
  </RigidBody>
}

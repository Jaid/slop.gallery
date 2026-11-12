import type {Curio as CurioKind} from '#src/lib/gallery/curios/index.ts'

import {ConvexHullCollider} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'

import GrabbableProp from '#src/components/Scene/GrabbableProp.tsx'

/** A curio lying where it lies when a game begins, to pick up, carry and throw, its body a convex hull round all of its meshes that weighs as much as the curio, casting the mood of the orb it belongs to while held in the Forge. */
export default function Curio({curio}: {curio: CurioKind}) {
  const model = useDisposable(useMemo(() => curio.createModel(), [curio]))
  const collider = useMemo(() => <ConvexHullCollider args={[model.hull]} mass={curio.mass} />, [model, curio])
  return <GrabbableProp id={curio.propId} collider={collider} forgeMood={curio.mood} mass={curio.mass} orbit={{radius: curio.reach}} position={curio.position} rotation={curio.rotation} title={curio.title} type={curio.type}>
    {model.parts.map(({geometry, material, name}) => <mesh key={name} castShadow geometry={geometry} material={material} name={name} receiveShadow />)}
  </GrabbableProp>
}

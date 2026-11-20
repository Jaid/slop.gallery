import type {CurioCollider} from '#src/lib/gallery/curios/base/Curio.ts'
import type {Curio as CurioKind} from '#src/lib/gallery/curios/index.ts'

import {BallCollider, CapsuleCollider, CuboidCollider, CylinderCollider, RoundCuboidCollider, RoundCylinderCollider} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'

import GrabbableProp from '#src/components/Scene/GrabbableProp.tsx'

/** A curio lying where it lies when a game begins, to pick up, carry and throw, its body the primitives its shapes say, which weigh as much as the curio together, its spin dying down as its damping says. */
export default function Curio({curio}: {curio: CurioKind}) {
  const model = useDisposable(useMemo(() => curio.createModel(), [curio]))
  const collider = useMemo(() => curio.colliders.map((shape, index) => <Shape key={index} collider={shape} />), [curio])
  return <GrabbableProp id={curio.propId} angularDamping={curio.angularDamping} collider={collider} orbit={{radius: curio.reach}} position={curio.position} rotation={curio.rotation} title={curio.title} type={curio.type}>
    {model.parts.map(({geometry, material, name}) => <mesh key={name} castShadow geometry={geometry} material={material} name={name} receiveShadow />)}
  </GrabbableProp>
}

/** One collider of a curio’s body, as its shape says. */
function Shape({collider}: {collider: CurioCollider}) {
  const {mass, position, rotation} = collider
  const placed = {
    mass,
    position,
    rotation,
  }
  switch (collider.shape) {
    case 'ball': {
      return <BallCollider args={collider.args} {...placed} />
    }
    case 'capsule': {
      return <CapsuleCollider args={collider.args} {...placed} />
    }
    case 'cuboid': {
      return <CuboidCollider args={collider.args} {...placed} />
    }
    case 'cylinder': {
      return <CylinderCollider args={collider.args} {...placed} />
    }
    case 'roundCuboid': {
      return <RoundCuboidCollider args={collider.args} {...placed} />
    }
    case 'roundCylinder': {
      return <RoundCylinderCollider args={collider.args} {...placed} />
    }
  }
}

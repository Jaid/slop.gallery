import type LodgeMaterials from '#src/lib/materials/LodgeMaterials.ts'

import {CuboidCollider, RigidBody} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'

import lodgeInterior, {lodgeFurnitureColliders} from '#src/lib/gallery/lodgeInterior/layout.ts'
import UpholsteredSeatGeometry from '#src/lib/gallery/lodgeInterior/UpholsteredSeatGeometry.ts'

const {armchairs, rug, sofa} = lodgeInterior

/** Seating and rug of the Lodge, in the room’s frame. */
export default function LodgeFurnishings({materials}: {materials: LodgeMaterials}) {
  const sofaGeometry = useDisposable(useMemo(() => new UpholsteredSeatGeometry(sofa.seats, lodgeInterior.seatWidth), []))
  const armchairGeometry = useDisposable(useMemo(() => new UpholsteredSeatGeometry(1, lodgeInterior.seatWidth + lodgeInterior.armchairSpread), []))
  const seats = [
    {
      geometry: sofaGeometry,
      ...sofa,
    },
    ...armchairs.map(placement => ({
      geometry: armchairGeometry,
      ...placement,
    })),
  ]
  return <group name='lodge-furnishings'>
    {/* Each piece a body of its own, named after it, standing where it stands */}
    {lodgeFurnitureColliders().map(({name, position, yaw, size}) => <RigidBody key={name} colliders={false} name={name} position={position} rotation={[0, yaw, 0]} type='fixed'>
      <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} position={[0, size[1] / 2, 0]} />
    </RigidBody>)}
    <mesh material={materials.rug} name='lodge-rug' position={[rug.position[0], rug.thickness / 2, rug.position[2]]} receiveShadow>
      <boxGeometry args={[rug.size[0], rug.thickness, rug.size[1]]} />
    </mesh>
    {seats.map(({geometry, position, yaw}, index) => <group key={index} name={index ? 'lodge-armchair' : 'lodge-sofa'} position={position} rotation={[0, yaw, 0]}>
      <mesh castShadow geometry={geometry.leather} material={materials.leather} receiveShadow />
      <mesh castShadow geometry={geometry.timber} material={materials.timber} receiveShadow />
    </group>)}
  </group>
}

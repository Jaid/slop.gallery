import type {SteelTable as SteelTableLayout} from '#src/lib/gallery/steelTable.ts'

import {CuboidCollider, RigidBody} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'

import {steelTableColliders} from '#src/lib/gallery/steelTable.ts'
import SteelTableGeometry from '#src/lib/gallery/SteelTableGeometry.ts'
import BrushedMetalMaterial from '#src/lib/materials/BrushedMetalMaterial.ts'
import {studioEnvironment} from '#src/lib/materials/metal.ts'
import WroughtIronMaterial from '#src/lib/materials/WroughtIronMaterial.ts'

/** A heavy steel workshop table in the frame it stands in, its middle on the floor at the origin and running along z: a brushed steel top over a blackened iron frame. */
export default function SteelTable({name, table}: {
  name: string
  table: SteelTableLayout
}) {
  const geometry = useDisposable(useMemo(() => new SteelTableGeometry(table), [table]))
  const steel = useDisposable(useMemo(() => new BrushedMetalMaterial({environment: studioEnvironment}), []))
  const iron = useDisposable(useMemo(() => new WroughtIronMaterial, []))
  return <group name={name}>
    <RigidBody colliders={false} type='fixed'>
      {steelTableColliders(table, name).map(({center, name: part, size}, index) => <CuboidCollider key={index} args={[size[0] / 2, size[1] / 2, size[2] / 2]} name={part} position={center} />)}
    </RigidBody>
    <mesh castShadow geometry={geometry.top} material={steel} name={`${name}-top`} receiveShadow />
    <mesh castShadow geometry={geometry.frame} material={iron} name={`${name}-frame`} receiveShadow />
  </group>
}

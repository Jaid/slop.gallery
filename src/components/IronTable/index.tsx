import type {IronTable as IronTableLayout} from '#src/lib/gallery/ironTable.ts'

import {CuboidCollider, RigidBody} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'

import {ironTableColliders, ironTableFinish} from '#src/lib/gallery/ironTable.ts'
import IronTableGeometry from '#src/lib/gallery/IronTableGeometry.ts'
import SoapstoneMaterial from '#src/lib/materials/SoapstoneMaterial.ts'
import WroughtIronMaterial from '#src/lib/materials/WroughtIronMaterial.ts'

/** An iron table under a slab of soapstone in the frame it stands in, its middle on the floor at the origin, running along x with its back toward +z; the `seed` cuts its slab from another part of the block. */
export default function IronTable({name, seed, table}: {
  name: string
  seed: number
  table: IronTableLayout
}) {
  const geometry = useDisposable(useMemo(() => new IronTableGeometry(table), [table]))
  const materials = useDisposable(useMemo(() => {
    const stone = new SoapstoneMaterial({seed})
    const iron = new WroughtIronMaterial(ironTableFinish)
    return {
      stone,
      iron,
      dispose() {
        stone.dispose()
        iron.dispose()
      },
    }
  }, [seed]))
  return <group name={name}>
    <RigidBody colliders={false} type='fixed'>
      {ironTableColliders(table, name).map(({center, name: part, size}, index) => <CuboidCollider key={index} args={[size[0] / 2, size[1] / 2, size[2] / 2]} name={part} position={center} />)}
    </RigidBody>
    <mesh castShadow geometry={geometry.top} material={materials.stone} name={`${name}-top`} receiveShadow />
    <mesh castShadow geometry={geometry.frame} material={materials.iron} name={`${name}-frame`} receiveShadow />
  </group>
}

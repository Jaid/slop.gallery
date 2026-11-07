import type {PlankTable as PlankTableLayout} from '#src/lib/gallery/plankTable.ts'
import type {GrainedWoodColors} from '#src/lib/materials/GrainedWoodMaterial.ts'

import {CuboidCollider, RigidBody} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'

import {plankTableColliders} from '#src/lib/gallery/plankTable.ts'
import PlankTableGeometry from '#src/lib/gallery/PlankTableGeometry.ts'
import GrainedWoodMaterial from '#src/lib/materials/GrainedWoodMaterial.ts'

/** A table of planks in the frame it stands in, its middle on the floor at the origin and running along z, of oiled or lacquered wood, its grain drawn by the `seed`. */
export default function PlankTable({colors, name, roughness, seed, table}: {
  colors: GrainedWoodColors
  name: string
  roughness: number
  seed: number
  table: PlankTableLayout
}) {
  const geometry = useDisposable(useMemo(() => new PlankTableGeometry(table, seed), [seed, table]))
  const [dark, light] = colors.heartwood
  const wood = useDisposable(useMemo(() => new GrainedWoodMaterial({
    heartwood: [dark, light],
    latewood: colors.latewood,
  }, {roughness}), [colors.latewood, dark, light, roughness]))
  return <group name={name}>
    <RigidBody colliders={false} type='fixed'>
      {plankTableColliders(table, name).map(({center, name: part, size}, index) => <CuboidCollider key={index} args={[size[0] / 2, size[1] / 2, size[2] / 2]} name={part} position={center} />)}
    </RigidBody>
    <mesh castShadow geometry={geometry.timber} material={wood} receiveShadow />
  </group>
}

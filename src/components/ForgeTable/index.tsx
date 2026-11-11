import type {ForgeTable as ForgeTableLayout} from '#src/lib/gallery/forgeTables/index.ts'
import type {Material} from 'three/webgpu'

import {CuboidCollider, RigidBody} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'

import BrushedMetalMaterial from '#src/lib/materials/BrushedMetalMaterial.ts'
import {studioEnvironment} from '#src/lib/materials/metal.ts'
import WroughtIronMaterial from '#src/lib/materials/WroughtIronMaterial.ts'

/**
 * An industrial workshop table in The Forge: a heavy satin steel plate top over
 * a blackened hand-forged wrought-iron underframe, standing clear of the room's baseboard.
 */
export default function ForgeTable({materials: customMaterials, name, table}: {
  materials?: {
    frame: Material
    top: Material
  }
  name: string
  table: ForgeTableLayout
}) {
  const parts = useDisposable(useMemo(() => {
    const top = table.createTopGeometry()
    const frame = table.createFrameGeometry()
    return {
      frame,
      top,
      dispose() {
        top.dispose()
        frame.dispose()
      },
    }
  }, [table]))
  const materials = useDisposable(useMemo(() => {
    if (customMaterials) {
      return {
        ...customMaterials,
        dispose() {},
      }
    }
    const top = new BrushedMetalMaterial({environment: studioEnvironment})
    const frame = new WroughtIronMaterial
    return {
      frame,
      top,
      dispose() {
        top.dispose()
        frame.dispose()
      },
    }
  }, [customMaterials]))
  return <group name={name}>
    <RigidBody colliders={false} name={name} type='fixed'>
      {table.colliders.map(({center, name: colliderName, size}) => <CuboidCollider
        key={colliderName}
        args={[size[0] / 2, size[1] / 2, size[2] / 2]}
        name={colliderName}
        position={center as [number, number, number]}
      />)}
      <mesh castShadow geometry={parts.top} material={materials.top} name={`${name}-top`} receiveShadow />
      <mesh castShadow geometry={parts.frame} material={materials.frame} name={`${name}-frame`} receiveShadow />
    </RigidBody>
  </group>
}

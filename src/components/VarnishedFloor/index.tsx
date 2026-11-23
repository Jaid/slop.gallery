import type {FloorSize} from '#src/rooms/index.ts'
import type {Material, Object3D} from 'three/webgpu'

import {CuboidCollider, RigidBody} from '@react-three/rapier'
import Branch from 'branch-component'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js'
import {PlaneGeometry} from 'three/webgpu'
import {useGraphicsModeValue} from 'use-graphics-mode'

import createVarnishedWood from '#src/lib/materials/varnishedWood.ts'
import {getGraphicsProfile} from '#src/lib/rendering/graphicsMode.ts'

/** a floor over a rectangular floor plan */
export type FloorSlabProps = {
  /** the middle of the floor plan, in world meters */
  center: readonly [x: number, z: number]
  /** what its meshes’ names start with, like its room’s id */
  name: string
  size: FloorSize
}

/** how thick the slab under the floor is */
export const varnishedFloorSlab = 0.24
/** the top of the floor, a millimeter over its slab, which floors level with it share their mirror plane with */
export const varnishedFloorY = 0.001

/** A floor of the Sandbox’s rooms: a plane of the material, its UVs in world meters, with the material’s mirror if it has one, on a dark slab with its collider. */
export function FloorSlab({center: [x, z], material, name, size: [width, depth]}: FloorSlabProps & {
  material: Material & {reflectionTarget?: Object3D | null}
}) {
  const geometry = useDisposable(useMemo(() => {
    const slab = new RoundedBoxGeometry(width, varnishedFloorSlab, depth, 2, 0.035)
    const plane = new PlaneGeometry(width, depth)
    // In meters across the world; the plane’s y runs along −z once laid flat.
    const position = plane.getAttribute('position')
    const uv = plane.getAttribute('uv')
    for (let index = 0; index < uv.count; index++) {
      uv.setXY(index, x + position.getX(index), position.getY(index) - z)
    }
    return {
      slab,
      plane,
      dispose() {
        slab.dispose()
        plane.dispose()
      },
    }
  }, [depth, width, x, z]))
  const reflection = material.reflectionTarget
  return <>
    <RigidBody colliders={false} type='fixed'>
      <CuboidCollider args={[width / 2, varnishedFloorSlab / 2, depth / 2]} position={[x, -varnishedFloorSlab / 2, z]} />
    </RigidBody>
    <mesh castShadow geometry={geometry.slab} name={`${name}-floor-slab`} position={[x, -varnishedFloorSlab / 2, z]} receiveShadow>
      <meshStandardNodeMaterial color='#23201d' roughness={0.8} />
    </mesh>
    <mesh geometry={geometry.plane} material={material} name={`${name}-floor`} position={[x, varnishedFloorY, z]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
      <Branch if={reflection}><primitive object={reflection!} /></Branch>
    </mesh>
  </>
}

/** The Cell’s floor over a rectangular floor plan: the Vesper’s varnished wood, mirroring the room through a blur, on a dark slab with its collider. */
export default function VarnishedFloor(props: FloorSlabProps) {
  const {mirrorReflections, surfaceAnisotropy} = useGraphicsModeValue(getGraphicsProfile)
  const wood = useDisposable(useMemo(() => createVarnishedWood(surfaceAnisotropy, mirrorReflections), [mirrorReflections, surfaceAnisotropy]))
  return <FloorSlab {...props} material={wood.material} />
}

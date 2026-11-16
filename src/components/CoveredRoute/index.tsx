import type RoutedPassage from '#src/lib/gallery/passages/RoutedPassage.ts'
import type {Material} from 'three/webgpu'

import {CuboidCollider, RigidBody, TrimeshCollider} from '@react-three/rapier'
import Branch from 'branch-component'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {useGraphicsModeValue} from 'use-graphics-mode'

import MeshSurfaceCollider from '#component/MeshSurfaceCollider'
import PendantLamps from '#component/PendantLamps'
import {colliderGeometry} from '#src/lib/gallery/architecture.ts'
import RouteVaultGeometry from '#src/lib/gallery/passages/RouteVaultGeometry.ts'
import {routePendantMounts} from '#src/lib/gallery/pendants/mounts.ts'
import {passageLantern, passageLanternGlow} from '#src/lib/gallery/pendants/passageLantern.ts'
import {getGraphicsProfile} from '#src/lib/rendering/graphicsMode.ts'

/** A stone-vaulted passage along a winding route, its paving and vault swept along it, with lanterns hung from the vault at the given distances along the route. Their lamps belong to the room, see its `lamps.ts`. Its drains’ grates and sumps are the room’s to build. The vault draws at the graphics mode’s curve detail, while its colliders always take the canonical sweep, so the physics never depends on the mode. */
export default function CoveredRoute({passage, material, lanterns}: {
  lanterns: ReadonlyArray<number>
  material: Material
  passage: RoutedPassage
}) {
  const {curveDetail} = useGraphicsModeValue(getGraphicsProfile)
  const geometry = useDisposable(useMemo(() => new RouteVaultGeometry(passage, curveDetail), [curveDetail, passage]))
  const mounts = useMemo(() => routePendantMounts(passage, [geometry.shell, geometry.ribs], lanterns), [geometry, lanterns, passage])
  const paving = colliderGeometry(geometry.pavingCollision)
  const box = geometry.pavingBox
  const collision = [geometry.shellCollision, geometry.ribsCollision].map(colliderGeometry)
  return <group name={passage.name}>
    <RigidBody colliders={false} type='fixed'>
      {/* Welded, so orbs roll on across its facets round the turns instead of catching on their edges */}
      <Branch if={passage.fixPavingEdges} else={<TrimeshCollider args={paving} />}><MeshSurfaceCollider args={paving} /></Branch>
      <Branch if={box}><CuboidCollider args={box?.halfSize ?? [0, 0, 0]} position={box?.position} rotation={[0, box?.rotation ?? 0, 0]} /></Branch>
      {collision.map((args, i) => <TrimeshCollider key={i} args={args} />)}
      <mesh castShadow geometry={geometry.paving} material={material} name='castle-paving' receiveShadow />
      <mesh castShadow geometry={geometry.shell} material={material} name='castle-barrel-vault' receiveShadow />
      <mesh castShadow geometry={geometry.ribs} material={material} name='castle-vault-ribs' receiveShadow />
    </RigidBody>
    <PendantLamps body={passageLantern} glow={passageLanternGlow} mounts={mounts} name={`${passage.name}-pendants`} />
  </group>
}

import type RoutedPassage from '#src/lib/gallery/passages/RoutedPassage.ts'
import type {PendantMount} from '#src/lib/gallery/pendants/CeilingProbe.ts'
import type {Material} from 'three/webgpu'

import {CuboidCollider, RigidBody, TrimeshCollider} from '@react-three/rapier'
import Branch from 'branch-component'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'

import MeshSurfaceCollider from '#component/MeshSurfaceCollider'
import PendantLamps from '#component/PendantLamps'
import {colliderGeometry} from '#src/lib/gallery/architecture.ts'
import RouteVaultGeometry from '#src/lib/gallery/passages/RouteVaultGeometry.ts'
import {routePendantMounts} from '#src/lib/gallery/pendants/mounts.ts'
import {passageLantern, passageLanternGlow} from '#src/lib/gallery/pendants/passageLantern.ts'
import {graphicsProfile} from '#src/lib/rendering/graphicsMode.ts'

/** A stone-vaulted passage along a winding route, its paving and vault swept along it, with lanterns hung from the vault at the given distances along the route. Their lamps belong to the room, see its `lamps.ts`. Its drains’ grates and sumps are the room’s to build. Graphics with more curve detail draw a finer vault, which neither collides nor carries the lanterns, so every graphics mode collides alike. */
export default function CoveredRoute({passage, material, lanterns, mounts: fixedMounts}: {
  lanterns?: ReadonlyArray<number>
  material: Material
  /** fixed mounts for lanterns placed off the route’s center line */
  mounts?: ReadonlyArray<PendantMount>
  passage: RoutedPassage
}) {
  const geometry = useDisposable(useMemo(() => new RouteVaultGeometry(passage), [passage]))
  const {curveDetail} = graphicsProfile
  const vault = useDisposable(useMemo(() => (curveDetail > 1 ? RouteVaultGeometry.vault(passage, curveDetail) : {
    shell: geometry.shell,
    ribs: geometry.ribs,
    // The base detail’s belong to the passage’s geometry.
    dispose() {},
  }), [curveDetail, geometry, passage]))
  const mounts = useMemo(() => fixedMounts ?? (lanterns ? routePendantMounts(passage, [geometry.shell, geometry.ribs], lanterns) : []), [fixedMounts, geometry, lanterns, passage])
  const paving = colliderGeometry(geometry.pavingCollision)
  const box = geometry.pavingBox
  const collision = [geometry.shell, geometry.ribs].map(colliderGeometry)
  return <group name={passage.name}>
    <RigidBody colliders={false} type='fixed'>
      {/* Welded, so orbs roll on across its facets round the turns instead of catching on their edges */}
      <Branch if={passage.fixPavingEdges} else={<TrimeshCollider args={paving} />}><MeshSurfaceCollider args={paving} /></Branch>
      <Branch if={box}><CuboidCollider args={box?.halfSize ?? [0, 0, 0]} position={box?.position} rotation={[0, box?.rotation ?? 0, 0]} /></Branch>
      {collision.map((args, i) => <TrimeshCollider key={i} args={args} />)}
      <mesh castShadow geometry={geometry.paving} material={material} name='castle-paving' receiveShadow />
      <mesh castShadow geometry={vault.shell} material={material} name='castle-barrel-vault' receiveShadow />
      <mesh castShadow geometry={vault.ribs} material={material} name='castle-vault-ribs' receiveShadow />
    </RigidBody>
    <Branch if={mounts.length > 0}><PendantLamps body={passageLantern} glow={passageLanternGlow} mounts={mounts} name={`${passage.name}-pendants`} /></Branch>
  </group>
}

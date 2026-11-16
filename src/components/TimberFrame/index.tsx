import type TimberGeometry from '#src/lib/gallery/passages/TimberGeometry.ts'
import type {Material} from 'three/webgpu'

import {TrimeshCollider} from '@react-three/rapier'
import Branch from 'branch-component'

import {colliderGeometry} from '#src/lib/gallery/architecture.ts'

/** The enclosing fixed body and geometry ownership belong to the passage or stair flight. */
export default function TimberFrame({geometry, material, lining}: {
  geometry: TimberGeometry
  lining: Material
  material: Material
}) {
  // A lining of open elbows alone has no planks or ribs to draw or collide with.
  const collision = [geometry.shell, geometry.ribs].filter(part => part.hasAttribute('position')).map(colliderGeometry)
  return <>
    {collision.map((args, i) => <TrimeshCollider key={i} args={args} />)}
    <Branch if={geometry.shell.hasAttribute('position')}><mesh castShadow geometry={geometry.shell} material={lining} name='timber-plank-shell' receiveShadow /></Branch>
    <Branch if={geometry.ribs.hasAttribute('position')}><mesh castShadow geometry={geometry.ribs} material={material} name='timber-faceted-portals' receiveShadow /></Branch>
  </>
}

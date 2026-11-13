import type {LobbyWindow as Glazing} from '#src/lib/gallery/lobbyWindows.ts'
import type {Material} from 'three/webgpu'

import {CuboidCollider, RigidBody} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {BoxGeometry, Matrix4, Quaternion, Vector3} from 'three/webgpu'

import {refractingPaneRef} from '#src/lib/rendering/refractingPanes.ts'

// The cast glass relieves the faces normal to its local y and lays its joints out in local x and z, measured from the local origin.
// Standing it up: local x runs north to south along the wall, local y crosses the wall eastward and local z rises.
const basis = new Matrix4
basis.makeBasis(new Vector3(0, 0, 1), new Vector3(1, 0, 0), new Vector3(0, 1, 0))
const upright = new Quaternion
upright.setFromRotationMatrix(basis)
/** Orbs and Knots behind the pane draw before it, so it bends them along with the room. */
const paneRef = refractingPaneRef([0, 1, 0])

/** A glass wall between the Lobby extension and the room beside it, the Salon or the Forge, filling the openings both walls leave for it. */
export default function LobbyWindow({glass, glazing, name}: {
  glass: Material
  glazing: Glazing
  name: string
}) {
  const {bottom, thickness, top, width, x, z} = glazing
  const height = top - bottom
  // The origin sits in the pane's lower north corner, so whole pavers fill it from edge to edge, on the floor window's joints.
  const geometry = useDisposable(useMemo(() => {
    const pane = new BoxGeometry(width, thickness, height)
    return pane.translate(width / 2, 0, height / 2)
  }, [height, thickness, width]))
  return <group name={name}>
    <RigidBody colliders={false} type='fixed'>
      <CuboidCollider args={[thickness / 2, height / 2, width / 2]} position={[x, bottom + height / 2, z]} />
    </RigidBody>
    <mesh geometry={geometry} material={glass} name={`${name}-glass`} position={[x, bottom, z - width / 2]} quaternion={upright} renderOrder={-1} ref={paneRef} />
  </group>
}

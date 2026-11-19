import type {Vec3} from '../../src/lib/gallery/types.ts'
import type {GalleryRoomId} from '../../src/worlds/gallery/index.ts'
import type {Camera} from 'three/webgpu'

import {afterEach, expect, test} from 'bun:test'

import {createRoot} from '@react-three/fiber'
import {act} from 'react'
import {BoxGeometry, Group, Mesh, MeshBasicNodeMaterial, PerspectiveCamera} from 'three/webgpu'

import RoomCulling from '../../src/components/RoomCulling/index.tsx'
import {useGallery} from '../../src/lib/gallery.ts'
import lobbyLayout from '../../src/lib/gallery/lobby.ts'
import {GalleryRenderer} from '../../src/lib/rendering/GalleryRenderer.ts'

const box = new BoxGeometry
const material = new MeshBasicNodeMaterial
const unmounts: Array<() => Promise<void>> = []
const initiallyReady = useGallery.getState().ready
afterEach(async () => {
  for (const unmount of unmounts.splice(0)) {
    await unmount()
  }
  useGallery.setState({ready: initiallyReady})
})
/** a mesh owned by the room at the position, which skips frustum culling like GPU-driven spray unless `culled` */
const roomMesh = (room: GalleryRoomId, position: Vec3, culled: boolean) => {
  const owner = new Group
  owner.userData.room = room
  const mesh = new Mesh(box, material)
  mesh.position.set(...position)
  mesh.frustumCulled = culled
  owner.add(mesh)
  return {
    mesh,
    owner,
  }
}
/** Mounts RoomCulling with the owners in real Fiber and React lifecycles on a renderer without a GPU, and returns the renderer and how to cull for a camera. */
const mount = async (owners: Array<Group>) => {
  const previousActEnvironment = Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT')
  Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true})
  const canvas = {
    width: 100,
    height: 100,
    style: {},
    ownerDocument: {},
  } as unknown as HTMLCanvasElement
  const renderer = new GalleryRenderer({canvas})
  renderer.hasInitialized = () => true
  // Fiber’s XR wiring clears the animation loop, which would otherwise initialize a real backend.
  renderer.setAnimationLoop = () => Promise.resolve()
  renderer.render = () => {}
  const root = createRoot(canvas)
  unmounts.push(async () => {
    await act(async () => root.unmount())
    ;(renderer as unknown as {untrackLoading: () => void}).untrackLoading()
    if (previousActEnvironment) {
      Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', previousActEnvironment)
    } else {
      Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT')
    }
  })
  await root.configure({
    renderer: () => renderer,
    frameloop: 'never',
    size: {
      width: 100,
      height: 100,
      top: 0,
      left: 0,
    },
  })
  await act(async () => {
    root.render(<>
      {owners.map(owner => <primitive key={owner.uuid} object={owner} />)}
      <RoomCulling />
    </>)
  })
  return {
    cull: (position: Vec3, target: Vec3) => {
      const camera = new PerspectiveCamera(62, 16 / 9, 0.05, 90)
      camera.position.set(...position)
      camera.lookAt(...target)
      camera.updateMatrixWorld()
      // The renderer brings the scene’s matrices up to date before it culls a frame.
      for (const owner of owners) {
        owner.updateMatrixWorld()
      }
      ;(renderer as unknown as {culler: (camera: Camera) => void}).culler(camera)
    },
    renderer,
  }
}
test('a room out of sight drops out with the objects that skip frustum culling, like the Lobby fountain’s spray', async () => {
  useGallery.setState({ready: true})
  const spray = roomMesh('lobby', [0, 2, -12], false)
  const pool = roomMesh('lobby', [0, 0.5, -12], true)
  const own = roomMesh('vesper', [-18, 1, 0], false)
  const {cull, renderer} = await mount([spray.owner, pool.owner, own.owner])
  // Facing the Vesper’s blank west wall, as the room-visibility test does.
  cull([-14, 1.6, 0], [-20, 1.6, 0])
  expect(renderer.hidden.has(pool.mesh)).toBe(true)
  expect(renderer.hidden.has(spray.mesh)).toBe(true)
  expect(renderer.hidden.has(own.mesh)).toBe(false)
})
test('objects that skip frustum culling show wherever their room shows through an opening, since their bounds don’t cover what they draw', async () => {
  useGallery.setState({ready: true})
  // Both lie behind the camera, outside the part of the screen the Lobby’s side door covers.
  const spray = roomMesh('lobby', [-20, 1.6, lobbyLayout.sideDoorZ], false)
  const pool = roomMesh('lobby', [-20, 1.6, lobbyLayout.sideDoorZ], true)
  const {cull, renderer} = await mount([spray.owner, pool.owner])
  cull([-14, 1.6, lobbyLayout.sideDoorZ], [14, 1.6, lobbyLayout.sideDoorZ])
  expect(renderer.hiddenFromView.has(pool.mesh)).toBe(true)
  expect(renderer.hidden.has(spray.mesh)).toBe(false)
  expect(renderer.hiddenFromView.has(spray.mesh)).toBe(false)
})
test('behind the loading screen, every room but the camera’s drops out, objects that skip frustum culling included', async () => {
  useGallery.setState({ready: false})
  const spray = roomMesh('lobby', [0, 2, -12], false)
  const {cull, renderer} = await mount([spray.owner])
  cull([-14, 1.6, lobbyLayout.sideDoorZ], [14, 1.6, lobbyLayout.sideDoorZ])
  expect(renderer.hidden.has(spray.mesh)).toBe(true)
})
